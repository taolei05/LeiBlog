import { describe, expect, it } from "vitest";

import {
  buildArticleRequestBody,
  toFormState,
} from "../src/features/admin/content/article-edit-helpers";
import articleEditPageSource from "../src/features/admin/content/ArticleEditPage.tsx?raw";
import categoriesPageSource from "../src/features/admin/content/CategoriesPage.tsx?raw";
import { toCommentRow } from "../src/features/admin/content/CommentsPage";
import tagsPageSource from "../src/features/admin/content/TagsPage.tsx?raw";
import { adminNavigationGroups } from "../src/app/admin/adminNavigation";

function toExpectedLocalDateTime(value: string) {
  const date = new Date(value);
  const timezoneOffset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

describe("admin article form relations", () => {
  it("hydrates a single category and tag relations into form state", () => {
    const scheduledPublishAt = "2026-06-20T01:30:00.000Z";
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
      scheduledPublishAt,
      slug: "article-1",
      status: "draft",
      summary: null,
      tags: [{ color: "#22c55e", id: "tag-1", name: "PostgreSQL" }],
      title: "测试文章",
      updatedAt: "2026-06-06T00:00:00.000Z",
    });

    expect(formState.categoryId).toBe("category-1");
    expect(formState.tagIds).toEqual(["tag-1"]);
    expect(formState.scheduledPublishAt).toBe(toExpectedLocalDateTime(scheduledPublishAt));
  });

  it("submits only one selected category id, multiple tag ids, and schedule time", () => {
    const scheduledPublishAt = "2026-06-20T09:30";
    const body = buildArticleRequestBody({
      categoryId: "category-1",
      contentMdx: "正文",
      contributorIds: [],
      coverImageUrl: "",
      isPinned: false,
      scheduledPublishAt,
      slug: "test-article",
      status: "draft",
      summary: "",
      tagIds: ["tag-1"],
      title: "测试文章",
    });

    expect(body.categoryIds).toEqual(["category-1"]);
    expect(body.tagIds).toEqual(["tag-1"]);
    expect(body.scheduledPublishAt).toBe(new Date(scheduledPublishAt).toISOString());
  });

  it("clears scheduled publish time for immediate publish actions", () => {
    const body = buildArticleRequestBody(
      {
        categoryId: "",
        contentMdx: "正文",
        contributorIds: [],
        coverImageUrl: "",
        isPinned: false,
        scheduledPublishAt: "2026-06-20T09:30",
        slug: "test-article",
        status: "draft",
        summary: "",
        tagIds: [],
        title: "测试文章",
      },
      "published",
    );

    expect(body.status).toBe("published");
    expect(body.scheduledPublishAt).toBeNull();
  });

  it("lets editors create and immediately associate categories and tags from the article form", () => {
    expect(articleEditPageSource).toContain("新建分类");
    expect(articleEditPageSource).toContain("新建标签");
    expect(articleEditPageSource).toContain('"/admin/content/categories"');
    expect(articleEditPageSource).toContain('"/admin/content/tags"');
    expect(articleEditPageSource).toContain("setIsCategoryModalOpen(true)");
    expect(articleEditPageSource).toContain("setIsTagModalOpen(true)");
    expect(articleEditPageSource).toContain("categoryId: response.item.id");
    expect(articleEditPageSource).not.toContain('tagColor.toString("hex")');
    expect(articleEditPageSource).not.toMatch(/body:\s*\{[\s\S]*?color,[\s\S]*?name,[\s\S]*?slug:/);
    expect(articleEditPageSource).toMatch(
      /tagIds:\s+state\.tagIds\.includes\(response\.item\.id\)\s+\?\s+state\.tagIds\s+:\s+\[\.\.\.state\.tagIds,\s+response\.item\.id\]/,
    );
    expect(articleEditPageSource).toContain("分类已创建并关联");
    expect(articleEditPageSource).toContain("标签已创建并关联");
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

describe("admin taxonomy forms", () => {
  it("lets editors create and update category and tag slugs from management modals", () => {
    expect(categoriesPageSource).toContain('label="Slug"');
    expect(categoriesPageSource).toContain("setCategorySlug(row.slug)");
    expect(categoriesPageSource).toContain("value={categorySlug}");
    expect(categoriesPageSource).toContain("slug: optionalFormValue(categorySlug) ?? undefined");

    expect(tagsPageSource).toContain('label="Slug"');
    expect(tagsPageSource).toContain("slug: row.slug");
    expect(tagsPageSource).toContain("value={tagForm.slug}");
    expect(tagsPageSource).toContain("slug: optionalFormValue(tagForm.slug) ?? undefined");
    expect(tagsPageSource).toContain('tagModalState.mode === "rename"');
    const createTagBranchStart = tagsPageSource.indexOf('if (tagModalState.mode === "create")');
    const createTagBranchEnd = tagsPageSource.indexOf("} else {", createTagBranchStart);
    const createTagBranch = tagsPageSource.slice(createTagBranchStart, createTagBranchEnd);

    expect(tagsPageSource).toMatch(
      /body:\s*\{\s*name,\s*slug: optionalFormValue\(tagForm\.slug\) \?\? undefined\s*\}/,
    );
    expect(createTagBranch).not.toContain("color");
  });

  it("lets editors batch create tags from tag management", () => {
    expect(tagsPageSource).toContain("批量创建");
    expect(tagsPageSource).toContain("AdminTextAreaGroupField");
    expect(tagsPageSource).toContain('"/admin/content/tags/batch"');
    expect(tagsPageSource).toContain("batchTagNames");
    expect(tagsPageSource).toContain("parseBatchTagNames");
  });
});

describe("admin content navigation", () => {
  it("places navigation management directly after contributors", () => {
    const contentItems =
      adminNavigationGroups.find((group) => group.label === "内容管理")?.items ?? [];
    const contributorIndex = contentItems.findIndex((item) => item.label === "贡献者管理");

    expect(contentItems[contributorIndex + 1]?.label).toBe("导航页管理");
    expect(contentItems[contributorIndex + 1]?.path).toBe("/admin/content/navigation");
  });
});
