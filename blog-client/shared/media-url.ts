// Bump only when a media-serving change invalidates previously cached responses.
const MEDIA_CACHE_VERSION = "2";

export const versionLocalMediaUrl = ({ value, origin }: { value: string; origin?: string }) => {
  if (!value.startsWith("/") && !/^https?:\/\//i.test(value)) {
    return value;
  }
  const baseOrigin =
    origin || (typeof window === "undefined" ? "https://leiblog.invalid" : window.location.origin);
  try {
    const url = new URL(value, baseOrigin);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.origin !== new URL(baseOrigin).origin ||
      !url.pathname.startsWith("/uploads/")
    ) {
      return value;
    }

    url.searchParams.set("media-v", MEDIA_CACHE_VERSION);
    return value.startsWith("/") && !value.startsWith("//")
      ? `${url.pathname}${url.search}${url.hash}`
      : url.toString();
  } catch {
    return value;
  }
};
