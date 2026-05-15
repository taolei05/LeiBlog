import { db, type DbClient } from "../db";
import { redisKeys } from "../redis";
import { cacheDelete, cacheDeleteByPattern } from ".";

export async function clearSiteCache() {
  await cacheDelete([
    redisKeys.siteInfo,
    redisKeys.siteConfig,
    redisKeys.siteFiling,
  ]);
}

export async function clearArticleCache(slugs: Array<string | null | undefined> = []) {
  await cacheDeleteByPattern(redisKeys.postListPattern);
  await cacheDelete(slugs.map((slug) => (slug ? redisKeys.post(slug) : null)));
}

export async function clearAllArticleCache() {
  await cacheDeleteByPattern(redisKeys.postPattern);
}

export async function clearArticleCacheById(
  articleId: string,
  client: DbClient = db
) {
  const [article] = await client<{ slug: string }[]>`
    SELECT slug
    FROM articles
    WHERE id = ${articleId}
  `;

  if (article) {
    await clearArticleCache([article.slug]);
  }
}
