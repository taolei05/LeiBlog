import { stat } from "node:fs/promises";
import { Elysia, status } from "elysia";
import type { Context } from "elysia";

import { resolveSafeMediaStoragePath } from "./storage-path";

export const createMediaFileRoutes = ({ root, prefix }: { root: string; prefix: string }) => {
  const handleFile = async ({ params, set }: Pick<Context, "params" | "set">) => {
    set.headers["Cache-Control"] = "no-store";
    const storageKey = params["*"];
    if (storageKey.split("/").some((part) => part.startsWith("."))) {
      return status(404, { message: "Resource was not found." });
    }
    try {
      const filePath = await resolveSafeMediaStoragePath({ root, storageKey });
      if (!(await stat(filePath)).isFile()) {
        return status(404, { message: "Resource was not found." });
      }
      const file = Bun.file(filePath);
      // Bun omits the HEAD body while retaining the file's length on the wire.
      const response = new Response(file, {
        headers: {
          "Content-Type": file.type,
          "Content-Length": String(file.size),
        },
      });
      set.headers["Cache-Control"] = "public, max-age=3600";
      return response;
    } catch {
      return status(404, { message: "Resource was not found." });
    }
  };
  return new Elysia({ name: "leiblog-media-files" })
    .get(`${prefix}/*`, handleFile)
    .head(`${prefix}/*`, handleFile);
};
