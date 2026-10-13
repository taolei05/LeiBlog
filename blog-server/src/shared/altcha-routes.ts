import { Elysia } from "elysia";

import { createAltchaChallenge } from "./altcha";

export const altchaRoutes = new Elysia({ prefix: "/api/altcha" }).get("/challenge", () =>
  createAltchaChallenge(),
);
