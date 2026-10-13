import { jwt } from "@elysiajs/jwt";
import { Elysia, status, t } from "elysia";

import { env } from "../../shared/env";
import { adminJwtSchema, extractBearerToken, isAuthJwtPayload } from "../auth/session";
import { readAdminSession } from "../auth/service";
import { ContentInputError } from "./errors";
import {
  ARTICLE_STATUS,
  CONTENT_FAILURE,
  ContentError,
  createArticle,
  createCategory,
  createContributor,
  createTag,
  deleteArticle,
  deleteCategory,
  deleteContributor,
  deleteTag,
  getArticle,
  listArticles,
  listCategories,
  listContributors,
  listTags,
  updateArticle,
  updateCategory,
  updateContributor,
  updateTag,
} from "./service";
import type { ArticleStatus, ContentFailure } from "./service";

type AdminJwtVerifier = {
  verify: (token: string) => Promise<unknown>;
};

type ResolveAuthenticatedAdminParameters = {
  authorization?: string;
  jwt: AdminJwtVerifier;
};

const resolveAuthenticatedAdmin = async ({
  authorization,
  jwt,
}: ResolveAuthenticatedAdminParameters) => {
  const token = extractBearerToken(authorization);
  if (token === undefined) {
    return {
      ok: false as const,
      response: status(401, { message: "Missing bearer token." }),
    };
  }

  const payload = await jwt.verify(token);
  if (!isAuthJwtPayload(payload)) {
    return {
      ok: false as const,
      response: status(401, { message: "Invalid bearer token." }),
    };
  }

  const session = await readAdminSession({ sessionId: payload.sid });
  if (session === undefined || session.userId !== payload.sub) {
    return {
      ok: false as const,
      response: status(401, { message: "Session expired." }),
    };
  }

  return {
    ok: true as const,
    userId: session.userId,
  };
};

const authHeadersSchema = t.Object({
  authorization: t.Optional(t.String()),
});

const idParamsSchema = t.Object({
  id: t.String(),
});

const taxonomyLocalizationInputSchema = t.Object({
  description: t.Optional(t.Nullable(t.String())),
  name: t.Optional(t.Nullable(t.String())),
});

const taxonomyLocalizationsInputSchema = t.Object({
  en: t.Optional(taxonomyLocalizationInputSchema),
});

const categoryInputSchema = t.Object({
  description: t.Optional(t.Nullable(t.String())),
  localizations: t.Optional(taxonomyLocalizationsInputSchema),
  name: t.String({ maxLength: 120, minLength: 1 }),
  slug: t.Optional(t.String({ maxLength: 140 })),
});

const tagInputSchema = t.Object({
  color: t.Optional(t.Nullable(t.String({ maxLength: 40 }))),
  description: t.Optional(t.Nullable(t.String())),
  localizations: t.Optional(taxonomyLocalizationsInputSchema),
  name: t.String({ maxLength: 120, minLength: 1 }),
  slug: t.Optional(t.String({ maxLength: 140 })),
});

const contributorInputSchema = t.Object({
  avatarUrl: t.Optional(t.Nullable(t.String())),
  linkUrl: t.Optional(t.Nullable(t.String())),
  name: t.String({ maxLength: 100, minLength: 1 }),
});

const articleLocalizationInputSchema = t.Object({
  contentMdx: t.Optional(t.Nullable(t.String())),
  summary: t.Optional(t.Nullable(t.String())),
  title: t.Optional(t.Nullable(t.String())),
});

const articleLocalizationsInputSchema = t.Object({
  en: t.Optional(articleLocalizationInputSchema),
});

const articleInputSchema = t.Object({
  categoryIds: t.Optional(t.Array(t.String())),
  contentMdx: t.Optional(t.String()),
  contributorIds: t.Optional(t.Array(t.String())),
  coverImageUrl: t.Optional(t.Nullable(t.String())),
  isPinned: t.Optional(t.Boolean()),
  localizations: t.Optional(articleLocalizationsInputSchema),
  publishedAt: t.Optional(t.Nullable(t.String())),
  scheduledPublishAt: t.Optional(t.Nullable(t.String())),
  slug: t.Optional(t.String({ maxLength: 240 })),
  status: t.Optional(
    t.Union([
      t.Literal(ARTICLE_STATUS.Draft),
      t.Literal(ARTICLE_STATUS.Published),
      t.Literal(ARTICLE_STATUS.Scheduled),
    ]),
  ),
  summary: t.Optional(t.Nullable(t.String())),
  tagIds: t.Optional(t.Array(t.String())),
  title: t.String({ maxLength: 220, minLength: 1 }),
});

