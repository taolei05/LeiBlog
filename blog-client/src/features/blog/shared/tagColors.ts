import type { CSSProperties } from "react";

export const defaultBlogTagColor = "#ec4899";

export type ArticleTagColorStyle = CSSProperties & {
  "--article-tag-color"?: string;
};

export type ArchiveTagColorStyle = CSSProperties & {
  "--archive-tag-color"?: string;
};

export function normalizeBlogTagColor(color: string | null | undefined) {
  const value = color?.trim();

  if (value && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
    return value;
  }

  return defaultBlogTagColor;
}

export function getArticleTagColorStyle(color: string | null | undefined): ArticleTagColorStyle {
  return {
    "--article-tag-color": normalizeBlogTagColor(color),
  };
}

export function getArchiveTagColorStyle(color: string | null | undefined): ArchiveTagColorStyle {
  return {
    "--archive-tag-color": normalizeBlogTagColor(color),
  };
}
