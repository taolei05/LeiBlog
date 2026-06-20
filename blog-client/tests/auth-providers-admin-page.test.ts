import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import adminLoginPageSource from "../src/features/admin/auth/AdminLoginPage.tsx?raw";
import adminNavigationSource from "../src/app/admin/adminNavigation.ts?raw";
import routerSource from "../src/app/router.tsx?raw";
import authProvidersPageSource from "../src/features/admin/system/AuthProvidersPage.tsx?raw";

const layoutsCss = readFileSync(
  new URL("../src/shared/theme/layouts.css", import.meta.url),
  "utf8",
);

describe("admin auth provider settings", () => {
  it("adds a dedicated login methods page to the admin system section", () => {
    expect(adminNavigationSource).toContain("登录方式");
    expect(adminNavigationSource).toContain("/admin/system/auth-providers");
    expect(routerSource).toContain("AuthProvidersPage");
    expect(routerSource).toContain('path="admin/system/auth-providers"');
  });

  it("edits OAuth provider configuration without exposing OAuth on the admin login page", () => {
    expect(authProvidersPageSource).toContain("/admin/system/auth-providers");
    expect(authProvidersPageSource).toContain("Client Secret");
    expect(authProvidersPageSource).toContain("hasClientSecret");
    expect(authProvidersPageSource).toContain("AUTH_PROVIDER_CLIENT_SECRET_URLS");
    expect(authProvidersPageSource).toContain("<ApiKeyGetLink href={clientSecretGetUrl} />");
    expect(authProvidersPageSource).toContain("openClientSecretRevealModal(provider)");
    expect(authProvidersPageSource).toContain(
      "/admin/system/auth-providers/${clientSecretRevealProvider.provider}/client-secret/reveal",
    );
    expect(authProvidersPageSource).toContain("Client Secret 查看验证码");
    expect(authProvidersPageSource).toContain("验证并显示");
    expect(authProvidersPageSource).toContain("pendingSaveProvider");
    expect(authProvidersPageSource).toContain("确认保存登录方式？");
    expect(authProvidersPageSource).toContain("saveProvider(pendingSaveProvider)");
    expect(authProvidersPageSource).toContain("providerDefaultScopes");
    expect(authProvidersPageSource).toContain('google: ["openid", "profile", "email"]');
    expect(authProvidersPageSource).toContain("启用 {provider.displayName} 登录");
    expect(adminLoginPageSource).not.toContain("/auth/oauth/");
    expect(adminLoginPageSource).not.toContain("GitHub 登录");
    expect(adminLoginPageSource).not.toContain("Google 登录");
  });

  it("styles provider cards and secret state without nested cards", () => {
    expect(authProvidersPageSource).toContain('className="auth-provider-list"');
    expect(authProvidersPageSource).toContain('className="auth-provider-panel"');
    expect(layoutsCss).toContain(".auth-provider-list");
    expect(layoutsCss).toContain(".auth-provider-panel");
    expect(layoutsCss).toContain(".auth-provider-secret-state");
  });
});
