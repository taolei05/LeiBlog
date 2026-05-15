import { Elysia } from "elysia";

import { HealthResponse, LiveHealthResponse } from "./model";
import { getHealth, getLiveHealth } from "./service";

export const healthModule = new Elysia({ prefix: "/api/health" })
  .get("/", () => getHealth(), {
    response: {
      200: HealthResponse,
    },
  })
  .get("/live", async ({ status }) => {
    const health = await getLiveHealth();
    return status(health.ok ? 200 : 503, health);
  }, {
    response: {
      200: LiveHealthResponse,
      503: LiveHealthResponse,
    },
  });
