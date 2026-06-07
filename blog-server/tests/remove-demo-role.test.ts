import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  TEST_POSTGRES_ADMIN_URL,
  TEST_POSTGRES_BASE_URL,
} from "./helpers/database";

const databaseName = `lei_blog_remove_demo_role_${Date.now()}`;
const databaseUrl = `${TEST_POSTGRES_BASE_URL}/${databaseName}`;
const adminDb = new Bun.SQL(TEST_POSTGRES_ADMIN_URL, { max: 1 });
let testDb: Bun.SQL;

beforeAll(async () => {
  await adminDb.unsafe(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
  await adminDb.unsafe(`CREATE DATABASE ${databaseName}`);
  testDb = new Bun.SQL(databaseUrl, { max: 1 });

  const migrationsDir = join(import.meta.dir, "../src/db/migrations");
  const legacyMigrations = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql") && file < "011_remove_demo_role.sql")
    .sort();

  for (const file of legacyMigrations) {
    await testDb.unsafe(readFileSync(join(migrationsDir, file), "utf8"));
  }
});

afterAll(async () => {
  await testDb?.close({ timeout: 1 });
  await adminDb.unsafe(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
  await adminDb.close({ timeout: 1 });
});

describe("remove demo role migration", () => {
  test("deletes demo accounts and rebuilds the role enum", async () => {
    const [demo] = await testDb<{ id: string }[]>`
      INSERT INTO users (username, password_hash, email, role)
      VALUES ('legacy-demo', 'unused', 'legacy-demo@example.com', 'demo')
      RETURNING id
    `;
    const [article] = await testDb<{ id: string }[]>`
      INSERT INTO articles (author_id, title, slug, content_mdx)
      VALUES (${demo.id}, 'Legacy demo article', 'legacy-demo-article', '# Legacy')
      RETURNING id
    `;
    const [media] = await testDb<{ id: string }[]>`
      INSERT INTO media_assets (
        file_name, file_format, file_type, file_size_bytes, access_url, uploaded_by
      )
      VALUES ('legacy.png', 'png', 'image', 1, '/uploads/legacy.png', ${demo.id})
      RETURNING id
    `;
    const [audit] = await testDb<{ id: string }[]>`
      INSERT INTO login_audit_logs (user_id, success)
      VALUES (${demo.id}, true)
      RETURNING id
    `;
    const [revision] = await testDb<{ id: string }[]>`
      INSERT INTO article_revisions (
        article_id, editor_id, title, slug, content_mdx, status
      )
      VALUES (
        ${article.id}, ${demo.id}, 'Legacy demo article',
        'legacy-demo-article', '# Legacy', 'draft'
      )
      RETURNING id
    `;

    await testDb`
      INSERT INTO comments (article_id, user_id, content)
      VALUES (${article.id}, ${demo.id}, 'Legacy demo comment')
    `;
    await testDb`
      INSERT INTO auth_sessions (user_id, token_hash, expires_at)
      VALUES (${demo.id}, 'legacy-demo-session', now() + interval '1 day')
    `;
    await testDb`
      INSERT INTO email_change_requests (user_id, new_email, code_hash, expires_at)
      VALUES (
        ${demo.id}, 'next@example.com', 'legacy-demo-email-code',
        now() + interval '1 day'
      )
    `;
    await testDb`
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES (
        ${demo.id}, 'legacy-demo-reset-token',
        now() + interval '1 day'
      )
    `;

    const migration = readFileSync(
      join(import.meta.dir, "../src/db/migrations/011_remove_demo_role.sql"),
      "utf8"
    );
    await testDb.unsafe(migration);

    const [demoCount] = await testDb<{ count: string }[]>`
      SELECT count(*) AS count FROM users WHERE username = 'legacy-demo'
    `;
    const [cascadeCount] = await testDb<{ count: string }[]>`
      SELECT (
        (SELECT count(*) FROM comments WHERE user_id = ${demo.id}) +
        (SELECT count(*) FROM auth_sessions WHERE user_id = ${demo.id}) +
        (SELECT count(*) FROM email_change_requests WHERE user_id = ${demo.id}) +
        (SELECT count(*) FROM password_reset_tokens WHERE user_id = ${demo.id})
      ) AS count
    `;
    const [articleOwner] = await testDb<{ author_id: string | null }[]>`
      SELECT author_id FROM articles WHERE id = ${article.id}
    `;
    const [mediaOwner] = await testDb<{ uploaded_by: string | null }[]>`
      SELECT uploaded_by FROM media_assets WHERE id = ${media.id}
    `;
    const [auditOwner] = await testDb<{ user_id: string | null }[]>`
      SELECT user_id FROM login_audit_logs WHERE id = ${audit.id}
    `;
    const [revisionEditor] = await testDb<{ editor_id: string | null }[]>`
      SELECT editor_id FROM article_revisions WHERE id = ${revision.id}
    `;
    const roles = await testDb<{ role: string }[]>`
      SELECT unnest(enum_range(NULL::user_role))::text AS role
    `;

    expect(demoCount?.count).toBe("0");
    expect(cascadeCount?.count).toBe("0");
    expect(articleOwner?.author_id).toBeNull();
    expect(mediaOwner?.uploaded_by).toBeNull();
    expect(auditOwner?.user_id).toBeNull();
    expect(revisionEditor?.editor_id).toBeNull();
    expect(roles.map((row) => row.role)).toEqual(["admin", "user"]);
  });
});

