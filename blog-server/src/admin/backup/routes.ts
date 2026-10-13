import { jwt } from "@elysiajs/jwt";
import { Elysia, status, t } from "elysia";

import { env } from "../../shared/env";
import { adminJwtSchema, extractBearerToken, isAuthJwtPayload } from "../auth/session";
import { readAdminSession } from "../auth/service";
import { BackupFileBody, BackupImportBody } from "./model";
import {
  BACKUP_FAILURE,
  BackupError,
  createBackupArchive,
  importBackupArchive,
  previewBackupArchive,
} from "./service";
import type { BackupFailure } from "./service";

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

const readBackupFailureMessage = (reason: BackupFailure) => {
  switch (reason) {
    case BACKUP_FAILURE.EmptyFile:
      return "Backup file is empty.";
    case BACKUP_FAILURE.InvalidArchive:
      return "Backup file must be a valid zip archive.";
    case BACKUP_FAILURE.InvalidMedia:
      return "Backup media files are invalid.";
    case BACKUP_FAILURE.InvalidMediaPath:
      return "Backup media path is invalid.";
    case BACKUP_FAILURE.InvalidMode:
      return "Restore mode is not supported.";
    case BACKUP_FAILURE.InvalidPayload:
      return "Backup payload is invalid.";
    case BACKUP_FAILURE.RemoteMediaUnsupported:
      return "Remote media files cannot be exported yet.";
    case BACKUP_FAILURE.UnsupportedVersion:
      return "Backup version is not supported.";
    default: {
      const exhaustiveReason: never = reason;
      return exhaustiveReason;
    }
  }
};

const createBackupFailureResponse = (error: BackupError) => {
  const message = error.message || readBackupFailureMessage(error.reason);

  return status(400, { message, reason: error.reason });
};

export const adminBackupRoutes = new Elysia({ prefix: "/api/admin" })
  .use(
    jwt({
      name: "jwt",
      secret: env.jwtSecret,
      exp: `${env.sessionTtlSeconds}s`,
      schema: adminJwtSchema,
    }),
  )
  .get(
    "/backup/export",
    async ({ headers, jwt, set }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      try {
        const archive = await createBackupArchive();
        set.headers["cache-control"] = "no-store";
        set.headers["content-type"] = "application/zip";
        set.headers["content-disposition"] =
          `attachment; filename="${archive.fileName}"; filename*=UTF-8''${encodeURIComponent(
            archive.fileName,
          )}`;

        return archive.data;
      } catch (error) {
        if (error instanceof BackupError) {
          return createBackupFailureResponse(error);
        }

        throw error;
      }
    },
    {
      headers: t.Object({
        authorization: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/backup/preview",
    async ({ body, headers, jwt }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      try {
        return await previewBackupArchive({ file: body.file });
      } catch (error) {
        if (error instanceof BackupError) {
          return createBackupFailureResponse(error);
        }

        throw error;
      }
    },
    {
      body: BackupFileBody,
      headers: t.Object({
        authorization: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/backup/import",
    async ({ body, headers, jwt }) => {
      const auth = await resolveAuthenticatedAdmin({
        authorization: headers.authorization,
        jwt,
      });
      if (!auth.ok) {
        return auth.response;
      }

      try {
        return await importBackupArchive({
          file: body.file,
          mode: body.mode ?? "replace",
        });
      } catch (error) {
        if (error instanceof BackupError) {
          return createBackupFailureResponse(error);
        }

        throw error;
      }
    },
    {
      body: BackupImportBody,
      headers: t.Object({
        authorization: t.Optional(t.String()),
      }),
    },
  );
