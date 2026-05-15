import { Elysia } from "elysia";

import {
  AuthResponse,
  EmailCodeBody,
  EmailCodeResponse,
  ForgotPasswordBody,
  LoginBody,
  OkResponse,
  PasswordResetResponse,
  RegisterBody,
  ResetPasswordBody,
} from "./model";
import {
  createAuthSession,
  createEmailCode,
  createPasswordResetToken,
  getRequestMeta,
  registerUser,
  resetPassword,
  revokeAuthSession,
  verifyLogin,
} from "./service";
import { authContext, jwtPlugin } from "../shared/auth/plugin";

export const authModule = new Elysia({ prefix: "/api/auth" })
  .use(jwtPlugin)
  .get("/status", () => ({
    ok: true,
    scope: "auth",
  }))
  .post("/email-code", ({ body }) => createEmailCode(body), {
    body: EmailCodeBody,
    response: {
      200: EmailCodeResponse,
    },
  })
  .post(
    "/register",
    async ({ body, headers, jwt }) => {
      const user = await registerUser(body);
      const token = await jwt.sign({
        sub: user.id,
        role: user.role,
        username: user.username,
        type: "access",
        exp: "7d",
      });

      await createAuthSession(user, token, getRequestMeta(headers));

      return {
        ok: true,
        token,
        user,
      };
    },
    {
      body: RegisterBody,
      response: {
        200: AuthResponse,
      },
    }
  )
  .post(
    "/login",
    async ({ body, headers, jwt }) => {
      const user = await verifyLogin(body, getRequestMeta(headers));
      const token = await jwt.sign({
        sub: user.id,
        role: user.role,
        username: user.username,
        type: "access",
        exp: "7d",
      });

      await createAuthSession(user, token, getRequestMeta(headers));

      return {
        ok: true,
        token,
        user,
      };
    },
    {
      body: LoginBody,
      response: {
        200: AuthResponse,
      },
    }
  )
  .post("/password/forgot", ({ body }) => createPasswordResetToken(body.email), {
    body: ForgotPasswordBody,
    response: {
      200: PasswordResetResponse,
    },
  })
  .post("/password/reset", ({ body }) => resetPassword(body), {
    body: ResetPasswordBody,
    response: {
      200: OkResponse,
    },
  })
  .use(authContext)
  .post("/logout", ({ accessToken }) => revokeAuthSession(accessToken!), {
    response: {
      200: OkResponse,
    },
  });
