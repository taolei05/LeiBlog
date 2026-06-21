import { Elysia } from "elysia";

import { DashboardOverviewResponse } from "./model";
import { getAdminDashboardOverview } from "./service";
import { adminContext } from "../../shared/auth/plugin";
import { requestContext } from "../../shared/http/plugin";

export const adminDashboardModule = new Elysia({ prefix: "/dashboard" })
  .use(requestContext)
  .use(adminContext)
  .get("/overview", ({ currentUser }) => getAdminDashboardOverview(currentUser), {
    response: { 200: DashboardOverviewResponse },
  });
