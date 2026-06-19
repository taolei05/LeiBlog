import { createApp } from "../../src/app";
import { hashPassword } from "../../src/shared/auth";
import {
  clearAllArticleCache,
  clearSiteCache,
} from "../../src/shared/cache/content";
import { db } from "../../src/shared/db";
import { closeRedis, getRedis } from "../../src/shared/redis";

interface AuthBody {
  token: string;
  user: {
    id: string;
    role: "admin" | "user";
  };
}

interface ListBody<T> {
  items: T[];
  total: number;
}

interface ArticleBody {
  id: string;
  slug: string;
  title: string;
  contentMdx?: string;
  commentCount: number;
}

interface MeBody {
  ok: boolean;
  user: {
    id: string;
    username: string;
    email: string | null;
    name: string | null;
    description: string;
    tags: string[];
    role: "admin" | "user";
    avatarUrl: string | null;
    socialLinks: Record<string, string>;
    blogUrl: string | null;
    commentEmailNotificationsEnabled: boolean;
    newArticleEmailNotificationsEnabled: boolean;
    createdAt: string;
    updatedAt: string;
    lastLoginAt: string | null;
    lastLoginIp: string | null;
    lastLoginLocation: string | null;
    lastLoginDevice: string | null;
  };
}

interface AuthProvidersBody {
  items: Array<{
    displayName: string;
    provider: string;
  }>;
}

interface AuthProviderSettingsBody {
  items: Array<{
    clientId: string | null;
    displayName: string;
    enabled: boolean;
    hasClientSecret: boolean;
    provider: string;
    redirectUri: string | null;
    scopes: string[];
  }>;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertNullableString(value: unknown, message: string) {
  assert(value === null || typeof value === "string", message);
}

function assertUserProfileShape(user: MeBody["user"]) {
  assert(typeof user.id === "string" && user.id, "用户资料应包含 id");
  assert(typeof user.username === "string" && user.username, "用户资料应包含 username");
  assertNullableString(user.email, "用户资料应包含 email");
  assertNullableString(user.name, "用户资料应包含 name");
  assert(typeof user.description === "string", "用户资料应包含 description");
  assert(
    Array.isArray(user.tags) && user.tags.every((tag) => typeof tag === "string"),
    "用户资料应包含 tags"
  );
  assert(user.role === "admin" || user.role === "user", "用户资料应包含 role");
  assertNullableString(user.avatarUrl, "用户资料应包含 avatarUrl");
  assert(isRecord(user.socialLinks), "用户资料应包含 socialLinks");
  assertNullableString(user.blogUrl, "用户资料应包含 blogUrl");
  assert(
    typeof user.commentEmailNotificationsEnabled === "boolean",
    "用户资料应包含 commentEmailNotificationsEnabled"
  );
  assert(
    typeof user.newArticleEmailNotificationsEnabled === "boolean",
    "用户资料应包含 newArticleEmailNotificationsEnabled"
  );
  assert(typeof user.createdAt === "string", "用户资料应包含 createdAt");
  assert(typeof user.updatedAt === "string", "用户资料应包含 updatedAt");
  assertNullableString(user.lastLoginAt, "用户资料应包含 lastLoginAt");
  assertNullableString(user.lastLoginIp, "用户资料应包含 lastLoginIp");
  assertNullableString(user.lastLoginLocation, "用户资料应包含 lastLoginLocation");
  assertNullableString(user.lastLoginDevice, "用户资料应包含 lastLoginDevice");
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`响应不是 JSON：${text}`);
  }
}

async function expectJson<T>(response: Response, status: number) {
  const body = await readJson<T>(response);
  assert(response.status === status, `期望状态码 ${status}，实际 ${response.status}：${JSON.stringify(body)}`);
  return body;
}

async function expectText(response: Response, status: number) {
  const body = await response.text();
  assert(response.status === status, `期望状态码 ${status}，实际 ${response.status}：${body}`);
  return body;
}

