import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

const migrationsDir = join(import.meta.dir, "../src/db/migrations");
const migrationFiles = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();
function readMigration(file: string) {
  try {
    return readFileSync(join(migrationsDir, file), "utf8");
  } catch {
    return "";
  }
}
const migration = readFileSync(
  join(migrationsDir, "001_initial_schema.sql"),
  "utf8"
);
const articleSchedulingMigration = readFileSync(
  join(migrationsDir, "002_article_scheduling_and_notifications.sql"),
  "utf8"
);
const authProvidersMigration = readFileSync(
  join(migrationsDir, "003_auth_providers.sql"),
  "utf8"
);
const authSessionLoginMethodMigration = readFileSync(
  join(migrationsDir, "004_auth_session_login_method.sql"),
  "utf8"
);
const googleAuthProviderMigration = readMigration("005_google_auth_provider.sql");
const userLastLoginMethodMigration = readMigration("007_user_last_login_method.sql");
const seedSource = readFileSync(join(import.meta.dir, "../src/db/seed.ts"), "utf8");

describe("initial database migration", () => {
  test("keeps a consolidated baseline migration", () => {
    expect(migrationFiles).toEqual([
      "001_initial_schema.sql",
      "002_article_scheduling_and_notifications.sql",
      "003_auth_providers.sql",
      "004_auth_session_login_method.sql",
      "005_google_auth_provider.sql",
      "006_r2_media_storage.sql",
      "007_user_last_login_method.sql",
    ]);
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

  test("keeps seed-compatible protected media folders in sync", () => {
    for (const slug of ["article-covers", "avatars", "comments", "site", "website-icons"]) {
      expect(seedSource).toContain(slug);
    }

    expect(seedSource).toContain(
      "WHERE slug IN ('article-covers', 'avatars', 'comments', 'site', 'website-icons')"
    );
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

  test("enables comment email notifications for users by default", () => {
    expect(migration).toContain(
      "comment_email_notifications_enabled boolean NOT NULL DEFAULT true"
    );
  });

  test("supports scheduled article publishing and new article email preferences", () => {
    expect(migration).toContain(
      "new_article_email_notifications_enabled boolean NOT NULL DEFAULT true"
    );
    expect(migration).toContain("scheduled_publish_at timestamptz");
    expect(articleSchedulingMigration).toContain(
      "ADD COLUMN IF NOT EXISTS new_article_email_notifications_enabled boolean NOT NULL DEFAULT true"
    );
    expect(articleSchedulingMigration).toContain(
      "ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz"
    );
    expect(articleSchedulingMigration).toContain("articles_scheduled_publish_at_idx");
  });

  test("supports configurable OAuth login providers", () => {
    for (const table of [
      "auth_provider_settings",
      "user_oauth_accounts",
      "oauth_login_states",
      "oauth_login_tickets",
    ]) {
      expect(migration).toContain(`CREATE TABLE ${table}`);
      expect(authProvidersMigration).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }

    expect(migration).toContain("client_secret_encrypted jsonb");
    expect(migration).toContain("auth_provider_settings_set_updated_at");
    expect(migration).toContain("user_oauth_accounts_provider_user_unique");
    expect(migration).toContain("oauth_login_tickets_hash_unique");
    expect(authProvidersMigration).toContain("'github', 'GitHub'");
    expect(migration).toContain("'google', 'Google'");
    expect(googleAuthProviderMigration).toContain("'google', 'Google'");
    expect(googleAuthProviderMigration).toContain("'openid', 'profile', 'email'");
  });

  test("marks OAuth sessions as front-only for administrator accounts", () => {
    expect(migration).toContain("login_method varchar(40) NOT NULL DEFAULT 'password'");
    expect(migration).toContain("CHECK (login_method IN ('password', 'oauth'))");
    expect(authSessionLoginMethodMigration).toContain(
      "ADD COLUMN IF NOT EXISTS login_method varchar(40) NOT NULL DEFAULT 'password'"
    );
    expect(authSessionLoginMethodMigration).toContain("auth_sessions_login_method_check");
  });

  test("stores the latest concrete login method for users", () => {
    expect(migration).toContain("last_login_method varchar(40)");
    expect(migration).toContain(
      "last_login_method IS NULL OR last_login_method IN ('password', 'github', 'google')"
    );
    expect(userLastLoginMethodMigration).toContain(
      "ADD COLUMN IF NOT EXISTS last_login_method varchar(40)"
    );
    expect(userLastLoginMethodMigration).toContain("users_last_login_method_check");
  });

  test("supports optional Cloudflare R2 media storage", () => {
    const r2Migration = readMigration("006_r2_media_storage.sql");

    for (const column of [
      "r2_enabled boolean NOT NULL DEFAULT false",
      "r2_account_id text",
      "r2_bucket text",
      "r2_access_key_id text",
      "r2_secret_access_key_encrypted jsonb",
      "r2_public_base_url text",
      "storage_provider varchar(20) NOT NULL DEFAULT 'local'",
      "storage_key text",
      "storage_bucket text",
    ]) {
      expect(migration).toContain(column);
      expect(r2Migration).toContain(column.replace(" NOT NULL DEFAULT 'local'", ""));
    }

    expect(r2Migration).toContain("media_assets_storage_provider_check");
    expect(r2Migration).toContain("CHECK (storage_provider IN ('local', 'r2'))");
  });
});
