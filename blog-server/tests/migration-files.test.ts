import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

const migrationsDir = join(import.meta.dir, "../src/db/migrations");
const migrationFiles = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();
const migration = readFileSync(
  join(migrationsDir, "001_initial_schema.sql"),
  "utf8"
);

describe("initial database migration", () => {
  test("keeps production initialization consolidated into one migration", () => {
    expect(migrationFiles).toEqual(["001_initial_schema.sql"]);
  });

  test("creates the required core tables", () => {
    for (const table of [
      "site_info",
      "site_config",
      "site_filing",
      "users",
      "article_tags",
      "article_categories",
      "articles",
      "comments",
      "email_change_requests",
      "media_assets",
      "media_folders",
      "setup_state",
    ]) {
      expect(migration).toContain(`CREATE TABLE ${table}`);
    }
  });

  test("uses Shanghai timezone and encrypted API key columns", () => {
    expect(migration).toContain("SET TIME ZONE 'Asia/Shanghai'");
    expect(migration).toContain("resend_api_key_encrypted");
    expect(migration).toContain("deepl_api_key_encrypted");
    expect(migration).toContain("ipgeolocation_api_key_encrypted");
  });

  test("supports guestbook comments and verified email changes", () => {
    expect(migration).toContain("CREATE TYPE comment_target_type");
    expect(migration).toContain("target_type comment_target_type");
    expect(migration).toContain("'email_change'");
    expect(migration).toContain("comment_location jsonb");
    expect(migration).toContain("comment_device jsonb");
  });

  test("adds protected media folders", () => {
    expect(migration).toContain("CREATE TABLE media_folders");
    expect(migration).toContain("media_assets_folder_created_at_idx");
    expect(migration).toContain("article-covers");
    expect(migration).toContain("avatars");
    expect(migration).toContain("comments");
    expect(migration).toContain("site");
  });

  test("limits articles to one linked category", () => {
    expect(migration).toContain("PRIMARY KEY (article_id)");
    expect(migration).not.toContain("PRIMARY KEY (article_id, category_id)");
  });

  test("stores multiple ICP filing records without legacy single ICP columns", () => {
    expect(migration).toContain("icp_records jsonb NOT NULL DEFAULT '[]'::jsonb");
    expect(migration).not.toContain("icp_number");
    expect(migration).not.toContain("icp_url");
  });

  test("keeps only admin and user roles", () => {
    expect(migration).toContain("CREATE TYPE user_role AS ENUM ('admin', 'user')");
    expect(migration).not.toContain("'demo'");
  });
});
