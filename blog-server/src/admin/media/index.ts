import { Elysia } from "elysia";

import {
  MediaLinkResponse,
  MediaListResponse,
  MediaFolderBody,
  MediaFolderListResponse,
  MediaFolderParams,
  MediaFolderResponse,
  MediaParams,
  MediaPreviewResponse,
  MediaQuery,
  MediaResponse,
  OkResponse,
  RenameMediaBody,
  UploadMediaBody,
} from "./model";
import {
  createMediaFolder,
  deleteMediaFolder,
  deleteMedia,
  getMediaById,
  getMediaDownload,
  getMediaLink,
  getMediaPreview,
  listMediaFolders,
  listMedia,
  updateMediaFolder,
  renameMedia,
  uploadMedia,
} from "./service";
import { adminContext } from "../../shared/auth/plugin";
import { requestContext } from "../../shared/http/plugin";
import { enforceUploadRateLimit } from "../../shared/http/rate-limit";

export const adminMediaModule = new Elysia({ prefix: "/media" })
  .use(requestContext)
  .use(adminContext)
  .get("/folders", ({ currentUser }) => listMediaFolders(currentUser), {
    response: { 200: MediaFolderListResponse },
  })
  .post("/folders", ({ currentUser, body }) => createMediaFolder(currentUser, body), {
    body: MediaFolderBody,
    response: { 200: MediaFolderResponse },
  })
  .patch(
    "/folders/:id",
    ({ currentUser, params, body }) => updateMediaFolder(currentUser, params.id, body),
    {
      params: MediaFolderParams,
      body: MediaFolderBody,
      response: { 200: MediaFolderResponse },
    }
  )
  .delete("/folders/:id", ({ currentUser, params }) => deleteMediaFolder(currentUser, params.id), {
    params: MediaFolderParams,
    response: { 200: OkResponse },
  })
  .get("/", ({ currentUser, query }) => listMedia(currentUser, query), {
    query: MediaQuery,
    response: { 200: MediaListResponse },
  })
  .post(
    "/",
    async ({ currentUser, body, requestMeta }) => {
      await enforceUploadRateLimit("admin-media", currentUser.id, requestMeta);
      return {
        ok: true,
        item: await uploadMedia(currentUser, body),
      };
    },
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
