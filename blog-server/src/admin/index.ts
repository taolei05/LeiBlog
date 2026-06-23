import { Elysia } from "elysia";

import { adminBackupModule } from "./backup";
import { adminCommentsModule } from "./comments";
import { adminContentModule } from "./content";
import { adminDashboardModule } from "./dashboard";
import { adminMediaModule } from "./media";
import { adminNavigationModule } from "./navigation";
import { setupModule } from "./setup";
import { adminSystemModule } from "./system";
import { adminUsersModule } from "./users";

export const adminModule = new Elysia({ prefix: "/api/admin" })
  .use(setupModule)
  .use(adminUsersModule)
  .use(adminDashboardModule)
  .use(adminContentModule)
  .use(adminCommentsModule)
  .use(adminMediaModule)
  .use(adminNavigationModule)
  .use(adminSystemModule)
  .use(adminBackupModule)
  .get("/status", () => ({
    ok: true,
    scope: "admin",
  }));
