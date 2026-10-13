export const parseCorsOrigins = (origins: readonly string[]): readonly (string | RegExp)[] =>
  origins.map((origin) => {
    if (origin === "*") {
      throw new Error("CORS_ORIGINS cannot use a wildcard with authenticated requests.");
    }

    const lastSlash = origin.lastIndexOf("/");
    if (origin.startsWith("/") && lastSlash > 0) {
      const pattern = origin.slice(1, lastSlash);
      const flags = origin.slice(lastSlash + 1);
      if (!pattern.startsWith("^") || !pattern.endsWith("$") || /[^i]/.test(flags)) {
        throw new Error("CORS origin patterns must be anchored and may only use the i flag.");
      }
      return new RegExp(pattern, flags);
    }

    const url = new URL(origin);
    if (!["http:", "https:"].includes(url.protocol) || url.origin !== origin) {
      throw new Error("CORS_ORIGINS must contain HTTP origins without paths or credentials.");
    }
    return origin;
  });

export const isAllowedOrigin = ({
  origin,
  allowedOrigins,
}: {
  origin: string;
  allowedOrigins: readonly (string | RegExp)[];
}) =>
  allowedOrigins.some((allowed) =>
    typeof allowed === "string" ? allowed === origin : allowed.test(origin),
  );

export const isAllowedWriteRequest = ({
  request,
  allowedOrigins,
}: {
  request: Request;
  allowedOrigins: readonly (string | RegExp)[];
}) => {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    return true;
  }

  const origin = request.headers.get("origin");
  if (origin !== null) {
    return origin === new URL(request.url).origin || isAllowedOrigin({ origin, allowedOrigins });
  }

  const referer = request.headers.get("referer");
  if (referer !== null) {
    try {
      const refererOrigin = new URL(referer).origin;
      return (
        refererOrigin === new URL(request.url).origin ||
        isAllowedOrigin({ origin: refererOrigin, allowedOrigins })
      );
    } catch {
      return false;
    }
  }

  // Non-browser API clients may omit Origin, but ambient cookies still require proof of origin.
  return request.headers.get("sec-fetch-site") !== "cross-site" && !request.headers.has("cookie");
};
