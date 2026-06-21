import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  listAuthProviderSettings,
  revealAuthProviderClientSecret,
  updateAuthProviderSettings,
} from "../src/admin/system/auth-providers";
import {
  completeOAuthLogin,
  consumeOAuthLoginTicket,
  createOAuthAuthorization,
  listPublicAuthProviders,
} from "../src/auth/oauth";
import { hashPassword, hashToken } from "../src/shared/auth";
import type { AuthUser } from "../src/shared/auth";
import { decryptSecret, encryptSecret } from "../src/shared/crypto";
import type { TestDatabase } from "./helpers/database";
import { createMigratedTestDatabase } from "./helpers/database";

let testDatabase: TestDatabase;
let testDb: Bun.SQL;

const adminUser: AuthUser = {
  avatarUrl: null,
  email: "admin@example.com",
  id: "00000000-0000-0000-0000-000000000001",
  name: "Admin",
  role: "admin",
  username: "admin",
};

const meta = {
  ip: "127.0.0.1",
  userAgent: "oauth-test",
};

function oauthFetch(
  payload: {
    email?: string | null;
    emails?: Array<{ email: string; primary?: boolean; verified?: boolean }>;
    id?: number;
    login?: string;
    name?: string | null;
  } = {}
) {
  const calls: string[] = [];
  const fetcher = async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);

    if (url === "https://github.com/login/oauth/access_token") {
      return Response.json({
        access_token: "github-access-token",
        scope: "read:user,user:email",
        token_type: "bearer",
      });
    }

    if (url === "https://api.github.com/user") {
      return Response.json({
        avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
        email: payload.email ?? null,
        html_url: `https://github.com/${payload.login ?? "octocat"}`,
        id: payload.id ?? 1,
        login: payload.login ?? "octocat",
        name: payload.name ?? "Octo Cat",
      });
    }

    if (url === "https://api.github.com/user/emails") {
      return Response.json(
        payload.emails ?? [
          {
            email: "octocat@example.com",
            primary: true,
            verified: true,
          },
        ]
      );
    }

    throw new Error(`Unexpected OAuth fetch URL: ${url}`);
  };

  return {
    calls,
    fetcher,
  };
}

function googleOauthFetch(
  payload: {
    email?: string;
    emailVerified?: boolean;
    name?: string;
    picture?: string;
    sub?: string;
  } = {}
) {
  const calls: string[] = [];
  const fetcher = async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);

    if (url === "https://oauth2.googleapis.com/token") {
      return Response.json({
        access_token: "google-access-token",
        scope: "openid profile email",
        token_type: "bearer",
      });
    }

    if (url === "https://openidconnect.googleapis.com/v1/userinfo") {
      return Response.json({
        email: payload.email ?? "reader-google@example.com",
        email_verified: payload.emailVerified ?? true,
        name: payload.name ?? "Google Reader",
        picture: payload.picture ?? "https://lh3.googleusercontent.com/a/default-user",
        sub: payload.sub ?? "google-sub-1",
      });
    }

    throw new Error(`Unexpected Google OAuth fetch URL: ${url}`);
  };

  return {
    calls,
    fetcher,
  };
}

async function configureGithubProvider({
  clientId = "github-client-id",
  redirectUri = "https://taolei.net/api/auth/oauth/github/callback",
  secret = "github-client-secret",
} = {}) {
  return updateAuthProviderSettings(
    adminUser,
    "github",
    {
      clientId,
      clientSecret: secret,
      displayName: "GitHub",
      enabled: true,
      redirectUri,
      scopes: ["read:user", "user:email"],
    },
    testDb
  );
}

async function configureGoogleProvider({
  clientId = "google-client-id",
  redirectUri = "https://taolei.net/api/auth/oauth/google/callback",
  secret = "google-client-secret",
} = {}) {
  return updateAuthProviderSettings(
    adminUser,
    "google",
    {
      clientId,
      clientSecret: secret,
      displayName: "Google",
      enabled: true,
      redirectUri,
      scopes: ["openid", "profile", "email"],
    },
    testDb
  );
}

