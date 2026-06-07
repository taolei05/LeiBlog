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
  registerUser,
  resetPassword,
  revokeAuthSession,
  verifyLogin,
} from "./service";
import {
  enforceEmailCodeRateLimit,
  enforceForgotPasswordRateLimit,
  enforceLoginRateLimit,
  enforcePasswordResetRateLimit,
} from "./rate-limit";
import { authContext, jwtPlugin } from "../shared/auth/plugin";
import { requestContext } from "../shared/http/plugin";

export const authModule = new Elysia({ prefix: "/api/auth" })
  .use(jwtPlugin)
  .use(requestContext)
  .get("/status", () => ({
    ok: true,
    scope: "auth",
  }))
  .post(
    "/email-code",
    async ({ body, requestMeta }) => {
      await enforceEmailCodeRateLimit(requestMeta, body.email, body.purpose);

      return createEmailCode(body);
    },
    {
      body: EmailCodeBody,
      response: {
        200: EmailCodeResponse,
      },
    }
  )
  .post(
    "/register",
    async ({ body, jwt, requestMeta }) => {
      const user = await registerUser(body);
      const token = await jwt.sign({
        sub: user.id,
        role: user.role,
        username: user.username,
        type: "access",
        exp: "7d",
      });
      await createAuthSession(user, token, requestMeta);

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
    async ({ body, jwt, requestMeta }) => {
      await enforceLoginRateLimit(requestMeta, body.identifier);
      const user = await verifyLogin(body, requestMeta);
      const token = await jwt.sign({
        sub: user.id,
        role: user.role,
        username: user.username,
        type: "access",
        exp: "7d",
      });

      await createAuthSession(user, token, requestMeta);

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
  .post(
    "/password/forgot",
    async ({ body, requestMeta }) => {
      await enforceForgotPasswordRateLimit(requestMeta, body.email);

      return createPasswordResetToken(body.email);
    },
    {
      body: ForgotPasswordBody,
      response: {
        200: PasswordResetResponse,
      },
    }
  )
  .post(
    "/password/reset",
    async ({ body, requestMeta }) => {
      await enforcePasswordResetRateLimit(requestMeta, body);

      return resetPassword(body);
    },
    {
      body: ResetPasswordBody,
      response: {
        200: OkResponse,
      },
    }
  )
  .use(authContext)
  .post("/logout", ({ accessToken }) => revokeAuthSession(accessToken!), {
    response: {
      200: OkResponse,
    },
  });
