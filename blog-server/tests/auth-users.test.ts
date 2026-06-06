import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  createAuthSession,
  createEmailCode,
  createPasswordResetToken,
  getRequestMeta,
  registerUser,
  resetPassword,
  revokeAuthSession,
  verifyLogin,
} from "../src/auth/service";
import type { AuthUser } from "../src/shared/auth";
import {
  createUserByAdmin,
  deleteUserByAdmin,
  listUsers,
  updateUserByAdmin,
} from "../src/admin/users/service";
import { hashPassword, verifyPassword } from "../src/shared/auth";
import { encryptSecret } from "../src/shared/crypto";
import {
  changeMyPassword,
  confirmEmailChange,
  getUserProfile,
  requestEmailChangeCode,
  updateMe,
} from "../src/me/service";

const POSTGRES_ADMIN_URL =
  process.env.TEST_POSTGRES_ADMIN_URL ??
  "postgres://taolei:12345678@localhost:5432/postgres";

const dbName = `lei_blog_auth_test_${Date.now()}`;
const adminDb = new Bun.SQL(POSTGRES_ADMIN_URL, { max: 1 });
let testDb: Bun.SQL;

const meta = {
  ip: "127.0.0.1",
  userAgent: "bun-test",
};

beforeAll(async () => {
  await adminDb.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await adminDb.unsafe(`CREATE DATABASE ${dbName}`);

  testDb = new Bun.SQL(
    `postgres://taolei:12345678@localhost:5432/${dbName}`,
    { max: 1 }
  );

  const migration = readFileSync(
    join(import.meta.dir, "../src/db/migrations/001_initial_schema.sql"),
    "utf8"
  );
  await testDb.unsafe(migration);
});

afterAll(async () => {
  await testDb?.close({ timeout: 1 });
  await adminDb.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await adminDb.close({ timeout: 1 });
});

