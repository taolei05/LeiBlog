import { Elysia } from "elysia";

import {
  ArticleBody,
  ArticleListResponse,
  ArticleQuery,
  ArticleResponse,
  ArticleUpdateBody,
  CategoryBody,
  CategoryListResponse,
  CategoryResponse,
  ContributorBody,
  ContributorListResponse,
  ContributorQuery,
  ContributorResponse,
  IdParams,
  OkResponse,
  TagBody,
  TagListResponse,
  TagResponse,
  TaxonomyQuery,
} from "./model";
import {
  createArticle,
  createCategory,
  createContributor,
  createTag,
  deleteArticle,
  deleteCategory,
  deleteContributor,
  deleteTag,
  getArticleById,
  getCategoryById,
  getContributorById,
  getTagById,
  listArticles,
  listCategories,
  listContributors,
  listTags,
  updateArticle,
  updateCategory,
  updateContributor,
  updateTag,
} from "./service";
import { requireAdmin } from "../../shared/auth";
import { authContext } from "../../shared/auth/plugin";

export const adminContentModule = new Elysia({ prefix: "/content" })
  .use(authContext)
  .get("/categories", ({ currentUser, query }) => listCategories(currentUser, query), {
    query: TaxonomyQuery,
    response: { 200: CategoryListResponse },
  })
  .post("/categories", async ({ currentUser, body }) => ({
    ok: true,
    item: await createCategory(currentUser, body),
  }), {
    body: CategoryBody,
    response: { 200: CategoryResponse },
  })
  .get("/categories/:id", async ({ currentUser, params }) => {
    requireAdmin(currentUser);
    return { ok: true, item: await getCategoryById(params.id) };
  }, {
    params: IdParams,
    response: { 200: CategoryResponse },
  })
  .patch("/categories/:id", async ({ currentUser, params, body }) => ({
    ok: true,
    item: await updateCategory(currentUser, params.id, body),
  }), {
    params: IdParams,
    body: CategoryBody,
    response: { 200: CategoryResponse },
  })
  .delete("/categories/:id", ({ currentUser, params }) => deleteCategory(currentUser, params.id), {
    params: IdParams,
    response: { 200: OkResponse },
  })
  .get("/tags", ({ currentUser, query }) => listTags(currentUser, query), {
    query: TaxonomyQuery,
    response: { 200: TagListResponse },
  })
  .post("/tags", async ({ currentUser, body }) => ({
    ok: true,
    item: await createTag(currentUser, body),
  }), {
    body: TagBody,
    response: { 200: TagResponse },
  })
  .get("/tags/:id", async ({ currentUser, params }) => {
    requireAdmin(currentUser);
    return { ok: true, item: await getTagById(params.id) };
  }, {
    params: IdParams,
    response: { 200: TagResponse },
  })
  .patch("/tags/:id", async ({ currentUser, params, body }) => ({
    ok: true,
    item: await updateTag(currentUser, params.id, body),
  }), {
    params: IdParams,
    body: TagBody,
    response: { 200: TagResponse },
  })
  .delete("/tags/:id", ({ currentUser, params }) => deleteTag(currentUser, params.id), {
    params: IdParams,
    response: { 200: OkResponse },
  })
  .get("/contributors", ({ currentUser, query }) => listContributors(currentUser, query), {
    query: ContributorQuery,
    response: { 200: ContributorListResponse },
  })
  .post("/contributors", async ({ currentUser, body }) => ({
    ok: true,
    item: await createContributor(currentUser, body),
  }), {
    body: ContributorBody,
    response: { 200: ContributorResponse },
  })
  .get("/contributors/:id", async ({ currentUser, params }) => {
    requireAdmin(currentUser);
    return { ok: true, item: await getContributorById(params.id) };
  }, {
    params: IdParams,
    response: { 200: ContributorResponse },
  })
  .patch("/contributors/:id", async ({ currentUser, params, body }) => ({
    ok: true,
    item: await updateContributor(currentUser, params.id, body),
  }), {
    params: IdParams,
    body: ContributorBody,
    response: { 200: ContributorResponse },
  })
  .delete("/contributors/:id", ({ currentUser, params }) => deleteContributor(currentUser, params.id), {
    params: IdParams,
    response: { 200: OkResponse },
  })
  .get("/articles", ({ currentUser, query }) => listArticles(currentUser, query), {
    query: ArticleQuery,
    response: { 200: ArticleListResponse },
  })
  .post("/articles", async ({ currentUser, body }) => ({
    ok: true,
    item: await createArticle(currentUser, body),
  }), {
    body: ArticleBody,
    response: { 200: ArticleResponse },
  })
  .get("/articles/:id", async ({ currentUser, params }) => {
    requireAdmin(currentUser);
    return { ok: true, item: await getArticleById(params.id) };
  }, {
    params: IdParams,
    response: { 200: ArticleResponse },
  })
  .patch("/articles/:id", async ({ currentUser, params, body }) => ({
    ok: true,
    item: await updateArticle(currentUser, params.id, body),
  }), {
    params: IdParams,
    body: ArticleUpdateBody,
    response: { 200: ArticleResponse },
  })
  .delete("/articles/:id", ({ currentUser, params }) => deleteArticle(currentUser, params.id), {
    params: IdParams,
    response: { 200: OkResponse },
  });
