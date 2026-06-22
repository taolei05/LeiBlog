import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  createMediaFolder,
  deleteMediaFolder,
  deleteMedia,
  getMediaById,
  getMediaDownload,
  getMediaLink,
  getMediaPreview,
  listMedia,
  listMediaFolders,
  listMediaStorageSummary,
  migrateMediaStorage,
  renameMedia,
  uploadMedia,
} from "../src/admin/media/service";
import {
  getSystemSiteConfig,
  updateSystemSiteConfig,
} from "../src/admin/system/service";
import { hashPassword, type AuthUser } from "../src/shared/auth";
import { loadConfig } from "../src/shared/config";
import { decryptSecret, encryptSecret } from "../src/shared/crypto";

const POSTGRES_ADMIN_URL =
  process.env.TEST_POSTGRES_ADMIN_URL ??
  "postgres://taolei:12345678@localhost:5432/postgres";

const dbName = `lei_blog_media_test_${Date.now()}`;
const adminDb = new Bun.SQL(POSTGRES_ADMIN_URL, { max: 1 });
let testDb: Bun.SQL;
let uploadRoot = "";
let currentAdmin: AuthUser;

function pngFile(name = "cover.png") {
  return new File(
    [
      new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
      ]),
    ],
    name,
    { type: "image/png" }
  );
}

