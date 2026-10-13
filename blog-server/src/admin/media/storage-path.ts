import { lstat } from "node:fs/promises";
import { resolve, sep } from "node:path";

export const isMediaStorageKeyValid = (storageKey: string) =>
  storageKey.length > 0 &&
  storageKey.length <= 1024 &&
  storageKey
    .split("/")
    .every(
      (segment) =>
        segment.length > 0 &&
        segment !== "." &&
        segment !== ".." &&
        /^[a-zA-Z0-9._-]+$/.test(segment),
    );

export const resolveMediaStoragePath = ({
  root,
  storageKey,
}: {
  root: string;
  storageKey: string;
}) => {
  const resolvedRoot = resolve(root);
  const filePath = resolve(resolvedRoot, storageKey);
  if (!isMediaStorageKeyValid(storageKey) || !filePath.startsWith(`${resolvedRoot}${sep}`)) {
    throw new Error("Media storage path is invalid.");
  }
  return filePath;
};

export const resolveSafeMediaStoragePath = async ({
  root,
  storageKey,
}: {
  root: string;
  storageKey: string;
}) => {
  const filePath = resolveMediaStoragePath({ root, storageKey });
  const paths = [resolve(root)];
  for (const segment of storageKey.split("/")) {
    paths.push(resolve(paths[paths.length - 1], segment));
  }
  for (const path of paths) {
    try {
      if ((await lstat(path)).isSymbolicLink()) {
        throw new Error("Media storage path must not contain symbolic links.");
      }
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        break;
      }
      throw error;
    }
  }
  return filePath;
};