const articlePatchSchema = t.Partial(articleInputSchema);

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

const isArticleStatusFilter = (value?: string): value is ArticleStatus | "all" =>
  value === undefined ||
  value === "all" ||
  value === ARTICLE_STATUS.Draft ||
  value === ARTICLE_STATUS.Published ||
  value === ARTICLE_STATUS.Scheduled;

const readBooleanFilter = (value?: string) => {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
};

const readContentFailureMessage = (reason: ContentFailure) => {
  switch (reason) {
    case CONTENT_FAILURE.CategoryNotFound:
      return "分类不存在。";
    case CONTENT_FAILURE.ContributorNotFound:
      return "贡献者不存在。";
    case CONTENT_FAILURE.InvalidSlug:
      return "slug 格式无效。";
    case CONTENT_FAILURE.InvalidStatus:
      return "文章状态无效。";
    case CONTENT_FAILURE.InvalidTitle:
      return "名称不能为空。";
    case CONTENT_FAILURE.NotFound:
      return "文章不存在。";
    case CONTENT_FAILURE.SlugExists:
      return "slug 已存在。";
    case CONTENT_FAILURE.TagNotFound:
      return "标签不存在。";
    case CONTENT_FAILURE.TaxonomyInUse:
      return "仍有关联文章，不能删除。";
    default: {
      const exhaustiveReason: never = reason;
      return exhaustiveReason;
    }
  }
};

const createContentFailureResponse = (error: ContentError) => {
  const message = readContentFailureMessage(error.reason);

  switch (error.reason) {
    case CONTENT_FAILURE.CategoryNotFound:
    case CONTENT_FAILURE.ContributorNotFound:
    case CONTENT_FAILURE.NotFound:
    case CONTENT_FAILURE.TagNotFound:
      return status(404, { message, reason: error.reason });
    case CONTENT_FAILURE.SlugExists:
      return status(409, { message, reason: error.reason });
    case CONTENT_FAILURE.InvalidSlug:
    case CONTENT_FAILURE.InvalidStatus:
    case CONTENT_FAILURE.InvalidTitle:
    case CONTENT_FAILURE.TaxonomyInUse:
      return status(400, { message, reason: error.reason });
    default: {
      const exhaustiveReason: never = error.reason;
      return exhaustiveReason;
    }
  }
};

const withContentErrors = async <Result>(work: () => Promise<Result>) => {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ContentInputError) {
      return status(400, { message: error.message, reason: error.reason });
    }
    if (error instanceof ContentError) {
      return createContentFailureResponse(error);
    }

    throw error;
  }
};

