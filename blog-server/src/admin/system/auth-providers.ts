import type { AuthUser } from "../../shared/auth";
import { requireAdmin } from "../../shared/auth";
import type { AuthProvider, AuthProviderSettingsItem } from "../../shared/auth-providers";
import {
  getAuthProviderDefaults,
  readAuthProvider,
  supportedAuthProviders,
} from "../../shared/auth-providers";
import type { StoredEncryptedSecret } from "../../shared/crypto";
import { encryptSecret } from "../../shared/crypto";
import type { DbClient } from "../../shared/db";
import { db } from "../../shared/db";
import { validationError } from "../../shared/errors";

export type AuthProviderSettingsInput = {
  clientId?: string | null;
  clientSecret?: string | null;
  displayName?: string;
  enabled: boolean;
  redirectUri?: string | null;
  scopes?: string[];
};

type AuthProviderSettingsRow = {
  provider: AuthProvider;
  display_name: string;
  enabled: boolean;
  client_id: string | null;
  client_secret_encrypted: StoredEncryptedSecret | null;
  redirect_uri: string | null;
  scopes: string[] | string;
};

function cleanOptional(value: string | null | undefined) {
  if (value === null) return null;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseTextArray(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  return value
    .replace(/^\{|\}$/g, "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanScopes(provider: AuthProvider, scopes: string[] | undefined) {
  const values = scopes?.length ? scopes : getAuthProviderDefaults(provider).scopes;

  return [
    ...new Set(
      values
        .map((scope) => scope.trim())
        .filter(Boolean)
        .slice(0, 20)
    ),
  ];
}

function toSettingsItem(provider: AuthProvider, row?: AuthProviderSettingsRow): AuthProviderSettingsItem {
  const defaults = getAuthProviderDefaults(provider);

  return {
    clientId: row?.client_id ?? null,
    displayName: row?.display_name ?? defaults.displayName,
    enabled: row?.enabled ?? false,
    hasClientSecret: Boolean(row?.client_secret_encrypted),
    provider,
    redirectUri: row?.redirect_uri ?? null,
    scopes: parseTextArray(row?.scopes).length
      ? parseTextArray(row?.scopes)
      : defaults.scopes,
  };
}

export async function listAuthProviderSettings(
  currentUser: AuthUser,
  client: DbClient = db
) {
  requireAdmin(currentUser);

  const rows = await client<AuthProviderSettingsRow[]>`
    SELECT provider, display_name, enabled, client_id, client_secret_encrypted,
           redirect_uri, scopes
    FROM auth_provider_settings
  `;
  const rowMap = new Map(rows.map((row) => [row.provider, row]));

  return {
    items: supportedAuthProviders.map((provider) => toSettingsItem(provider, rowMap.get(provider))),
    ok: true,
  };
}

export async function updateAuthProviderSettings(
  currentUser: AuthUser,
  providerValue: string,
  input: AuthProviderSettingsInput,
  client: DbClient = db
) {
  requireAdmin(currentUser);
  const provider = readAuthProvider(providerValue);
  if (!provider) throw validationError("不支持的登录方式");

  const [existing] = await client<AuthProviderSettingsRow[]>`
    SELECT provider, display_name, enabled, client_id, client_secret_encrypted,
           redirect_uri, scopes
    FROM auth_provider_settings
    WHERE provider = ${provider}
    LIMIT 1
  `;
  const shouldUpdateSecret = input.clientSecret !== undefined;
  const shouldUpdateClientId = input.clientId !== undefined;
  const shouldUpdateRedirectUri = input.redirectUri !== undefined;
  const clientId = shouldUpdateClientId
    ? cleanOptional(input.clientId)
    : (existing?.client_id ?? null);
  const redirectUri = shouldUpdateRedirectUri
    ? cleanOptional(input.redirectUri)
    : (existing?.redirect_uri ?? null);
  const clientSecret = shouldUpdateSecret
    ? encryptSecret(cleanOptional(input.clientSecret))
    : null;
  const hasClientSecret = shouldUpdateSecret
    ? Boolean(clientSecret)
    : Boolean(existing?.client_secret_encrypted);
  const scopes = cleanScopes(provider, input.scopes);
  const displayName =
    cleanOptional(input.displayName) ?? existing?.display_name ?? getAuthProviderDefaults(provider).displayName;

  if (input.enabled && (!clientId || !redirectUri || !hasClientSecret)) {
    throw validationError("启用第三方登录前，请完整配置 Client ID、Client Secret 和 Callback URL");
  }

  await client`
    INSERT INTO auth_provider_settings (
      provider, display_name, enabled, client_id, client_secret_encrypted,
      redirect_uri, scopes
    )
    VALUES (
      ${provider},
      ${displayName},
      ${input.enabled},
      ${clientId},
      ${clientSecret ? JSON.stringify(clientSecret) : null}::jsonb,
      ${redirectUri},
      ${client.array(scopes, "TEXT")}
    )
    ON CONFLICT (provider) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        enabled = EXCLUDED.enabled,
        client_id = EXCLUDED.client_id,
        client_secret_encrypted = CASE
          WHEN ${shouldUpdateSecret} THEN EXCLUDED.client_secret_encrypted
          ELSE auth_provider_settings.client_secret_encrypted
        END,
        redirect_uri = EXCLUDED.redirect_uri,
        scopes = EXCLUDED.scopes
  `;

  const [row] = await client<AuthProviderSettingsRow[]>`
    SELECT provider, display_name, enabled, client_id, client_secret_encrypted,
           redirect_uri, scopes
    FROM auth_provider_settings
    WHERE provider = ${provider}
    LIMIT 1
  `;

  return {
    item: toSettingsItem(provider, row),
    ok: true,
  };
}
