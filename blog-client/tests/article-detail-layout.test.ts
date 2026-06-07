import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const layoutsCss = readFileSync(
  new URL("../src/shared/theme/layouts.css", import.meta.url),
  "utf8",
);

function getCssRule(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const ruleMatch = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`).exec(layoutsCss);

  return ruleMatch?.[1] ?? "";
}

describe("article detail layout", () => {
  it("keeps the article detail column full width when content is short", () => {
    expect(getCssRule(".article-detail")).toContain("width: 100%");
  });
});
