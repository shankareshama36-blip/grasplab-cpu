# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| main    | ✅        |
| < 1.0   | ❌        |

---

## Tenant Isolation

GraspLab is multi-tenant. Every table that stores user data carries a `tenant_id` column:

- `User.tenant_id`
- `Program.tenant_id`
- `Run.tenant_id`

**Rules enforced in every query:**

1. **Every** read/write is scoped to the caller's `tenant_id` — extracted from the JWT, never from the request body.
2. Cross-tenant access attempts return `404 Not Found`, never `403 Forbidden`, to avoid leaking whether a resource exists in another tenant.
3. The `get_current_user` FastAPI dependency injects the tenant-scoped user; endpoints never accept `tenant_id` as a parameter.
4. Seeded demo data uses `tenant_id = "demo-tenant"` and is fully isolated from real signups.

**Tested by:** `tests/test_tenant_isolation.py` — verifies Tenant A cannot read, update, or delete Tenant B's `Program` or `Run` rows.

---

## Authentication & Sessions

- **Password hashing:** bcrypt via `passlib[bcrypt]`. Passwords are never logged, returned, or stored in plaintext.
- **JWT:** signed with `HS256` using `JWT_SECRET` env var (min 32 chars, rotated per environment).
- **Token payload:** `sub` (user id), `tenant_id`, `role`, `exp`, `iat`. Expiry is 24h.
- **Storage:** JWT is stored in `localStorage` on the frontend. All API calls attach `Authorization: Bearer <token>`.
- **Verification:** `/auth/verify` re-checks token validity on page load; expired or tampered tokens are rejected with `401`.
- **401 handling (frontend):** any `401` response clears `localStorage` and redirects to `/login`.
- **500 handling (frontend):** shown as a toast; the token is *not* cleared (server error ≠ auth error).

---

## Rate Limiting

Auth endpoints are protected by [`slowapi`](https://github.com/laurentS/slowapi):

| Endpoint          | Limit         |
| ----------------- | ------------- |
| `/auth/login`     | 5 / minute / IP |
| `/auth/signup`    | 3 / minute / IP |
| `/auth/verify`    | 30 / minute / IP |
| All other routes  | 60 / minute / IP |

Exceeding a limit returns `429 Too Many Requests` with a `Retry-After` header.

---

## CORS

Allowed origins are strictly whitelisted via `CORS_ORIGINS` (comma-separated env var):
