import { Elysia } from "elysia";

import { adminAuthRoutes } from "./auth/routes";
import { adminSettingsRoutes } from "./settings/routes";
import { adminSetupRoutes } from "./setup/routes";

export const adminRoutes = new Elysia()
  .use(adminSetupRoutes)
  .use(adminAuthRoutes)
  .use(adminSettingsRoutes);
