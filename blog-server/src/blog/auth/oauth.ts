import { createHash, randomBytes } from "node:crypto";

import type { Sql, TransactionSql } from "postgres";

import type { AuthProvider } from "../../shared/auth-providers";
import {
  getAuthProviderDefaults,
  readAuthProvider,
  SUPPORTED_AUTH_PROVIDERS,
} from "../../shared/auth-providers";
import { getSql } from "../../shared/db/postgres";
import { env } from "../../shared/env";
import type { RequestMeta } from "../../shared/request-meta";
import { decryptSecret } from "../../shared/security/encryption";
import { BlogAuthError, readBlogUserProfileById, recordBlogUserOAuthLogin } from "./service";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type BlogOAuthSql = Sql | TransactionSql;

type AuthProviderSettingsRow = {
  provider: AuthProvider;
  displayName: string | null;
  enabled: boolean;
  clientId: string | null;
  clientSecretEncrypted: string | null;
  redirectUri: string | null;
  scopes: string[] | string | null;
};

type OAuthStateRow = {
  codeVerifier: string;
  returnTo: string;
};

type OAuthIdentity = {
  avatarUrl?: string;
  email?: string;
  name: string;
  profileUrl?: string;
  providerUserId: string;
  username: string;
};

type OAuthProviderPublicItem = {
  displayName: string;
  provider: AuthProvider;
};

type OAuthProviderConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
};

type CreateOAuthAuthorizationParameters = {
  providerValue: string;
  returnTo?: string;
  sql?: BlogOAuthSql;
};

type CompleteOAuthLoginParameters = {
  code: string;
  fetcher?: FetchLike;
  providerValue: string;
  requestMeta: RequestMeta;
  sql?: Sql;
  state: string;
};

type CreateOAuthResultRedirectUrlParameters = {
  provider?: AuthProvider;
  reason?: string;
  returnTo?: string;
  status: "error" | "success";
};

const OAUTH_STATE_MINUTES = 10;

const createRandomToken = (byteLength = 32) => randomBytes(byteLength).toString("base64url");

const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60 * 1000);

const createCodeChallenge = (codeVerifier: string) =>
  createHash("sha256").update(codeVerifier).digest("base64url");

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const createAuthError = ({
  message,
  reason,
  statusCode,
}: {
  message: string;
  reason: "invalid-identity" | "oauth-provider-unavailable" | "oauth-state-invalid";
  statusCode: number;
}) => new BlogAuthError({ message, reason, statusCode });

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (value: unknown) => (typeof value === "string" ? value.trim() : undefined);

const readBoolean = (value: unknown) => (typeof value === "boolean" ? value : undefined);

const parseTextArray = (value: string[] | string | null | undefined) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === null || value === undefined || value.trim().length === 0) {
    return [];
  }

  return value
    .replace(/^\{|\}$/g, "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const sanitizeReturnTo = (value: string | null | undefined) => {
  const trimmedValue = value?.trim();
  if (
    trimmedValue === undefined ||
    trimmedValue.length === 0 ||
    !trimmedValue.startsWith("/") ||
    trimmedValue.startsWith("//")
  ) {
    return "/";
  }

  return trimmedValue.slice(0, 2048);
};

const getFrontendBaseUrl = () => {
  const origin = env.corsOrigins.find(
    (candidate) => candidate !== "*" && !candidate.startsWith("/"),
  );
  if (origin !== undefined) {
    return origin;
  }

  const hostname = env.hostname === "0.0.0.0" ? "localhost" : env.hostname;
  return `http://${hostname}:5174`;
};

export const createOAuthResultRedirectUrl = ({
  provider,
  reason,
  returnTo,
  status,
}: CreateOAuthResultRedirectUrlParameters) => {
  const url = new URL(sanitizeReturnTo(returnTo), getFrontendBaseUrl());
  const frontend = new URL(getFrontendBaseUrl());
  if (url.origin !== frontend.origin) {
    url.href = new URL("/", frontend).href;
  }
  url.searchParams.set("oauth_status", status);

  if (provider !== undefined) {
    url.searchParams.set("oauth_provider", provider);
  }

  if (reason !== undefined) {
    url.searchParams.set("oauth_reason", reason);
  }

  return url.toString();
};

