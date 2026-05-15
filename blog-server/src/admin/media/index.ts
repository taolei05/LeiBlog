import { Elysia } from "elysia";

import {
  MediaLinkResponse,
  MediaListResponse,
  MediaParams,
  MediaPreviewResponse,
  MediaQuery,
  MediaResponse,
  OkResponse,
  RenameMediaBody,
  UploadMediaBody,
} from "./model";
import {
  deleteMedia,
  getMediaById,
  getMediaDownload,
  getMediaLink,
  getMediaPreview,
  listMedia,
  renameMedia,
  uploadMedia,
} from "./service";
import { authContext } from "../../shared/auth/plugin";

export const adminMediaModule = new Elysia({ prefix: "/media" })
  .use(authContext)
  .get("/", ({ currentUser, query }) => listMedia(currentUser, query), {
    query: MediaQuery,
    response: { 200: MediaListResponse },
  })
  .post(
    "/",
    async ({ currentUser, body }) => ({
      ok: true,
      item: await uploadMedia(currentUser, body),
    }),
    {
      body: UploadMediaBody,
      response: { 200: MediaResponse },
    }
  )
  .get(
    "/:id",
    async ({ currentUser, params }) => ({
      ok: true,
      item: await getMediaById(currentUser, params.id),
    }),
    {
      params: MediaParams,
      response: { 200: MediaResponse },
    }
  )
  .get("/:id/link", ({ currentUser, params }) => getMediaLink(currentUser, params.id), {
    params: MediaParams,
    response: { 200: MediaLinkResponse },
  })
  .get(
    "/:id/preview",
    ({ currentUser, params }) => getMediaPreview(currentUser, params.id),
    {
      params: MediaParams,
      response: { 200: MediaPreviewResponse },
    }
  )
  .get("/:id/download", async ({ currentUser, params, set }) => {
    const download = await getMediaDownload(currentUser, params.id);
    set.headers["content-type"] = download.contentType;
    set.headers["content-disposition"] =
      `attachment; filename="${encodeURIComponent(download.fileName)}"`;

    return Bun.file(download.filePath);
  }, {
    params: MediaParams,
  })
  .patch(
    "/:id",
    async ({ currentUser, params, body }) => ({
      ok: true,
      item: await renameMedia(currentUser, params.id, body.fileName),
    }),
    {
      params: MediaParams,
      body: RenameMediaBody,
      response: { 200: MediaResponse },
    }
  )
  .delete("/:id", ({ currentUser, params }) => deleteMedia(currentUser, params.id), {
    params: MediaParams,
    response: { 200: OkResponse },
  });