describe("auth and user services", () => {
  test("reads proxy and direct request IP metadata", () => {
    expect(
      getRequestMeta({
        headers: {
          "user-agent": "proxy-browser",
          "x-forwarded-for": "invalid, 203.0.113.9, 10.0.0.2",
        },
        requestIp: "127.0.0.1",
      })
    ).toEqual({
      ip: "203.0.113.9",
      userAgent: "proxy-browser",
    });

    expect(
      getRequestMeta({
        headers: {
          "user-agent": "direct-browser",
        },
        requestIp: "192.168.3.125",
      })
    ).toEqual({
      ip: "192.168.3.125",
      userAgent: "direct-browser",
    });
  });

  test("registers, logs in, updates profile, and resets password", async () => {
    const code = await createEmailCode(
      { email: "user@example.com", purpose: "register" },
      { client: testDb }
    );

    expect(code.sent).toBe(false);
    expect(typeof code.devCode).toBe("string");

    const user = await registerUser(
      {
        username: "reader",
        password: "12345678",
        email: "user@example.com",
        emailCode: code.devCode!,
        name: "读者",
      },
      { client: testDb }
    );

    expect(user.role).toBe("user");
    expect(user.email).toBe("user@example.com");

    const loggedIn = await verifyLogin(
      { identifier: "reader", password: "12345678" },
      meta,
      { client: testDb }
    );
    expect(loggedIn.id).toBe(user.id);

    await createAuthSession(loggedIn, "access-token", meta, { client: testDb });
    const [session] = await testDb<{ revoked_at: Date | null }[]>`
      SELECT revoked_at
      FROM auth_sessions
      LIMIT 1
    `;
    expect(session.revoked_at).toBeNull();

    await expect(
      updateMe(
        user.id,
        {
          socialLinks: {
            github: "https://github.com/example",
          },
        },
        testDb
      )
    ).rejects.toThrow("只有管理员可以设置社交链接");

    const updated = await updateMe(
      user.id,
      {
        name: "新名字",
        description: "新的简介",
        tags: ["小可爱", "小可爱", "读者"],
        avatarUrl: "https://example.com/avatar.png",
        blogUrl: "https://example.com",
      },
      testDb
    );
    expect(updated.name).toBe("新名字");
    expect(updated.tags).toEqual(["小可爱", "读者"]);

    const emailChange = await requestEmailChangeCode(
      user.id,
      { email: "new-user@example.com" },
      testDb
    );
    expect(emailChange.sent).toBe(false);
    expect(typeof emailChange.devCode).toBe("string");

    const changedEmail = await confirmEmailChange(
      user.id,
      {
        email: "new-user@example.com",
        emailCode: emailChange.devCode!,
      },
      testDb
    );
    expect(changedEmail.email).toBe("new-user@example.com");

    await changeMyPassword(
      user.id,
      {
        currentPassword: "12345678",
        newPassword: "87654321",
      },
      testDb
    );

    await expect(
      verifyLogin({ identifier: "reader", password: "12345678" }, meta, {
        client: testDb,
      })
    ).rejects.toThrow("用户名、邮箱或密码错误");

    await verifyLogin(
      { identifier: "reader", password: "87654321" },
      meta,
      { client: testDb }
    );

    const reset = await createPasswordResetToken("new-user@example.com", {
      client: testDb,
    });
    expect(typeof reset.devToken).toBe("string");

    await resetPassword(
      {
        token: reset.devToken!,
        password: "new-password",
      },
      { client: testDb }
    );

    await verifyLogin(
      { identifier: "reader", password: "new-password" },
      meta,
      { client: testDb }
    );

    const passwordResetCode = await createEmailCode(
      {
        email: "new-user@example.com",
        purpose: "password_reset",
      },
      { client: testDb }
    );

    await resetPassword(
      {
        email: "new-user@example.com",
        emailCode: passwordResetCode.devCode!,
        password: "code-reset-password",
      },
      { client: testDb }
    );

    await verifyLogin(
      { identifier: "reader", password: "code-reset-password" },
      meta,
      { client: testDb }
    );

    await revokeAuthSession("access-token", { client: testDb });
    const [revoked] = await testDb<{ revoked_at: Date | null }[]>`
      SELECT revoked_at
      FROM auth_sessions
      WHERE token_hash IS NOT NULL
      LIMIT 1
    `;
    expect(revoked.revoked_at).toBeInstanceOf(Date);

    const profile = await getUserProfile(user.id, testDb);
    expect(profile.lastLoginIp).toBe("127.0.0.1");
  });

  test("stores IPGeolocation metadata for successful public IP logins", async () => {
    const [user] = await testDb<{ id: string }[]>`
      INSERT INTO users (username, password_hash, email, role)
      VALUES (
        'geo-reader',
        ${await hashPassword("geo-password")},
        'geo-reader@example.com',
        'user'
      )
      RETURNING id
    `;
    const encryptedApiKey = encryptSecret("geo-secret");

    await testDb`
      INSERT INTO site_config (id, ipgeolocation_api_key_encrypted)
      VALUES (1, ${JSON.stringify(encryptedApiKey)}::jsonb)
    `;

    const originalFetch = globalThis.fetch;
    const locationFetch = async (..._args: Parameters<typeof fetch>) =>
      new Response(
        JSON.stringify({
          country_name: "中国",
          city: "上海",
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    globalThis.fetch = Object.assign(locationFetch, {
      preconnect: originalFetch.preconnect,
    });

    try {
      const profile = await verifyLogin(
        { identifier: "geo-reader", password: "geo-password" },
        { ip: "8.8.8.8", userAgent: "geo-browser" },
        { client: testDb }
      );

      expect(profile.lastLoginLocation).toBe("中国 上海");
      expect(profile.lastLoginDevice).toBe("geo-browser");
    } finally {
      globalThis.fetch = originalFetch;
    }

    const [stored] = await testDb<{ city: string | null; country_name: string | null }[]>`
      SELECT last_login_location->>'city' AS city,
             last_login_location->>'country_name' AS country_name
      FROM users
      WHERE id = ${user.id}
    `;

    expect(stored).toEqual({
      city: "上海",
      country_name: "中国",
    });
  });

  test("allows admin user management and blocks demo writes", async () => {
    const [admin] = await testDb<{ id: string; password_hash: string }[]>`
      INSERT INTO users (username, password_hash, email, role)
      VALUES (
        'admin',
        ${await hashPassword("admin-password")},
        'admin@example.com',
        'admin'
      )
      RETURNING id, password_hash
    `;

    expect(await verifyPassword("admin-password", admin.password_hash)).toBe(true);

    const currentAdmin: AuthUser = {
      id: admin.id,
      username: "admin",
      email: "admin@example.com",
      name: null,
      role: "admin",
      avatarUrl: null,
    };

    const created = await createUserByAdmin(
      currentAdmin,
      {
        username: "demo",
        password: "demo-password",
        email: "demo@example.com",
        role: "demo",
        tags: ["演示"],
      },
      testDb
    );

    expect(created.role).toBe("demo");

    const list = await listUsers(
      currentAdmin,
      { role: "demo", page: "1", pageSize: "10" },
      testDb
    );
    expect(list.total).toBe(1);
    expect(list.items[0]?.username).toBe("demo");

    const updated = await updateUserByAdmin(
      currentAdmin,
      created.id,
      {
        name: "演示账户",
        role: "user",
      },
      testDb
    );
    expect(updated.role).toBe("user");
    expect(updated.name).toBe("演示账户");

    await expect(
      createUserByAdmin(
        {
          ...currentAdmin,
          id: created.id,
          role: "demo",
          username: "demo",
        },
        {
          username: "blocked",
          password: "blocked-password",
          role: "user",
        },
        testDb
      )
    ).rejects.toThrow("演示账户仅允许读取");

    await deleteUserByAdmin(currentAdmin, created.id, testDb);

    const afterDelete = await listUsers(
      currentAdmin,
      { search: "demo", page: "1", pageSize: "10" },
      testDb
    );
    expect(afterDelete.total).toBe(0);
  });
});
