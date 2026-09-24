import { Elysia } from "elysia";

import { adminAuthRoutes } from "./auth/routes";
import { adminSettingsRoutes } from "./settings/routes";
import { adminSetupRoutes } from "./setup/routes";
import { adminUsersRoutes } from "./users/routes";

export const adminRoutes = new Elysia()
  .use(adminSetupRoutes)
  .use(adminAuthRoutes)
  .use(adminSettingsRoutes)
  .use(adminUsersRoutes);