export const adminContentRoutes = new Elysia({ prefix: "/api/admin/content" })
  .use(
    jwt({
      name: "jwt",
      secret: env.jwtSecret,
      exp: `${env.sessionTtlSeconds}s`,
      schema: adminJwtSchema,
    }),
  )
  .get(
    "/articles",
    async ({ headers, jwt, query }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      const statusFilter = isArticleStatusFilter(query.status) ? query.status : "all";

      return listArticles({
        categorySlug: query.categorySlug,
        isPinned: readBooleanFilter(query.isPinned),
        page: parsePositiveInteger({ fallback: 1, value: query.page }),
        pageSize: parsePositiveInteger({ fallback: 12, value: query.pageSize }),
        query: query.query,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder === "asc" ? "asc" : "desc",
        status: statusFilter,
        tagSlug: query.tagSlug,
      });
    },
    {
      headers: authHeadersSchema,
      query: t.Object({
        categorySlug: t.Optional(t.String()),
        isPinned: t.Optional(t.String()),
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
        query: t.Optional(t.String()),
        sortBy: t.Optional(t.String()),
        sortOrder: t.Optional(t.String()),
        status: t.Optional(t.String()),
        tagSlug: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/articles",
    async ({ body, headers, jwt }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return withContentErrors(() => createArticle({ authorId: auth.userId, input: body }));
    },
    {
      body: articleInputSchema,
      headers: authHeadersSchema,
    },
  )
  .get(
    "/articles/:id",
    async ({ headers, jwt, params }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return withContentErrors(async () => ({
        item: await getArticle({ articleId: params.id }),
        ok: true,
      }));
    },
    {
      headers: authHeadersSchema,
      params: idParamsSchema,
    },
  )
  .patch(
    "/articles/:id",
    async ({ body, headers, jwt, params }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return withContentErrors(() => updateArticle({ articleId: params.id, input: body }));
    },
    {
      body: articlePatchSchema,
      headers: authHeadersSchema,
      params: idParamsSchema,
    },
  )
  .delete(
    "/articles/:id",
    async ({ headers, jwt, params }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return withContentErrors(() => deleteArticle({ articleId: params.id }));
    },
    {
      headers: authHeadersSchema,
      params: idParamsSchema,
    },
  )
  .get(
    "/categories",
    async ({ headers, jwt, query }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return listCategories({
        page: parsePositiveInteger({ fallback: 1, value: query.page }),
        pageSize: parsePositiveInteger({ fallback: 50, value: query.pageSize }),
        query: query.query,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder === "desc" ? "desc" : "asc",
      });
    },
    {
      headers: authHeadersSchema,
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
        query: t.Optional(t.String()),
        sortBy: t.Optional(t.String()),
        sortOrder: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/categories",
    async ({ body, headers, jwt }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return withContentErrors(() => createCategory({ input: body }));
    },
    {
      body: categoryInputSchema,
      headers: authHeadersSchema,
    },
  )
  .patch(
    "/categories/:id",
    async ({ body, headers, jwt, params }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return withContentErrors(() => updateCategory({ categoryId: params.id, input: body }));
    },
    {
      body: categoryInputSchema,
      headers: authHeadersSchema,
      params: idParamsSchema,
    },
  )
  .delete(
    "/categories/:id",
    async ({ headers, jwt, params }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return withContentErrors(() => deleteCategory({ categoryId: params.id }));
    },
    {
      headers: authHeadersSchema,
      params: idParamsSchema,
    },
  )
  .get(
    "/tags",
    async ({ headers, jwt, query }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return listTags({
        page: parsePositiveInteger({ fallback: 1, value: query.page }),
        pageSize: parsePositiveInteger({ fallback: 50, value: query.pageSize }),
        query: query.query,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder === "asc" ? "asc" : "desc",
      });
    },
    {
      headers: authHeadersSchema,
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
        query: t.Optional(t.String()),
        sortBy: t.Optional(t.String()),
        sortOrder: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/tags",
    async ({ body, headers, jwt }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return withContentErrors(() => createTag({ input: body }));
    },
    {
      body: tagInputSchema,
      headers: authHeadersSchema,
    },
  )
  .patch(
    "/tags/:id",
    async ({ body, headers, jwt, params }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return withContentErrors(() => updateTag({ input: body, tagId: params.id }));
    },
    {
      body: tagInputSchema,
      headers: authHeadersSchema,
      params: idParamsSchema,
    },
  )
  .delete(
    "/tags/:id",
    async ({ headers, jwt, params }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return withContentErrors(() => deleteTag({ tagId: params.id }));
    },
    {
      headers: authHeadersSchema,
      params: idParamsSchema,
    },
  )
  .get(
    "/contributors",
    async ({ headers, jwt, query }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return listContributors({
        page: parsePositiveInteger({ fallback: 1, value: query.page }),
        pageSize: parsePositiveInteger({ fallback: 50, value: query.pageSize }),
        query: query.query,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder === "asc" ? "asc" : "desc",
      });
    },
    {
      headers: authHeadersSchema,
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
        query: t.Optional(t.String()),
        sortBy: t.Optional(t.String()),
        sortOrder: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/contributors",
    async ({ body, headers, jwt }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return withContentErrors(() => createContributor({ input: body }));
    },
    {
      body: contributorInputSchema,
      headers: authHeadersSchema,
    },
  )
  .patch(
    "/contributors/:id",
    async ({ body, headers, jwt, params }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return withContentErrors(() => updateContributor({ contributorId: params.id, input: body }));
    },
    {
      body: contributorInputSchema,
      headers: authHeadersSchema,
      params: idParamsSchema,
    },
  )
  .delete(
    "/contributors/:id",
    async ({ headers, jwt, params }) => {
      const auth = await resolveAuthenticatedAdmin({ authorization: headers.authorization, jwt });
      if (!auth.ok) {
        return auth.response;
      }

      return withContentErrors(() => deleteContributor({ contributorId: params.id }));
    },
    {
      headers: authHeadersSchema,
      params: idParamsSchema,
    },
  );
