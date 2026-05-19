const DEFAULT_API_PORT = "3000";
const absoluteUrlPattern = /^(?:[a-z][a-z\d+\-.]*:)?\/\//i;

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/$/, "");
}

function getConfiguredApiBaseUrl() {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL;

  if (typeof configuredBaseUrl !== "string") {
    return null;
  }

  if (!configuredBaseUrl.trim()) {
    return null;
  }

  return normalizeBaseUrl(configuredBaseUrl);
}

function getApiPort() {
  const configuredPort = import.meta.env.VITE_API_PORT;

  if (typeof configuredPort !== "string") {
    return DEFAULT_API_PORT;
  }

  return configuredPort.trim() || DEFAULT_API_PORT;
}

function formatHostname(hostname: string) {
  return hostname.includes(":") ? `[${hostname}]` : hostname;
}

function getRuntimeApiBaseUrl() {
  if (typeof window === "undefined") {
    return `http://127.0.0.1:${DEFAULT_API_PORT}/api`;
  }

  return `${window.location.protocol}//${formatHostname(window.location.hostname)}:${getApiPort()}/api`;
}

function removePublicSuffix(baseUrl: string) {
  return baseUrl.endsWith("/public") ? baseUrl.slice(0, -"/public".length) : baseUrl;
}

export function getApiOriginUrl() {
  const baseUrl = removePublicSuffix(getConfiguredApiBaseUrl() ?? getRuntimeApiBaseUrl());

  return new URL(baseUrl).origin;
}

export function getAdminApiBaseUrl() {
  return removePublicSuffix(getConfiguredApiBaseUrl() ?? getRuntimeApiBaseUrl());
}

export function getPublicApiBaseUrl() {
  const baseUrl = getConfiguredApiBaseUrl() ?? getRuntimeApiBaseUrl();

  return baseUrl.endsWith("/public") ? baseUrl : `${baseUrl}/public`;
}

export function resolveApiAssetUrl(value: string | null | undefined) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) return undefined;

  if (
    absoluteUrlPattern.test(trimmedValue) ||
    trimmedValue.startsWith("blob:") ||
    trimmedValue.startsWith("data:")
  ) {
    return trimmedValue;
  }

  if (trimmedValue.startsWith("/")) {
    return `${getApiOriginUrl()}${trimmedValue}`;
  }

  if (trimmedValue.startsWith("uploads/")) {
    return `${getApiOriginUrl()}/${trimmedValue}`;
  }

  return trimmedValue;
}
