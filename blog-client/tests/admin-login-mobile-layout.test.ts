import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import adminLoginPageSource from "../src/features/admin/auth/AdminLoginPage.tsx?raw";

const layoutsCss = readFileSync(
  new URL("../src/shared/theme/layouts.css", import.meta.url),
  "utf8",
);

describe("admin login mobile layout", () => {
  it("shows only the administrator login action", () => {
    expect(adminLoginPageSource).toContain("登录后台");
    const actionLayoutIndex = layoutsCss.indexOf(`.admin-login-card__actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr);`);
    expect(actionLayoutIndex).toBeGreaterThan(-1);
    expect(actionLayoutIndex).toBeLessThan(layoutsCss.indexOf("@media (max-width: 768px)"));
    expect(layoutsCss).toContain(`.admin-login-card__actions > .button {
  width: 100%;
  min-width: 0;`);
    expect(layoutsCss).not.toContain(".admin-login-card__actions > .button:first-child");
  });

  it("keeps the theme switcher beside the heading at every width", () => {
    expect(layoutsCss).toContain(`.admin-login-card__header {
  align-items: center;
  flex-direction: row;
  justify-content: space-between;
}`);
    expect(layoutsCss).toContain(`.admin-login-card__header .theme-switcher {
  flex: 0 0 auto;
  width: auto;
  min-width: 0;`);
    expect(layoutsCss).not.toContain("@media (max-width: 520px)");
    expect(layoutsCss).toContain(`.admin-login-card__header .theme-switcher span {
    display: inline-flex;`);
  });
});
