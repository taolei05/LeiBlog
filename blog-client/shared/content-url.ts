const LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const IMAGE_PROTOCOLS = new Set(["http:", "https:"]);

const readSafeUrl = (value: string | null | undefined, protocols: ReadonlySet<string>) => {
  if (value === null || value === undefined) {
    return undefined;
  }

  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 32 || code === 127) {
      return undefined;
    }
  }

  const url = value.trim();
  if (url.length === 0) {
    return undefined;
  }

  try {
    const parsed = new URL(url, "https://leiblog.invalid/");
    return protocols.has(parsed.protocol) ? url : undefined;
  } catch {
    return undefined;
  }
};

export const getSafeLinkUrl = (value: string | null | undefined) =>
  readSafeUrl(value, LINK_PROTOCOLS);

export const resolveContentAssetUrl = (value: string) => {
  const path = readSafeUrl(value, IMAGE_PROTOCOLS);
  if (path === undefined) {
    return "";
  }

  if (!path.startsWith("/") || typeof window === "undefined") {
    return path;
  }

  const url = new URL(path, window.location.origin);
  if (url.origin === window.location.origin && (url.port === "5173" || url.port === "5174")) {
    url.port = "3000";
  }

  return url.toString();
};
