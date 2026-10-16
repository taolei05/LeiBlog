import { jwt } from "@elysiajs/jwt";
import { Elysia, status, t } from "elysia";

import { env } from "../../shared/env";
import { adminJwtSchema, extractBearerToken, isAuthJwtPayload } from "../auth/session";
import { readAdminSession } from "../auth/service";
import {
  createMediaFolder,
  deleteMediaAsset,
  deleteMediaFolder,
  getMediaAssetDownload,
  listMediaFolders,
  listMediaAssets,
  MEDIA_FILE_TYPES,
  MEDIA_LIBRARY_FAILURE,
  MediaLibraryError,
  migrateMediaStorage,
  uploadMediaAsset,
  updateMediaAsset,
  updateMediaFolder,
} from "./service";
import type { MediaAsset, MediaFileType, MediaLibraryFailure } from "./service";

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

type ParsePositiveIntegerParameters = {
  fallback: number;
  value?: string;
};

const parsePositiveInteger = ({ fallback, value }: ParsePositiveIntegerParameters) => {
  if (value === undefined) {
    return fallback;
  }

  const parsedValue = Number.parseInt(value, 10);
  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return parsedValue;
};

const isMediaFileType = (value?: string): value is MediaFileType =>
  value === MEDIA_FILE_TYPES.Document ||
  value === MEDIA_FILE_TYPES.Image ||
  value === MEDIA_FILE_TYPES.Video;

const readMediaFileTypeFilter = (value?: string) => {
  if (isMediaFileType(value)) {
    return value;
  }

  return "all";
};

const isMediaStorageProvider = (value?: string): value is MediaAsset["storageProvider"] =>
  value === "local" || value === "r2";

const readMediaStorageProviderFilter = (value?: string) => {
  if (isMediaStorageProvider(value)) {
    return value;
  }

  return "all";
};

const readMediaLibraryFailureMessage = (reason: MediaLibraryFailure) => {
  switch (reason) {
    case MEDIA_LIBRARY_FAILURE.EmptyFile:
      return "File is empty.";
    case MEDIA_LIBRARY_FAILURE.FileTooLarge:
      return "File is too large.";
    case MEDIA_LIBRARY_FAILURE.FolderNotFound:
      return "Media folder was not found.";
    case MEDIA_LIBRARY_FAILURE.FolderSlugExists:
      return "Media folder slug already exists.";
    case MEDIA_LIBRARY_FAILURE.NotFound:
      return "Media asset was not found.";
    case MEDIA_LIBRARY_FAILURE.ProtectedFolder:
      return "Protected media folder cannot be deleted.";
    case MEDIA_LIBRARY_FAILURE.SubscriptionAttachmentOnly:
      return "Upload attachments from subscription management. / 请在订阅与提醒管理中上传附件。";
    case MEDIA_LIBRARY_FAILURE.R2ConfigurationIncomplete:
      return "Cloudflare R2 storage configuration is incomplete.";
    case MEDIA_LIBRARY_FAILURE.RemoteStorageUnsupported:
      return "Remote media download is not supported.";
    case MEDIA_LIBRARY_FAILURE.UnsupportedFileType:
      return "File type is not supported.";
    default: {
      const exhaustiveReason: never = reason;
      return exhaustiveReason;
    }
  }
};

const createMediaLibraryFailureResponse = (error: MediaLibraryError) => {
  const message = readMediaLibraryFailureMessage(error.reason);

  switch (error.reason) {
    case MEDIA_LIBRARY_FAILURE.NotFound:
    case MEDIA_LIBRARY_FAILURE.FolderNotFound:
      return status(404, { message, reason: error.reason });
    case MEDIA_LIBRARY_FAILURE.EmptyFile:
    case MEDIA_LIBRARY_FAILURE.FileTooLarge:
    case MEDIA_LIBRARY_FAILURE.FolderSlugExists:
    case MEDIA_LIBRARY_FAILURE.ProtectedFolder:
    case MEDIA_LIBRARY_FAILURE.SubscriptionAttachmentOnly:
    case MEDIA_LIBRARY_FAILURE.R2ConfigurationIncomplete:
    case MEDIA_LIBRARY_FAILURE.RemoteStorageUnsupported:
    case MEDIA_LIBRARY_FAILURE.UnsupportedFileType:
      return status(400, { message, reason: error.reason });
    default: {
      const exhaustiveReason: never = error.reason;
      return exhaustiveReason;
    }
  }
};

