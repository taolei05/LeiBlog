import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

const selectedPage = vi.hoisted(() => ({ id: "comments" }));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useState: (initial: unknown) =>
      react.useState(initial === "dashboard" ? selectedPage.id : initial),
  };
});
vi.mock("../components/admin-async-content", () => ({ AdminAsyncContent: () => null }));

import { AdminShellPage } from "./page";
import { InitialSetupPage } from "../initial-setup/page";

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
