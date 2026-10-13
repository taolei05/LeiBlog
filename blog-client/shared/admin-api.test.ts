import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  COOKIE_ADMIN_AUTH_TOKEN,
  getAdminMe,
  getAdminSetupStatus,
  getPublicGuestbookComments,
  getPublicSiteSettings,
  isAdminAuthState,
  loginAdmin,
  resolveAdminAssetUrl,
  updateBlogUserProfile,
} from "./admin-api";

const adminUser = {
  id: "admin",
  role: "admin",
  username: "owner",
  email: "owner@example.com",
  tags: [],
  commentEmailNotifications: false,
  newPostEmailNotifications: false,
};

afterEach(() => vi.unstubAllGlobals());

describe("admin media display URLs", () => {
  it("uses the same stable version for media previews and absolute local URLs", () => {
    const source = "/uploads/site/image.png";
    const displayUrl = resolveAdminAssetUrl(source);
    expect(displayUrl).toContain("/uploads/site/image.png?media-v=2");
    expect(resolveAdminAssetUrl(displayUrl)).toBe(displayUrl);
  });

  it("leaves external media and local object previews unchanged", () => {
    for (const url of [
      "https://cdn.example.com/uploads/image.png?signature=abc",
      "data:image/png;base64,aGVsbG8=",
      "blob:http://localhost/preview",
    ]) {
      expect(resolveAdminAssetUrl(url)).toBe(url);
    }
  });
});

describe("shared API response validation", () => {
  it("reads the initialization token requirement without exposing a secret", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          hasAdmin: false,
          requiresSetup: true,
          requiresSetupToken: true,
        }),
      ),
    );
    expect(await getAdminSetupStatus()).toEqual({
      hasAdmin: false,
      requiresSetup: true,
      requiresSetupToken: true,
    });
  });
  it("sends the chosen notification email language with profile preferences", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (typeof init?.body !== "string") {
          throw new Error("Expected a JSON profile payload");
        }
        const payload: unknown = JSON.parse(init.body);
        expect(payload).toMatchObject({
          notificationEmailLocale: "en",
          commentEmailNotifications: true,
          newPostEmailNotifications: false,
        });
        return Response.json({ user: adminUser });
      }),
    );
    await updateBlogUserProfile({
      username: "owner",
      notificationEmailLocale: "en",
      commentEmailNotifications: true,
      newPostEmailNotifications: false,
    });
  });
  const publicSettings = {
    author: null,
    basics: { copyright: "Test Blog", commentsEnabled: true },
    filings: { icpRecords: [], policeRecordNumber: "", policeRecordUrl: "" },
    siteLocalizations: {
      zhCN: {
        siteName: "Test",
        siteDescription: "",
        homepageCopy: "",
        seoTitle: "",
        seoDescription: "",
      },
      en: {
        siteName: "Test",
        siteDescription: "",
        homepageCopy: "",
        seoTitle: "",
        seoDescription: "",
      },
    },
    site: {
      siteName: "Test",
      foundedAt: "2026-10-12",
      siteDescription: "",
      coverUrls: [],
      lightLogoUrl: "",
      darkLogoUrl: "",
      faviconUrl: "",
      timeZone: "Asia/Shanghai",
    },
  };

  it.each([true, false])("preserves the public comment switch: %s", async (commentsEnabled) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ...publicSettings,
          basics: { ...publicSettings.basics, commentsEnabled },
        }),
      ),
    );
    expect((await getPublicSiteSettings()).basics).toEqual({
      copyright: "Test Blog",
      commentsEnabled,
    });
  });

  it.each([undefined, null, "false", 0])(
    "rejects an invalid comment switch: %s",
    async (commentsEnabled) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json({
            ...publicSettings,
            basics: { ...publicSettings.basics, commentsEnabled },
          }),
        ),
      );
      await expect(getPublicSiteSettings()).rejects.toThrow("invalid");
    },
  );

  it("keeps browser credentials in cookies and discards the login bearer token", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.credentials).toBe("include");
      return Response.json({ token: "private-bearer-token", user: adminUser });
    });
    vi.stubGlobal("fetch", fetcher);
    const state = await loginAdmin({
      identifier: "owner",
      password: "password",
      altcha: "proof",
      locale: "en",
    });
    expect(state.token).toBe(COOKIE_ADMIN_AUTH_TOKEN);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("restores a cookie session without an empty Authorization header", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).has("authorization")).toBe(false);
      expect(init?.credentials).toBe("include");
      return Response.json({ user: adminUser });
    });
    vi.stubGlobal("fetch", fetcher);
    expect(await getAdminMe(COOKIE_ADMIN_AUTH_TOKEN, "en")).toEqual(adminUser);
  });
  it.each(["name", "avatarUrl", "bio", "blogUrl"])(
    "rejects a malformed admin %s",
    async (field) => {
      const body = { token: "token", user: { ...adminUser, [field]: { invalid: true } } };
      expect(isAdminAuthState(body)).toBe(false);
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => Response.json(body)),
      );
      await expect(
        loginAdmin({ identifier: "owner", password: "password", altcha: "proof", locale: "en" }),
      ).rejects.toThrow("invalid");
    },
  );

  it("accepts valid optional profile fields and rejects empty tokens", () => {
    expect(
      isAdminAuthState({
        token: "token",
        user: { ...adminUser, name: "Owner", blogUrl: "https://example.com" },
      }),
    ).toBe(true);
    expect(isAdminAuthState({ token: " ", user: adminUser })).toBe(false);
    expect(isAdminAuthState({ token: "", transport: "cookie", user: adminUser })).toBe(true);
    expect(isAdminAuthState({ token: "token", transport: "cookie", user: adminUser })).toBe(false);
    expect(isAdminAuthState({ token: "token", transport: {}, user: adminUser })).toBe(false);
  });

  it.each([{ page: 0 }, { pageSize: 0 }, { page: 1.5 }, { totalItems: -1 }, { totalPages: -1 }])(
    "rejects invalid pagination: %j",
    async (invalid) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json({
            ok: true,
            items: [],
            pageInfo: { page: 1, pageSize: 80, totalItems: 0, totalPages: 0, ...invalid },
          }),
        ),
      );
      await expect(
        getPublicGuestbookComments({ locale: "en", page: 1, pageSize: 80 }),
      ).rejects.toThrow("invalid");
    },
  );

  it("accepts empty comment pages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ok: true,
          items: [],
          pageInfo: { page: 1, pageSize: 80, totalItems: 0, totalPages: 0 },
        }),
      ),
    );
    expect(
      (await getPublicGuestbookComments({ locale: "en", page: 1, pageSize: 80 })).items,
    ).toEqual([]);
  });

  it("rejects duplicate comment IDs that could cause recursive rendering", async () => {
    const comment = {
      id: "duplicate",
      targetType: "guestbook",
      articleId: null,
      articleTitle: null,
      userId: "user",
      parentId: null,
      content: "comment",
      status: "approved",
      createdAt: "2026-10-12",
      updatedAt: "2026-10-12",
      deletedAt: null,
      location: null,
      author: {
        id: "user",
        username: "user",
        name: null,
        role: "user",
        avatarUrl: null,
        tags: [],
        blogUrl: null,
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ok: true,
          items: [comment, { ...comment, parentId: "duplicate" }],
          pageInfo: { page: 1, pageSize: 80, totalItems: 2, totalPages: 1 },
        }),
      ),
    );
    await expect(
      getPublicGuestbookComments({ locale: "en", page: 1, pageSize: 80 }),
    ).rejects.toThrow("invalid");
  });
});