export const adminMediaRoutes = new Elysia({ prefix: "/api/admin" })
  .use(
    jwt({
      name: "jwt",
      secret: env.jwtSecret,
      exp: `${env.sessionTtlSeconds}s`,
      schema: adminJwtSchema,
    }),
  )
  .get(
    "/media/folders",
    async ({ headers, jwt }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      return listMediaFolders();
    },
    {
      headers: t.Object({
        authorization: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/media/folders",
    async ({ body, headers, jwt }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      try {
        return await createMediaFolder({
          description: body.description,
          name: body.name,
          slug: body.slug,
        });
      } catch (error) {
        if (error instanceof MediaLibraryError) {
          return createMediaLibraryFailureResponse(error);
        }

        throw error;
      }
    },
    {
      body: t.Object({
        description: t.Optional(t.String({ maxLength: 500 })),
        name: t.String({ maxLength: 80, minLength: 1 }),
        slug: t.Optional(t.String({ maxLength: 100 })),
      }),
      headers: t.Object({
        authorization: t.Optional(t.String()),
      }),
    },
  )
  .patch(
    "/media/folders/:id",
    async ({ body, headers, jwt, params }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      try {
        return await updateMediaFolder({
          description: body.description,
          folderId: params.id,
          name: body.name,
          slug: body.slug,
        });
      } catch (error) {
        if (error instanceof MediaLibraryError) {
          return createMediaLibraryFailureResponse(error);
        }

        throw error;
      }
    },
    {
      body: t.Object({
        description: t.Optional(t.String({ maxLength: 500 })),
        name: t.String({ maxLength: 80, minLength: 1 }),
        slug: t.Optional(t.String({ maxLength: 100 })),
      }),
      headers: t.Object({
        authorization: t.Optional(t.String()),
      }),
      params: t.Object({
        id: t.String(),
      }),
    },
  )
  .delete(
    "/media/folders/:id",
    async ({ headers, jwt, params }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      try {
        return await deleteMediaFolder({ folderId: params.id });
      } catch (error) {
        if (error instanceof MediaLibraryError) {
          return createMediaLibraryFailureResponse(error);
        }

        throw error;
      }
    },
    {
      headers: t.Object({
        authorization: t.Optional(t.String()),
      }),
      params: t.Object({
        id: t.String(),
      }),
    },
  )
  .get(
    "/media",
    async ({ headers, jwt, query }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      return listMediaAssets({
        excludePrivate: query.excludePrivate === "true",
        fileType: readMediaFileTypeFilter(query.fileType),
        folderSlug: query.folderSlug,
        page: parsePositiveInteger({ fallback: 1, value: query.page }),
        pageSize: parsePositiveInteger({ fallback: 12, value: query.pageSize }),
        query: query.query,
        storageProvider: readMediaStorageProviderFilter(query.storageProvider),
      });
    },
    {
      headers: t.Object({
        authorization: t.Optional(t.String()),
      }),
      query: t.Object({
        excludePrivate: t.Optional(t.String()),
        fileType: t.Optional(t.String()),
        folderSlug: t.Optional(t.String()),
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
        query: t.Optional(t.String()),
        storageProvider: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/media",
    async ({ body, headers, jwt }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      try {
        const item = await uploadMediaAsset({
          file: body.file,
          fileName: body.fileName,
          folderSlug: body.folderSlug,
          targetProvider: isMediaStorageProvider(body.targetProvider)
            ? body.targetProvider
            : undefined,
          uploadedBy: auth.userId,
        });

        return { item, ok: true };
      } catch (error) {
        if (error instanceof MediaLibraryError) {
          return createMediaLibraryFailureResponse(error);
        }

        throw error;
      }
    },
    {
      body: t.Object({
        file: t.File(),
        fileName: t.Optional(t.String({ maxLength: 255 })),
        folderSlug: t.Optional(t.String({ maxLength: 100 })),
        targetProvider: t.Optional(t.String()),
      }),
      headers: t.Object({
        authorization: t.Optional(t.String()),
      }),
    },
  )
  .get("/media/storage/migrate", () =>
    status(405, { message: "Use POST to migrate media storage." }),
  )
  .post(
    "/media/storage/migrate",
    async ({ body, headers, jwt }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      if (!isMediaStorageProvider(body.targetProvider)) {
        return status(400, {
          message: "Target storage provider must be local or r2.",
          reason: MEDIA_LIBRARY_FAILURE.UnsupportedFileType,
        });
      }

      try {
        return await migrateMediaStorage({
          ids: body.ids,
          targetProvider: body.targetProvider,
        });
      } catch (error) {
        if (error instanceof MediaLibraryError) {
          return createMediaLibraryFailureResponse(error);
        }

        throw error;
      }
    },
    {
      body: t.Object({
        ids: t.Array(t.String()),
        targetProvider: t.String(),
      }),
      headers: t.Object({
        authorization: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/media/:id/download",
    async ({ headers, jwt, params, set }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      try {
        const download = await getMediaAssetDownload({ mediaId: params.id });
        set.headers["content-disposition"] =
          `attachment; filename*=UTF-8''${encodeURIComponent(download.fileName)}`;
        set.headers["content-type"] = download.contentType;
        set.headers["cache-control"] = "private, no-store";
        set.headers["x-content-type-options"] = "nosniff";

        if (download.data !== undefined) {
          return download.data;
        }

        return Bun.file(download.filePath);
      } catch (error) {
        if (error instanceof MediaLibraryError) {
          return createMediaLibraryFailureResponse(error);
        }

        throw error;
      }
    },
    {
      headers: t.Object({
        authorization: t.Optional(t.String()),
      }),
      params: t.Object({
        id: t.String(),
      }),
    },
  )
  .patch(
    "/media/:id",
    async ({ body, headers, jwt, params }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      try {
        return await updateMediaAsset({
          fileName: body.fileName,
          mediaId: params.id,
        });
      } catch (error) {
        if (error instanceof MediaLibraryError) {
          return createMediaLibraryFailureResponse(error);
        }

        throw error;
      }
    },
    {
      body: t.Object({
        fileName: t.String({ maxLength: 255, minLength: 1 }),
      }),
      headers: t.Object({
        authorization: t.Optional(t.String()),
      }),
      params: t.Object({
        id: t.String(),
      }),
    },
  )
  .delete(
    "/media/:id",
    async ({ headers, jwt, params }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      try {
        return await deleteMediaAsset({ mediaId: params.id });
      } catch (error) {
        if (error instanceof MediaLibraryError) {
          return createMediaLibraryFailureResponse(error);
        }

        throw error;
      }
    },
    {
      headers: t.Object({
        authorization: t.Optional(t.String()),
      }),
      params: t.Object({
        id: t.String(),
      }),
    },
  );
