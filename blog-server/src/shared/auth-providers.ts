export type AuthProvider = "github" | "google";

export type AuthProviderPublicItem = {
  displayName: string;
  provider: AuthProvider;
};

export type AuthProviderSettingsItem = AuthProviderPublicItem & {
  clientId: string | null;
  enabled: boolean;
  hasClientSecret: boolean;
  redirectUri: string | null;
  scopes: string[];
};

export const authProviderDefaults: Record<
  AuthProvider,
  {
    displayName: string;
    scopes: string[];
  }
> = {
  github: {
    displayName: "GitHub",
    scopes: ["read:user", "user:email"],
  },
  google: {
    displayName: "Google",
    scopes: ["openid", "profile", "email"],
  },
};

export const supportedAuthProviders = Object.keys(authProviderDefaults) as AuthProvider[];

export function readAuthProvider(value: string): AuthProvider | null {
  if (value === "github" || value === "google") return value;

  return null;
}

export function requireAuthProvider(value: string): AuthProvider {
  const provider = readAuthProvider(value);
  if (!provider) {
    throw new Error(`Unsupported auth provider: ${value}`);
  }

  return provider;
}

export function getAuthProviderDefaults(provider: AuthProvider) {
  return authProviderDefaults[provider];
}
