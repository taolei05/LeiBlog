import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import {
  COOKIE_ADMIN_AUTH_TOKEN,
  getAdminMe,
  getAdminSetupStatus,
  getPublicGuestbookComments,
  getPublicSiteSettings,
  isAdminAuthState,
  loginAdmin,
  importBackupArchive,
  previewBackupArchive,
  resolveAdminAssetUrl,
  readMediaAssetForPreview,
  uploadBlogUserAvatar,
  uploadInitialSetupMediaAsset,
  uploadMediaAsset,
  uploadPublicCommentImage,
  updateBlogUserProfile,
  translateArticleBody,
  testExchangeRateApiKey,
} from "./admin-api";
import type { UploadProgress, UploadProgressHandler } from "./upload-request";

const adminUser = {
  id: "admin",
  role: "admin",
  username: "owner",
  email: "owner@example.com",
  tags: [],
  commentEmailNotifications: false,
  newPostEmailNotifications: false,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("authenticated media preview reads", () => {
  const parameters = {
    mediaId: "private-file",
    token: "",
    maxBytes: 10,
    signal: new AbortController().signal,
  };
  it("uses the admin download route, cookies, no cache and an abort signal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input, init) => {
        expect(String(input)).toContain("/api/admin/media/private-file/download");
        expect(init?.credentials).toBe("include");
        expect(init?.cache).toBe("no-store");
        expect(init?.signal).toBe(parameters.signal);
        expect(new Headers(init?.headers).has("authorization")).toBe(false);
        return new Response("hello");
      }),
    );
    expect(await (await readMediaAssetForPreview(parameters)).text()).toBe("hello");
  });
  it("preserves authentication failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ message: "Not authorized" }, { status: 401 })),
    );
    await expect(readMediaAssetForPreview(parameters)).rejects.toThrow("Not authorized");
  });
  it("rejects excessive declared size before reading the file", async () => {
    const response = new Response("file", { headers: { "content-length": "100" } });
    const cancel = vi.spyOn(response.body!, "cancel");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response),
    );
    await expect(readMediaAssetForPreview(parameters)).rejects.toBeInstanceOf(RangeError);
    expect(cancel).toHaveBeenCalled();
  });
  it("bounds streamed data even without a trustworthy content length", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(8));
        controller.enqueue(new Uint8Array(8));
      },
      cancel,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(body)),
    );
    await expect(readMediaAssetForPreview(parameters)).rejects.toBeInstanceOf(RangeError);
    expect(cancel).toHaveBeenCalled();
  });
});

describe("ExchangeRate API key test messages", () => {
  it.each([
    { locale: "zh-CN", message: "ExchangeRate API 密钥测试失败。" },
    { locale: "en", message: "ExchangeRate API key test failed." },
  ] as const)(
    "uses the $locale fallback when the response has no message",
    async ({ locale, message }) => {
      const fetcher = vi.fn(async (_input, init) => {
        expect(new Headers(init?.headers).get("x-leiblog-locale")).toBe(locale);
        return Response.json({}, { status: 502 });
      });
      vi.stubGlobal("fetch", fetcher);

      await expect(testExchangeRateApiKey({ apiKey: "", locale, token: "" })).rejects.toThrow(
        message,
      );
    },
  );

  it("preserves the server's detailed Chinese error message", async () => {
    const message = "汇率请求失败，请检查密钥、账户与额度。";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ message }, { status: 400 })),
    );

    await expect(
      testExchangeRateApiKey({ apiKey: "", locale: "zh-CN", token: "" }),
    ).rejects.toThrow(message);
  });
});

describe("all multipart upload endpoints", () => {
  const file = new File(["image"], "test.png");
  const cases: {
    name: string;
    run: (onUploadProgress: UploadProgressHandler) => Promise<unknown>;
  }[] = [
    {
      name: "profile avatar",
      run: (onUploadProgress) => uploadBlogUserAvatar({ file, onUploadProgress }),
    },
    {
      name: "comment image",
      run: (onUploadProgress) => uploadPublicCommentImage({ file, onUploadProgress }),
    },
    {
      name: "setup image",
      run: (onUploadProgress) =>
        uploadInitialSetupMediaAsset({ file, onUploadProgress, setupToken: "test-token" }),
    },
    {
      name: "admin media",
      run: (onUploadProgress) => uploadMediaAsset({ file, onUploadProgress, token: "" }),
    },
    {
      name: "backup preview",
      run: (onUploadProgress) => previewBackupArchive({ file, onUploadProgress, token: "" }),
    },
    {
      name: "backup import",
      run: (onUploadProgress) =>
        importBackupArchive({ file, onUploadProgress, token: "", mode: "replace" }),
    },
  ];
  it.each(cases)("reports a rejected $name upload as failed, not complete", async ({ run }) => {
    const progress: UploadProgress[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input, init) => {
        expect(init?.body).toBeInstanceOf(FormData);
        expect(init?.credentials).toBe("include");
        expect(new Headers(init?.headers).get("authorization")).toBeNull();
        return Response.json({ message: "Rejected upload" }, { status: 400 });
      }),
    );
    await expect(run((item) => progress.push(item))).rejects.toThrow("Rejected upload");
    expect(progress.map((item) => item.phase)).toEqual(["uploading", "processing", "error"]);
  });
  it("completes a comment image only after validating its response", async () => {
    const progress: UploadProgress[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: true, accessUrl: "/uploads/test.png" })),
    );
    expect(
      await uploadPublicCommentImage({ file, onUploadProgress: (item) => progress.push(item) }),
    ).toBe("/uploads/test.png");
    expect(progress.at(-1)?.phase).toBe("complete");
  });
  it("reports malformed success responses as failures", async () => {
    const progress: UploadProgress[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: true })),
    );
    await expect(
      uploadPublicCommentImage({ file, onUploadProgress: (item) => progress.push(item) }),
    ).rejects.toThrow("Comment image upload response was invalid.");
    expect(progress.at(-1)?.phase).toBe("error");
  });
});

