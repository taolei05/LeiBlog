import { describe, expect, it } from "vitest";

import layoutsCss from "../src/shared/theme/layouts.css?raw";

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
