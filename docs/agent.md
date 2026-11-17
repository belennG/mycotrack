# The MycoTrack assistant

A small agent that answers questions about a grower's own batches and readings
("how is Oyster-01 doing?", "which batches are outside the safe ranges?").

It is built **from scratch** on the Anthropic Python SDK: no agent framework, so every step is visible.
The code is in [`backend/agent/`](../backend/agent).

> **Status:** the core (tools, loop, safeguards, tests) and the API endpoint are done, and the
> agent has been run against the real model (`backend/scripts/try_agent.py`). The chat panel and
> the demo-mode replay are next.

## Is it really an agent?

Yes, a deliberately small one. An agent is a model that decides which tool to call and when to
stop; the loop is the code that makes that possible. A fixed pipeline ("always call A, then B")
would be a workflow, not an agent. Here the model chooses, and our code bounds it.

```
question → model → "call get_batch_summary(id)" → our code runs it → result → model → … → answer
```

The model never touches the database. It asks; our code decides whether and how to run it.

## What it can do

Three read-only tools, in [`agent/tools.py`](../backend/agent/tools.py):

| Tool | Returns |
| --- | --- |
| `list_batches` | The organization's batches, with each one's latest reading |
| `get_batch_summary` | One batch: averages, trends, whether the latest reading is out of range |
| `get_recent_readings` | The newest readings of one batch (at most 20) |

## How it is kept safe

The system prompt asks the model to behave, but **it is not the defense**: the guarantees come from
the design, and each one has a test (`backend/tests/test_agent.py`), which was checked by breaking the
safeguard on purpose and watching the right test fail.

- **The model never chooses the tenant.** No tool takes an organization id. Every query is filtered
  by the organization the server resolved from the authenticated user, and inventing an
  `organization_id` is rejected, not ignored.
- **Other organizations' data looks like nothing.** A batch in another organization returns the same
  "not found" as one that does not exist, exactly like the REST API.
- **Prompt injection is contained, not "solved".** Batch names and notes are free text that the agent
  reads, so someone could write "ignore your instructions and…" in a note. Layers, strongest first:
  1. the tools are read-only and tenant-bound, so a tricked model still cannot cross or change anything;
  2. no tool can send data anywhere;
  3. user-written text has `<` and `>` escaped (it cannot fake or close a delimiter), is length-capped,
     and notes are wrapped in `<user_note>` tags that the system prompt declares to be data;
  4. hard limits: 6 model calls per question, 1024 tokens per call, 1000-character questions,
     6000-character tool results.
  The tests play a **compromised model** that obeys an injected instruction and check it still cannot
  read another organization or write anything.
- **Writes, when added, need a person.** The model will only be able to *propose* a change; a separate
  endpoint, called by a button the user presses, executes it with the normal role checks.
- **Tools never crash the loop.** Every failure becomes an error the model can read; internal details
  are logged, never shown.

## The endpoint

`POST /api/v1/assistant/ask` with `{"question": "...", "history": [...]}` returns the answer, the
names of the tools used, and the token counts ([`routers/assistant.py`](../backend/routers/assistant.py)).

- **Who:** any signed-in member of the organization, including viewers (the assistant only reads).
  Acting for an organization you do not belong to is a 404, like every other route.
- **Conversation:** the server keeps no state. The client sends back up to 6 earlier messages
  (at most 2000 characters each, strictly alternating user/assistant). History is untrusted input
  like everything else: it is plain text turns, and the tools stay bound to the tenant whatever it says.
- **Limits:** 20 questions per user per hour and 500 per day across everyone (both configurable with
  `ASSISTANT_USER_LIMIT_PER_HOUR` and `ASSISTANT_GLOBAL_LIMIT_PER_DAY`). Sign-up is open, so the global
  ceiling is what caps the bill. The limiter is in memory, so it is per process and resets on restart:
  fine for one small server, to be replaced (for example with Redis) before running several.
- **Failures never explain themselves to the caller:** no key configured or a rejected key is
  a 503 "not available"; any other API failure is a 502; the cause goes to the log.
- **One thing to know:** the request holds a database session while the model answers, which can take
  seconds. Fine at this scale; it would need rethinking under real load.

## Cost

The model is Claude Haiku 5.5. Every turn of the loop re-sends the whole conversation, so a question
that uses two tools costs roughly a tenth of a cent. The real exposure is abuse of a public
endpoint, so the plan is: the live demo replays recorded answers (no API calls), real usage requires
a signed-in account, with per-user rate limits and a spend cap set in the Anthropic console.

## Not yet / next

1. The chat panel; in demo mode, replay answers recorded from real runs (no API calls), labelled as such.
2. Writing readings from natural language, with explicit confirmation.
3. Alerts: deterministic threshold and trend rules that create alerts (the `alerts` table is never
   written today); the agent would only *explain* an alert that already fired, and the code sends it.
