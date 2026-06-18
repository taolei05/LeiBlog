import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { createArticleReadingNavigation } from "../src/features/blog/articles/ArticleDetailPage";
import { extractArticleToc, type BlogArticle } from "../src/features/blog/shared/blogApi";

const layoutsCss = readFileSync(
  new URL("../src/shared/theme/layouts.css", import.meta.url),
  "utf8",
);

function getCssRule(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const ruleMatch = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`).exec(layoutsCss);

  return ruleMatch?.[1] ?? "";
}

function createArticle(slug: string, overrides: Partial<BlogArticle> = {}): BlogArticle {
  return {
    categories: [{ id: "cat-1", name: "工程", slug: "engineering" }],
    category: "工程",
    categorySlug: "engineering",
    commentCount: 0,
    contributors: [],
    cover: null,
    date: "2026-06-01",
    excerpt: "",
    id: slug,
    isPinned: false,
    publishedAt: `2026-06-0${slug.slice(-1)}T00:00:00.000Z`,
    readCount: 0,
    readTime: "1 分钟",
    searchExcerpt: null,
    slug,
    tags: [{ id: "tag-1", name: "React", slug: "react" }],
    title: slug,
    toc: [],
    ...overrides,
  };
}

describe("article detail layout", () => {
  it("keeps the article detail column full width when content is short", () => {
    expect(getCssRule(".article-detail")).toContain("width: 100%");
  });

  it("extracts h2 and h3 headings for the article table of contents", () => {
    expect(extractArticleToc("## 起点\n\n### 细节\n\n## 结尾")).toEqual([
      { id: "起点", level: 2, title: "起点" },
      { id: "细节", level: 3, title: "细节" },
      { id: "结尾", level: 2, title: "结尾" },
    ]);
  });

  it("builds previous, next, and related article navigation", () => {
    const current = createArticle("article-2", {
      tags: [{ id: "tag-2", name: "搜索", slug: "search" }],
    });
    const navigation = createArticleReadingNavigation({
      articles: [
        createArticle("article-3", { publishedAt: "2026-06-03T00:00:00.000Z" }),
        current,
        createArticle("article-1", { publishedAt: "2026-06-01T00:00:00.000Z" }),
        createArticle("search-note", {
          categorySlug: "engineering",
          publishedAt: "2026-06-04T00:00:00.000Z",
          tags: [{ id: "tag-2", name: "搜索", slug: "search" }],
        }),
      ],
      currentArticle: current,
    });

    expect(navigation.nextArticle?.slug).toBe("article-3");
    expect(navigation.previousArticle?.slug).toBe("article-1");
    expect(navigation.relatedArticles.map((article) => article.slug)).toEqual(["search-note"]);
  });

  it("defines reading progress and related article surfaces", () => {
    expect(layoutsCss).toContain(".article-reading-progress");
    expect(layoutsCss).toContain(".article-neighbor-grid");
    expect(layoutsCss).toContain(".article-related-grid");
  });
});
