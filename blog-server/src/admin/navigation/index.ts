import { Elysia } from "elysia";

import { adminContext } from "../../shared/auth/plugin";
import {
  IdParams,
  NavigationGroupBody,
  NavigationGroupResponse,
  NavigationItemBody,
  NavigationItemReorderBody,
  NavigationItemResponse,
  NavigationListResponse,
  NavigationReorderBody,
  OkResponse,
} from "./model";
import {
  createNavigationGroup,
  createNavigationItem,
  deleteNavigationGroup,
  deleteNavigationItem,
  listNavigation,
  reorderNavigationGroups,
  reorderNavigationItems,
  updateNavigationGroup,
  updateNavigationItem,
} from "./service";

export const adminNavigationModule = new Elysia({ prefix: "/navigation" })
  .use(adminContext)
  .get("/", ({ currentUser }) => listNavigation(currentUser), {
    response: { 200: NavigationListResponse },
  })
  .post("/groups/reorder", ({ currentUser, body }) => reorderNavigationGroups(currentUser, body), {
    body: NavigationReorderBody,
    response: { 200: OkResponse },
  })
  .post("/groups", async ({ currentUser, body }) => ({
    item: await createNavigationGroup(currentUser, body),
    ok: true,
  }), {
    body: NavigationGroupBody,
    response: { 200: NavigationGroupResponse },
  })
  .patch("/groups/:id", async ({ currentUser, params, body }) => ({
    item: await updateNavigationGroup(currentUser, params.id, body),
    ok: true,
  }), {
    body: NavigationGroupBody,
    params: IdParams,
    response: { 200: NavigationGroupResponse },
  })
  .delete("/groups/:id", ({ currentUser, params }) => deleteNavigationGroup(currentUser, params.id), {
    params: IdParams,
    response: { 200: OkResponse },
  })
  .post("/items/reorder", ({ currentUser, body }) => reorderNavigationItems(currentUser, body), {
    body: NavigationItemReorderBody,
    response: { 200: OkResponse },
  })
  .post("/items", async ({ currentUser, body }) => ({
    item: await createNavigationItem(currentUser, body),
    ok: true,
  }), {
    body: NavigationItemBody,
    response: { 200: NavigationItemResponse },
  })
  .patch("/items/:id", async ({ currentUser, params, body }) => ({
    item: await updateNavigationItem(currentUser, params.id, body),
    ok: true,
  }), {
    body: NavigationItemBody,
    params: IdParams,
    response: { 200: NavigationItemResponse },
  })
  .delete("/items/:id", ({ currentUser, params }) => deleteNavigationItem(currentUser, params.id), {
    params: IdParams,
    response: { 200: OkResponse },
  });
