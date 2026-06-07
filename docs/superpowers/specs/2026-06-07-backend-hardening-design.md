# LeiBlog Backend Hardening Design

## Goal

Harden the Elysia backend against setup takeover, spoofed client identity, sensitive
error disclosure, abusive requests, and inconsistent authorization while improving
the API contract, health endpoints, and shutdown behavior.

## Security Boundaries

### Initial setup

- `SETUP_TOKEN` is required in production and optional outside production.
- Before an administrator exists, setup uploads and administrator creation require
  `X-Setup-Token` when `SETUP_TOKEN` is configured.
- Administrator creation is only valid while the setup step is `admin`; it can
  never update an existing administrator.
- After administrator creation, the client logs in immediately. All remaining
  setup writes require an administrator bearer token.
- Setup write endpoints are rate limited.

### Client identity

- The direct socket address is authoritative by default.
- `X-Forwarded-For` and `X-Real-IP` are considered only when the direct socket
  address appears in `TRUSTED_PROXY_IPS`.
- Request metadata is derived once by an Elysia plugin and reused by routes.

### Authentication and authorization

- Elysia macros expose route-level `auth: true` and `admin: true` policies.
- Admin routes apply the administrator policy at the controller boundary.
- Services retain `requireAdmin` checks as defense in depth.

### Rate limiting

- Existing authentication limits remain unchanged.
- Limits are added to email-change codes, API-key reveal codes, comments, uploads,
  and setup writes.
- Redis failures continue to fail open and log the failure.

## API Contract

- Production validation and parse responses never include raw Elysia error details.
- Shared error schemas describe `401`, `403`, `404`, `409`, `422`, and `429`
  responses in OpenAPI.
- Query parameters use Elysia numeric and boolean schemas so invalid values receive
  `422` instead of silently falling back.
- Production CORS requires explicit origins.
- Production OpenAPI is disabled unless `OPENAPI_ENABLED=true`.
- CORS exposes `Retry-After`.

## Operations

- `/api/health/live` reports process liveness without dependency checks.
- `/api/health/ready` checks PostgreSQL and Redis and returns `503` when unavailable.
- `SIGINT` and `SIGTERM` stop the Elysia server and close PostgreSQL and Redis.
- Dependency versions use explicit ranges rather than `latest`.

## Testing

- Unit tests cover trusted proxy handling, setup state transitions, macro policies,
  query conversion, validation redaction, and configuration requirements.
- HTTP integration tests cover setup authorization, rate limits, OpenAPI/CORS
  production behavior, shared error responses, and health endpoints.
- Final verification runs backend type checking and all backend tests, frontend
  tests, and the frontend production build.