const readProvider = (providerValue: string) => {
  const provider = readAuthProvider(providerValue);
  if (provider === undefined) {
    throw createAuthError({
      message: "不支持的第三方登录方式。",
      reason: "oauth-provider-unavailable",
      statusCode: 404,
    });
  }

  return provider;
};

const getProviderConfig = async ({
  provider,
  sql,
}: {
  provider: AuthProvider;
  sql: BlogOAuthSql;
}): Promise<OAuthProviderConfig> => {
  const rows = await sql<AuthProviderSettingsRow[]>`
    SELECT
      provider,
      display_name,
      enabled,
      client_id,
      client_secret_encrypted,
      redirect_uri,
      scopes
    FROM auth_provider_settings
    WHERE provider = ${provider}
    LIMIT 1
  `;
  const row = rows[0];

  if (row === undefined || !row.enabled) {
    throw createAuthError({
      message: "此登录方式尚未开启。",
      reason: "oauth-provider-unavailable",
      statusCode: 404,
    });
  }

  const clientId = row.clientId?.trim();
  const redirectUri = row.redirectUri?.trim();
  const clientSecret =
    row.clientSecretEncrypted === null
      ? undefined
      : decryptSecret({
          value: row.clientSecretEncrypted,
          secret: env.configEncryptionSecret,
        }).trim();

  if (
    clientId === undefined ||
    clientId.length === 0 ||
    redirectUri === undefined ||
    redirectUri.length === 0 ||
    clientSecret === undefined ||
    clientSecret.length === 0
  ) {
    throw createAuthError({
      message: "此登录方式配置不完整。",
      reason: "oauth-provider-unavailable",
      statusCode: 400,
    });
  }

  const scopes = parseTextArray(row.scopes);

  return {
    clientId,
    clientSecret,
    redirectUri,
    scopes: scopes.length > 0 ? scopes : getAuthProviderDefaults(provider).scopes,
  };
};

const createGithubHeaders = (accessToken: string) => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${accessToken}`,
  "X-GitHub-Api-Version": "2022-11-28",
});

const readJsonResponse = async ({ message, response }: { message: string; response: Response }) => {
  if (!response.ok) {
    throw createAuthError({
      message,
      reason: "invalid-identity",
      statusCode: 400,
    });
  }

  return response.json() as Promise<unknown>;
};

const readAccessToken = async ({ message, response }: { message: string; response: Response }) => {
  const payload = await readJsonResponse({ message, response });
  if (!isObjectRecord(payload)) {
    throw createAuthError({ message, reason: "invalid-identity", statusCode: 400 });
  }

  const accessToken = readString(payload.access_token);
  if (accessToken === undefined || accessToken.length === 0) {
    throw createAuthError({ message, reason: "invalid-identity", statusCode: 400 });
  }

  return accessToken;
};

const cleanOAuthUsername = ({ fallback, value }: { fallback: string; value?: string }) => {
  const cleaned = (value ?? fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return cleaned.length >= 2 ? cleaned : fallback.slice(0, 60);
};

const selectVerifiedGithubEmail = ({ emails }: { emails: unknown }) => {
  if (!Array.isArray(emails)) {
    return undefined;
  }

  const verifiedEmails = emails
    .filter(isObjectRecord)
    .map((email) => ({
      email: readString(email.email),
      primary: readBoolean(email.primary) === true,
      verified: readBoolean(email.verified) === true,
    }))
    .filter((email) => email.email !== undefined && email.verified);
  const selectedEmail =
    verifiedEmails.find((email) => email.primary)?.email ?? verifiedEmails[0]?.email;

  return selectedEmail === undefined ? undefined : normalizeEmail(selectedEmail);
};

const fetchGithubIdentity = async ({
  code,
  codeVerifier,
  config,
  fetcher,
}: {
  code: string;
  codeVerifier: string;
  config: OAuthProviderConfig;
  fetcher: FetchLike;
}): Promise<OAuthIdentity> => {
  const tokenResponse = await fetcher("https://github.com/login/oauth/access_token", {
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      code_verifier: codeVerifier,
      redirect_uri: config.redirectUri,
    }),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
  const accessToken = await readAccessToken({
    message: "GitHub 授权失败。",
    response: tokenResponse,
  });

  const [userPayload, emailPayload] = await Promise.all([
    fetcher("https://api.github.com/user", {
      headers: createGithubHeaders(accessToken),
    }).then((response) => readJsonResponse({ message: "GitHub 用户资料读取失败。", response })),
    fetcher("https://api.github.com/user/emails", {
      headers: createGithubHeaders(accessToken),
    }).then((response) => readJsonResponse({ message: "GitHub 用户邮箱读取失败。", response })),
  ]);

  if (!isObjectRecord(userPayload)) {
    throw createAuthError({
      message: "GitHub 用户资料无效。",
      reason: "invalid-identity",
      statusCode: 400,
    });
  }

  const rawProviderUserId = userPayload.id;
  const providerUserId =
    typeof rawProviderUserId === "number" || typeof rawProviderUserId === "string"
      ? String(rawProviderUserId).trim()
      : "";
  const login = readString(userPayload.login);
  if (providerUserId.length === 0 || login === undefined || login.length === 0) {
    throw createAuthError({
      message: "GitHub 用户资料无效。",
      reason: "invalid-identity",
      statusCode: 400,
    });
  }

  return {
    avatarUrl: readString(userPayload.avatar_url),
    email: selectVerifiedGithubEmail({
      emails: emailPayload,
    }),
    name: readString(userPayload.name) ?? login,
    profileUrl: readString(userPayload.html_url) ?? `https://github.com/${login}`,
    providerUserId,
    username: login,
  };
};

