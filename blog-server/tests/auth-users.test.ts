import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  createAuthSession,
  createEmailCode,
  createPasswordResetToken,
  registerUser,
  resetPassword,
  revokeAuthSession,
  verifyLogin,
} from "../src/auth/service";
import {
  createUserByAdmin,
  deleteUserByAdmin,
  listUsers,
  updateUserByAdmin,
} from "../src/admin/users/service";
import { hashPassword, verifyPassword, type AuthUser } from "../src/shared/auth";
import { changeMyPassword, getUserProfile, updateMe } from "../src/me/service";

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

    const updated = await updateMe(
      user.id,
      {
        name: "新名字",
        description: "新的简介",
        tags: ["小可爱", "小可爱", "读者"],
        avatarUrl: "https://example.com/avatar.png",
        blogUrl: "https://example.com",
        socialLinks: {
          github: "https://github.com/example",
        },
      },
      testDb
    );
    expect(updated.name).toBe("新名字");
    expect(updated.tags).toEqual(["小可爱", "读者"]);

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

    const reset = await createPasswordResetToken("user@example.com", {
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
