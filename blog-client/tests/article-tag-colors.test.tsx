import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ArticleCard } from "../src/features/blog/shared/BlogComponents";
import type { BlogArticle } from "../src/features/blog/shared/blogApi";

const article: BlogArticle = {
  categories: [{ id: "cat-1", name: "工程", slug: "engineering" }],
  category: "工程",
  categorySlug: "engineering",
  commentCount: 0,
  contributors: [],
  cover: null,
  date: "2026-06-05",
  excerpt: "文章摘要",
  id: "article-1",
  isPinned: false,
  publishedAt: "2026-06-05T00:00:00.000Z",
  readCount: 12,
  readTime: "1 分钟",
  slug: "article-one",
  tags: [
    { color: "#22c55e", id: "tag-1", name: "React", slug: "react" },
    { color: "not-a-color", id: "tag-2", name: "Fallback", slug: "fallback" },
  ],
  title: "测试文章",
  toc: [],
};

describe("article tag colors", () => {
  it("renders article card tag links with normalized tag color variables", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ArticleCard article={article} />
      </MemoryRouter>,
    );

    expect(html).toContain('href="/tags/react"');
    expect(html).toContain("--article-tag-color:#22c55e");
    expect(html).toContain('href="/tags/fallback"');
    expect(html).toContain("--article-tag-color:#ec4899");
  });
});