const fetchGoogleIdentity = async ({
  code,
  codeVerifier,
  config,
  fetcher,
}: {
  code: string;
  codeVerifier: string;
  config: OAuthProviderConfig;
  fetcher: FetchLike;
}): Promise<OAuthIdentity> => {
  const tokenResponse = await fetcher("https://oauth2.googleapis.com/token", {
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    }),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
  const accessToken = await readAccessToken({
    message: "Google 授权失败。",
    response: tokenResponse,
  });
  const userPayload = await fetcher("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  }).then((response) => readJsonResponse({ message: "Google 用户资料读取失败。", response }));

  if (!isObjectRecord(userPayload) || readBoolean(userPayload.email_verified) !== true) {
    throw createAuthError({
      message: "Google 用户邮箱未验证。",
      reason: "invalid-identity",
      statusCode: 400,
    });
  }

  const providerUserId = readString(userPayload.sub);
  const email = readString(userPayload.email);
  if (
    providerUserId === undefined ||
    providerUserId.length === 0 ||
    email === undefined ||
    email.length === 0
  ) {
    throw createAuthError({
      message: "Google 用户资料无效。",
      reason: "invalid-identity",
      statusCode: 400,
    });
  }

  const normalizedEmail = normalizeEmail(email);
  const username = cleanOAuthUsername({
    fallback: "google-user",
    value: normalizedEmail.split("@")[0],
  });

  return {
    avatarUrl: readString(userPayload.picture),
    email: normalizedEmail,
    name: readString(userPayload.name) ?? username,
    providerUserId,
    username,
  };
};

const fetchOAuthIdentity = ({
  code,
  codeVerifier,
  config,
  fetcher,
  provider,
}: {
  code: string;
  codeVerifier: string;
  config: OAuthProviderConfig;
  fetcher: FetchLike;
  provider: AuthProvider;
}) => {
  switch (provider) {
    case "github":
      return fetchGithubIdentity({ code, codeVerifier, config, fetcher });
    case "google":
      return fetchGoogleIdentity({ code, codeVerifier, config, fetcher });
    default: {
      const exhaustiveProvider: never = provider;
      throw createAuthError({
        message: `不支持的第三方登录方式：${exhaustiveProvider}`,
        reason: "oauth-provider-unavailable",
        statusCode: 404,
      });
    }
  }
};

const createUniqueUsername = async ({
  baseValue,
  sql,
}: {
  baseValue: string;
  sql: BlogOAuthSql;
}) => {
  const base = cleanOAuthUsername({ fallback: "oauth-user", value: baseValue });

  for (let index = 0; index < 50; index += 1) {
    const suffix = index === 0 ? "" : `-${index + 1}`;
    const username = `${base.slice(0, 60 - suffix.length)}${suffix}`;
    const rows = await sql<{ id: string }[]>`
      SELECT id
      FROM users
      WHERE lower(username) = ${username.toLowerCase()}
      LIMIT 1
    `;

    if (rows[0] === undefined) {
      return username;
    }
  }

  return `${base.slice(0, 51)}-${createRandomToken(4).slice(0, 8)}`;
};

const findOrCreateOAuthUser = async ({
  identity,
  provider,
  sql,
}: {
  identity: OAuthIdentity;
  provider: AuthProvider;
  sql: BlogOAuthSql;
}) => {
  await sql`LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE`;

  const linkedRows = await sql<{ userId: string }[]>`
    SELECT user_id
    FROM user_oauth_accounts
    WHERE provider = ${provider}
      AND provider_user_id = ${identity.providerUserId}
    LIMIT 1
  `;
  const linked = linkedRows[0];

  if (linked !== undefined) {
    await sql`
      UPDATE user_oauth_accounts
      SET
        provider_username = ${identity.username},
        provider_email = ${identity.email ?? null},
        avatar_url = ${identity.avatarUrl ?? null},
        profile_url = ${identity.profileUrl ?? null}
      WHERE provider = ${provider}
        AND provider_user_id = ${identity.providerUserId}
    `;

    return readBlogUserProfileById({ sql, userId: linked.userId });
  }

  if (identity.email === undefined) {
    throw createAuthError({
      message: "第三方账号没有提供已验证邮箱，无法创建本站账号。",
      reason: "invalid-identity",
      statusCode: 400,
    });
  }

  const existingUserRows = await sql<{ id: string }[]>`
    SELECT id
    FROM users
    WHERE lower(email) = ${identity.email}
    LIMIT 1
  `;
  const existingUser = existingUserRows[0];
  let userId = existingUser?.id;

  if (userId === undefined) {
    const username = await createUniqueUsername({ baseValue: identity.username, sql });
    const createdRows = await sql<{ id: string }[]>`
      INSERT INTO users (
        username,
        password_hash,
        email,
        name,
        role,
        avatar_url,
        blog_url
      )
      VALUES (
        ${username},
        ${await Bun.password.hash(createRandomToken(32))},
        ${identity.email},
        ${identity.name},
        'user',
        ${identity.avatarUrl ?? null},
        ${identity.profileUrl ?? null}
      )
      RETURNING id
    `;
    const created = createdRows[0];
    if (created === undefined) {
      throw createAuthError({
        message: "第三方账号创建失败。",
        reason: "invalid-identity",
        statusCode: 400,
      });
    }

    userId = created.id;
  }

  const linkedProviderRows = await sql<{ providerUserId: string }[]>`
    SELECT provider_user_id
    FROM user_oauth_accounts
    WHERE provider = ${provider}
      AND user_id = ${userId}
    LIMIT 1
  `;
  const linkedProvider = linkedProviderRows[0];
  if (linkedProvider !== undefined && linkedProvider.providerUserId !== identity.providerUserId) {
    throw createAuthError({
      message: `该账号已绑定其他 ${getAuthProviderDefaults(provider).displayName} 登录身份。`,
      reason: "invalid-identity",
      statusCode: 409,
    });
  }

  await sql`
    INSERT INTO user_oauth_accounts (
      user_id,
      provider,
      provider_user_id,
      provider_username,
      provider_email,
      avatar_url,
      profile_url
    )
    VALUES (
      ${userId},
      ${provider},
      ${identity.providerUserId},
      ${identity.username},
      ${identity.email ?? null},
      ${identity.avatarUrl ?? null},
      ${identity.profileUrl ?? null}
    )
    ON CONFLICT (provider, provider_user_id)
    DO UPDATE SET
      provider_username = EXCLUDED.provider_username,
      provider_email = EXCLUDED.provider_email,
      avatar_url = EXCLUDED.avatar_url,
      profile_url = EXCLUDED.profile_url
  `;

  return readBlogUserProfileById({ sql, userId });
};

export const listPublicOAuthProviders = async (sql: BlogOAuthSql = getSql()) => {
  const rows = await sql<AuthProviderSettingsRow[]>`
    SELECT
      provider,
      display_name,
      enabled,
      client_id,
      client_secret_encrypted,
      redirect_uri,
      scopes
    FROM auth_provider_settings
    WHERE enabled = true
  `;
  const items = rows.flatMap((row): OAuthProviderPublicItem[] => {
    const provider = readAuthProvider(row.provider);
    const clientId = row.clientId?.trim();
    const redirectUri = row.redirectUri?.trim();
    if (
      provider === undefined ||
      !row.enabled ||
      clientId === undefined ||
      clientId.length === 0 ||
      redirectUri === undefined ||
      redirectUri.length === 0 ||
      row.clientSecretEncrypted === null
    ) {
      return [];
    }

    return [
      {
        displayName: row.displayName?.trim() || getAuthProviderDefaults(provider).displayName,
        provider,
      },
    ];
  });

  const sortedItems = SUPPORTED_AUTH_PROVIDERS.flatMap((provider) =>
    items.filter((item) => item.provider === provider),
  );

  return {
    items: sortedItems,
    ok: true,
  };
};

export const createOAuthAuthorization = async ({
  providerValue,
  returnTo,
  sql = getSql(),
}: CreateOAuthAuthorizationParameters) => {
  const provider = readProvider(providerValue);
  const config = await getProviderConfig({ provider, sql });
  const state = createRandomToken();
  const codeVerifier = createRandomToken();
  const authorizationUrl =
    provider === "google"
      ? new URL("https://accounts.google.com/o/oauth2/v2/auth")
      : new URL("https://github.com/login/oauth/authorize");

  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", config.clientId);
  authorizationUrl.searchParams.set("redirect_uri", config.redirectUri);
  authorizationUrl.searchParams.set("scope", config.scopes.join(" "));
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("code_challenge", createCodeChallenge(codeVerifier));
  authorizationUrl.searchParams.set("code_challenge_method", "S256");

  await sql`
    INSERT INTO oauth_login_states (
      provider,
      state_hash,
      code_verifier,
      return_to,
      expires_at
    )
    VALUES (
      ${provider},
      ${hashToken(state)},
      ${codeVerifier},
      ${sanitizeReturnTo(returnTo)},
      ${addMinutes(new Date(), OAUTH_STATE_MINUTES)}
    )
  `;

  return {
    authorizationUrl: authorizationUrl.toString(),
    provider,
    state,
  };
};

export const completeOAuthLogin = async ({
  code,
  fetcher = fetch,
  providerValue,
  requestMeta,
  sql = getSql(),
  state: inputState,
}: CompleteOAuthLoginParameters) => {
  const provider = readProvider(providerValue);
  const config = await getProviderConfig({ provider, sql });
  const state = await sql.begin<OAuthStateRow>(async (transaction) => {
    const rows = await transaction<OAuthStateRow[]>`
      SELECT code_verifier, return_to
      FROM oauth_login_states
      WHERE provider = ${provider}
        AND state_hash = ${hashToken(inputState)}
        AND consumed_at IS NULL
        AND expires_at > now()
      LIMIT 1
      FOR UPDATE
    `;
    const row = rows[0];

    if (row === undefined) {
      throw createAuthError({
        message: "第三方登录状态无效或已过期。",
        reason: "oauth-state-invalid",
        statusCode: 400,
      });
    }

    await transaction`
      UPDATE oauth_login_states
      SET consumed_at = now()
      WHERE provider = ${provider}
        AND state_hash = ${hashToken(inputState)}
    `;

    return row;
  });
  const identity = await fetchOAuthIdentity({
    code,
    codeVerifier: state.codeVerifier,
    config,
    fetcher,
    provider,
  });
  const user = await sql.begin((transaction) =>
    findOrCreateOAuthUser({ identity, provider, sql: transaction }),
  );

  return {
    provider,
    returnTo: state.returnTo,
    user: await recordBlogUserOAuthLogin({
      loginMethod: provider,
      requestMeta,
      user,
    }),
  };
};
