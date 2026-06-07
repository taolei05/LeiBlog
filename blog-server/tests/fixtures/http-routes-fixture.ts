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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
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

  const comments = await expectJson<ListBody<{ content: string }>>(
    await app.handle(
      new Request(`http://localhost/api/public/articles/${seeded.article.id}/comments`)
    ),
    200
  );
  assert(comments.total === 1, "公共评论列表应按文章 ID 返回评论");

  const adminAuth = await login(app, "route-admin", "admin-password");
  assert(adminAuth.user.id === seeded.adminId, "管理员登录用户不正确");
  const userAuth = await login(app, "route-user", "user-password");
  assert(userAuth.user.id === seeded.userId, "普通用户登录用户不正确");
  await expectJson(
    await app.handle(new Request("http://localhost/api/admin/setup/demo-session", {
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
        role: "demo",
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
