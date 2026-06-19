import { Button, Chip, Description, InputGroup, Label, Switch, TextField } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";

import { getAdminApiBaseUrl } from "../../../shared/api/api-base-url";
import { AppIcon } from "../../../shared/icons";
import { showOperationToast } from "../../../shared/toast/operation-toast";
import { AdminDataPage } from "../shared/AdminDataPage";
import { adminFetch } from "../shared/admin-api";

type AuthProviderSettingsItem = {
  clientId: string | null;
  displayName: string;
  enabled: boolean;
  hasClientSecret: boolean;
  provider: string;
  redirectUri: string | null;
  scopes: string[];
};

type AuthProviderFormState = {
  clientId: string;
  clientSecret: string;
  displayName: string;
  enabled: boolean;
  redirectUri: string;
  scopes: string;
};

const providerDefaultScopes: Record<string, string[]> = {
  github: ["read:user", "user:email"],
  google: ["openid", "profile", "email"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown) {
  const trimmed = readString(value).trim();
  return trimmed ? trimmed : null;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function parseAuthProvider(value: unknown): AuthProviderSettingsItem | null {
  if (!isRecord(value)) return null;
  const provider = readString(value.provider);
  if (!provider) return null;

  return {
    clientId: readNullableString(value.clientId),
    displayName: readString(value.displayName) || provider,
    enabled: readBoolean(value.enabled),
    hasClientSecret: readBoolean(value.hasClientSecret),
    provider,
    redirectUri: readNullableString(value.redirectUri),
    scopes: readStringArray(value.scopes),
  };
}

function parseAuthProviderList(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.items)) return [];

  return payload.items
    .map(parseAuthProvider)
    .filter((item): item is AuthProviderSettingsItem => Boolean(item));
}

function createDefaultRedirectUri(provider: string) {
  return `${getAdminApiBaseUrl()}/auth/oauth/${provider}/callback`;
}

function getDefaultScopes(provider: string) {
  return providerDefaultScopes[provider] ?? [];
}

function getProviderIcon(provider: string) {
  return provider === "github" ? "codeSlash" : "key";
}

function createFormState(provider: AuthProviderSettingsItem): AuthProviderFormState {
  return {
    clientId: provider.clientId ?? "",
    clientSecret: "",
    displayName: provider.displayName,
    enabled: provider.enabled,
    redirectUri: provider.redirectUri ?? createDefaultRedirectUri(provider.provider),
    scopes: (provider.scopes.length ? provider.scopes : getDefaultScopes(provider.provider)).join(
      ", ",
    ),
  };
}

function parseScopes(value: string) {
  return [
    ...new Set(
      value
        .split(/[\s,，]+/)
        .map((scope) => scope.trim())
        .filter(Boolean),
    ),
  ];
}

function isConfigured(provider: AuthProviderSettingsItem) {
  return Boolean(provider.clientId && provider.redirectUri && provider.hasClientSecret);
}

