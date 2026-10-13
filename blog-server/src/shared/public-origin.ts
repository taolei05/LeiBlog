type ResolvePublicOriginParameters = {
  configuredOrigin?: string;
  corsOrigins: readonly string[];
  hostname: string;
  port: number;
  isProduction: boolean;
};

export const resolvePublicOrigin = ({
  configuredOrigin,
  corsOrigins,
  hostname,
  port,
  isProduction,
}: ResolvePublicOriginParameters) => {
  const localHostname = hostname === "0.0.0.0" ? "localhost" : hostname;
  const value =
    configuredOrigin ?? (isProduction ? corsOrigins[0] : `http://${localHostname}:${port}`);
  if (value === undefined) {
    throw new Error("A public HTTPS origin is required in production.");
  }
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    (isProduction && url.protocol !== "https:") ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error(
      "PUBLIC_SITE_URL must be an HTTP origin without credentials, paths or query parameters; production requires HTTPS.",
    );
  }
  return url.origin;
};
