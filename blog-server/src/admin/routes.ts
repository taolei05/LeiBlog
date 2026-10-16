import { Elysia } from "elysia";

import { adminAuthRoutes } from "./auth/routes";
import { adminBackupRoutes } from "./backup/routes";
import { adminCommentsRoutes } from "./comments/routes";
import { adminContentRoutes } from "./content/routes";
import { adminMediaRoutes } from "./media/routes";
import { adminNavigationRoutes } from "./navigation/routes";
import { adminSettingsRoutes } from "./settings/routes";
import { adminSetupRoutes } from "./setup/routes";
import { adminUsersRoutes } from "./users/routes";
import { adminSubscriptionRoutes } from "./subscriptions/routes";

export const adminRoutes = new Elysia()
  .use(adminSetupRoutes)
  .use(adminAuthRoutes)
  .use(adminSettingsRoutes)
  .use(adminUsersRoutes)
  .use(adminContentRoutes)
  .use(adminCommentsRoutes)
  .use(adminMediaRoutes)
  .use(adminNavigationRoutes)
  .use(adminBackupRoutes)
  .use(adminSubscriptionRoutes);
