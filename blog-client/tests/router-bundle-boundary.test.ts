import { describe, expect, it } from "vitest";

import routerSource from "../src/app/router.tsx?raw";

describe("router bundle boundary", () => {
  it("keeps the article editor out of the public startup bundle", () => {
    expect(routerSource).not.toContain(
      'import { ArticleEditPage } from "../features/admin/content/ArticleEditPage"',
    );
    expect(routerSource).toContain('import("prismjs")');
    expect(routerSource).toContain('import("../features/admin/content/ArticleEditPage")');
  });

  it("wires the navigation management route", () => {
    expect(routerSource).toContain('path="admin/content/navigation"');
  });
});
