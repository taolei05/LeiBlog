import { getPublicSiteConfig, getPublicSiteInfo } from "../site/service";
import { listPublishedArticles } from "../articles/service";

type SyndicationArticle = Awaited<ReturnType<typeof listPublishedArticles>>["items"][number];

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getOrigin(request: Request) {
  const url = new URL(request.url);
  return url.origin;
}

function getAbsoluteUrl(origin: string, path: string) {
  return new URL(path, origin).toString();
}

function getArticleUrl(origin: string, article: Pick<SyndicationArticle, "slug">) {
  return getAbsoluteUrl(origin, `/articles/${encodeURIComponent(article.slug)}`);
}

function getArticleDate(article: SyndicationArticle) {
  return article.publishedAt ?? article.updatedAt ?? article.createdAt;
}

function getFeedUpdatedAt(articles: SyndicationArticle[]) {
  const latestArticleDate = articles[0] ? getArticleDate(articles[0]) : undefined;
  return new Date(latestArticleDate ?? Date.now()).toISOString();
}

function getTextResponse(body: string, contentType: string) {
  return new Response(body, {
    headers: {
      "cache-control": "public, max-age=300",
      "content-type": contentType,
    },
  });
}

async function getSyndicationData() {
  const [siteInfo, siteConfig, articleList] = await Promise.all([
    getPublicSiteInfo(),
    getPublicSiteConfig(),
    listPublishedArticles({
      page: 1,
      pageSize: 1000,
      sortBy: "publishedAt",
      sortOrder: "desc",
    }),
  ]);

  return {
    articles: articleList.items,
    description: siteConfig.seoDescription || siteInfo.description,
    siteName: siteConfig.seoTitle || siteInfo.siteName,
  };
}

export async function renderRssFeed(request: Request) {
  const origin = getOrigin(request);
  const { articles, description, siteName } = await getSyndicationData();
  const items = articles
    .map((article) => {
      const articleUrl = getArticleUrl(origin, article);
      const articleDate = new Date(getArticleDate(article)).toUTCString();

      return [
        "<item>",
        `<title>${escapeXml(article.title)}</title>`,
        `<link>${escapeXml(articleUrl)}</link>`,
        `<guid isPermaLink="true">${escapeXml(articleUrl)}</guid>`,
        `<pubDate>${escapeXml(articleDate)}</pubDate>`,
        `<description>${escapeXml(article.summary ?? description)}</description>`,
        "</item>",
      ].join("");
    })
    .join("");

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "<channel>",
    `<title>${escapeXml(siteName)}</title>`,
    `<link>${escapeXml(origin)}</link>`,
    `<description>${escapeXml(description)}</description>`,
    `<lastBuildDate>${escapeXml(new Date(getFeedUpdatedAt(articles)).toUTCString())}</lastBuildDate>`,
    items,
    "</channel>",
    "</rss>",
  ].join("");

  return getTextResponse(body, "application/rss+xml; charset=utf-8");
}

export async function renderAtomFeed(request: Request) {
  const origin = getOrigin(request);
  const { articles, description, siteName } = await getSyndicationData();
  const updatedAt = getFeedUpdatedAt(articles);
  const entries = articles
    .map((article) => {
      const articleUrl = getArticleUrl(origin, article);

      return [
        "<entry>",
        `<title>${escapeXml(article.title)}</title>`,
        `<id>${escapeXml(articleUrl)}</id>`,
        `<link href="${escapeXml(articleUrl)}" />`,
        `<updated>${escapeXml(new Date(getArticleDate(article)).toISOString())}</updated>`,
        `<summary>${escapeXml(article.summary ?? description)}</summary>`,
        "</entry>",
      ].join("");
    })
    .join("");

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `<title>${escapeXml(siteName)}</title>`,
    `<id>${escapeXml(origin)}</id>`,
    `<link href="${escapeXml(origin)}" />`,
    `<link href="${escapeXml(getAbsoluteUrl(origin, "/atom.xml"))}" rel="self" />`,
    `<updated>${escapeXml(updatedAt)}</updated>`,
    `<subtitle>${escapeXml(description)}</subtitle>`,
    entries,
    "</feed>",
  ].join("");

  return getTextResponse(body, "application/atom+xml; charset=utf-8");
}

export async function renderSitemap(request: Request) {
  const origin = getOrigin(request);
  const { articles } = await getSyndicationData();
  const categoryPaths = new Set<string>();
  const tagPaths = new Set<string>();

  for (const article of articles) {
    for (const category of article.categories) {
      if (category.slug) categoryPaths.add(`/categories/${encodeURIComponent(category.slug)}`);
    }

    for (const tag of article.tags) {
      if (tag.slug) tagPaths.add(`/tags/${encodeURIComponent(tag.slug)}`);
    }
  }

  const staticPaths = [
    "/",
    "/articles",
    "/categories",
    "/tags",
    "/archives",
    "/navigation",
    "/about-site",
    "/about-author",
    "/guestbook",
  ];
  const articleEntries = articles.map((article) => ({
    lastmod: getArticleDate(article),
    path: `/articles/${encodeURIComponent(article.slug)}`,
  }));
  const entries = [
    ...staticPaths.map((path) => ({ lastmod: undefined, path })),
    ...[...categoryPaths, ...tagPaths].map((path) => ({ lastmod: undefined, path })),
    ...articleEntries,
  ];
  const urls = entries
    .map(({ lastmod, path }) => {
      const lastmodXml = lastmod ? `<lastmod>${escapeXml(new Date(lastmod).toISOString())}</lastmod>` : "";
      return `<url><loc>${escapeXml(getAbsoluteUrl(origin, path))}</loc>${lastmodXml}</url>`;
    })
    .join("");
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
  ].join("");

  return getTextResponse(body, "application/xml; charset=utf-8");
}

export function renderRobotsTxt(request: Request) {
  const origin = getOrigin(request);
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /api/admin",
    `Sitemap: ${getAbsoluteUrl(origin, "/sitemap.xml")}`,
    "",
  ].join("\n");

  return getTextResponse(body, "text/plain; charset=utf-8");
}
