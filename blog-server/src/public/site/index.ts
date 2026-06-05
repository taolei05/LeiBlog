import { Elysia } from "elysia";

import {
  SiteAuthorResponse,
  SiteConfigResponse,
  SiteFilingResponse,
  SiteInfoResponse,
} from "./model";
import {
  getPublicSiteAuthor,
  getPublicSiteConfig,
  getPublicSiteFiling,
  getPublicSiteInfo,
} from "./service";

export const publicSiteModule = new Elysia({ prefix: "/site" })
  .get("/info", async () => ({
    ok: true,
    item: await getPublicSiteInfo(),
  }), {
    response: { 200: SiteInfoResponse },
  })
  .get("/config", async () => ({
    ok: true,
    item: await getPublicSiteConfig(),
  }), {
    response: { 200: SiteConfigResponse },
  })
  .get("/filing", async () => ({
    ok: true,
    item: await getPublicSiteFiling(),
  }), {
    response: { 200: SiteFilingResponse },
  })
  .get("/author", async () => ({
    ok: true,
    item: await getPublicSiteAuthor(),
  }), {
    response: { 200: SiteAuthorResponse },
  });
