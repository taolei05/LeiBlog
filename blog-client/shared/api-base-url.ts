type ResolveApiBaseUrlParameters = {
  configuredUrl?: string;
  isProduction: boolean;
  location?: { protocol: string; hostname: string };
};

export const resolveApiBaseUrl = ({
  configuredUrl,
  isProduction,
  location,
}: ResolveApiBaseUrlParameters) => {
  if (configuredUrl !== undefined) {
    return configuredUrl.trim().replace(/\/+$/, "");
  }
  if (isProduction || location?.protocol === "https:") {
    return "";
  }
  return `${location?.protocol ?? "http:"}//${location?.hostname ?? "127.0.0.1"}:3000`;
};