function jsonHeaders(token?: string) {
  return {
    "content-type": "application/json",
    "user-agent": "leiblog-route-test",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

async function clearRateLimits() {
  const redis = await getRedis();
  const keys = await redis.keys("rate:*");
  if (keys.length > 0) await redis.del(keys);
}

async function expectRateLimited(response: Response) {
  const body = await expectJson<{
    code: string;
    details: {
      retryAfterSeconds: number;
    };
  }>(response, 429);

  assert(body.code === "RATE_LIMITED", "超限响应应返回 RATE_LIMITED");
  assert(
    body.details.retryAfterSeconds > 0,
    "超限响应应返回剩余等待秒数"
  );
  assert(
    Number(response.headers.get("retry-after")) === body.details.retryAfterSeconds,
    "超限响应头应返回剩余等待秒数"
  );
}

async function seedRouteData() {
  await clearSiteCache();
  await clearAllArticleCache();
  await clearRateLimits();

  await db`
    INSERT INTO site_info (
      id, site_name, description, established_at
    )
    VALUES (1, 'LeiBlog Routes', '路由测试站点', now())
  `;
  await db`
    INSERT INTO site_config (
      id, seo_title, seo_description, seo_keywords, copyright, comments_enabled
    )
    VALUES (
      1,
      'LeiBlog Routes',
      '路由测试',
      ${db.array(["LeiBlog", "Routes"], "TEXT")},
      'Copyright',
      true
    )
  `;
  await db`
    INSERT INTO site_filing (id, icp_records, police_number, police_url)
    VALUES (
      1,
      ${JSON.stringify([{ number: "ICP-route", url: "https://beian.example.com" }])}::jsonb,
      'Police-route',
      'https://police.example.com'
    )
  `;

  const [admin] = await db<{ id: string }[]>`
    INSERT INTO users (username, password_hash, email, role)
    VALUES ('route-admin', ${await hashPassword("admin-password")}, 'route-admin@example.com', 'admin')
    RETURNING id
  `;
  const [user] = await db<{ id: string }[]>`
    INSERT INTO users (username, password_hash, email, role)
    VALUES ('route-user', ${await hashPassword("user-password")}, 'route-user@example.com', 'user')
    RETURNING id
  `;

  const [article] = await db<{ id: string; slug: string }[]>`
    INSERT INTO articles (
      author_id, title, slug, summary, content_mdx, status, is_pinned, published_at
    )
    VALUES (
      ${admin.id},
      '路由缓存文章',
      'route-post',
      '路由测试摘要',
      '# 路由缓存文章',
      'published',
      true,
      now()
    )
    RETURNING id, slug
  `;

  await db`
    INSERT INTO comments (article_id, user_id, content, status)
    VALUES (${article.id}, ${user.id}, '第一条公开评论', 'approved')
  `;
  const [navigationGroup] = await db<{ id: string }[]>`
    INSERT INTO navigation_groups (name, sort_order)
    VALUES ('路由导航', 0)
    RETURNING id
  `;
  await db`
    INSERT INTO navigation_items (group_id, name, url, note, sort_order)
    VALUES (${navigationGroup.id}, '路由网站', 'https://routes.example.com', '路由测试网站', 0)
  `;

  return {
    article,
    adminId: admin.id,
    userId: user.id,
  };
}

async function login(app: Awaited<ReturnType<typeof createApp>>, identifier: string, password: string) {
  const response = await app.handle(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ identifier, password }),
    })
  );

  return expectJson<AuthBody>(response, 200);
}

