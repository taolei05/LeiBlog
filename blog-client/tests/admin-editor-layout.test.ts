import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const layoutsCss = readFileSync(
  new URL("../src/shared/theme/layouts.css", import.meta.url),
  "utf8",
);

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