async function configureLocationProviders() {
  await testDb`
    INSERT INTO site_config (id, deepl_api_key_encrypted, ipgeolocation_api_key_encrypted)
    VALUES (
      1,
      ${JSON.stringify(encryptSecret("deepl-oauth-test"))}::jsonb,
      ${JSON.stringify(encryptSecret("ipgeo-oauth-test"))}::jsonb
    )
    ON CONFLICT (id) DO UPDATE
    SET deepl_api_key_encrypted = EXCLUDED.deepl_api_key_encrypted,
        ipgeolocation_api_key_encrypted = EXCLUDED.ipgeolocation_api_key_encrypted
  `;
}

function installLocationFetch() {
  const originalFetch = globalThis.fetch;
  const locationFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://api.ipgeolocation.io/ipgeo")) {
      return Response.json({
        country_name: "United States",
        city: "San Jose",
      });
    }
    if (url.includes("api-free.deepl.com") || url.includes("api.deepl.com")) {
      expect(JSON.parse(String(init?.body))).toEqual({
        target_lang: "ZH-HANS",
        text: ["United States San Jose"],
      });
      return Response.json({ translations: [{ text: "美国 圣何塞" }] });
    }

    throw new Error(`Unexpected location fetch URL: ${url}`);
  };

  globalThis.fetch = Object.assign(locationFetch, {
    preconnect: originalFetch.preconnect,
  });

  return () => {
    globalThis.fetch = originalFetch;
  };
}

async function createStartedGithubState(returnTo = "/profile") {
  const authorization = await createOAuthAuthorization(
    "github",
    {
      returnTo,
    },
    testDb
  );
  const authorizationUrl = new URL(authorization.authorizationUrl);

  return {
    authorization,
    state: authorizationUrl.searchParams.get("state") ?? "",
    url: authorizationUrl,
  };
}

async function createStartedGoogleState(returnTo = "/profile") {
  const authorization = await createOAuthAuthorization(
    "google",
    {
      returnTo,
    },
    testDb
  );
  const authorizationUrl = new URL(authorization.authorizationUrl);

  return {
    authorization,
    state: authorizationUrl.searchParams.get("state") ?? "",
    url: authorizationUrl,
  };
}

beforeAll(async () => {
  testDatabase = await createMigratedTestDatabase("lei_blog_oauth_test");
  testDb = new Bun.SQL(testDatabase.databaseUrl, { max: 1 });
});

afterAll(async () => {
  await testDb?.close({ timeout: 1 });
  await testDatabase?.drop();
});

