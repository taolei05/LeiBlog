export type AuthProvider = "github" | "google";

export type AuthProviderDefaults = {
  displayName: string;
  scopes: string[];
};

export const SUPPORTED_AUTH_PROVIDERS: AuthProvider[] = ["github", "google"];

const AUTH_PROVIDER_DEFAULTS: Record<AuthProvider, AuthProviderDefaults> = {
  github: {
    displayName: "GitHub",
    scopes: ["read:user", "user:email"],
  },
  google: {
    displayName: "Google",
    scopes: ["openid", "profile", "email"],
  },
};

export const readAuthProvider = (value: string): AuthProvider | undefined => {
  if (value === "github" || value === "google") {
    return value;
  }

  return undefined;
};

export const getAuthProviderDefaults = (provider: AuthProvider) => AUTH_PROVIDER_DEFAULTS[provider];

export const normalizeAuthProviderScopes = (provider: AuthProvider, values?: string[]) => {
  const scopes = (values ?? [])
    .map((value) => value.trim())
    .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);

  return scopes.length > 0 ? scopes : [...getAuthProviderDefaults(provider).scopes];
};