describe("OAuth navigation URLs", () => {
  it.each(["google", "github"] as const)(
    "starts %s sign-in on the production website origin",
    async (provider) => {
      vi.stubEnv("PROD", true);
      vi.stubEnv("VITE_API_BASE_URL", undefined);
      vi.resetModules();
      const { startBlogOAuthLogin } = await import("./admin-api");
      const returnTo = "/articles/标签?tag=C++&lang=en#评论";
      const authorizationUrl =
        provider === "github"
          ? "https://github.com/login/oauth/authorize?state=test"
          : "https://accounts.google.com/o/oauth2/v2/auth?state=test";
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input, init) => {
          expect(input).toBe(`/api/blog/auth/oauth/${provider}/start`);
          expect(init?.method).toBe("POST");
          expect(init?.credentials).toBe("include");
          expect(JSON.parse(String(init?.body))).toEqual({
            altcha: "fresh-proof",
            locale: "en",
            returnTo,
          });
          return Response.json({ ok: true, authorizationUrl });
        }),
      );
      expect(
        await startBlogOAuthLogin({ provider, returnTo, altcha: "fresh-proof", locale: "en" }),
      ).toBe(authorizationUrl);
    },
  );

  it.each(["google", "github"] as const)(
    "preserves an explicitly configured API origin for %s",
    async (provider) => {
      vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test/");
      vi.resetModules();
      const { startBlogOAuthLogin } = await import("./admin-api");
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input) => {
          expect(input).toBe(`https://api.example.test/api/blog/auth/oauth/${provider}/start`);
          return Response.json({ message: "Human verification failed." }, { status: 400 });
        }),
      );
      await expect(
        startBlogOAuthLogin({ provider, returnTo: "/", altcha: "invalid", locale: "en" }),
      ).rejects.toThrow("Human verification failed.");
    },
  );

  it("rejects an authorization URL outside the selected provider", async () => {
    const { startBlogOAuthLogin } = await import("./admin-api");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ok: true,
          authorizationUrl: "https://attacker.example/login",
        }),
      ),
    );
    await expect(
      startBlogOAuthLogin({ provider: "github", returnTo: "/", altcha: "proof", locale: "en" }),
    ).rejects.toThrow("第三方登录授权地址无效。");
  });
});

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
  it("sends and reads both profile languages without mixing notification preferences", async () => {
    const profileLocalizations = {
      zhCN: { name: "中文", bio: "描述", tags: ["摄影"] },
      en: { name: "Name", bio: "Bio", tags: ["Photography"] },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input, init) => {
        expect(JSON.parse(String(init?.body))).toEqual({ profileLocalizations });
        return Response.json({ user: { ...adminUser, profileLocalizations } });
      }),
    );
    expect((await updateBlogUserProfile({ profileLocalizations })).profileLocalizations).toEqual(
      profileLocalizations,
    );
  });
  it("rejects malformed bilingual profile responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ user: { ...adminUser, profileLocalizations: { en: { tags: "bad" } } } }),
      ),
    );
    await expect(updateBlogUserProfile({})).rejects.toThrow("个人资料响应格式异常");
  });
  it("translates an article through the authenticated API without saving it", async () => {
    const signal = new AbortController().signal;
    const content = '<img width="233" height="134" src="/image.png" />\n\nText';
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input, init) => {
        expect(String(input)).toMatch(/\/api\/admin\/content\/articles\/translate$/);
        expect(init?.method).toBe("POST");
        expect(init?.credentials).toBe("include");
        expect(init?.signal).toBe(signal);
        expect(new Headers(init?.headers).get("authorization")).toBe("Bearer synthetic-token");
        expect(JSON.parse(String(init?.body))).toEqual({ content, sourceLocale: "en" });
        return Response.json({ content });
      }),
    );
    expect(
      await translateArticleBody({ content, sourceLocale: "en", token: "synthetic-token", signal }),
    ).toBe(content);
  });
  it.each([409, 502])(
    "reports article translation failure %s without accepting an invalid result",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => Response.json({ reason: "translation-failed" }, { status })),
      );
      await expect(
        translateArticleBody({ content: "Text", sourceLocale: "en", token: "token" }),
      ).rejects.toThrow("translation-failed");
    },
  );
  it("rejects malformed article translation success responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ content: { invalid: true } })),
    );
    await expect(
      translateArticleBody({ content: "Text", sourceLocale: "en", token: "token" }),
    ).rejects.toThrow("translation-failed");
  });
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
      notificationEmailLocale: "en",
      commentEmailNotifications: true,
      newPostEmailNotifications: false,
    });
  });
  it("sends explicit empty profile fields so they can be cleared independently", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (typeof init?.body !== "string") throw new Error("Expected a JSON profile payload");
        expect(JSON.parse(init.body)).toEqual({
          avatarUrl: "",
          bio: "",
          name: "",
          blogUrl: "",
          tags: [],
        });
        return Response.json({ user: adminUser });
      }),
    );
    await updateBlogUserProfile({ avatarUrl: "", bio: "", name: "", blogUrl: "", tags: [] });
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
