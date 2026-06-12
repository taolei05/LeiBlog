import { describe, expect, test } from "vitest";

import adminApiSource from "../src/features/admin/shared/admin-api.ts?raw";
import authPagesSource from "../src/features/blog/auth/AuthPages.tsx?raw";
import blogApiSource from "../src/features/blog/shared/blogApi.ts?raw";
import mdxEditorSource from "../src/shared/mdx/MdxEditorField.tsx?raw";
import adminGuardsSource from "../src/shared/routing/adminGuards.tsx?raw";

describe("expired session handling", () => {
  test("clears and synchronizes the admin session after an authenticated 401 response", () => {
    expect(adminApiSource).toContain("ADMIN_SESSION_CHANGE_EVENT");
    expect(adminApiSource).toContain("expireAdminSessionForResponse(response");
    expect(adminGuardsSource).toContain(
      "window.addEventListener(ADMIN_SESSION_CHANGE_EVENT, syncAdminSession)",
    );
    expect(mdxEditorSource).toContain("expireAdminSessionForResponse(response, true)");
  });

  test("clears the shared blog session after authenticated profile and comment 401 responses", () => {
    expect(authPagesSource).toContain('from "../../../shared/auth/blog-session"');
    expect(authPagesSource).toContain(
      "expireBlogSessionForResponse(response, Boolean(options.token))",
    );
    expect(blogApiSource).toContain('from "../../../shared/auth/blog-session"');
    expect(blogApiSource).toContain("expireBlogSessionForResponse(response, true)");
  });
});
