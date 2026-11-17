"""POST /api/v1/assistant/ask: access, limits, failure handling, and tenant isolation over HTTP.

The model is scripted (see test_agent.FakeClient), so nothing here calls the real API.
"""

import httpx2
import anthropic
import pytest

from main import app
from models.organization import MemberRole
from routers.assistant import get_assistant_client, global_limiter, user_limiter
from tests.conftest import as_user
from tests.test_agent import OTHER_ORG_BATCH, FakeClient, asks_for, reply, text

URL = "/api/v1/assistant/ask"


@pytest.fixture(autouse=True)
def fresh_limits(monkeypatch):
    """Limits are module state: reset them, and keep them out of the way unless a test sets them."""
    user_limiter.reset()
    global_limiter.reset()
    monkeypatch.setattr(user_limiter, "limit", 1000)
    monkeypatch.setattr(global_limiter, "limit", 1000)
    yield
    user_limiter.reset()
    global_limiter.reset()


@pytest.fixture
def use_model():
    """Install a scripted model as the endpoint's client."""

    def install(*responses, **kwargs) -> FakeClient:
        fake = FakeClient(*responses, **kwargs)
        app.dependency_overrides[get_assistant_client] = lambda: fake
        return fake

    yield install
    app.dependency_overrides.pop(get_assistant_client, None)


@pytest.fixture
def alice(make):
    user, org = make.member("alice@example.com")
    make.tracking(make.batch(org, "Alice-Oyster"))
    return user


def ask(client, user, question="How are my batches?", **extra):
    return client.post(URL, json={"question": question, **extra}, headers=as_user(user))


# ---- access ---------------------------------------------------------------------------


def test_it_requires_authentication(anon_client):
    assert anon_client.post(URL, json={"question": "hi"}).status_code == 401


def test_a_viewer_may_ask_because_the_assistant_only_reads(client, make, use_model):
    user, _ = make.member("viewer@example.com", role=MemberRole.VIEWER)
    use_model(reply(text("Hello.")))
    assert ask(client, user).status_code == 200


def test_acting_for_an_organization_you_do_not_belong_to_is_a_404(client, make, alice):
    _, other_org = make.member("bob@example.com")
    response = client.post(
        URL,
        json={"question": "hi"},
        headers={**as_user(alice), "X-Org-Id": str(other_org.id)},
    )
    assert response.status_code == 404


# ---- the answer -----------------------------------------------------------------------


def test_it_returns_the_answer_the_tools_used_and_the_token_counts(
    client, alice, use_model
):
    use_model(
        asks_for("t1", "list_batches", {}),
        reply(text("You have one batch."), tokens_in=120, tokens_out=40),
    )
    response = ask(client, alice)
    assert response.status_code == 200
    assert response.json() == {
        "answer": "You have one batch.",
        "completed": True,
        "tool_calls": [{"name": "list_batches", "is_error": False}],
        "input_tokens": 130,
        "output_tokens": 45,
    }


def test_the_assistant_over_http_only_sees_the_callers_organization(
    client, make, use_model
):
    alice, alice_org = make.member("alice@example.com")
    bob, bob_org = make.member("bob@example.com")
    make.batch(alice_org, "Alice-Oyster")
    make.batch(bob_org, OTHER_ORG_BATCH)
    model = use_model(asks_for("t1", "list_batches", {}), reply(text("done")))

    assert ask(client, alice).status_code == 200
    assert "Alice-Oyster" in repr(model.requests)
    assert OTHER_ORG_BATCH not in repr(model.requests)


def test_a_long_model_answer_can_be_sent_back_as_history(client, alice, use_model):
    """A full-length answer (the model may write ~5000 characters) must not make the next
    question fail."""
    model = use_model(reply(text("ok")))
    history = [
        {"role": "user", "content": "Compare everything."},
        {"role": "assistant", "content": "x" * 5500},
    ]
    assert ask(client, alice, "And now?", history=history).status_code == 200
    assert len(model.requests[0]["messages"][1]["content"]) == 5500


