import { jwt } from "@elysiajs/jwt";
import { Elysia, status, t } from "elysia";

import { env } from "../../shared/env";
import { USER_PROFILE_LOCALE_HEADER } from "../../shared/profile-tags";
import { adminJwtSchema, extractBearerToken, isAuthJwtPayload } from "../auth/session";
import { readAdminSession } from "../auth/service";
import {
  createManagedUser,
  deleteManagedUser,
  getManagedUser,
  listManagedUsers,
  MANAGED_USER_FAILURE,
  updateManagedUser,
} from "./service";
import type { ManagedUserFailure } from "./service";

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
    userId: session.userId,
  };
};

const profileLocalizationSchema = t.Object({
  bio: t.String(),
  name: t.String(),
  tags: t.Array(t.String()),
});

const managedUserInputSchema = t.Object({
  avatarUrl: t.String(),
  blogUrl: t.String(),
  commentEmailNotifications: t.Boolean(),
  email: t.String(),
  newPostEmailNotifications: t.Boolean(),
  password: t.String(),
  profileLocalizations: t.Object({
    en: profileLocalizationSchema,
    zhCN: profileLocalizationSchema,
  }),
  role: t.Union([t.Literal("admin"), t.Literal("user")]),
  username: t.String(),
});

type ParsePositiveIntegerParameters = {
  fallback: number;
  value?: string;
};

const parsePositiveInteger = ({ fallback, value }: ParsePositiveIntegerParameters) => {
  if (value === undefined) {
    return fallback;
  }

  const parsedValue = Number.parseInt(value, 10);
  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return parsedValue;
};

const readManagedUserFailureMessage = (reason: ManagedUserFailure) => {
  switch (reason) {
    case MANAGED_USER_FAILURE.CreateFailed:
      return "User could not be created.";
    case MANAGED_USER_FAILURE.DeleteFailed:
      return "User could not be deleted.";
    case MANAGED_USER_FAILURE.EmailExists:
      return "Email is already used.";
    case MANAGED_USER_FAILURE.InvalidIdentity:
      return "Username and email are required.";
    case MANAGED_USER_FAILURE.InvalidRole:
      return "Role is invalid.";
    case MANAGED_USER_FAILURE.LastAdmin:
      return "At least one administrator must remain.";
    case MANAGED_USER_FAILURE.NotFound:
      return "User was not found.";
    case MANAGED_USER_FAILURE.PasswordTooShort:
      return "Password must be at least 8 characters.";
    case MANAGED_USER_FAILURE.SelfDelete:
      return "You cannot delete your own account.";
    case MANAGED_USER_FAILURE.SelfRoleChange:
      return "You cannot remove your own administrator role.";
    case MANAGED_USER_FAILURE.UpdateFailed:
      return "User could not be updated.";
    case MANAGED_USER_FAILURE.UsernameExists:
      return "Username is already used.";
    default: {
      const exhaustiveReason: never = reason;
      return exhaustiveReason;
    }
  }
};

const createManagedUserFailureResponse = (reason: ManagedUserFailure) => {
  const message = readManagedUserFailureMessage(reason);

  switch (reason) {
    case MANAGED_USER_FAILURE.NotFound:
      return status(404, { message, reason });
    case MANAGED_USER_FAILURE.EmailExists:
    case MANAGED_USER_FAILURE.UsernameExists:
      return status(409, { message, reason });
    case MANAGED_USER_FAILURE.InvalidIdentity:
    case MANAGED_USER_FAILURE.InvalidRole:
    case MANAGED_USER_FAILURE.LastAdmin:
    case MANAGED_USER_FAILURE.PasswordTooShort:
    case MANAGED_USER_FAILURE.SelfDelete:
    case MANAGED_USER_FAILURE.SelfRoleChange:
      return status(400, { message, reason });
    case MANAGED_USER_FAILURE.CreateFailed:
    case MANAGED_USER_FAILURE.DeleteFailed:
    case MANAGED_USER_FAILURE.UpdateFailed:
      return status(500, { message, reason });
    default: {
      const exhaustiveReason: never = reason;
      return exhaustiveReason;
    }
  }
};

export const adminUsersRoutes = new Elysia({ prefix: "/api/admin" })
  .use(
    jwt({
      name: "jwt",
      secret: env.jwtSecret,
      exp: `${env.sessionTtlSeconds}s`,
      schema: adminJwtSchema,
    }),
  )
  .get(
    "/users",
    async ({ headers, jwt, query }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      return listManagedUsers({
        page: parsePositiveInteger({ fallback: 1, value: query.page }),
        pageSize: parsePositiveInteger({ fallback: 10, value: query.pageSize }),
        query: query.query,
        role: query.role ?? "all",
      });
    },
    {
      headers: t.Object({
        authorization: t.Optional(t.String()),
        [USER_PROFILE_LOCALE_HEADER]: t.Optional(t.String()),
      }),
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
        query: t.Optional(t.String()),
        role: t.Optional(t.Union([t.Literal("all"), t.Literal("admin"), t.Literal("user")])),
      }),
    },
  )
  .get(
    "/users/:id",
    async ({ headers, jwt, params }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      const details = await getManagedUser({ userId: params.id });
      if (details === undefined) {
        return status(404, { message: "User was not found." });
      }

      return details;
    },
    {
      headers: t.Object({
        authorization: t.Optional(t.String()),
        [USER_PROFILE_LOCALE_HEADER]: t.Optional(t.String()),
      }),
      params: t.Object({
        id: t.String(),
      }),
    },
  )
  .post(
    "/users",
    async ({ body, headers, jwt }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      const result = await createManagedUser({ input: body });
      if (!result.ok) {
        return createManagedUserFailureResponse(result.reason);
      }

      return result;
    },
    {
      body: managedUserInputSchema,
      headers: t.Object({
        authorization: t.Optional(t.String()),
        [USER_PROFILE_LOCALE_HEADER]: t.Optional(t.String()),
      }),
    },
  )
  .put(
    "/users/:id",
    async ({ body, headers, jwt, params }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      const result = await updateManagedUser({
        actorUserId: auth.userId,
        input: body,
        userId: params.id,
      });
      if (!result.ok) {
        return createManagedUserFailureResponse(result.reason);
      }

      return result;
    },
    {
      body: managedUserInputSchema,
      headers: t.Object({
        authorization: t.Optional(t.String()),
        [USER_PROFILE_LOCALE_HEADER]: t.Optional(t.String()),
      }),
      params: t.Object({
        id: t.String(),
      }),
    },
  )
  .delete(
    "/users/:id",
    async ({ headers, jwt, params }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      const result = await deleteManagedUser({
        actorUserId: auth.userId,
        userId: params.id,
      });
      if (!result.ok) {
        return createManagedUserFailureResponse(result.reason);
      }

      return result;
    },
    {
      headers: t.Object({
        authorization: t.Optional(t.String()),
      }),
      params: t.Object({
        id: t.String(),
      }),
    },
  );