export function AuthProvidersPage() {
  const [providers, setProviders] = useState<AuthProviderSettingsItem[]>([]);
  const [forms, setForms] = useState<Record<string, AuthProviderFormState>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [savingProvider, setSavingProvider] = useState("");
  const enabledCount = providers.filter((provider) => provider.enabled).length;
  const configuredCount = providers.filter(isConfigured).length;
  const metrics = useMemo(
    () => [
      { label: "登录方式", value: String(providers.length) },
      { label: "已启用", value: String(enabledCount) },
      { label: "配置完整", value: String(configuredCount) },
    ],
    [configuredCount, enabledCount, providers.length],
  );

  function updateForm(provider: string, update: Partial<AuthProviderFormState>) {
    setForms((current) => ({
      ...current,
      [provider]: {
        ...current[provider],
        ...update,
      },
    }));
  }

  async function loadProviders() {
    setIsLoading(true);
    try {
      const response = await adminFetch<unknown>("/admin/system/auth-providers");
      const items = parseAuthProviderList(response);
      setProviders(items);
      setForms(
        Object.fromEntries(items.map((provider) => [provider.provider, createFormState(provider)])),
      );
    } catch (error) {
      showOperationToast(
        error instanceof Error ? `登录方式加载失败：${error.message}` : "登录方式加载失败",
        "danger",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function saveProvider(provider: AuthProviderSettingsItem) {
    const form = forms[provider.provider];
    if (!form || savingProvider) return;

    setSavingProvider(provider.provider);
    try {
      const body = {
        clientId: form.clientId.trim() || null,
        displayName: form.displayName.trim() || provider.displayName,
        enabled: form.enabled,
        redirectUri: form.redirectUri.trim() || null,
        scopes: parseScopes(form.scopes),
        ...(form.clientSecret.trim() ? { clientSecret: form.clientSecret.trim() } : {}),
      };
      const response = await adminFetch<unknown>(
        `/admin/system/auth-providers/${provider.provider}`,
        {
          body,
          method: "PATCH",
        },
      );
      const nextProvider = isRecord(response) ? parseAuthProvider(response.item) : null;
      if (!nextProvider) throw new Error("登录方式响应格式无效");

      setProviders((current) =>
        current.map((item) => (item.provider === nextProvider.provider ? nextProvider : item)),
      );
      setForms((current) => ({
        ...current,
        [nextProvider.provider]: createFormState(nextProvider),
      }));
      showOperationToast(`${nextProvider.displayName} 登录方式已保存`, "success");
    } catch (error) {
      showOperationToast(
        error instanceof Error ? `登录方式保存失败：${error.message}` : "登录方式保存失败",
        "danger",
      );
    } finally {
      setSavingProvider("");
    }
  }

  useEffect(() => {
    void loadProviders();
  }, []);

  return (
    <AdminDataPage
      description="配置前台可用的第三方登录方式；后台仍只允许管理员账号密码登录。"
      eyebrow="系统"
      icon="key"
      metrics={metrics}
      title="登录方式"
    >
      <div className="auth-provider-list">
        {isLoading ? <p className="front-form-note">登录方式加载中...</p> : null}
        {providers.map((provider) => {
          const form = forms[provider.provider] ?? createFormState(provider);
          const isSaving = savingProvider === provider.provider;
          const defaultScopeText = getDefaultScopes(provider.provider).join("、");

          return (
            <section className="auth-provider-panel" key={provider.provider}>
              <div className="auth-provider-panel__header">
                <div>
                  <p className="eyebrow">{provider.provider}</p>
                  <h3>
                    <AppIcon name={getProviderIcon(provider.provider)} />
                    {provider.displayName}
                  </h3>
                </div>
                <Chip color={provider.enabled ? "success" : "default"} variant="soft">
                  <Chip.Label>{provider.enabled ? "已启用" : "未启用"}</Chip.Label>
                </Chip>
              </div>

              <div className="auth-provider-form">
                <Switch
                  isDisabled={isSaving}
                  isSelected={form.enabled}
                  onChange={(enabled) => updateForm(provider.provider, { enabled })}
                >
                  <Switch.Content>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                    <strong>启用 {provider.displayName} 登录</strong>
                    <span>启用后仅前台登录页显示这个第三方登录方式。</span>
                  </Switch.Content>
                </Switch>

                <TextField fullWidth>
                  <Label>显示名称</Label>
                  <InputGroup fullWidth variant="secondary">
                    <InputGroup.Prefix>
                      <AppIcon name="bookmark" size={16} />
                    </InputGroup.Prefix>
                    <InputGroup.Input
                      onChange={(event) =>
                        updateForm(provider.provider, { displayName: event.target.value })
                      }
                      value={form.displayName}
                    />
                  </InputGroup>
                </TextField>

                <TextField fullWidth>
                  <Label>Client ID</Label>
                  <InputGroup fullWidth variant="secondary">
                    <InputGroup.Prefix>
                      <AppIcon name="key" size={16} />
                    </InputGroup.Prefix>
                    <InputGroup.Input
                      autoComplete="off"
                      onChange={(event) =>
                        updateForm(provider.provider, { clientId: event.target.value })
                      }
                      value={form.clientId}
                    />
                  </InputGroup>
                </TextField>

                <TextField fullWidth>
                  <Label>Client Secret</Label>
                  <InputGroup fullWidth variant="secondary">
                    <InputGroup.Prefix>
                      <AppIcon name="lockClosed" size={16} />
                    </InputGroup.Prefix>
                    <InputGroup.Input
                      autoComplete="new-password"
                      onChange={(event) =>
                        updateForm(provider.provider, { clientSecret: event.target.value })
                      }
                      placeholder={provider.hasClientSecret ? "已设置，留空则不修改" : "尚未设置"}
                      type="password"
                      value={form.clientSecret}
                    />
                  </InputGroup>
                  <Description>
                    <span className="auth-provider-secret-state">
                      {provider.hasClientSecret
                        ? "Client Secret 已加密保存"
                        : "Client Secret 未配置"}
                    </span>
                  </Description>
                </TextField>

                <TextField fullWidth>
                  <Label>Callback URL</Label>
                  <InputGroup fullWidth variant="secondary">
                    <InputGroup.Prefix>
                      <AppIcon name="link" size={16} />
                    </InputGroup.Prefix>
                    <InputGroup.Input
                      onChange={(event) =>
                        updateForm(provider.provider, { redirectUri: event.target.value })
                      }
                      type="url"
                      value={form.redirectUri}
                    />
                  </InputGroup>
                </TextField>

                <TextField fullWidth>
                  <Label>Scope</Label>
                  <InputGroup fullWidth variant="secondary">
                    <InputGroup.Prefix>
                      <AppIcon name="list" size={16} />
                    </InputGroup.Prefix>
                    <InputGroup.Input
                      onChange={(event) =>
                        updateForm(provider.provider, { scopes: event.target.value })
                      }
                      value={form.scopes}
                    />
                  </InputGroup>
                  <Description>
                    {defaultScopeText ? `默认使用 ${defaultScopeText}。` : "未设置默认 Scope。"}
                  </Description>
                </TextField>

                <div className="auth-provider-panel__actions">
                  <Button isDisabled={isSaving} onPress={() => void saveProvider(provider)}>
                    <AppIcon name="save" />
                    {isSaving ? "保存中" : "保存登录方式"}
                  </Button>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </AdminDataPage>
  );
}