async function main() {
  const seeded = await seedRouteData();
  const app = await createApp({ enableStatic: false });

  const siteInfo = await expectJson<{ item: { siteName: string } }>(
    await app.handle(new Request("http://localhost/api/public/site/info")),
    200
  );
  assert(siteInfo.item.siteName === "LeiBlog Routes", "公共站点信息路由应返回已配置站点");

  const publicList = await expectJson<ListBody<ArticleBody>>(
    await app.handle(new Request("http://localhost/api/public/articles?search=route-post")),
    200
  );
  assert(publicList.total === 1, "公共文章列表应返回已发布文章");
  assert(publicList.items[0]?.slug === "route-post", "公共文章列表 slug 不正确");

  const publicDetail = await expectJson<{ item: ArticleBody }>(
    await app.handle(new Request("http://localhost/api/public/articles/slug/route-post")),
    200
  );
  assert(publicDetail.item.contentMdx === "# 路由缓存文章", "公共文章详情应返回 MDX 内容");
  assert(publicDetail.item.commentCount === 1, "公共文章详情应返回评论数量");

  const rss = await expectText(await app.handle(new Request("https://taolei.test/rss.xml")), 200);
  assert(rss.includes("<rss"), "RSS 应返回 rss 文档");
  assert(rss.includes("LeiBlog Routes"), "RSS 应包含站点标题");
  assert(rss.includes("https://taolei.test/articles/route-post"), "RSS 应包含文章链接");

  const atom = await expectText(await app.handle(new Request("https://taolei.test/atom.xml")), 200);
  assert(atom.includes("<feed"), "Atom 应返回 feed 文档");
  assert(atom.includes("https://taolei.test/articles/route-post"), "Atom 应包含文章链接");

  const sitemap = await expectText(
    await app.handle(new Request("https://taolei.test/sitemap.xml")),
    200
  );
  assert(sitemap.includes("<urlset"), "sitemap 应返回 urlset");
  assert(sitemap.includes("https://taolei.test/articles/route-post"), "sitemap 应包含文章链接");

  const robots = await expectText(await app.handle(new Request("https://taolei.test/robots.txt")), 200);
  assert(robots.includes("User-agent: *"), "robots 应包含默认爬虫规则");
  assert(robots.includes("Sitemap: https://taolei.test/sitemap.xml"), "robots 应指向 sitemap");

  const comments = await expectJson<ListBody<{ content: string }>>(
    await app.handle(
      new Request(`http://localhost/api/public/articles/${seeded.article.id}/comments`)
    ),
    200
  );
  assert(comments.total === 1, "公共评论列表应按文章 ID 返回评论");

  const publicNavigation = await expectJson<{
    groups: Array<{ items: Array<{ name: string }>; name: string }>;
  }>(
    await app.handle(new Request("http://localhost/api/public/navigation")),
    200
  );
  assert(publicNavigation.groups[0]?.name === "路由导航", "公共导航路由应返回导航分组");
  assert(publicNavigation.groups[0]?.items[0]?.name === "路由网站", "公共导航路由应返回网站");

  const adminAuth = await login(app, "route-admin", "admin-password");
  assert(adminAuth.user.id === seeded.adminId, "管理员登录用户不正确");
  const userAuth = await login(app, "route-user", "user-password");
  assert(userAuth.user.id === seeded.userId, "普通用户登录用户不正确");

  const initialPublicProviders = await expectJson<AuthProvidersBody>(
    await app.handle(new Request("http://localhost/api/auth/providers")),
    200
  );
  assert(initialPublicProviders.items.length === 0, "未启用时公开登录方式应为空");

  await expectJson(
    await app.handle(new Request("http://localhost/api/admin/system/auth-providers/github", {
      method: "PATCH",
      headers: jsonHeaders(userAuth.token),
      body: JSON.stringify({
        clientId: "route-github-client",
        clientSecret: "route-github-secret",
        displayName: "GitHub",
        enabled: true,
        redirectUri: "http://localhost/api/auth/oauth/github/callback",
        scopes: ["read:user", "user:email"],
      }),
    })),
    403
  );

  await expectJson(
    await app.handle(new Request("http://localhost/api/admin/system/auth-providers/github", {
      method: "PATCH",
      headers: jsonHeaders(adminAuth.token),
      body: JSON.stringify({
        clientId: "route-github-client",
        clientSecret: "route-github-secret",
        displayName: "GitHub",
        enabled: true,
        redirectUri: "http://localhost/api/auth/oauth/github/callback",
        scopes: ["read:user", "user:email"],
      }),
    })),
    200
  );

  const providerSettings = await expectJson<AuthProviderSettingsBody>(
    await app.handle(new Request("http://localhost/api/admin/system/auth-providers", {
      headers: jsonHeaders(adminAuth.token),
    })),
    200
  );
  const githubSettings = providerSettings.items.find((item) => item.provider === "github");
  assert(githubSettings?.enabled === true, "后台登录方式配置应返回已启用的 GitHub");
  assert(githubSettings.hasClientSecret === true, "后台登录方式配置应隐藏并标记 Client Secret");

  const publicProviders = await expectJson<AuthProvidersBody>(
    await app.handle(new Request("http://localhost/api/auth/providers")),
    200
  );
  assert(publicProviders.items[0]?.provider === "github", "公开登录方式应返回 GitHub");

  const oauthStart = await app.handle(
    new Request("http://localhost/api/auth/oauth/github/start?returnTo=/login")
  );
  assert(oauthStart.status === 302, "GitHub OAuth start 应重定向到 GitHub");
  const githubAuthorizeUrl = new URL(oauthStart.headers.get("location") ?? "");
  assert(
    githubAuthorizeUrl.origin + githubAuthorizeUrl.pathname ===
      "https://github.com/login/oauth/authorize",
    "GitHub OAuth start 应使用 GitHub 授权地址"
  );
  assert(
    githubAuthorizeUrl.searchParams.get("client_id") === "route-github-client",
    "GitHub OAuth start 应包含配置的 Client ID"
  );
  const oauthState = githubAuthorizeUrl.searchParams.get("state");
  assert(oauthState, "GitHub OAuth start 应包含 state");

  const originalFetch = globalThis.fetch;
  const routeOauthFetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "https://github.com/login/oauth/access_token") {
      return Response.json({
        access_token: "route-github-access-token",
        scope: "read:user,user:email",
        token_type: "bearer",
      });
    }
    if (url === "https://api.github.com/user") {
      return Response.json({
        avatar_url: "https://avatars.githubusercontent.com/u/123?v=4",
        email: null,
        html_url: "https://github.com/route-octocat",
        id: 123,
        login: "route-octocat",
        name: "Route Octocat",
      });
    }
    if (url === "https://api.github.com/user/emails") {
      return Response.json([
        {
          email: "route-oauth@example.com",
          primary: true,
          verified: true,
        },
      ]);
    }
    throw new Error(`Unexpected route OAuth fetch URL: ${url}`);
  };
  globalThis.fetch = Object.assign(routeOauthFetch, {
    preconnect: originalFetch.preconnect,
  });
  try {
    const oauthCallback = await app.handle(
      new Request(
        `http://localhost/api/auth/oauth/github/callback?code=route-code&state=${oauthState}`
      )
    );
    assert(oauthCallback.status === 302, "GitHub OAuth callback 应重定向回前台");
    const callbackLocation = new URL(oauthCallback.headers.get("location") ?? "");
    const oauthTicket = callbackLocation.searchParams.get("oauth_ticket");
    assert(oauthTicket, "GitHub OAuth callback 应携带一次性登录票据");
    assert(
      callbackLocation.searchParams.get("oauth_provider") === "github",
      "GitHub OAuth callback 应携带 provider"
    );

    const oauthSession = await expectJson<AuthBody>(
      await app.handle(new Request("http://localhost/api/auth/oauth/ticket", {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ ticket: oauthTicket }),
      })),
      200
    );
    assert(oauthSession.user.role === "user", "OAuth 登录只能得到普通前台用户");
    assert(oauthSession.user.id !== seeded.adminId, "OAuth 登录不能得到管理员用户");
  } finally {
    globalThis.fetch = originalFetch;
  }

  await expectJson(
    await app.handle(new Request("http://localhost/api/me/preferences", {
      method: "PATCH",
      headers: jsonHeaders(),
      body: JSON.stringify({
        commentEmailNotificationsEnabled: false,
      }),
    })),
    401
  );

  const preferences = await expectJson<MeBody>(
    await app.handle(new Request("http://localhost/api/me/preferences", {
      method: "PATCH",
      headers: jsonHeaders(userAuth.token),
      body: JSON.stringify({
        commentEmailNotificationsEnabled: false,
        newArticleEmailNotificationsEnabled: false,
      }),
    })),
    200
  );
  assert(preferences.ok === true, "偏好更新响应应成功");
  assert(preferences.user.id === seeded.userId, "偏好更新应返回当前 token 用户");
  assert(
    preferences.user.commentEmailNotificationsEnabled === false,
    "偏好更新响应应返回已关闭邮件通知"
  );
  assert(
    preferences.user.newArticleEmailNotificationsEnabled === false,
    "偏好更新响应应返回已关闭新文章邮件通知"
  );
  assertUserProfileShape(preferences.user);

  const [currentUserPreferences] = await db<{
    comment_enabled: boolean;
    new_article_enabled: boolean;
  }[]>`
    SELECT
      comment_email_notifications_enabled AS comment_enabled,
      new_article_email_notifications_enabled AS new_article_enabled
    FROM users
    WHERE id = ${seeded.userId}
  `;
  const [otherUserPreferences] = await db<{
    comment_enabled: boolean;
    new_article_enabled: boolean;
  }[]>`
    SELECT
      comment_email_notifications_enabled AS comment_enabled,
      new_article_email_notifications_enabled AS new_article_enabled
    FROM users
    WHERE id = ${seeded.adminId}
  `;
  assert(
    currentUserPreferences?.comment_enabled === false,
    "当前用户评论邮件偏好应持久化为 false"
  );
  assert(
    currentUserPreferences?.new_article_enabled === false,
    "当前用户新文章邮件偏好应持久化为 false"
  );
  assert(otherUserPreferences?.comment_enabled === true, "其他用户评论邮件偏好应保持 true");
  assert(
    otherUserPreferences?.new_article_enabled === true,
    "其他用户新文章邮件偏好应保持 true"
  );

  const invalidPreferences = await expectJson<{ code: string }>(
    await app.handle(new Request("http://localhost/api/me/preferences", {
      method: "PATCH",
      headers: jsonHeaders(userAuth.token),
      body: JSON.stringify({
        commentEmailNotificationsEnabled: "false",
        newArticleEmailNotificationsEnabled: false,
      }),
    })),
    422
  );
  assert(invalidPreferences.code === "VALIDATION_ERROR", "非布尔偏好值应返回参数错误");

  await expectJson(
    await app.handle(new Request("http://localhost/api/admin/setup/unknown-session", {
      method: "POST",
      headers: jsonHeaders(),
    })),
    404
  );
  await expectJson(
    await app.handle(new Request("http://localhost/api/admin/setup/site-info", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        establishedAt: new Date().toISOString(),
        siteName: "Unauthorized setup change",
      }),
    })),
    401
  );

  const loginHeaders = {
    ...jsonHeaders(),
    "x-forwarded-for": "203.0.113.10",
  };
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await expectJson(
      await app.handle(new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: loginHeaders,
        body: JSON.stringify({
          identifier: "rate-limited-login",
          password: "wrong-password",
        }),
      })),
      401
    );
  }
  await expectRateLimited(
    await app.handle(new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: loginHeaders,
      body: JSON.stringify({
        identifier: "rate-limited-login",
        password: "wrong-password",
      }),
    }))
  );
  await clearRateLimits();

  const ipLoginHeaders = {
    ...jsonHeaders(),
    "x-forwarded-for": "203.0.113.14",
  };
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await expectJson(
      await app.handle(new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: ipLoginHeaders,
        body: JSON.stringify({
          identifier: `rate-limited-ip-${attempt}`,
          password: "wrong-password",
        }),
      })),
      401
    );
  }
  await expectRateLimited(
    await app.handle(new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: ipLoginHeaders,
      body: JSON.stringify({
        identifier: "rate-limited-ip-overflow",
        password: "wrong-password",
      }),
    }))
  );

  const emailCodeRequest = () =>
    app.handle(new Request("http://localhost/api/auth/email-code", {
      method: "POST",
      headers: {
        ...jsonHeaders(),
        "x-forwarded-for": "203.0.113.11",
      },
      body: JSON.stringify({
        email: "rate-code@example.com",
        purpose: "register",
      }),
    }));
  await expectJson(await emailCodeRequest(), 200);
  await expectRateLimited(await emailCodeRequest());

  const forgotPasswordRequest = () =>
    app.handle(new Request("http://localhost/api/auth/password/forgot", {
      method: "POST",
      headers: {
        ...jsonHeaders(),
        "x-forwarded-for": "203.0.113.12",
      },
      body: JSON.stringify({
        email: "rate-forgot@example.com",
      }),
    }));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await expectJson(await forgotPasswordRequest(), 200);
  }
  await expectRateLimited(await forgotPasswordRequest());

  const resetPasswordRequest = () =>
    app.handle(new Request("http://localhost/api/auth/password/reset", {
      method: "POST",
      headers: {
        ...jsonHeaders(),
        "x-forwarded-for": "203.0.113.13",
      },
      body: JSON.stringify({
        token: "invalid-rate-limit-token",
        password: "new-password",
      }),
    }));
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await expectJson(await resetPasswordRequest(), 422);
  }
  await expectRateLimited(await resetPasswordRequest());

  const emailResetPasswordRequest = () =>
    app.handle(new Request("http://localhost/api/auth/password/reset", {
      method: "POST",
      headers: {
        ...jsonHeaders(),
        "x-forwarded-for": "203.0.113.15",
      },
      body: JSON.stringify({
        email: "rate-reset@example.com",
        emailCode: "000000",
        password: "new-password",
      }),
    }));
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await expectJson(await emailResetPasswordRequest(), 422);
  }
  await expectRateLimited(await emailResetPasswordRequest());

  await expectJson(
    await app.handle(new Request("http://localhost/api/me/", {
      headers: jsonHeaders(userAuth.token),
    })),
    200
  );

  const emailChangeCodeRequest = () =>
    app.handle(new Request("http://localhost/api/me/email-change-code", {
      method: "POST",
      headers: jsonHeaders(userAuth.token),
      body: JSON.stringify({
        email: "route-user-next@example.com",
      }),
    }));
  await expectJson(await emailChangeCodeRequest(), 200);
  await expectRateLimited(await emailChangeCodeRequest());

  await expectJson(
    await app.handle(new Request("http://localhost/api/admin/content/articles")),
    401
  );
  await expectJson(
    await app.handle(new Request("http://localhost/api/admin/content/articles", {
      headers: jsonHeaders(userAuth.token),
    })),
    403
  );
  await expectJson(
    await app.handle(new Request("http://localhost/api/admin/navigation")),
    401
  );
  await expectJson(
    await app.handle(new Request("http://localhost/api/admin/navigation", {
      headers: jsonHeaders(userAuth.token),
    })),
    403
  );
  const adminNavigation = await expectJson<{
    groups: Array<{ name: string }>;
  }>(
    await app.handle(new Request("http://localhost/api/admin/navigation", {
      headers: jsonHeaders(adminAuth.token),
    })),
    200
  );
  assert(adminNavigation.groups[0]?.name === "路由导航", "管理员导航路由应返回导航分组");

  const adminArticles = await expectJson<ListBody<ArticleBody>>(
    await app.handle(new Request("http://localhost/api/admin/content/articles", {
      headers: jsonHeaders(adminAuth.token),
    })),
    200
  );
  assert(adminArticles.total === 1, "管理员文章列表应返回文章");

  const apiKeyEmailCodeRequest = () =>
    app.handle(new Request("http://localhost/api/admin/system/api-keys/email-code", {
      method: "POST",
      headers: jsonHeaders(adminAuth.token),
    }));
  await expectJson(await apiKeyEmailCodeRequest(), 422);
  await expectRateLimited(await apiKeyEmailCodeRequest());

  await expectJson(
    await app.handle(new Request("http://localhost/api/admin/users/", {
      method: "POST",
      headers: jsonHeaders(adminAuth.token),
      body: JSON.stringify({
        username: "unsupported-role",
        password: "unsupported-role-password",
        role: "owner",
      }),
    })),
    422
  );

  const commentRequest = (content: string) =>
    app.handle(new Request(`http://localhost/api/public/articles/${seeded.article.id}/comments`, {
      method: "POST",
      headers: jsonHeaders(userAuth.token),
      body: JSON.stringify({ content }),
    }));
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await expectJson(await commentRequest(`公开评论 ${attempt}`), 200);
  }
  await expectRateLimited(await commentRequest("超限公开评论"));

  const detailAfterComment = await expectJson<{ item: ArticleBody }>(
    await app.handle(new Request("http://localhost/api/public/articles/slug/route-post")),
    200
  );
  assert(detailAfterComment.item.commentCount === 11, "评论后文章详情缓存应刷新");
}

try {
  await main();
  await clearSiteCache();
  await clearAllArticleCache();
  await clearRateLimits();
  await closeRedis();
  await db.close({ timeout: 1 });
} catch (error) {
  console.error(error);
  await clearSiteCache();
  await clearAllArticleCache();
  await clearRateLimits();
  await closeRedis();
  await db.close({ timeout: 1 });
  process.exit(1);
}
