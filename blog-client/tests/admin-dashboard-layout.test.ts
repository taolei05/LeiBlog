import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import dashboardPageSource from "../src/features/admin/dashboard/AdminDashboardPage.tsx?raw";

const layoutsCss = readFileSync(
  new URL("../src/shared/theme/layouts.css", import.meta.url),
  "utf8",
);

describe("admin dashboard layout", () => {
  it("matches the wide content width used by management pages", () => {
    expect(dashboardPageSource).toContain(
      '<section className="page-stack admin-page admin-page--wide dashboard-page">',
    );
    expect(layoutsCss).toContain(`.dashboard-page .admin-status-card {
  max-width: none;
}`);
  });

  it("renders the dashboard as a management workspace", () => {
    expect(dashboardPageSource).toContain('"/admin/dashboard/overview"');
    expect(dashboardPageSource).toContain("contentTasks");
    expect(dashboardPageSource).toContain("recentArticles");
    expect(dashboardPageSource).toContain("recentComments");
    expect(dashboardPageSource).toContain("integrations");
    expect(dashboardPageSource).toContain("内容待办");
    expect(dashboardPageSource).toContain("最近文章");
    expect(dashboardPageSource).toContain("最新评论");
    expect(dashboardPageSource).toContain("媒体存储");
    expect(dashboardPageSource).toContain("集成状态");
    expect(dashboardPageSource).not.toContain("后台框架");
    expect(dashboardPageSource).not.toContain("阶段 3");
  });
});
