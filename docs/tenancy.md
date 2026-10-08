# Multi-tenancy and roles

Every piece of data belongs to an **organization**. A request only ever sees, and can only
change, data in the organization it acts on.

```
users ──< memberships >── organizations ──< batches ──< trackings
            (role)                                  └──< alerts
```

- `organizations`: the tenant boundary (`name`, unique `slug`).
- `memberships`: a user's `role` in an organization; one row per (user, organization).
- `batches.organization_id` (NOT NULL). Trackings and alerts have no column of their own:
  they are scoped through their batch, so a tracking can never end up in a different
  organization than its batch.
- Batch names are unique **per organization**, not globally.

## Roles

| Role | Read | Create / edit batches, trackings; acknowledge or delete alerts |
| --- | --- | --- |
| `VIEWER` | yes | no (403) |
| `MEMBER` | yes | yes |
| `ADMIN` | yes | yes (member and invitation management will require this, #71) |
| `OWNER` | yes | yes |

## How a request is scoped (`backend/auth/tenancy.py`)

1. `get_current_user` validates the Auth0 token and loads the user.
2. `get_org_context` picks the organization: the one in the `X-Org-Id` header if the user is
   a member (otherwise **404**), else their oldest membership.
3. `read_access` / `write_access` / `admin_access` enforce the minimum role. Every router
   has `read_access` as a floor, so a new endpoint cannot be accidentally unauthenticated.
4. Handlers filter by `ctx.organization.id`.

**Anything in another organization is a 404, never a 403**, so the API does not reveal that
a batch, tracking or alert exists.

## First login

When a new Auth0 user is seen for the first time, the user, a personal organization
(`"<name>'s Farm"`) and an `OWNER` membership are created in one transaction. If two first
requests race, the loser rolls back and reuses the winner's rows (tested with 8 concurrent
logins against Postgres).

An account created before multi-tenancy that has no membership gets a personal organization
on its next request.

## The migration (`c3a9e5d7b1f2`)

Existing batches are moved into an organization called **Legacy**, owned by the earliest
user. On a fresh database no Legacy organization is created. `downgrade` restores the global
unique batch name and fails if two organizations now share a name.

## Not built yet

- Inviting people into an organization and changing roles (#71), so today every user is the
  `OWNER` of their own organization and the `VIEWER`/`MEMBER`/`ADMIN` paths are exercised by
  tests only.
- An organization switcher in the UI. The API already supports `X-Org-Id`.
