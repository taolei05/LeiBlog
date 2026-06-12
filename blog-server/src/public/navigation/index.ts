import { Elysia } from "elysia";

import { PublicNavigationResponse } from "./model";
import { listPublicNavigation } from "./service";

export const publicNavigationModule = new Elysia({ prefix: "/navigation" }).get(
  "/",
  () => listPublicNavigation(),
  { response: { 200: PublicNavigationResponse } }
);