describe("OAuth login providers", () => {
  test("stores provider secrets encrypted and exposes only public enabled providers", async () => {
    const initialSettings = await listAuthProviderSettings(adminUser, testDb);
    expect(initialSettings.items).toEqual([
      {
        clientId: null,
        displayName: "GitHub",
        enabled: false,
        hasClientSecret: false,
        provider: "github",
        redirectUri: null,
        scopes: ["read:user", "user:email"],
      },
      {
        clientId: null,
        displayName: "Google",
        enabled: false,
        hasClientSecret: false,
        provider: "google",
        redirectUri: null,
        scopes: ["openid", "profile", "email"],
      },
    ]);
    expect(await listPublicAuthProviders(testDb)).toEqual({ items: [] });

    const saved = await configureGithubProvider();
    expect(saved.item).toMatchObject({
      clientId: "github-client-id",
      displayName: "GitHub",
      enabled: true,
      hasClientSecret: true,
      provider: "github",
      redirectUri: "https://taolei.net/api/auth/oauth/github/callback",
      scopes: ["read:user", "user:email"],
    });

    const [stored] = await testDb<{
      client_secret_encrypted: unknown;
    }[]>`
      SELECT client_secret_encrypted
      FROM auth_provider_settings
      WHERE provider = 'github'
    `;

    expect(JSON.stringify(stored.client_secret_encrypted)).not.toContain(
      "github-client-secret"
    );
    expect(decryptSecret(stored.client_secret_encrypted as never)).toBe(
      "github-client-secret"
    );
    expect(await listPublicAuthProviders(testDb)).toEqual({
      items: [
        {
          displayName: "GitHub",
          provider: "github",
        },
      ],
    });

    const disabled = await updateAuthProviderSettings(
      adminUser,
      "github",
      {
        clientId: null,
        clientSecret: null,
        displayName: "GitHub",
        enabled: false,
        redirectUri: null,
        scopes: ["read:user", "user:email"],
      },
      testDb
    );
    expect(disabled.item).toMatchObject({
      clientId: null,
      enabled: false,
      hasClientSecret: false,
      redirectUri: null,
    });
  });

  test("reveals a provider Client Secret only after administrator email verification", async () => {
    await configureGithubProvider({
      clientId: "github-client-id-reveal",
      secret: "github-client-secret-reveal",
    });
    await testDb`
      INSERT INTO email_verification_codes (email, code_hash, purpose, expires_at)
      VALUES (
        ${adminUser.email},
        ${hashToken("123456")},
        'email_change',
        now() + interval '10 minutes'
      )
    `;

    await expect(
      revealAuthProviderClientSecret(
        adminUser,
        "microsoft",
        { emailCode: "123456" },
        testDb
      )
    ).rejects.toThrow("不支持的登录方式");

    const revealed = await revealAuthProviderClientSecret(
      adminUser,
      "github",
      { emailCode: "123456" },
      testDb
    );

    expect(revealed).toEqual({
      item: {
        clientSecret: "github-client-secret-reveal",
        provider: "github",
      },
      ok: true,
    });

    await expect(
      revealAuthProviderClientSecret(
        adminUser,
        "github",
        { emailCode: "123456" },
        testDb
      )
    ).rejects.toThrow("邮箱验证码无效或已过期");
  });

  test("creates a GitHub authorization URL and turns a callback into a one-time login ticket", async () => {
    await configureGithubProvider({
      clientId: "github-client-id-callback",
      secret: "github-client-secret-callback",
    });

    const { state, url } = await createStartedGithubState("/profile");
    expect(url.origin + url.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("github-client-id-callback");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://taolei.net/api/auth/oauth/github/callback"
    );
    expect(url.searchParams.get("scope")).toBe("read:user user:email");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(state).toHaveLength(43);

    const { fetcher } = oauthFetch();
    const loginTicket = await completeOAuthLogin(
      "github",
      {
        code: "github-code",
        state,
      },
      meta,
      {
        client: testDb,
        fetch: fetcher,
      }
    );

    expect(loginTicket).toMatchObject({
      provider: "github",
      returnTo: "/profile",
    });
    expect(loginTicket.ticket).toHaveLength(43);

    const session = await consumeOAuthLoginTicket(loginTicket.ticket, meta, {
      client: testDb,
    });
    expect(session.user).toMatchObject({
      avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
      blogUrl: "https://github.com/octocat",
      email: "octocat@example.com",
      name: "Octo Cat",
      role: "user",
      username: "octocat",
    });

    const [linkedAccount] = await testDb<{
      provider_email: string | null;
      provider_user_id: string;
      user_id: string;
    }[]>`
      SELECT user_id, provider_user_id, provider_email
      FROM user_oauth_accounts
      WHERE provider = 'github'
    `;
    expect(linkedAccount).toEqual({
      provider_email: "octocat@example.com",
      provider_user_id: "1",
      user_id: session.user.id,
    });

    await expect(
      consumeOAuthLoginTicket(loginTicket.ticket, meta, { client: testDb })
    ).rejects.toThrow("第三方登录票据无效或已过期");
  });

  test("records login location and method when consuming a GitHub login ticket", async () => {
    await configureLocationProviders();
    await configureGithubProvider({
      clientId: "github-client-id-location",
      secret: "github-client-secret-location",
    });
    const restoreFetch = installLocationFetch();

    try {
      const { state } = await createStartedGithubState("/profile");
      const { fetcher } = oauthFetch({
        emails: [
          {
            email: "octocat-location@example.com",
            primary: true,
            verified: true,
          },
        ],
        id: 10,
        login: "octocat-location",
      });
      const loginTicket = await completeOAuthLogin(
        "github",
        {
          code: "github-code-location",
          state,
        },
        { ip: "8.8.8.8", userAgent: "github-location-browser" },
        {
          client: testDb,
          fetch: fetcher,
        }
      );
      const session = await consumeOAuthLoginTicket(
        loginTicket.ticket,
        { ip: "8.8.8.8", userAgent: "github-location-browser" },
        { client: testDb }
      );

      expect(session.user.lastLoginLocation).toBe("美国 圣何塞");
      expect(session.user.lastLoginMethod).toBe("github");

      const [stored] = await testDb<{
        last_login_method: string | null;
        location: string | null;
      }[]>`
        SELECT last_login_method,
               last_login_location->>'location' AS location
        FROM users
        WHERE id = ${session.user.id}
      `;
      expect(stored).toEqual({
        last_login_method: "github",
        location: "美国 圣何塞",
      });
    } finally {
      restoreFetch();
    }
  });

  test("creates a Google authorization URL and turns a callback into a one-time login ticket", async () => {
    await configureGoogleProvider({
      clientId: "google-client-id-callback",
      secret: "google-client-secret-callback",
    });

    const { state, url } = await createStartedGoogleState("/profile");
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("google-client-id-callback");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://taolei.net/api/auth/oauth/google/callback"
    );
    expect(url.searchParams.get("scope")).toBe("openid profile email");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(state).toHaveLength(43);

    const { fetcher } = googleOauthFetch();
    const loginTicket = await completeOAuthLogin(
      "google",
      {
        code: "google-code",
        state,
      },
      meta,
      {
        client: testDb,
        fetch: fetcher,
      }
    );

    expect(loginTicket).toMatchObject({
      provider: "google",
      returnTo: "/profile",
    });
    expect(loginTicket.ticket).toHaveLength(43);

    const session = await consumeOAuthLoginTicket(loginTicket.ticket, meta, {
      client: testDb,
    });
    expect(session.user).toMatchObject({
      avatarUrl: "https://lh3.googleusercontent.com/a/default-user",
      blogUrl: null,
      email: "reader-google@example.com",
      name: "Google Reader",
      role: "user",
      username: "reader-google",
    });

    const [linkedAccount] = await testDb<{
      provider_email: string | null;
      provider_user_id: string;
      user_id: string;
    }[]>`
      SELECT user_id, provider_user_id, provider_email
      FROM user_oauth_accounts
      WHERE provider = 'google'
    `;
    expect(linkedAccount).toEqual({
      provider_email: "reader-google@example.com",
      provider_user_id: "google-sub-1",
      user_id: session.user.id,
    });
  });

  test("records login location and method when consuming a Google login ticket", async () => {
    await configureLocationProviders();
    await configureGoogleProvider({
      clientId: "google-client-id-location",
      secret: "google-client-secret-location",
    });
    const restoreFetch = installLocationFetch();

    try {
      const { state } = await createStartedGoogleState("/profile");
      const { fetcher } = googleOauthFetch({
        email: "reader-google-location@example.com",
        sub: "google-sub-location",
      });
      const loginTicket = await completeOAuthLogin(
        "google",
        {
          code: "google-code-location",
          state,
        },
        { ip: "8.8.4.4", userAgent: "google-location-browser" },
        {
          client: testDb,
          fetch: fetcher,
        }
      );
      const session = await consumeOAuthLoginTicket(
        loginTicket.ticket,
        { ip: "8.8.4.4", userAgent: "google-location-browser" },
        { client: testDb }
      );

      expect(session.user.lastLoginLocation).toBe("美国 圣何塞");
      expect(session.user.lastLoginMethod).toBe("google");

      const [stored] = await testDb<{
        last_login_method: string | null;
        location: string | null;
      }[]>`
        SELECT last_login_method,
               last_login_location->>'location' AS location
        FROM users
        WHERE id = ${session.user.id}
      `;
      expect(stored).toEqual({
        last_login_method: "google",
        location: "美国 圣何塞",
      });
    } finally {
      restoreFetch();
    }
  });

  test("binds a verified GitHub email to an existing normal user", async () => {
    const [existingUser] = await testDb<{ id: string }[]>`
      INSERT INTO users (username, password_hash, email, role)
      VALUES (
        'oauth-reader',
        ${await hashPassword("reader-password")},
        'reader-oauth@example.com',
        'user'
      )
      RETURNING id
    `;
    await configureGithubProvider({
      clientId: "github-client-id-bind",
      secret: "github-client-secret-bind",
    });
    const { state } = await createStartedGithubState();
    const { fetcher } = oauthFetch({
      emails: [
        {
          email: "reader-oauth@example.com",
          primary: true,
          verified: true,
        },
      ],
      id: 2,
      login: "reader-oauth",
      name: "Reader OAuth",
    });

    const ticket = await completeOAuthLogin(
      "github",
      {
        code: "github-code-bind",
        state,
      },
      meta,
      {
        client: testDb,
        fetch: fetcher,
      }
    );
    const session = await consumeOAuthLoginTicket(ticket.ticket, meta, {
      client: testDb,
    });

    expect(session.user.id).toBe(existingUser.id);
    expect(session.user.role).toBe("user");
  });

  test("rejects binding a second GitHub identity to the same user", async () => {
    const [existingUser] = await testDb<{ id: string }[]>`
      INSERT INTO users (username, password_hash, email, role)
      VALUES (
        'oauth-linked-reader',
        ${await hashPassword("reader-password")},
        'linked-reader@example.com',
        'user'
      )
      RETURNING id
    `;
    await testDb`
      INSERT INTO user_oauth_accounts (
        user_id, provider, provider_user_id, provider_username, provider_email
      )
      VALUES (
        ${existingUser.id}, 'github', 'old-github-id', 'old-reader',
        'linked-reader@example.com'
      )
    `;
    await configureGithubProvider({
      clientId: "github-client-id-second-bind",
      secret: "github-client-secret-second-bind",
    });
    const { state } = await createStartedGithubState();
    const { fetcher } = oauthFetch({
      emails: [
        {
          email: "linked-reader@example.com",
          primary: true,
          verified: true,
        },
      ],
      id: 4,
      login: "new-reader",
    });

    await expect(
      completeOAuthLogin(
        "github",
        {
          code: "github-code-second-bind",
          state,
        },
        meta,
        {
          client: testDb,
          fetch: fetcher,
        }
      )
    ).rejects.toThrow("该账号已绑定其他 GitHub 登录身份");
  });

  test("allows administrator accounts to use OAuth for front login sessions", async () => {
    const [admin] = await testDb<{ id: string }[]>`
      INSERT INTO users (username, password_hash, email, role)
      VALUES (
        'oauth-admin',
        ${await hashPassword("admin-password")},
        'oauth-admin@example.com',
        'admin'
      )
      RETURNING id
    `;
    await configureGithubProvider({
      clientId: "github-client-id-admin",
      secret: "github-client-secret-admin",
    });
    const { state } = await createStartedGithubState();
    const { fetcher } = oauthFetch({
      emails: [
        {
          email: "oauth-admin@example.com",
          primary: true,
          verified: true,
        },
      ],
      id: 3,
      login: "oauth-admin",
    });

    const ticket = await completeOAuthLogin(
      "github",
      {
        code: "github-code-admin",
        state,
      },
      meta,
      {
        client: testDb,
        fetch: fetcher,
      }
    );
    const session = await consumeOAuthLoginTicket(ticket.ticket, meta, {
      client: testDb,
    });

    expect(session.user).toMatchObject({
      email: "oauth-admin@example.com",
      id: admin.id,
      role: "admin",
      username: "oauth-admin",
    });
  });
});
