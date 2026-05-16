import { describe, expect, test } from "bun:test";

import { createArticleSummary } from "../src/shared/mdx/summary";

describe("article summary extraction", () => {
  test("uses explicit summaries first", () => {
    expect(createArticleSummary("  手写摘要  ", "# 标题")).toBe("手写摘要");
  });

  test("generates a plain text summary from MDX content", () => {
    const summary = createArticleSummary(
      undefined,
      `---
title: 测试
---

# 标题

正文包含 **重点** 和 <Callout>组件</Callout>。

\`\`\`ts
console.log("skip");
\`\`\`
`
    );

    expect(summary).toBe("标题 正文包含 重点 和 组件 。");
  });
});
