import { Elysia } from "elysia";

import { HealthResponse, LiveHealthResponse, ReadyHealthResponse } from "./model";
import { getHealth, getLiveHealth, getReadyHealth } from "./service";

export const healthModule = new Elysia({ prefix: "/api/health" })
  .get("/", () => getHealth(), {
    response: {
      200: HealthResponse,
    },
  })
  .get("/live", () => getLiveHealth(), {
    response: {
      200: LiveHealthResponse,
    },
  })
  .get("/ready", async ({ status }) => {
    const health = await getReadyHealth();
    return status(health.ok ? 200 : 503, health);
  }, {
    response: {
      200: ReadyHealthResponse,
      503: ReadyHealthResponse,
    },
  });
