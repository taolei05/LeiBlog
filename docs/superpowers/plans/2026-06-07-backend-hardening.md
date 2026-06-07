# LeiBlog Backend Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Elysia backend security, API contract, and operational improvements without breaking the existing blog and admin flows.

**Architecture:** Introduce focused shared Elysia plugins for request metadata and route policies, keep business authorization in services as defense in depth, and move HTTP input coercion into TypeBox schemas. Secure the initial setup transition with a deployment secret before administrator creation and administrator JWT after creation.

**Tech Stack:** Bun, Elysia 1.4, TypeBox schemas, Bun SQL/PostgreSQL, Redis, React admin client, Bun test, Vitest.

---

### Task 1: Secure setup and request identity

**Files:**
- Modify: `blog-server/src/shared/config/index.ts`
- Modify: `blog-server/src/auth/service.ts`
- Modify: `blog-server/src/admin/setup/index.ts`
- Modify: `blog-server/src/admin/setup/service.ts`
- Modify: `blog-client/src/features/admin/setup/SetupPage.tsx`
- Modify: `blog-client/src/features/admin/shared/admin-api.ts`
- Test: `blog-server/tests/setup.test.ts`
- Test: `blog-server/tests/auth-users.test.ts`
- Test: `blog-server/tests/http-routes.test.ts`

- [ ] Write failing tests proving untrusted forwarded headers are ignored, production requires a setup token, repeated administrator setup is rejected, and post-admin setup writes require admin authentication.
- [ ] Run the focused tests and confirm the new assertions fail.
- [ ] Add `SETUP_TOKEN` and `TRUSTED_PROXY_IPS` configuration, enforce setup state transitions, and update the setup client to switch from the setup token to administrator JWT.
- [ ] Run the focused tests and type checks.
- [ ] Commit the completed security boundary.

### Task 2: Add Elysia request and authorization policies

**Files:**
- Create: `blog-server/src/shared/http/plugin.ts`
- Modify: `blog-server/src/shared/auth/plugin.ts`
- Modify: `blog-server/src/auth/index.ts`
- Modify: `blog-server/src/admin/index.ts`
- Modify: `blog-server/src/admin/*/index.ts`
- Modify: `blog-server/src/me/index.ts`
- Modify: `blog-server/src/public/comments/index.ts`
- Test: `blog-server/tests/http-routes.test.ts`

- [ ] Write failing route tests for request metadata reuse, authenticated policies, and administrator policies.
- [ ] Run the route tests and confirm the policy assertions fail.
- [ ] Implement Elysia macros for request metadata, authenticated users, administrators, and reusable rate limits.
- [ ] Apply policies at controller boundaries while retaining service checks.
- [ ] Run route tests and type checks.
- [ ] Commit the policy refactor.

### Task 3: Complete abuse protection

**Files:**
- Modify: `blog-server/src/auth/rate-limit.ts`
- Modify: `blog-server/src/me/index.ts`
- Modify: `blog-server/src/admin/system/index.ts`
- Modify: `blog-server/src/public/comments/index.ts`
- Modify: `blog-server/src/admin/media/index.ts`
- Modify: `blog-server/src/admin/setup/index.ts`
- Test: `blog-server/tests/http-routes.test.ts`
- Test: `blog-server/tests/rate-limit.test.ts`

- [ ] Add failing integration assertions for email-change codes, API-key reveal codes, comments, uploads, and setup writes.
- [ ] Run the focused tests and confirm the new assertions fail.
- [ ] Apply scoped Redis rate-limit rules before expensive work or side effects.
- [ ] Run the focused tests and type checks.
- [ ] Commit the completed rate limits.

### Task 4: Harden API contracts and production configuration

**Files:**
- Modify: `blog-server/src/app.ts`
- Modify: `blog-server/src/shared/config/index.ts`
- Modify: `blog-server/src/shared/errors/index.ts`
- Modify: `blog-server/src/**/model.ts`
- Modify: `blog-server/src/**/index.ts`
- Modify: `blog-server/.env.example`
- Modify: `blog-server/package.json`
- Test: `blog-server/tests/app.test.ts`
- Test: `blog-server/tests/shared.test.ts`
- Test: `blog-server/tests/http-routes.test.ts`

- [ ] Write failing tests for production validation redaction, explicit production CORS, disabled production OpenAPI, shared error schemas, and invalid numeric/boolean queries.
- [ ] Run the focused tests and confirm the new assertions fail.
- [ ] Remove raw production error details, register shared response schemas, tighten production configuration, and use Elysia numeric/boolean query schemas.
- [ ] Pin the Elysia dependency to the installed compatible range.
- [ ] Run the focused tests and type checks.
- [ ] Commit the API contract hardening.

### Task 5: Improve operational lifecycle

**Files:**
- Modify: `blog-server/src/health/index.ts`
- Modify: `blog-server/src/health/model.ts`
- Modify: `blog-server/src/health/service.ts`
- Modify: `blog-server/src/index.ts`
- Test: `blog-server/tests/app.test.ts`

- [ ] Write failing tests for separate liveness and readiness behavior.
- [ ] Run the health tests and confirm the new assertions fail.
- [ ] Split liveness from readiness and add graceful HTTP, PostgreSQL, and Redis shutdown handling.
- [ ] Run backend type checking and all backend tests.
- [ ] Run frontend tests and production build, documenting any toolchain-only failures.
- [ ] Commit and push the final hardening changes to `main`.
