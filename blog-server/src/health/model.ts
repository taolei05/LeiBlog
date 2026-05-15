import { t } from "elysia";

export const HealthResponse = t.Object({
  ok: t.Boolean(),
  name: t.String(),
  env: t.String(),
  time: t.String(),
  uptime: t.Number(),
});

export const LiveHealthResponse = t.Object({
  ok: t.Boolean(),
  checks: t.Object({
    database: t.Boolean(),
    redis: t.Boolean(),
  }),
  time: t.String(),
});
