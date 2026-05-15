import { Elysia } from "elysia";

import {
  ArticleDetailResponse,
  ArticleListResponse,
  ArticleQuery,
  SlugParams,
} from "./model";
import {
  getPublishedArticleBySlug,
  listPublishedArticles,
} from "./service";

export const publicArticlesModule = new Elysia({ prefix: "/articles" })
  .get("/", ({ query }) => listPublishedArticles(query), {
    query: ArticleQuery,
    response: { 200: ArticleListResponse },
  })
  .get("/slug/:slug", async ({ params }) => ({
    ok: true,
    item: await getPublishedArticleBySlug(params.slug),
  }), {
    params: SlugParams,
    response: { 200: ArticleDetailResponse },
  });
