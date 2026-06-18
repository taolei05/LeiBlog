import { Elysia } from "elysia";

import {
  renderAtomFeed,
  renderRobotsTxt,
  renderRssFeed,
  renderSitemap,
} from "./service";

export const publicSyndicationModule = new Elysia({ name: "public-syndication" })
  .get("/rss.xml", ({ request }) => renderRssFeed(request))
  .get("/atom.xml", ({ request }) => renderAtomFeed(request))
  .get("/sitemap.xml", ({ request }) => renderSitemap(request))
  .get("/robots.txt", ({ request }) => renderRobotsTxt(request));
