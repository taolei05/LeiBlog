import { createElement } from "react";
import type { PropsWithChildren, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";
import type { BlogUser } from "../../../shared/admin-api";

vi.mock("@astryxdesign/core/Popover", () => ({
  Popover: ({ children, content }: PropsWithChildren<{ content: ReactNode }>) =>
    createElement("section", null, children, content),
}));
vi.mock("react-photo-view", () => ({
  PhotoProvider: ({ children }: PropsWithChildren) => children,
  PhotoView: ({ children }: PropsWithChildren) => children,
}));

import {
  AccountProfileEditor,
  frontCopyByLanguage,
  isInternalRoute,
  SiteAccountBlock,
} from "./App";

const user: BlogUser = {
  id: "account",
  username: "admin",
  email: "account@example.test",
  role: "user",
  tags: ["管理员"],
};

const renderAccount = (account: BlogUser | null, language: "zh-CN" | "en" = "zh-CN") =>
  renderToStaticMarkup(
    createElement(SiteAccountBlock, {
      authState: account === null ? null : { user: account },
      copy: frontCopyByLanguage[language],
      onNavigate: vi.fn(),
      onLogout: vi.fn(),
      onOpenAuth: vi.fn(),
    }),
  );

describe("public account admin entry", () => {
  it.each([
    { language: "zh-CN" as const, label: "前往后台" },
    { language: "en" as const, label: "Go to admin" },
  ])("shows a localized admin link only for administrators ($language)", ({ language, label }) => {
    const markup = renderAccount({ ...user, role: "admin" }, language);
    expect(markup).toContain('href="/admin/"');
    expect(markup).toContain(label);
  });

  it("does not grant an admin entry based on the username or profile tags", () => {
    expect(renderAccount(user)).not.toContain('href="/admin/"');
    expect(renderAccount(user)).not.toContain("前往后台");
  });

  it("does not expose the admin link to signed-out visitors", () => {
    const markup = renderAccount(null);
    expect(markup).not.toContain('href="/admin/"');
    expect(markup).toContain("登录");
  });
});

describe("public SPA route boundary", () => {
  it.each(["/admin", "/admin/", "/admin/site-settings", "/admin?next=x", "/admin#login"])(
    "leaves admin navigation to the browser: %s",
    (path) => expect(isInternalRoute(path)).toBe(false),
  );

  it.each(["/", "/profile", "/articles/example", "/admin-guide"])(
    "continues client navigation for public routes: %s",
    (path) => expect(isInternalRoute(path)).toBe(true),
  );
});

describe("profile settings panels", () => {
  it.each(["en", "zh-CN"] as const)(
    "edits both profile languages and localizes the sidebar in %s",
    (language) => {
      const markup = renderToStaticMarkup(
        createElement(AccountProfileEditor, {
          copy: frontCopyByLanguage[language],
          language,
          user: {
            ...user,
            profileLocalizations: {
              zhCN: { name: "中文姓名", bio: "中文简介", tags: ["摄影", "写作"] },
              en: { name: "English name", bio: "English bio", tags: ["Photography", "Writing"] },
            },
          },
          timeZone: "Asia/Shanghai",
          panelMode: null,
          onNotice: vi.fn(),
          onPasswordChanged: vi.fn(),
          onProfileUpdated: vi.fn(),
        }),
      );
      const sidebar = markup.split('class="profile-center__main"')[0] ?? "";
      expect(sidebar).toContain(language === "en" ? "English name" : "中文姓名");
      expect(sidebar).toContain(language === "en" ? "Photography" : "摄影");
      expect(sidebar).not.toContain(language === "en" ? "摄影" : "Photography");
      expect(markup).toContain('value="中文姓名"');
      expect(markup).toContain('value="English name"');
      expect(markup).toContain("中文简介");
      expect(markup).toContain("English bio");
      expect(markup.match(/class="astryx-tokenizer /g)).toHaveLength(2);
    },
  );
  it.each(["en", "zh-CN"] as const)("shows the corresponding login location in %s", (language) => {
    const markup = renderToStaticMarkup(
      createElement(AccountProfileEditor, {
        copy: frontCopyByLanguage[language],
        language,
        user: { ...user, lastLoginLocation: "日本东京", lastLoginLocationEn: "Tokyo, Japan" },
        timeZone: "Asia/Shanghai",
        panelMode: null,
        onNotice: vi.fn(),
        onPasswordChanged: vi.fn(),
        onProfileUpdated: vi.fn(),
      }),
    );
    expect(markup).toContain(language === "en" ? "Tokyo, Japan" : "日本东京");
    expect(markup).not.toContain(language === "en" ? "日本东京" : "Tokyo, Japan");
  });
  it("renders saved personal tags as individual editable tokens", () => {
    const markup = renderToStaticMarkup(
      createElement(AccountProfileEditor, {
        copy: frontCopyByLanguage["zh-CN"],
        language: "zh-CN",
        user: { ...user, tags: ["React", "摄影", "写作", "JavaScript, TypeScript"] },
        timeZone: "Asia/Shanghai",
        panelMode: null,
        onNotice: vi.fn(),
        onPasswordChanged: vi.fn(),
        onProfileUpdated: vi.fn(),
      }),
    );
    expect(markup).toContain("astryx-tokenizer");
    expect(markup).not.toContain('value="React, 摄影, 写作"');
    expect(markup).toContain("React");
    expect(markup).toContain("摄影");
    expect(markup).toContain("写作");
    expect(markup).toContain("JavaScript, TypeScript");
  });
  it.each(["zh-CN", "en"] as const)(
    "uses accessible collapsible sections with local actions in %s",
    (language) => {
      const copy = frontCopyByLanguage[language];
      const markup = renderToStaticMarkup(
        createElement(AccountProfileEditor, {
          copy,
          language,
          user,
          timeZone: "Asia/Shanghai",
          panelMode: null,
          onNotice: vi.fn(),
          onPasswordChanged: vi.fn(),
          onProfileUpdated: vi.fn(),
        }),
      );
      expect(markup).toContain(copy.auth.profile.displayInfo);
      expect(markup).toContain(copy.auth.profile.notificationsTitle);
      expect(markup).toContain(copy.auth.profile.securityTitle);
      expect(markup.match(/<button\b[^>]*aria-expanded=/g)).toHaveLength(3);
      expect(markup).toContain('class="profile-panel-actions"');
      expect(markup).not.toContain('class="profile-center__actions"');
      expect(markup).toContain(copy.auth.profile.cancel);
      expect(markup).toContain(copy.auth.profile.save);
    },
  );
});
