import { describe, expect, it } from "vitest";

import {
  buildArticleRequestBody,
  toFormState,
} from "../src/features/admin/content/article-edit-helpers";
import { toCommentRow } from "../src/features/admin/content/CommentsPage";

describe("admin article form relations", () => {
  it("hydrates a single category and tag relations into form state", () => {
    const formState = toFormState({
      categories: [
        { id: "category-1", name: "工程实践" },
        { id: "category-2", name: "生活观察" },
      ],
      contentMdx: "",
      contributors: [],
      coverImageUrl: null,
      id: "article-1",
      isPinned: false,
      slug: "article-1",
      status: "draft",
      summary: null,
      tags: [{ color: "#22c55e", id: "tag-1", name: "PostgreSQL" }],
      title: "测试文章",
      updatedAt: "2026-06-06T00:00:00.000Z",
    });

    expect(formState.categoryId).toBe("category-1");
    expect(formState.tagIds).toEqual(["tag-1"]);
  });

  it("submits only one selected category id and multiple tag ids", () => {
    const body = buildArticleRequestBody({
      categoryId: "category-1",
      contentMdx: "正文",
      contributorIds: [],
      coverImageUrl: "",
      isPinned: false,
      slug: "test-article",
      status: "draft",
      summary: "",
      tagIds: ["tag-1"],
      title: "测试文章",
    });

    expect(body.categoryIds).toEqual(["category-1"]);
    expect(body.tagIds).toEqual(["tag-1"]);
  });
});

describe("admin comment rows", () => {
  it("shows the article title instead of the article id", () => {
    const row = toCommentRow({
      articleId: "7c2510f0-5b86-4743-a040-a9c4ff3e8e5b",
      articleTitle: "阅读札记",
      author: {
        name: null,
        username: "reader",
      },
      content: "评论内容",
      createdAt: "2026-06-06T00:00:00.000Z",
      id: "comment-1",
      status: "approved",
      targetType: "article",
    });

    expect(row.article).toBe("阅读札记");
  });
});