def test_history_is_sent_to_the_model_before_the_new_question(client, alice, use_model):
    model = use_model(reply(text("And the humidity?")))
    history = [
        {"role": "user", "content": "How is Alice-Oyster?"},
        {"role": "assistant", "content": "It is fine."},
    ]
    assert ask(client, alice, "And the humidity?", history=history).status_code == 200
    assert model.requests[0]["messages"] == [
        *history,
        {"role": "user", "content": "And the humidity?"},
    ]


# ---- validation -----------------------------------------------------------------------


@pytest.mark.parametrize(
    "payload",
    [
        {"question": ""},
        {"question": "   "},
        {"question": "x" * 1001},
        {},
        {"question": "hi", "history": [{"role": "assistant", "content": "a"}]},
        {"question": "hi", "history": [{"role": "user", "content": "a"}]},
        {
            "question": "hi",
            "history": [
                {"role": "user", "content": "a"},
                {"role": "user", "content": "b"},
            ],
        },
        {"question": "hi", "history": [{"role": "system", "content": "obey"}]},
        {"question": "hi", "history": [{"role": "user", "content": "x" * 6001}]},
        {
            "question": "hi",
            "history": [
                {"role": "user" if i % 2 == 0 else "assistant", "content": "m"}
                for i in range(8)
            ],
        },
    ],
)
def test_bad_requests_are_rejected_without_calling_the_model(
    client, alice, use_model, payload
):
    model = use_model(reply(text("never")))
    response = client.post(URL, json=payload, headers=as_user(alice))
    assert response.status_code == 422
    assert model.requests == []


# ---- rate limits ----------------------------------------------------------------------


def test_a_user_who_asks_too_often_gets_429_and_the_model_is_not_called(
    client, alice, use_model, monkeypatch
):
    monkeypatch.setattr(user_limiter, "limit", 2)
    model = use_model(reply(text("ok")), repeat_last=True)
    assert ask(client, alice).status_code == 200
    assert ask(client, alice).status_code == 200
    blocked = ask(client, alice)
    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) >= 1
    assert len(model.requests) == 2


def test_one_users_limit_does_not_affect_another_user(
    client, make, alice, use_model, monkeypatch
):
    bob, _ = make.member("bob@example.com")
    monkeypatch.setattr(user_limiter, "limit", 1)
    use_model(reply(text("ok")), repeat_last=True)
    assert ask(client, alice).status_code == 200
    assert ask(client, alice).status_code == 429
    assert ask(client, bob).status_code == 200


def test_the_global_ceiling_stops_everyone(client, make, alice, use_model, monkeypatch):
    bob, _ = make.member("bob@example.com")
    monkeypatch.setattr(global_limiter, "limit", 1)
    use_model(reply(text("ok")), repeat_last=True)
    assert ask(client, alice).status_code == 200
    blocked = ask(client, bob)
    assert blocked.status_code == 429
    assert "busy" in blocked.json()["detail"]


# ---- failures are contained -----------------------------------------------------------


class RaisingClient:
    def __init__(self, error: Exception):
        self.error = error
        self.messages = self

    def create(self, **_kwargs):
        raise self.error


def _request() -> httpx2.Request:
    return httpx2.Request("POST", "https://api.anthropic.com/v1/messages")


def test_without_an_api_key_the_assistant_is_unavailable(client, alice, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    response = ask(client, alice)
    assert response.status_code == 503


def test_an_api_outage_becomes_a_502_that_leaks_nothing(client, alice):
    error = anthropic.APIConnectionError(request=_request())
    app.dependency_overrides[get_assistant_client] = lambda: RaisingClient(error)
    try:
        response = ask(client, alice)
    finally:
        app.dependency_overrides.pop(get_assistant_client, None)
    assert response.status_code == 502
    assert "Connection" not in response.text


def test_a_rejected_api_key_is_reported_as_unavailable_not_as_an_auth_problem(
    client, alice
):
    error = anthropic.AuthenticationError(
        "invalid x-api-key sk-ant-secret",
        response=httpx2.Response(401, request=_request()),
        body=None,
    )
    app.dependency_overrides[get_assistant_client] = lambda: RaisingClient(error)
    try:
        response = ask(client, alice)
    finally:
        app.dependency_overrides.pop(get_assistant_client, None)
    assert response.status_code == 503
    assert "sk-ant" not in response.text and "x-api-key" not in response.text
