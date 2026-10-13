import { jwt } from "@elysiajs/jwt";
import { Elysia, status, t } from "elysia";

import { env } from "../../shared/env";
import { adminJwtSchema, extractBearerToken, isAuthJwtPayload } from "../auth/session";
import { readAdminSession } from "../auth/service";
import {
  createNavigationGroup,
  createNavigationItem,
  deleteNavigationGroup,
  deleteNavigationItem,
  listNavigation,
  NAVIGATION_FAILURE,
  NavigationError,
  reorderNavigationGroups,
  reorderNavigationItems,
  updateNavigationGroup,
  updateNavigationItem,
} from "./service";
import type { NavigationFailure } from "./service";

type AdminJwtVerifier = {
  verify: (token: string) => Promise<unknown>;
};

type ResolveAuthenticatedAdminParameters = {
  authorization?: string;
  jwt: AdminJwtVerifier;
};

const resolveAuthenticatedAdmin = async ({
  authorization,
  jwt,
}: ResolveAuthenticatedAdminParameters) => {
  const token = extractBearerToken(authorization);
  if (token === undefined) {
    return {
      ok: false as const,
      response: status(401, { message: "Missing bearer token." }),
    };
  }

  const payload = await jwt.verify(token);
  if (!isAuthJwtPayload(payload)) {
    return {
      ok: false as const,
      response: status(401, { message: "Invalid bearer token." }),
    };
  }

  const session = await readAdminSession({ sessionId: payload.sid });
  if (session === undefined || session.userId !== payload.sub) {
    return {
      ok: false as const,
      response: status(401, { message: "Session expired." }),
    };
  }

  return {
    ok: true as const,
  };
};

const navigationItemSchema = t.Object({
  createdAt: t.String(),
  groupId: t.String(),
  iconUrl: t.Nullable(t.String()),
  id: t.String(),
  name: t.String(),
  note: t.Nullable(t.String()),
  sortOrder: t.Number(),
  updatedAt: t.String(),
  url: t.String(),
});

const navigationGroupSchema = t.Object({
  createdAt: t.String(),
  id: t.String(),
  items: t.Array(navigationItemSchema),
  name: t.String(),
  nameEn: t.Nullable(t.String()),
  sortOrder: t.Number(),
  updatedAt: t.String(),
});

const navigationGroupInputSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
  nameEn: t.Optional(t.Nullable(t.String({ maxLength: 100 }))),
});

const navigationItemInputSchema = t.Object({
  groupId: t.String(),
  iconUrl: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
  name: t.String({ minLength: 1, maxLength: 160 }),
  note: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
  url: t.String({ minLength: 1, maxLength: 2048 }),
});

const navigationReorderSchema = t.Object({
  ids: t.Array(t.String()),
});

const navigationItemReorderSchema = t.Object({
  groupId: t.String(),
  ids: t.Array(t.String()),
});

const idParamsSchema = t.Object({
  id: t.String(),
});

const authHeadersSchema = t.Object({
  authorization: t.Optional(t.String()),
});

const readNavigationFailureMessage = (reason: NavigationFailure) => {
  switch (reason) {
    case NAVIGATION_FAILURE.GroupHasItems:
      return "请先移动或删除组内网站。";
    case NAVIGATION_FAILURE.GroupNameExists:
      return "导航分组名称已存在。";
    case NAVIGATION_FAILURE.GroupNotFound:
      return "导航分组不存在。";
    case NAVIGATION_FAILURE.InvalidGroupName:
      return "导航分组名称不能为空。";
    case NAVIGATION_FAILURE.InvalidItemName:
      return "网站名称不能为空。";
    case NAVIGATION_FAILURE.InvalidOrder:
      return "排序数据不完整。";
    case NAVIGATION_FAILURE.InvalidUrl:
      return "网站链接必须是有效的 http 或 https 地址。";
    case NAVIGATION_FAILURE.ItemNotFound:
      return "导航网站不存在。";
    default: {
      const exhaustiveReason: never = reason;
      return exhaustiveReason;
    }
  }
};

