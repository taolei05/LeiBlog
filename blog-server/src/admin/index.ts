import { Elysia } from "elysia";

import { adminCommentsModule } from "./comments";
import { adminContentModule } from "./content";
import { adminMediaModule } from "./media";
import { setupModule } from "./setup";
import { adminSystemModule } from "./system";
import { adminUsersModule } from "./users";

export const adminModule = new Elysia({ prefix: "/api/admin" })
  .use(setupModule)
  .use(adminUsersModule)
  .use(adminContentModule)
  .use(adminCommentsModule)
  .use(adminMediaModule)
  .use(adminSystemModule)
  .get("/status", () => ({
    ok: true,
    scope: "admin",
  }));
