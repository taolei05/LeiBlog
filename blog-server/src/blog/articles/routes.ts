import { Elysia, status, t } from "elysia";

import {
  CONTENT_FAILURE,
  ContentError,
  getPublicArticleBySlug,
  listArticles,
  listPublicCategories,
  listPublicTags,
} from "../../admin/content/service";
import type { ContentFailure } from "../../admin/content/service";

const parsePositiveInteger = ({ fallback, value }: { fallback: number; value?: string }) => {
  if (value === undefined) {
    return fallback;
  }

  const parsedValue = Number.parseInt(value, 10);
  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return parsedValue;
};

const readPublicContentFailureMessage = (reason: ContentFailure) => {
  switch (reason) {
    case CONTENT_FAILURE.NotFound:
      return "文章不存在。";
    case CONTENT_FAILURE.CategoryNotFound:
      return "分类不存在。";
    case CONTENT_FAILURE.ContributorNotFound:
      return "贡献者不存在。";
    case CONTENT_FAILURE.TagNotFound:
      return "标签不存在。";
    case CONTENT_FAILURE.InvalidSlug:
    case CONTENT_FAILURE.InvalidStatus:
    case CONTENT_FAILURE.InvalidTitle:
    case CONTENT_FAILURE.SlugExists:
    case CONTENT_FAILURE.TaxonomyInUse:
      return "内容请求无效。";
    default: {
      const exhaustiveReason: never = reason;
      return exhaustiveReason;
    }
  }
};

const createPublicContentFailureResponse = (error: ContentError) => {
  const message = readPublicContentFailureMessage(error.reason);

  if (
    error.reason === CONTENT_FAILURE.NotFound ||
    error.reason === CONTENT_FAILURE.CategoryNotFound ||
    error.reason === CONTENT_FAILURE.TagNotFound
  ) {
    return status(404, { message, reason: error.reason });
  }

  return status(400, { message, reason: error.reason });
};

const withPublicContentErrors = async <Result>(work: () => Promise<Result>) => {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ContentError) {
      return createPublicContentFailureResponse(error);
    }

    throw error;
  }
};

export const blogArticleRoutes = new Elysia()
  .get(
    "/articles",
    ({ query }) =>
      listArticles({
        categorySlug: query.categorySlug,
        page: parsePositiveInteger({ fallback: 1, value: query.page }),
        pageSize: parsePositiveInteger({ fallback: 12, value: query.pageSize }),
        publicOnly: true,
        query: query.query,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder === "asc" ? "asc" : "desc",
        tagSlug: query.tagSlug,
      }),
    {
      query: t.Object({
        categorySlug: t.Optional(t.String()),
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
        query: t.Optional(t.String()),
        sortBy: t.Optional(t.String()),
        sortOrder: t.Optional(t.String()),
        tagSlug: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/articles/:slug",
    ({ params }) => withPublicContentErrors(() => getPublicArticleBySlug({ slug: params.slug })),
    {
      params: t.Object({
        slug: t.String({ minLength: 1 }),
      }),
    },
  )
  .get("/categories", () => listPublicCategories())
  .get("/tags", () => listPublicTags());
