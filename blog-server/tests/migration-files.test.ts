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
const navigationMigration = readFileSync(
  join(migrationsDir, "002_add_navigation_page.sql"),
  "utf8"
);

describe("initial database migration", () => {
  test("keeps a consolidated baseline and an incremental navigation migration", () => {
    expect(migrationFiles).toEqual([
      "001_initial_schema.sql",
      "002_add_navigation_page.sql",
    ]);
    expect(navigationMigration).toContain("CREATE TABLE IF NOT EXISTS navigation_groups");
    expect(navigationMigration).toContain("CREATE TABLE IF NOT EXISTS navigation_items");
    expect(navigationMigration).toContain("website-icons");
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
      "navigation_groups",
      "navigation_items",
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
    expect(migration).toContain("website-icons");
  });

  test("creates ordered navigation groups and items", () => {
    expect(migration).toContain("CREATE UNIQUE INDEX navigation_groups_name_unique");
    expect(migration).toContain("CREATE INDEX navigation_groups_sort_order_idx");
    expect(migration).toContain("CREATE INDEX navigation_items_group_sort_order_idx");
    expect(migration).toContain("REFERENCES navigation_groups(id) ON DELETE RESTRICT");
    expect(migration).toContain("CREATE TRIGGER navigation_groups_set_updated_at");
    expect(migration).toContain("CREATE TRIGGER navigation_items_set_updated_at");
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
