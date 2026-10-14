import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

const selectedPage = vi.hoisted(() => ({ id: "comments", step: 0, narrow: false }));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useState: (initial: unknown) =>
      react.useState(
        initial === "dashboard" ? selectedPage.id : initial === 0 ? selectedPage.step : initial,
      ),
  };
});
vi.mock("../components/admin-async-content", () => ({ AdminAsyncContent: () => null }));
vi.mock("@astryxdesign/core/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@astryxdesign/core/hooks")>()),
  useMediaQuery: () => selectedPage.narrow,
}));

import { AdminShellPage } from "./page";
import { InitialSetupPage } from "../initial-setup/page";
import { SiteSettingsPage } from "../site-settings/page";
import { i18n } from "../../../../shared/i18n";

describe("admin navigation implementation status", () => {
  it.each(["comments", "tags", "contributors"])(
    "does not mark implemented %s management as in development",
    (id) => {
      selectedPage.id = id;
      const markup = renderToStaticMarkup(
        createElement(AdminShellPage, {
          authToken: "test-token",
          user: {
            id: "admin",
            role: "admin",
            username: "owner",
            email: "owner@example.test",
            tags: [],
            commentEmailNotifications: false,
            newPostEmailNotifications: false,
          },
          themeMode: "light",
          onToggleThemeMode: vi.fn(),
          onUserUpdated: vi.fn(),
          onLogout: async () => {},
          onOpenBlog: vi.fn(),
        }),
      );
      expect(markup).not.toContain("admin.placeholder.dev");
      expect(markup).not.toContain("开发中");
      expect(markup).not.toContain("In development");
    },
  );
});

describe("initial setup token field", () => {
  it.each([true, false])("matches the server's token requirement: %s", (requiresSetupToken) => {
    const markup = renderToStaticMarkup(
      createElement(InitialSetupPage, {
        requiresSetupToken,
        themeMode: "light",
        onToggleThemeMode: vi.fn(),
        onComplete: vi.fn(),
        onSubmitFailed: vi.fn(),
      }),
    );
    expect(markup.includes('placeholder="SETUP_TOKEN"')).toBe(requiresSetupToken);
  });
});

describe("initial setup personal tags", () => {
  it.each(["zh-CN", "en"])(
    "uses removable tokens without the unwanted default in %s",
    async (language) => {
      const previousLanguage = i18n.language;
      try {
        await i18n.changeLanguage(language);
        const markup = renderToStaticMarkup(
          createElement(InitialSetupPage, {
            themeMode: "light",
            onToggleThemeMode: vi.fn(),
            onComplete: vi.fn(),
            onSubmitFailed: vi.fn(),
          }),
        );
        expect(markup).toContain(`role="group" aria-label="${i18n.t("initialSetup.admin.tags")}"`);
        expect(markup).not.toContain("小可爱");
        expect(markup).not.toContain("Cutie");
        expect(markup).toContain("repeat(4, 1fr)");
        expect(
          i18n
            .t("initialSetup.defaults.tags")
            .split(",")
            .map((tag) => tag.trim()),
        ).toEqual(language === "en" ? ["Admin", "Author"] : ["管理员", "作者"]);
      } finally {
        await i18n.changeLanguage(previousLanguage);
      }
    },
  );
});

describe("initial setup layout and keywords", () => {
  it.each([false, true])(
    "keeps account fields together and adapts to narrow screens: %s",
    (narrow) => {
      selectedPage.narrow = narrow;
      try {
        const markup = renderToStaticMarkup(
          createElement(InitialSetupPage, {
            requiresSetupToken: true,
            themeMode: "light",
            onToggleThemeMode: vi.fn(),
            onComplete: vi.fn(),
            onSubmitFailed: vi.fn(),
          }),
        );
        expect(markup).toContain(`repeat(${narrow ? 1 : 4}, 1fr)`);
        expect(markup).toContain('placeholder="SETUP_TOKEN"');
      } finally {
        selectedPage.narrow = false;
      }
    },
  );

  it("aligns the site information fields at the start of the row", () => {
    selectedPage.step = 1;
    try {
      const markup = renderToStaticMarkup(
        createElement(InitialSetupPage, {
          themeMode: "light",
          onToggleThemeMode: vi.fn(),
          onComplete: vi.fn(),
          onSubmitFailed: vi.fn(),
        }),
      );
      expect(markup).toContain('data-columns="3"');
      expect(markup).toContain('data-align="start"');
    } finally {
      selectedPage.step = 0;
    }
  });

  it.each(["zh-CN", "en"])("uses a tokenizer for SEO keywords in %s", async (language) => {
    const previousLanguage = i18n.language;
    selectedPage.step = 2;
    try {
      await i18n.changeLanguage(language);
      const markup = renderToStaticMarkup(
        createElement(InitialSetupPage, {
          themeMode: "light",
          onToggleThemeMode: vi.fn(),
          onComplete: vi.fn(),
          onSubmitFailed: vi.fn(),
        }),
      );
      expect(markup).toContain(
        `role="group" aria-label="${i18n.t("initialSetup.basics.seoKeywords")}"`,
      );
      expect(markup).not.toContain("用逗号分隔");
      expect(markup).not.toContain("Separate with commas");
    } finally {
      selectedPage.step = 0;
      await i18n.changeLanguage(previousLanguage);
    }
  });
});

describe("site settings keywords", () => {
  it("uses the same SEO tokenizer as initial setup", () => {
    const markup = renderToStaticMarkup(
      createElement(SiteSettingsPage, { authToken: "test-token", isNarrow: false }),
    );
    expect(markup).toContain(
      `role="group" aria-label="${i18n.t("initialSetup.basics.seoKeywords")}"`,
    );
  });
});
