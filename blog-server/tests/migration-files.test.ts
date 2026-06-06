import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

const migration = readFileSync(
  join(import.meta.dir, "../src/db/migrations/001_initial_schema.sql"),
  "utf8"
);
const mediaFolderMigration = readFileSync(
  join(import.meta.dir, "../src/db/migrations/002_media_folders.sql"),
  "utf8"
);
const singleArticleCategoryMigration = readFileSync(
  join(import.meta.dir, "../src/db/migrations/008_single_article_category.sql"),
  "utf8"
);
const siteFilingIcpRecordsMigration = readFileSync(
  join(import.meta.dir, "../src/db/migrations/009_site_filing_icp_records.sql"),
  "utf8"
);

describe("initial database migration", () => {
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
  });

  test("adds protected media folders", () => {
    expect(mediaFolderMigration).toContain("CREATE TABLE media_folders");
    expect(mediaFolderMigration).toContain("article-covers");
    expect(mediaFolderMigration).toContain("avatars");
    expect(mediaFolderMigration).toContain("comments");
    expect(mediaFolderMigration).toContain("site");
  });

  test("limits articles to one linked category", () => {
    expect(singleArticleCategoryMigration).toContain("ranked_article_categories");
    expect(singleArticleCategoryMigration).toContain("PRIMARY KEY (article_id)");
  });

  test("stores multiple ICP filing records", () => {
    expect(siteFilingIcpRecordsMigration).toContain("ADD COLUMN IF NOT EXISTS icp_records");
    expect(siteFilingIcpRecordsMigration).toContain("icp_records jsonb");
    expect(siteFilingIcpRecordsMigration).toContain("jsonb_build_array");
  });
});