const createNavigationFailureResponse = (error: NavigationError) => {
  const message = readNavigationFailureMessage(error.reason);

  switch (error.reason) {
    case NAVIGATION_FAILURE.GroupNotFound:
    case NAVIGATION_FAILURE.ItemNotFound:
      return status(404, { message, reason: error.reason });
    case NAVIGATION_FAILURE.GroupNameExists:
      return status(409, { message, reason: error.reason });
    case NAVIGATION_FAILURE.GroupHasItems:
    case NAVIGATION_FAILURE.InvalidGroupName:
    case NAVIGATION_FAILURE.InvalidItemName:
    case NAVIGATION_FAILURE.InvalidOrder:
    case NAVIGATION_FAILURE.InvalidUrl:
      return status(400, { message, reason: error.reason });
    default: {
      const exhaustiveReason: never = error.reason;
      return exhaustiveReason;
    }
  }
};

const withNavigationErrors = async <Result>(work: () => Promise<Result>) => {
  try {
    return await work();
  } catch (error) {
    if (error instanceof NavigationError) {
      return createNavigationFailureResponse(error);
    }

    throw error;
  }
};

export const adminNavigationRoutes = new Elysia({ prefix: "/api/admin/navigation" })
  .use(
    jwt({
      name: "jwt",
      secret: env.jwtSecret,
      exp: `${env.sessionTtlSeconds}s`,
      schema: adminJwtSchema,
    }),
  )
  .get(
    "/",
    async ({ headers, jwt }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return listNavigation();
    },
    {
      headers: authHeadersSchema,
    },
  )
  .post(
    "/groups",
    async ({ body, headers, jwt }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return withNavigationErrors(async () => ({
        item: await createNavigationGroup(body),
        ok: true,
      }));
    },
    {
      body: navigationGroupInputSchema,
      headers: authHeadersSchema,
    },
  )
  .patch(
    "/groups/:id",
    async ({ body, headers, jwt, params }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return withNavigationErrors(async () => ({
        item: await updateNavigationGroup({ groupId: params.id, input: body }),
        ok: true,
      }));
    },
    {
      body: navigationGroupInputSchema,
      headers: authHeadersSchema,
      params: idParamsSchema,
    },
  )
  .delete(
    "/groups/:id",
    async ({ headers, jwt, params }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return withNavigationErrors(() => deleteNavigationGroup({ groupId: params.id }));
    },
    {
      headers: authHeadersSchema,
      params: idParamsSchema,
    },
  )
  .post(
    "/groups/reorder",
    async ({ body, headers, jwt }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return withNavigationErrors(() => reorderNavigationGroups(body));
    },
    {
      body: navigationReorderSchema,
      headers: authHeadersSchema,
    },
  )
  .post(
    "/items",
    async ({ body, headers, jwt }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return withNavigationErrors(async () => ({
        item: await createNavigationItem(body),
        ok: true,
      }));
    },
    {
      body: navigationItemInputSchema,
      headers: authHeadersSchema,
    },
  )
  .patch(
    "/items/:id",
    async ({ body, headers, jwt, params }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return withNavigationErrors(async () => ({
        item: await updateNavigationItem({ input: body, itemId: params.id }),
        ok: true,
      }));
    },
    {
      body: navigationItemInputSchema,
      headers: authHeadersSchema,
      params: idParamsSchema,
    },
  )
  .delete(
    "/items/:id",
    async ({ headers, jwt, params }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return withNavigationErrors(() => deleteNavigationItem({ itemId: params.id }));
    },
    {
      headers: authHeadersSchema,
      params: idParamsSchema,
    },
  )
  .post(
    "/items/reorder",
    async ({ body, headers, jwt }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return withNavigationErrors(() => reorderNavigationItems(body));
    },
    {
      body: navigationItemReorderSchema,
      headers: authHeadersSchema,
    },
  );
