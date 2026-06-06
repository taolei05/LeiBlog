import { describe, expect, it } from "vitest";

import layoutsCss from "../src/shared/theme/layouts.css?raw";

describe("admin article editor layout", () => {
  it("keeps taxonomy select icons separated from selected text", () => {
    expect(layoutsCss).toMatch(
      /\.article-taxonomy-field\s+\[data-slot="select-trigger"\]\s*{[^}]*gap:\s*0\.5rem;/s,
    );
    expect(layoutsCss).toMatch(
      /\.article-taxonomy-field\s+\[data-slot="select-value"\]\s*{[^}]*min-width:\s*0;/s,
    );
  });
});
