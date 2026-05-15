import { Elysia } from "elysia";

import { adminCommentsModule } from "./comments";
import { adminContentModule } from "./content";
import { adminMediaModule } from "./media";
import { setupModule } from "./setup";
import { adminUsersModule } from "./users";

export const adminModule = new Elysia({ prefix: "/api/admin" })
  .use(setupModule)
  .use(adminUsersModule)
  .use(adminContentModule)
  .use(adminCommentsModule)
  .use(adminMediaModule)
  .get("/status", () => ({
    ok: true,
    scope: "admin",
  }));
