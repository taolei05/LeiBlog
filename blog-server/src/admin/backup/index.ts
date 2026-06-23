import { Elysia } from "elysia";

import {
  BackupFileBody,
  BackupImportBody,
  BackupImportResponse,
  BackupPreviewResponse,
} from "./model";
import {
  createBackupArchive,
  importBackupArchive,
  previewBackupArchive,
} from "./service";
import { adminContext } from "../../shared/auth/plugin";
import { requestContext } from "../../shared/http/plugin";

export const adminBackupModule = new Elysia({ prefix: "/backup" })
  .use(requestContext)
  .use(adminContext)
  .get("/export", async ({ currentUser, set }) => {
    const archive = await createBackupArchive(currentUser);

    set.headers["content-type"] = "application/zip";
    set.headers["content-disposition"] =
      `attachment; filename="${archive.fileName}"; filename*=UTF-8''${encodeURIComponent(
        archive.fileName
      )}`;

    return archive.data;
  })
  .post("/preview", ({ currentUser, body }) => previewBackupArchive(currentUser, body), {
    body: BackupFileBody,
    response: { 200: BackupPreviewResponse },
  })
  .post(
    "/import",
    ({ currentUser, body }) =>
      importBackupArchive(currentUser, {
        file: body.file,
        mode: body.mode ?? "replace",
      }),
    {
      body: BackupImportBody,
      response: { 200: BackupImportResponse },
    }
  );
