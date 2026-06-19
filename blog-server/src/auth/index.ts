import { Elysia } from "elysia";

import {
  AuthResponse,
  EmailCodeBody,
  EmailCodeResponse,
  ForgotPasswordBody,
  LoginBody,
  OkResponse,
  OAuthCallbackQuery,
  OAuthProviderParams,
  OAuthStartQuery,
  OAuthTicketBody,
  PasswordResetResponse,
  PublicAuthProvidersResponse,
  RegisterBody,
  ResetPasswordBody,
} from "./model";
import {
  completeOAuthLogin,
  consumeOAuthLoginTicket,
  createOAuthAuthorization,
  listPublicAuthProviders,
} from "./oauth";
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
  .get("/providers", () => listPublicAuthProviders(), {
    response: {
      200: PublicAuthProvidersResponse,
    },
  })
  .get(
    "/oauth/:provider/start",
    async ({ params, query }) => {
      const authorization = await createOAuthAuthorization(params.provider, {
        returnTo: query.returnTo,
      });

      return Response.redirect(authorization.authorizationUrl, 302);
    },
    {
      params: OAuthProviderParams,
      query: OAuthStartQuery,
    }
  )
  .get(
    "/oauth/:provider/callback",
    async ({ params, query, requestMeta }) => {
      const result = await completeOAuthLogin(params.provider, query, requestMeta);

      return Response.redirect(result.redirectUrl, 302);
    },
    {
      params: OAuthProviderParams,
      query: OAuthCallbackQuery,
    }
  )
  .post(
    "/oauth/ticket",
    async ({ body, jwt, requestMeta }) => {
      const result = await consumeOAuthLoginTicket(body.ticket, requestMeta);
      const token = await jwt.sign({
        sub: result.user.id,
        role: result.user.role,
        username: result.user.username,
        type: "access",
        exp: "7d",
      });

      await createAuthSession(result.user, token, requestMeta);

      return {
        ok: true,
        token,
        user: result.user,
      };
    },
    {
      body: OAuthTicketBody,
      response: {
        200: AuthResponse,
      },
    }
  )
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
