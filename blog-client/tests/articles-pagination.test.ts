import { describe, expect, it } from "vitest";

import blogLayoutSource from "../src/app/blog/BlogLayout.tsx?raw";
import {
  ARTICLES_PER_PAGE,
  createArticlePaginationItems,
  createArticlePaginationViewModel,
  getArticleListEmptyText,
} from "../src/features/blog/articles/ArticlesPage";
import articlesPageSource from "../src/features/blog/articles/ArticlesPage.tsx?raw";

function createArticle(slug: string) {
  return {
    slug,
  };
}

describe("article index pagination", () => {
  it("limits article cards to 9 per page", () => {
    const articles = Array.from({ length: 10 }, (_, index) =>
      createArticle(`article-${index + 1}`),
    );

    const firstPage = createArticlePaginationViewModel({
      articles,
      currentPage: 1,
    });
    const secondPage = createArticlePaginationViewModel({
      articles,
      currentPage: 2,
    });

    expect(ARTICLES_PER_PAGE).toBe(9);
    expect(firstPage.pageArticles.map((article) => article.slug)).toEqual([
      "article-1",
      "article-2",
      "article-3",
      "article-4",
      "article-5",
      "article-6",
      "article-7",
      "article-8",
      "article-9",
    ]);
    expect(secondPage.pageArticles.map((article) => article.slug)).toEqual(["article-10"]);
    expect(secondPage.fromArticle).toBe(10);
    expect(secondPage.toArticle).toBe(10);
    expect(secondPage.pageCount).toBe(2);
  });

  it("clamps invalid article pages", () => {
    const articles = Array.from({ length: 20 }, (_, index) =>
      createArticle(`article-${index + 1}`),
    );

    expect(
      createArticlePaginationViewModel({
        articles,
        currentPage: 99,
      }).currentPage,
    ).toBe(3);
    expect(
      createArticlePaginationViewModel({
        articles,
        currentPage: -2,
      }).currentPage,
    ).toBe(1);
  });

  it("builds compact page number items with ellipses", () => {
    expect(createArticlePaginationItems({ currentPage: 6, pageCount: 12 })).toEqual([
      1,
      "ellipsis-start",
      5,
      6,
      7,
      "ellipsis-end",
      12,
    ]);
  });

  it("uses the q URL parameter as local article search state", () => {
    expect(articlesPageSource).toContain("useSearchParams");
    expect(articlesPageSource).toContain(
      'const searchQuery = searchParams.get("q")?.trim() ?? "";',
    );
    expect(articlesPageSource).toContain("search: searchQuery || undefined");
    expect(articlesPageSource).toContain("搜索“{searchQuery}”");
    expect(articlesPageSource).toContain("没有找到与“${searchQuery}”匹配的文章。");
    expect(articlesPageSource).toContain("清除搜索");
    expect(blogLayoutSource).toContain("useLocation");
    expect(blogLayoutSource).toContain('new URLSearchParams(location.search).get("q")');
  });

  it("describes article search result states", () => {
    expect(
      getArticleListEmptyText({
        isSearchResult: true,
        searchQuery: "React",
        status: "loading",
      }),
    ).toBe("正在搜索“React”。");
    expect(
      getArticleListEmptyText({
        isSearchResult: true,
        searchQuery: "React",
        status: "idle",
      }),
    ).toBe("没有找到与“React”匹配的文章。");
    expect(
      getArticleListEmptyText({
        isSearchResult: false,
        searchQuery: "",
        status: "error",
      }),
    ).toBe("文章接口暂时不可用。");
  });
});
