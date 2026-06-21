import { createHash } from "node:crypto";

import {
  createRandomToken,
  hashPassword,
  hashToken,
  normalizeEmail,
} from "../shared/auth";
import type { AuthProvider, AuthProviderPublicItem } from "../shared/auth-providers";
import {
  getAuthProviderDefaults,
  readAuthProvider,
  supportedAuthProviders,
} from "../shared/auth-providers";
import { appConfig } from "../shared/config";
import type { StoredEncryptedSecret } from "../shared/crypto";
import { decryptSecret } from "../shared/crypto";
import type { DbClient } from "../shared/db";
import { db, withTransaction } from "../shared/db";
import { unauthorized, validationError } from "../shared/errors";
import { addMinutes } from "../shared/time";
import type { UserProfileRow } from "../shared/types/user";
import { toUserProfile } from "../shared/types/user";
import type { RequestMeta } from "./service";
import { resolveLoginLocation } from "./service";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type AuthProviderConfigRow = {
  provider: AuthProvider;
  display_name: string;
  enabled: boolean;
  client_id: string | null;
  client_secret_encrypted: StoredEncryptedSecret | null;
  redirect_uri: string | null;
  scopes: string[] | string;
};

type OAuthStateRow = {
  code_verifier: string;
  return_to: string;
};

type OAuthAccountUserRow = UserProfileRow & {
  oauth_user_id: string;
};

type GithubUser = {
  avatar_url?: string | null;
  email?: string | null;
  html_url?: string | null;
  id?: number | string;
  login?: string;
  name?: string | null;
};

type GithubEmail = {
  email?: string;
  primary?: boolean;
  verified?: boolean;
};

type GoogleUserInfo = {
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  sub?: string;
};

type OAuthIdentity = {
  avatarUrl: string | null;
  email: string | null;
  name: string;
  profileUrl: string | null;
  providerUserId: string;
  username: string;
};

export type OAuthAuthorizationInput = {
  returnTo?: string | null;
};

export type OAuthCallbackInput = {
  code: string;
  state: string;
};

export type OAuthServiceOptions = {
  client?: DbClient;
  fetch?: FetchLike;
};

const OAUTH_STATE_MINUTES = 10;
const OAUTH_TICKET_MINUTES = 5;