function svgFile(name = "logo.svg") {
  return new File(
    [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>\nContent-Length: 0\n`,
    ],
    name,
    { type: "image/svg+xml" }
  );
}

function icoFile(name = "favicon.ico") {
  return new File(
    [
      new Uint8Array([
        0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x10, 0x10, 0x00, 0x00, 0x01,
        0x00, 0x20, 0x00, 0x04, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
      ]),
    ],
    name,
    { type: "image/x-icon" }
  );
}

beforeAll(async () => {
  uploadRoot = await mkdtemp(join(tmpdir(), "leiblog-media-"));
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

  const [admin] = await testDb<{ id: string }[]>`
    INSERT INTO users (username, password_hash, email, role)
    VALUES ('admin', ${await hashPassword("admin-password")}, 'admin@example.com', 'admin')
    RETURNING id
  `;

  currentAdmin = {
    id: admin.id,
    username: "admin",
    email: "admin@example.com",
    name: null,
    role: "admin",
    avatarUrl: null,
  };
});

afterAll(async () => {
  await testDb?.close({ timeout: 1 });
  await adminDb.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await adminDb.close({ timeout: 1 });
  await rm(uploadRoot, { recursive: true, force: true });
});

describe("admin media service", () => {
  test("uploads, lists, renames, links, previews, downloads, and deletes media", async () => {
    const config = loadConfig({
      NODE_ENV: "test",
      UPLOADS_DIR: uploadRoot,
      UPLOADS_URL_PREFIX: "/uploads",
      UPLOAD_MAX_FILE_SIZE_BYTES: "1024",
    });

    const uploaded = await uploadMedia(
      currentAdmin,
      { file: pngFile(), fileName: "封面图.png" },
      { client: testDb, config }
    );

    expect(uploaded.fileName).toBe("封面图.png");
    expect(uploaded.fileFormat).toBe("png");
    expect(uploaded.fileType).toBe("image");
    expect(uploaded.accessUrl.startsWith("/uploads/")).toBe(true);

    const list = await listMedia(
      currentAdmin,
      { fileType: "image", fileFormat: "png", search: "封面", page: 1 },
      { client: testDb, config }
    );
    expect(list.total).toBe(1);
    expect(list.items[0]?.id).toBe(uploaded.id);

    const detail = await getMediaById(currentAdmin, uploaded.id, {
      client: testDb,
      config,
    });
    expect(detail.accessUrl).toBe(uploaded.accessUrl);

    const link = await getMediaLink(currentAdmin, uploaded.id, {
      client: testDb,
      config,
    });
    expect(link.accessUrl).toBe(uploaded.accessUrl);

    const preview = await getMediaPreview(currentAdmin, uploaded.id, {
      client: testDb,
      config,
    });
    expect(preview.implemented).toBe(false);
    expect(preview.fileType).toBe("image");

    const download = await getMediaDownload(currentAdmin, uploaded.id, {
      client: testDb,
      config,
    });
    expect(download.contentType).toBe("image/png");
    expect("filePath" in download).toBe(true);
    if (!("filePath" in download)) throw new Error("Expected local media download path");
    const downloadPath = download.filePath!;
    expect((await stat(downloadPath)).isFile()).toBe(true);

    const renamed = await renameMedia(
      currentAdmin,
      uploaded.id,
      "renamed.png",
      { client: testDb, config }
    );
    expect(renamed.fileName).toBe("renamed.png");

    await deleteMedia(currentAdmin, uploaded.id, { client: testDb, config });

    const afterDelete = await listMedia(currentAdmin, {}, { client: testDb, config });
    expect(afterDelete.total).toBe(0);
    await expect(stat(downloadPath)).rejects.toThrow();
  });

  test("rejects invalid files and blocks ordinary users", async () => {
    const config = loadConfig({
      NODE_ENV: "test",
      UPLOADS_DIR: uploadRoot,
      UPLOADS_URL_PREFIX: "/uploads",
      UPLOAD_MAX_FILE_SIZE_BYTES: "1024",
    });

    await expect(
      uploadMedia(
        currentAdmin,
        {
          file: new File(["not a png"], "fake.png", { type: "image/png" }),
        },
        { client: testDb, config }
      )
    ).rejects.toThrow("文件内容与扩展名不匹配");

    await expect(
      uploadMedia(
        { ...currentAdmin, role: "user" },
        { file: pngFile("user.png") },
        { client: testDb, config }
      )
    ).rejects.toThrow("需要管理员权限");
  });

  test("normalizes uploaded SVG files before storing them", async () => {
    const config = loadConfig({
      NODE_ENV: "test",
      UPLOADS_DIR: uploadRoot,
      UPLOADS_URL_PREFIX: "/uploads",
      UPLOAD_MAX_FILE_SIZE_BYTES: "2048",
    });

    const uploaded = await uploadMedia(
      currentAdmin,
      { file: svgFile(), folderSlug: "site" },
      { client: testDb, config }
    );
    const download = await getMediaDownload(currentAdmin, uploaded.id, {
      client: testDb,
      config,
    });
    expect("filePath" in download).toBe(true);
    if (!("filePath" in download)) throw new Error("Expected local SVG download path");
    const body = String(await readFile(download.filePath!, "utf8"));

    expect(uploaded.fileFormat).toBe("svg");
    expect(download.contentType).toBe("image/svg+xml");
    expect(body).toBe(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>`
    );
    expect(body).not.toContain("Content-Length: 0");
  });

  test("uploads website icon ico files", async () => {
    const config = loadConfig({
      NODE_ENV: "test",
      UPLOADS_DIR: uploadRoot,
      UPLOADS_URL_PREFIX: "/uploads",
      UPLOAD_MAX_FILE_SIZE_BYTES: "2048",
    });

    const uploaded = await uploadMedia(
      currentAdmin,
      { file: icoFile(), folderSlug: "website-icons" },
      { client: testDb, config }
    );
    const download = await getMediaDownload(currentAdmin, uploaded.id, {
      client: testDb,
      config,
    });

    expect(uploaded.fileFormat).toBe("ico");
    expect(uploaded.fileType).toBe("image");
    expect(uploaded.folderSlug).toBe("website-icons");
    expect(uploaded.accessUrl.endsWith(".ico")).toBe(true);
    expect(download.contentType).toBe("image/x-icon");
  });

  test("creates and protects the website icon folder", async () => {
    const config = loadConfig({
      NODE_ENV: "test",
      UPLOADS_DIR: uploadRoot,
      UPLOADS_URL_PREFIX: "/uploads",
      UPLOAD_MAX_FILE_SIZE_BYTES: "1024",
    });
    const folders = await listMediaFolders(currentAdmin, { client: testDb, config });
    const websiteIcons = folders.items.find((folder) => folder.slug === "website-icons");

    expect(websiteIcons?.systemKey).toBe("website-icons");
    expect(websiteIcons?.isProtected).toBe(true);
    await expect(
      deleteMediaFolder(currentAdmin, websiteIcons!.id, { client: testDb, config })
    ).rejects.toThrow("系统媒体文件夹禁止删除");
  });

  test("uses DeepL for generated media folder slugs when configured", async () => {
    const config = loadConfig({
      NODE_ENV: "test",
      UPLOADS_DIR: uploadRoot,
      UPLOADS_URL_PREFIX: "/uploads",
      UPLOAD_MAX_FILE_SIZE_BYTES: "1024",
    });
    const encryptedDeepLApiKey = encryptSecret("deepl-secret");
    const originalFetch = globalThis.fetch;

    await testDb`
      INSERT INTO site_config (id, deepl_api_key_encrypted)
      VALUES (1, ${JSON.stringify(encryptedDeepLApiKey)}::jsonb)
      ON CONFLICT (id) DO UPDATE
      SET deepl_api_key_encrypted = EXCLUDED.deepl_api_key_encrypted
    `;

    globalThis.fetch = Object.assign(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("api-free.deepl.com") || url.includes("api.deepl.com")) {
          const body = JSON.parse(String(init?.body)) as { target_lang: string; text: string[] };
          expect(body).toEqual({ target_lang: "EN", text: ["部署资料"] });

          return Response.json({ translations: [{ text: "deployment files" }] });
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      },
      originalFetch,
    );

    try {
      const folder = await createMediaFolder(
        currentAdmin,
        { name: "部署资料" },
        { client: testDb, config },
      );

      expect(folder.item.slug).toBe("deployment-files");
    } finally {
      globalThis.fetch = originalFetch;
      await testDb`
        UPDATE site_config
        SET deepl_api_key_encrypted = null
        WHERE id = 1
      `;
    }
  });

  test("stores R2 settings encrypted and hides the secret from site config responses", async () => {
    const updated = await updateSystemSiteConfig(
      currentAdmin,
      {
        commentsEnabled: true,
        r2AccessKeyId: "r2-access-key-id",
        r2AccountId: "r2-account-id",
        r2Bucket: "leiblog-media",
        r2Enabled: true,
        r2PublicBaseUrl: "https://media.example.com",
        r2SecretAccessKey: "r2-secret-access-key",
      },
      testDb
    );

    expect(updated.item?.r2Enabled).toBe(true);
    expect(updated.item?.r2AccountId).toBe("r2-account-id");
    expect(updated.item?.r2Bucket).toBe("leiblog-media");
    expect(updated.item?.r2AccessKeyId).toBe("r2-access-key-id");
    expect(updated.item?.r2PublicBaseUrl).toBe("https://media.example.com");
    expect(updated.item?.hasR2SecretAccessKey).toBe(true);
    expect(JSON.stringify(updated.item)).not.toContain("r2-secret-access-key");

    const [row] = await testDb<{
      r2_secret_access_key_encrypted: unknown;
    }[]>`
      SELECT r2_secret_access_key_encrypted
      FROM site_config
      WHERE id = 1
    `;

    expect(JSON.stringify(row.r2_secret_access_key_encrypted)).not.toContain(
      "r2-secret-access-key"
    );
    expect(decryptSecret(row.r2_secret_access_key_encrypted as never)).toBe(
      "r2-secret-access-key"
    );

    const loaded = await getSystemSiteConfig(currentAdmin, testDb);
    expect(loaded.item?.hasR2SecretAccessKey).toBe(true);
    expect(JSON.stringify(loaded.item)).not.toContain("r2-secret-access-key");
  });

  test("uploads, filters, downloads, deletes, and migrates media between local and R2", async () => {
    const config = loadConfig({
      NODE_ENV: "test",
      UPLOADS_DIR: uploadRoot,
      UPLOADS_URL_PREFIX: "/uploads",
      UPLOAD_MAX_FILE_SIZE_BYTES: "2048",
    });
    const calls: Array<{ body?: string; method: string; url: string }> = [];
    const originalFetch = globalThis.fetch;

    await updateSystemSiteConfig(
      currentAdmin,
      {
        commentsEnabled: true,
        r2AccessKeyId: "r2-access-key-id",
        r2AccountId: "r2-account-id",
        r2Bucket: "leiblog-media",
        r2Enabled: true,
        r2PublicBaseUrl: "https://media.example.com/assets/",
        r2SecretAccessKey: "r2-secret-access-key",
      },
      testDb
    );

    globalThis.fetch = Object.assign(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        let body: string | undefined;

        if (init?.body instanceof Uint8Array) {
          body = new TextDecoder().decode(init.body);
        }

        calls.push({ body, method, url });

        if (method === "GET") {
          return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        }

        return new Response(null, { status: 204 });
      },
      originalFetch
    );

    try {
      const r2Uploaded = await uploadMedia(
        currentAdmin,
        { file: pngFile("r2.png"), fileName: "R2 图片.png", folderSlug: "site" },
        { client: testDb, config }
      );

      expect(r2Uploaded.storageProvider).toBe("r2");
      expect(r2Uploaded.storageBucket).toBe("leiblog-media");
      expect(r2Uploaded.storageKey).toMatch(/^site\/\d{4}\/\d{2}\/.+\.png$/);
      expect(r2Uploaded.accessUrl).toBe(`https://media.example.com/assets/${r2Uploaded.storageKey}`);

      const r2Only = await listMedia(
        currentAdmin,
        { storageProvider: "r2" },
        { client: testDb, config }
      );
      expect(r2Only.items.some((item) => item.id === r2Uploaded.id)).toBe(true);
      expect(r2Only.items.every((item) => item.storageProvider === "r2")).toBe(true);

      const storageSummary = await listMediaStorageSummary(currentAdmin, {
        client: testDb,
        config,
      });
      expect(storageSummary.totals.r2).toBeGreaterThanOrEqual(1);
      expect(storageSummary.totals.all).toBe(
        storageSummary.totals.local + storageSummary.totals.r2
      );
      expect(storageSummary.folders.find((folder) => folder.slug === "site")?.r2).toBeGreaterThanOrEqual(
        1
      );

      const r2Download = await getMediaDownload(currentAdmin, r2Uploaded.id, {
        client: testDb,
        config,
      });
      expect(r2Download.contentType).toBe("image/png");
      expect(r2Download.data).toBeInstanceOf(Uint8Array);

      const migratedToLocal = await migrateMediaStorage(
        currentAdmin,
        { ids: [r2Uploaded.id], targetProvider: "local" },
        { client: testDb, config }
      );
      expect(migratedToLocal.items[0]?.storageProvider).toBe("local");
      expect(migratedToLocal.items[0]?.accessUrl.startsWith("/uploads/")).toBe(true);

      const localDownload = await getMediaDownload(currentAdmin, r2Uploaded.id, {
        client: testDb,
        config,
      });
      expect("filePath" in localDownload).toBe(true);
      if (!("filePath" in localDownload)) throw new Error("Expected migrated local path");
      expect((await stat(localDownload.filePath!)).isFile()).toBe(true);

      const migratedBackToR2 = await migrateMediaStorage(
        currentAdmin,
        { ids: [r2Uploaded.id], targetProvider: "r2" },
        { client: testDb, config }
      );
      expect(migratedBackToR2.items[0]?.storageProvider).toBe("r2");
      expect(migratedBackToR2.items[0]?.accessUrl).toContain("https://media.example.com/assets/");

      await deleteMedia(currentAdmin, r2Uploaded.id, { client: testDb, config });
      const afterDelete = await listMedia(
        currentAdmin,
        { storageProvider: "r2" },
        { client: testDb, config }
      );
      expect(afterDelete.items.some((item) => item.id === r2Uploaded.id)).toBe(false);

      expect(calls.some((call) => call.method === "PUT")).toBe(true);
      expect(calls.some((call) => call.method === "GET")).toBe(true);
      expect(calls.some((call) => call.method === "DELETE")).toBe(true);
      expect(calls.every((call) => call.url.includes("r2.cloudflarestorage.com"))).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
      await testDb`
        UPDATE site_config
        SET r2_enabled = false,
            r2_account_id = null,
            r2_bucket = null,
            r2_access_key_id = null,
            r2_secret_access_key_encrypted = null,
            r2_public_base_url = null
        WHERE id = 1
      `;
    }
  });

  test("honors explicit media upload storage targets", async () => {
    const config = loadConfig({
      NODE_ENV: "test",
      UPLOADS_DIR: uploadRoot,
      UPLOADS_URL_PREFIX: "/uploads",
      UPLOAD_MAX_FILE_SIZE_BYTES: "2048",
    });
    const calls: Array<{ method: string; url: string }> = [];
    const originalFetch = globalThis.fetch;

    await updateSystemSiteConfig(
      currentAdmin,
      {
        commentsEnabled: true,
        r2AccessKeyId: "r2-access-key-id",
        r2AccountId: "r2-account-id",
        r2Bucket: "leiblog-media",
        r2Enabled: true,
        r2PublicBaseUrl: "https://media.example.com/assets/",
        r2SecretAccessKey: "r2-secret-access-key",
      },
      testDb
    );

    globalThis.fetch = Object.assign(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ method: init?.method ?? "GET", url: String(input) });
        return new Response(null, { status: 204 });
      },
      originalFetch
    );

    try {
      const localUploaded = await uploadMedia(
        currentAdmin,
        {
          file: pngFile("forced-local.png"),
          fileName: "forced-local.png",
          folderSlug: "site",
          targetProvider: "local",
        },
        { client: testDb, config }
      );
      const r2Uploaded = await uploadMedia(
        currentAdmin,
        {
          file: pngFile("forced-r2.png"),
          fileName: "forced-r2.png",
          folderSlug: "site",
          targetProvider: "r2",
        },
        { client: testDb, config }
      );

      expect(localUploaded.storageProvider).toBe("local");
      expect(localUploaded.accessUrl.startsWith("/uploads/")).toBe(true);
      expect(r2Uploaded.storageProvider).toBe("r2");
      expect(r2Uploaded.accessUrl).toContain("https://media.example.com/assets/");
      expect(calls.filter((call) => call.method === "PUT")).toHaveLength(1);
    } finally {
      globalThis.fetch = originalFetch;
      await testDb`
        UPDATE site_config
        SET r2_enabled = false,
            r2_account_id = null,
            r2_bucket = null,
            r2_access_key_id = null,
            r2_secret_access_key_encrypted = null,
            r2_public_base_url = null
        WHERE id = 1
      `;
    }

    await expect(
      uploadMedia(
        currentAdmin,
        {
          file: pngFile("disabled-r2.png"),
          fileName: "disabled-r2.png",
          folderSlug: "site",
          targetProvider: "r2",
        },
        { client: testDb, config }
      )
    ).rejects.toThrow("请先启用 Cloudflare R2 存储配置");
  });

  test("migrates media to R2, updates known references, and keeps the original local file", async () => {
    const config = loadConfig({
      NODE_ENV: "test",
      UPLOADS_DIR: uploadRoot,
      UPLOADS_URL_PREFIX: "/uploads",
      UPLOAD_MAX_FILE_SIZE_BYTES: "2048",
    });
    const originalFetch = globalThis.fetch;
    const calls: Array<{ method: string; url: string }> = [];

    await updateSystemSiteConfig(
      currentAdmin,
      {
        commentsEnabled: true,
        r2AccessKeyId: null,
        r2AccountId: null,
        r2Bucket: null,
        r2Enabled: false,
        r2PublicBaseUrl: null,
        r2SecretAccessKey: null,
      },
      testDb
    );

    const uploaded = await uploadMedia(
      currentAdmin,
      { file: pngFile("references.png"), fileName: "references.png", folderSlug: "article-covers" },
      { client: testDb, config }
    );
    const oldUrl = uploaded.accessUrl;
    const localDownload = await getMediaDownload(currentAdmin, uploaded.id, {
      client: testDb,
      config,
    });

    expect(uploaded.storageProvider).toBe("local");
    expect("filePath" in localDownload).toBe(true);
    if (!("filePath" in localDownload)) throw new Error("Expected local media file");
    const originalLocalPath = localDownload.filePath!;

    await testDb`
      INSERT INTO site_info (
        id, site_name, description, logo_dark_url, logo_light_url, favicon_url,
        established_at, home_cover_urls
      )
      VALUES (
        1, 'LeiBlog', '媒体引用测试', ${oldUrl}, ${oldUrl}, ${oldUrl},
        now(), ARRAY[${oldUrl}, '/uploads/keep.png']::text[]
      )
      ON CONFLICT (id) DO UPDATE
      SET logo_dark_url = EXCLUDED.logo_dark_url,
          logo_light_url = EXCLUDED.logo_light_url,
          favicon_url = EXCLUDED.favicon_url,
          home_cover_urls = EXCLUDED.home_cover_urls
    `;
    await testDb`
      UPDATE users
      SET avatar_url = ${oldUrl}
      WHERE id = ${currentAdmin.id}
    `;
    const [article] = await testDb<{ id: string }[]>`
      INSERT INTO articles (author_id, title, slug, summary, content_mdx, cover_image_url)
      VALUES (
        ${currentAdmin.id}, '媒体迁移引用', ${`media-reference-${uploaded.id}`},
        '媒体迁移引用', ${`![cover](${oldUrl})\n\n${oldUrl}`}, ${oldUrl}
      )
      RETURNING id
    `;
    await testDb`
      INSERT INTO article_revisions (
        article_id, editor_id, title, slug, summary, content_mdx, cover_image_url, status
      )
      VALUES (
        ${article.id}, ${currentAdmin.id}, '媒体迁移引用', ${`media-reference-${uploaded.id}`},
        '媒体迁移引用', ${`![cover](${oldUrl})`}, ${oldUrl}, 'draft'
      )
    `;
    await testDb`
      INSERT INTO article_contributors (name, avatar_url, link_url)
      VALUES (${`媒体贡献者 ${uploaded.id}`}, ${oldUrl}, 'https://example.com')
    `;
    const [navigationGroup] = await testDb<{ id: string }[]>`
      INSERT INTO navigation_groups (name)
      VALUES (${`媒体导航 ${uploaded.id}`})
      RETURNING id
    `;
    await testDb`
      INSERT INTO navigation_items (group_id, name, url, icon_url)
      VALUES (${navigationGroup.id}, '媒体链接', 'https://example.com', ${oldUrl})
    `;
    await testDb`
      INSERT INTO comments (article_id, user_id, content)
      VALUES (${article.id}, ${currentAdmin.id}, ${`评论图片 ${oldUrl}`})
    `;

    await updateSystemSiteConfig(
      currentAdmin,
      {
        commentsEnabled: true,
        r2AccessKeyId: "r2-access-key-id",
        r2AccountId: "r2-account-id",
        r2Bucket: "leiblog-media",
        r2Enabled: true,
        r2PublicBaseUrl: "https://media.example.com/assets/",
        r2SecretAccessKey: "r2-secret-access-key",
      },
      testDb
    );

    globalThis.fetch = Object.assign(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ method: init?.method ?? "GET", url: String(input) });
        return new Response(null, { status: 204 });
      },
      originalFetch
    );

    try {
      const migrated = await migrateMediaStorage(
        currentAdmin,
        { ids: [uploaded.id], targetProvider: "r2" },
        { client: testDb, config }
      );
      const newUrl = migrated.items[0]?.accessUrl;

      expect(migrated.items[0]?.storageProvider).toBe("r2");
      expect(newUrl).toContain("https://media.example.com/assets/");
      expect(newUrl).not.toBe(oldUrl);
      expect(migrated.updatedReferences).toBeGreaterThanOrEqual(9);
      expect((await stat(originalLocalPath)).isFile()).toBe(true);
      expect(calls.some((call) => call.method === "PUT")).toBe(true);
      expect(calls.some((call) => call.method === "DELETE")).toBe(false);

      const [siteInfo] = await testDb<{
        favicon_url: string;
        home_cover_urls: string[];
        logo_dark_url: string;
        logo_light_url: string;
      }[]>`
        SELECT logo_dark_url, logo_light_url, favicon_url, home_cover_urls
        FROM site_info
        WHERE id = 1
      `;
      expect(siteInfo.logo_dark_url).toBe(newUrl);
      expect(siteInfo.logo_light_url).toBe(newUrl);
      expect(siteInfo.favicon_url).toBe(newUrl);
      expect(siteInfo.home_cover_urls).toContain(newUrl);
      expect(siteInfo.home_cover_urls).not.toContain(oldUrl);

      const [referenceRows] = await testDb<{ stale_count: string }[]>`
        SELECT (
          (SELECT count(*) FROM users WHERE avatar_url = ${oldUrl}) +
          (SELECT count(*) FROM articles WHERE cover_image_url = ${oldUrl} OR position(${oldUrl} in content_mdx) > 0) +
          (SELECT count(*) FROM article_revisions WHERE cover_image_url = ${oldUrl} OR position(${oldUrl} in content_mdx) > 0) +
          (SELECT count(*) FROM article_contributors WHERE avatar_url = ${oldUrl}) +
          (SELECT count(*) FROM navigation_items WHERE icon_url = ${oldUrl}) +
          (SELECT count(*) FROM comments WHERE position(${oldUrl} in content) > 0)
        )::text AS stale_count
      `;
      expect(Number(referenceRows.stale_count)).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
      await testDb`
        UPDATE site_config
        SET r2_enabled = false,
            r2_account_id = null,
            r2_bucket = null,
            r2_access_key_id = null,
            r2_secret_access_key_encrypted = null,
            r2_public_base_url = null
        WHERE id = 1
      `;
    }
  });
});
