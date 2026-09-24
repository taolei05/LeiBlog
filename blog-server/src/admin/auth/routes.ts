import { jwt } from "@elysiajs/jwt";
import { Elysia, status, t } from "elysia";

import { adminJwtSchema, extractBearerToken, isAuthJwtPayload } from "./session";
import {
  createAdminSession,
  deleteAdminSession,
  getAdminProfileById,
  loginAdmin,
  readAdminSession,
} from "./service";
import { USER_ROLE } from "./types";
import { env } from "../../shared/env";
import { USER_PROFILE_LOCALE_HEADER } from "../../shared/profile-tags";

export const adminAuthRoutes = new Elysia({ prefix: "/api/admin/auth" })
  .use(
    jwt({
      name: "jwt",
      secret: env.jwtSecret,
      exp: `${env.sessionTtlSeconds}s`,
      schema: adminJwtSchema,
    }),
  )
  .post(
    "/login",
    async ({ body, jwt }) => {
      const user = await loginAdmin({
        identifier: body.identifier,
        locale: body.locale,
        password: body.password,
      });

      if (user === undefined) {
        return status(401, { message: "Invalid username/email or password." });
      }

      const session = await createAdminSession({ user });
      const token = await jwt.sign({
        sub: user.id,
        sid: session.sessionId,
        username: user.username,
        role: USER_ROLE.Admin,
      });

      return { token, user };
    },
    {
      body: t.Object({
        identifier: t.String({ minLength: 1 }),
        locale: t.Optional(t.Union([t.Literal("zh-CN"), t.Literal("en")])),
        password: t.String({ minLength: 1 }),
      }),
    },
  )
  .get(
    "/me",
    async ({ headers, jwt }) => {
      const token = extractBearerToken(headers.authorization);
      if (token === undefined) {
        return status(401, { message: "Missing bearer token." });
      }

      const payload = await jwt.verify(token);
      if (!isAuthJwtPayload(payload)) {
        return status(401, { message: "Invalid bearer token." });
      }

      const session = await readAdminSession({ sessionId: payload.sid });
      if (session === undefined || session.userId !== payload.sub) {
        return status(401, { message: "Session expired." });
      }

      const user = await getAdminProfileById({
        locale: headers[USER_PROFILE_LOCALE_HEADER],
        userId: payload.sub,
      });
      if (user === undefined) {
        return status(401, { message: "Administrator no longer exists." });
      }

      return { user };
    },
    {
      headers: t.Object({
        authorization: t.Optional(t.String()),
        [USER_PROFILE_LOCALE_HEADER]: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/logout",
    async ({ headers, jwt }) => {
      const token = extractBearerToken(headers.authorization);
      if (token === undefined) {
        return { ok: true };
      }

      const payload = await jwt.verify(token);
      if (isAuthJwtPayload(payload)) {
        await deleteAdminSession({ sessionId: payload.sid });
      }

      return { ok: true };
    },
    {
      headers: t.Object({
        authorization: t.Optional(t.String()),
      }),
    },
  );