function parseTextArray(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  return value
    .replace(/^\{|\}$/g, "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizeReturnTo(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) return "/login";

  return trimmed.slice(0, 2048);
}

function base64Url(buffer: Buffer) {
  return buffer.toString("base64url");
}

function createCodeChallenge(codeVerifier: string) {
  return base64Url(createHash("sha256").update(codeVerifier).digest());
}

function getFrontendBaseUrl() {
  const [origin] = appConfig.corsOrigins;
  if (origin) return origin;

  const host = appConfig.host === "0.0.0.0" ? "localhost" : appConfig.host;

  return `http://${host}:${appConfig.port}`;
}

function createOAuthTicketRedirectUrl({
  provider,
  returnTo,
  ticket,
}: {
  provider: AuthProvider;
  returnTo: string;
  ticket: string;
}) {
  const url = new URL(sanitizeReturnTo(returnTo), getFrontendBaseUrl());
  url.searchParams.set("oauth_provider", provider);
  url.searchParams.set("oauth_ticket", ticket);

  return url.toString();
}

function readProvider(providerValue: string) {
  const provider = readAuthProvider(providerValue);
  if (!provider) throw validationError("不支持的登录方式");

  return provider;
}

function ensureString(value: unknown, message: string) {
  if (typeof value !== "string" || !value.trim()) throw validationError(message);

  return value.trim();
}

function createGithubHeaders(accessToken: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${accessToken}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function readJsonResponse<T>(response: Response, message: string) {
  if (!response.ok) throw validationError(message);

  return (await response.json()) as T;
}

function cleanOAuthUsername(value: string | undefined, fallback: string) {
  const cleaned = (value ?? fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return cleaned.length >= 2 ? cleaned : fallback.slice(0, 60);
}

function selectVerifiedEmail(emails: GithubEmail[], fallback: string | null | undefined) {
  const primary = emails.find((email) => email.primary && email.verified && email.email?.trim());
  const firstVerified = emails.find((email) => email.verified && email.email?.trim());
  const selected = primary?.email ?? firstVerified?.email ?? fallback ?? null;

  return selected ? normalizeEmail(selected) : null;
}

async function getProviderConfig(provider: AuthProvider, client: DbClient) {
  const [row] = await client<AuthProviderConfigRow[]>`
    SELECT provider, display_name, enabled, client_id, client_secret_encrypted,
           redirect_uri, scopes
    FROM auth_provider_settings
    WHERE provider = ${provider}
    LIMIT 1
  `;
  if (!row?.enabled) throw validationError("此登录方式尚未开启");

  const clientId = row.client_id?.trim();
  const clientSecret = decryptSecret(row.client_secret_encrypted);
  const redirectUri = row.redirect_uri?.trim();
  const scopes = parseTextArray(row.scopes).length
    ? parseTextArray(row.scopes)
    : getAuthProviderDefaults(provider).scopes;

  if (!clientId || !clientSecret || !redirectUri) {
    throw validationError("此登录方式配置不完整");
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    scopes,
  };
}

async function readUserProfileById(userId: string, client: DbClient) {
  const [row] = await client<UserProfileRow[]>`
    SELECT id, username, email, name, description, tags, role, avatar_url,
           social_links, blog_url, comment_email_notifications_enabled,
           new_article_email_notifications_enabled,
           created_at, updated_at, last_login_at,
           host(last_login_ip) AS last_login_ip, last_login_location,
           last_login_device, last_login_method
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  if (!row) throw unauthorized("用户不存在");

  return toUserProfile(row);
}

async function createUniqueUsername(baseValue: string, client: DbClient) {
  const base = cleanOAuthUsername(baseValue, "oauth-user");

  for (let index = 0; index < 50; index += 1) {
    const suffix = index === 0 ? "" : `-${index + 1}`;
    const username = `${base.slice(0, 60 - suffix.length)}${suffix}`;
    const [existing] = await client<{ id: string }[]>`
      SELECT id
      FROM users
      WHERE lower(username) = ${username.toLowerCase()}
      LIMIT 1
    `;

    if (!existing) return username;
  }

  return `${base.slice(0, 51)}-${createRandomToken(4).slice(0, 8)}`;
}

type AuthProviderConfig = Awaited<ReturnType<typeof getProviderConfig>>;

type FetchGithubIdentityParameters = {
  code: string;
  codeVerifier: string;
  config: AuthProviderConfig;
  fetcher: FetchLike;
};

async function fetchGithubIdentity({
  code,
  codeVerifier,
  config,
  fetcher,
}: FetchGithubIdentityParameters): Promise<OAuthIdentity> {
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
  const tokenPayload = await readJsonResponse<{ access_token?: string }>(
    tokenResponse,
    "GitHub 授权失败"
  );
  const accessToken = ensureString(tokenPayload.access_token, "GitHub 授权失败");

  const [userPayload, emailPayload] = await Promise.all([
    fetcher("https://api.github.com/user", {
      headers: createGithubHeaders(accessToken),
    }).then((response) => readJsonResponse<GithubUser>(response, "GitHub 用户资料读取失败")),
    fetcher("https://api.github.com/user/emails", {
      headers: createGithubHeaders(accessToken),
    }).then((response) =>
      readJsonResponse<GithubEmail[]>(response, "GitHub 用户邮箱读取失败")
    ),
  ]);
  const providerUserId = ensureString(String(userPayload.id ?? ""), "GitHub 用户资料无效");
  const login = ensureString(userPayload.login, "GitHub 用户资料无效");
  const email = selectVerifiedEmail(emailPayload, userPayload.email);

  return {
    avatarUrl: userPayload.avatar_url?.trim() || null,
    email,
    name: userPayload.name?.trim() || login,
    profileUrl: userPayload.html_url?.trim() || `https://github.com/${login}`,
    providerUserId,
    username: login,
  };
}

type FetchGoogleIdentityParameters = {
  code: string;
  codeVerifier: string;
  config: AuthProviderConfig;
  fetcher: FetchLike;
};

async function fetchGoogleIdentity({
  code,
  codeVerifier,
  config,
  fetcher,
}: FetchGoogleIdentityParameters): Promise<OAuthIdentity> {
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
  const tokenPayload = await readJsonResponse<{ access_token?: string }>(
    tokenResponse,
    "Google 授权失败"
  );
  const accessToken = ensureString(tokenPayload.access_token, "Google 授权失败");
  const userPayload = await fetcher("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  }).then((response) => readJsonResponse<GoogleUserInfo>(response, "Google 用户资料读取失败"));

  const providerUserId = ensureString(userPayload.sub, "Google 用户资料无效");
  const email = normalizeEmail(ensureString(userPayload.email, "Google 用户资料无效"));
  if (!userPayload.email_verified) throw validationError("Google 用户邮箱未验证");

  const username = cleanOAuthUsername(email.split("@")[0], "google-user");

  return {
    avatarUrl: userPayload.picture?.trim() || null,
    email,
    name: userPayload.name?.trim() || username,
    profileUrl: null,
    providerUserId,
    username,
  };
}

type FetchOAuthIdentityParameters = {
  code: string;
  codeVerifier: string;
  config: AuthProviderConfig;
  fetcher: FetchLike;
  provider: AuthProvider;
};

async function fetchOAuthIdentity({
  code,
  codeVerifier,
  config,
  fetcher,
  provider,
}: FetchOAuthIdentityParameters) {
  switch (provider) {
    case "github":
      return fetchGithubIdentity({ code, codeVerifier, config, fetcher });
    case "google":
      return fetchGoogleIdentity({ code, codeVerifier, config, fetcher });
    default: {
      const exhaustive: never = provider;
      throw validationError(`不支持的登录方式：${exhaustive}`);
    }
  }
}

async function findOrCreateOAuthUser(
  provider: AuthProvider,
  identity: OAuthIdentity,
  client: DbClient
) {
  const [linked] = await client<OAuthAccountUserRow[]>`
    SELECT u.id, u.username, u.email, u.name, u.description, u.tags, u.role,
           u.avatar_url, u.social_links, u.blog_url,
           u.comment_email_notifications_enabled,
           u.new_article_email_notifications_enabled,
           u.created_at, u.updated_at, u.last_login_at,
           host(u.last_login_ip) AS last_login_ip, u.last_login_location,
           u.last_login_device, u.last_login_method, oa.user_id AS oauth_user_id
    FROM user_oauth_accounts oa
    JOIN users u ON u.id = oa.user_id
    WHERE oa.provider = ${provider}
      AND oa.provider_user_id = ${identity.providerUserId}
    LIMIT 1
  `;

  if (linked) {
    await client`
      UPDATE user_oauth_accounts
      SET provider_username = ${identity.username},
          provider_email = ${identity.email},
          avatar_url = ${identity.avatarUrl},
          profile_url = ${identity.profileUrl}
      WHERE provider = ${provider}
        AND provider_user_id = ${identity.providerUserId}
    `;

    return toUserProfile(linked);
  }

  let userId = "";
  if (identity.email) {
    const [existingUser] = await client<{ id: string; role: "admin" | "user" }[]>`
      SELECT id, role
      FROM users
      WHERE lower(email) = ${identity.email}
      LIMIT 1
    `;

    if (existingUser) {
      userId = existingUser.id;
    }
  }

  if (!userId) {
    const username = await createUniqueUsername(identity.username, client);
    const [created] = await client<{ id: string }[]>`
      INSERT INTO users (
        username, password_hash, email, name, role, avatar_url, blog_url
      )
      VALUES (
        ${username},
        ${await hashPassword(createRandomToken(32))},
        ${identity.email},
        ${identity.name},
        'user',
        ${identity.avatarUrl},
        ${identity.profileUrl}
      )
      RETURNING id
    `;
    userId = created.id;
  }

  const [linkedUserProvider] = await client<{ provider_user_id: string }[]>`
    SELECT provider_user_id
    FROM user_oauth_accounts
    WHERE provider = ${provider}
      AND user_id = ${userId}
    LIMIT 1
  `;
  if (
    linkedUserProvider &&
    linkedUserProvider.provider_user_id !== identity.providerUserId
  ) {
    throw validationError("该账号已绑定其他 GitHub 登录身份");
  }

  await client`
    INSERT INTO user_oauth_accounts (
      user_id, provider, provider_user_id, provider_username, provider_email,
      avatar_url, profile_url
    )
    VALUES (
      ${userId}, ${provider}, ${identity.providerUserId}, ${identity.username},
      ${identity.email}, ${identity.avatarUrl}, ${identity.profileUrl}
    )
    ON CONFLICT (provider, provider_user_id) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        provider_username = EXCLUDED.provider_username,
        provider_email = EXCLUDED.provider_email,
        avatar_url = EXCLUDED.avatar_url,
        profile_url = EXCLUDED.profile_url
  `;

  return readUserProfileById(userId, client);
}

export async function listPublicAuthProviders(client: DbClient = db) {
  const rows = await client<AuthProviderConfigRow[]>`
    SELECT provider, display_name, enabled, client_id, client_secret_encrypted,
           redirect_uri, scopes
    FROM auth_provider_settings
    WHERE enabled = true
  `;
  const items = rows
    .filter((row) => {
      const provider = readAuthProvider(row.provider);
      return (
        provider &&
        row.client_id?.trim() &&
        row.redirect_uri?.trim() &&
        row.client_secret_encrypted
      );
    })
    .map((row): AuthProviderPublicItem => {
      const provider = readAuthProvider(row.provider)!;
      return {
        displayName: row.display_name || getAuthProviderDefaults(provider).displayName,
        provider,
      };
    });

  return { items };
}

export async function createOAuthAuthorization(
  providerValue: string,
  input: OAuthAuthorizationInput,
  client: DbClient = db
) {
  const provider = readProvider(providerValue);
  const config = await getProviderConfig(provider, client);
  const state = createRandomToken(32);
  const codeVerifier = createRandomToken(32);
  const authorizationUrl =
    provider === "google"
      ? new URL("https://accounts.google.com/o/oauth2/v2/auth")
      : new URL("https://github.com/login/oauth/authorize");

  if (provider === "google") authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", config.clientId);
  authorizationUrl.searchParams.set("redirect_uri", config.redirectUri);
  authorizationUrl.searchParams.set("scope", config.scopes.join(" "));
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("code_challenge", createCodeChallenge(codeVerifier));
  authorizationUrl.searchParams.set("code_challenge_method", "S256");

  await client`
    INSERT INTO oauth_login_states (
      provider, state_hash, code_verifier, return_to, expires_at
    )
    VALUES (
      ${provider},
      ${hashToken(state)},
      ${codeVerifier},
      ${sanitizeReturnTo(input.returnTo)},
      ${addMinutes(new Date(), OAUTH_STATE_MINUTES)}
    )
  `;

  return {
    authorizationUrl: authorizationUrl.toString(),
    provider,
  };
}

export async function completeOAuthLogin(
  providerValue: string,
  input: OAuthCallbackInput,
  meta: RequestMeta,
  options: OAuthServiceOptions = {}
) {
  const provider = readProvider(providerValue);
  const client = options.client ?? db;
  const fetcher = options.fetch ?? fetch;
  const config = await getProviderConfig(provider, client);
  const state = await withTransaction(async (tx) => {
    const [row] = await tx<OAuthStateRow[]>`
      SELECT code_verifier, return_to
      FROM oauth_login_states
      WHERE provider = ${provider}
        AND state_hash = ${hashToken(input.state)}
        AND consumed_at IS NULL
        AND expires_at > now()
      LIMIT 1
      FOR UPDATE
    `;

    if (!row) throw validationError("第三方登录状态无效或已过期");

    await tx`
      UPDATE oauth_login_states
      SET consumed_at = now()
      WHERE provider = ${provider}
        AND state_hash = ${hashToken(input.state)}
    `;

    return row;
  }, client);
  const identity = await fetchOAuthIdentity({
    code: input.code,
    codeVerifier: state.code_verifier,
    config,
    fetcher,
    provider,
  });

  const { ticket, user } = await withTransaction(async (tx) => {
    const oauthUser = await findOrCreateOAuthUser(provider, identity, tx);
    const ticketValue = createRandomToken(32);

    await tx`
      INSERT INTO oauth_login_tickets (
        provider, user_id, ticket_hash, return_to, expires_at
      )
      VALUES (
        ${provider},
        ${oauthUser.id},
        ${hashToken(ticketValue)},
        ${sanitizeReturnTo(state.return_to)},
        ${addMinutes(new Date(), OAUTH_TICKET_MINUTES)}
      )
    `;

    return {
      ticket: ticketValue,
      user: oauthUser,
    };
  }, client);

  return {
    provider,
    redirectUrl: createOAuthTicketRedirectUrl({
      provider,
      returnTo: state.return_to,
      ticket,
    }),
    returnTo: sanitizeReturnTo(state.return_to),
    ticket,
    user,
    userAgent: meta.userAgent,
  };
}

export async function consumeOAuthLoginTicket(
  ticket: string,
  meta: RequestMeta,
  options: OAuthServiceOptions = {}
) {
  const client = options.client ?? db;

  const user = await withTransaction(async (tx) => {
    const [row] = await tx<(UserProfileRow & { ticket_id: string; ticket_provider: AuthProvider })[]>`
      SELECT t.id AS ticket_id, t.provider AS ticket_provider,
             u.id, u.username, u.email, u.name, u.description, u.tags, u.role,
             u.avatar_url, u.social_links, u.blog_url,
             u.comment_email_notifications_enabled,
             u.new_article_email_notifications_enabled,
             u.created_at, u.updated_at, u.last_login_at,
             host(u.last_login_ip) AS last_login_ip, u.last_login_location,
             u.last_login_device, u.last_login_method
      FROM oauth_login_tickets t
      JOIN users u ON u.id = t.user_id
      WHERE t.ticket_hash = ${hashToken(ticket)}
        AND t.consumed_at IS NULL
        AND t.expires_at > now()
      LIMIT 1
      FOR UPDATE
    `;

    if (!row) throw validationError("第三方登录票据无效或已过期");

    const device = { userAgent: meta.userAgent };
    const location = await resolveLoginLocation(meta, tx);
    await tx`
      UPDATE oauth_login_tickets
      SET consumed_at = now()
      WHERE id = ${row.ticket_id}
    `;
    await tx`
      UPDATE users
      SET last_login_at = now(),
          last_login_ip = ${meta.ip},
          last_login_location = ${location}::jsonb,
          last_login_device = ${device}::jsonb,
          last_login_method = ${row.ticket_provider}
      WHERE id = ${row.id}
    `;

    return toUserProfile({
      ...row,
      last_login_at: new Date(),
      last_login_device: device,
      last_login_ip: meta.ip,
      last_login_location: location,
      last_login_method: row.ticket_provider,
    });
  }, client);

  return {
    user,
  };
}
