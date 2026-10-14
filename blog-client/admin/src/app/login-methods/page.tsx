import { Fragment, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { LoadingStatus } from "../../../../shared/loading-status";
import { Copy, ExternalLink, Eye, GitBranch, Globe2, KeyRound, Mail, Save, X } from "lucide-react";

import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Citation } from "@astryxdesign/core/Citation";
import { Collapsible, CollapsibleGroup } from "@astryxdesign/core/Collapsible";
import { Dialog } from "@astryxdesign/core/Dialog";
import { Divider } from "@astryxdesign/core/Divider";
import { Grid } from "@astryxdesign/core/Grid";
import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Switch } from "@astryxdesign/core/Switch";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";

import type {
  AuthProvider,
  AuthProviderSettingsItem,
  UpdateAuthProviderSettingsPayload,
} from "../../../../shared/admin-api";
import {
  getAuthProviderSettings,
  revealAuthProviderClientSecret,
  sendAuthProviderClientSecretRevealCode,
  updateAuthProviderSettings,
} from "../../../../shared/admin-api";
import { normalizeLanguage } from "../../../../shared/i18n";
import {
  AdminFeedbackBanner,
  createAdminFeedbackBanner,
} from "../components/admin-feedback-banner";
import type { AdminFeedbackBannerState } from "../components/admin-feedback-banner";
import {
  getAltchaVerificationDialogCopy,
  useAltchaVerificationDialog,
} from "../../../../shared/altcha-challenge";
import { getAltchaSuccessMessage } from "../../../../shared/altcha-feedback";

type LoginMethodsPageProps = {
  authToken: string;
  isNarrow: boolean;
};

type AuthProviderFormState = {
  clientId: string;
  clientSecret: string;
  displayName: string;
  enabled: boolean;
  hasClientSecret: boolean;
  redirectUri: string;
  scopes: string;
};

const AUTH_PROVIDER_GET_URLS: Record<AuthProvider, string> = {
  github: "https://github.com/settings/developers",
  google: "https://console.cloud.google.com/apis/credentials",
};

const AUTH_PROVIDER_ORDER: AuthProvider[] = ["github", "google"];

const SECRET_REVEAL_CODE_COOLDOWN_SECONDS = 60;

const PAGE_PANEL_STYLE: CSSProperties = {
  minWidth: 0,
};

const PANEL_GROUP_FRAME_STYLE: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-container)",
  overflow: "hidden",
  padding: 12,
};

const PROVIDER_HEADER_STYLE: CSSProperties = {
  minWidth: 0,
};

const PROVIDER_ICON_STYLE: CSSProperties = {
  alignItems: "center",
  background: "var(--color-bg-soft)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-control)",
  display: "flex",
  height: 38,
  justifyContent: "center",
  width: 38,
};

const PROVIDER_TRIGGER_STYLE: CSSProperties = {
  minWidth: 0,
  width: "100%",
};

const PROVIDER_PANEL_BODY_STYLE: CSSProperties = {
  paddingTop: 4,
};

const SECRET_VALUE_BOX_STYLE: CSSProperties = {
  background: "var(--color-bg-soft)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-container)",
  minHeight: 46,
  overflowWrap: "anywhere",
  padding: "12px 14px",
};

const FORM_GRID_STYLE: CSSProperties = {
  alignItems: "end",
};

const ACTION_ROW_STYLE: CSSProperties = {
  minWidth: 0,
};

const DIALOG_TITLE_STYLE: CSSProperties = {
  minWidth: 0,
};

const SUMMARY_CARD_STYLE: CSSProperties = {
  minHeight: 88,
};

const SUMMARY_CARD_ACCENT_STYLE: CSSProperties = {
  background: "var(--color-text-pink)",
  borderRadius: 999,
  flex: "0 0 4px",
  height: 56,
};

const SUMMARY_CARD_LABEL_STYLE: CSSProperties = {
  minWidth: 0,
};

const SUMMARY_CARD_VALUE_STYLE: CSSProperties = {
  lineHeight: 1,
  textAlign: "right",
};

const padDateUnit = (value: number) => value.toString().padStart(2, "0");

const formatCountdown = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${padDateUnit(remainingSeconds)}`;
};

const splitScopes = (value: string) =>
  value
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter((scope, index, scopes) => scope.length > 0 && scopes.indexOf(scope) === index);

const createFormState = (
  items: AuthProviderSettingsItem[],
): Record<AuthProvider, AuthProviderFormState> =>
  AUTH_PROVIDER_ORDER.reduce(
    (accumulator, provider) => {
      const item = items.find((candidate) => candidate.provider === provider);
      accumulator[provider] = {
        clientId: item?.clientId ?? "",
        clientSecret: "",
        displayName: item?.displayName ?? (provider === "github" ? "GitHub" : "Google"),
        enabled: item?.enabled ?? false,
        hasClientSecret: item?.hasClientSecret ?? false,
        redirectUri: item?.redirectUri ?? "",
        scopes: item?.scopes.join(", ") ?? "",
      };

      return accumulator;
    },
    {} as Record<AuthProvider, AuthProviderFormState>,
  );

const getProviderIcon = (provider: AuthProvider) =>
  provider === "github" ? <GitBranch size={18} /> : <Globe2 size={18} />;

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const isProviderConfigurationComplete = (providerForm: AuthProviderFormState) =>
  providerForm.clientId.trim().length > 0 &&
  providerForm.redirectUri.trim().length > 0 &&
  (providerForm.hasClientSecret || providerForm.clientSecret.trim().length > 0);

type LoginMethodSummaryCardProps = {
  label: string;
  value: number;
};

const LoginMethodSummaryCard = ({ label, value }: LoginMethodSummaryCardProps) => (
  <Card padding={4} style={SUMMARY_CARD_STYLE}>
    <HStack gap={4} hAlign="between" vAlign="center">
      <HStack gap={4} vAlign="center" style={SUMMARY_CARD_LABEL_STYLE}>
        <div style={SUMMARY_CARD_ACCENT_STYLE} />
        <Text type="label" color="secondary">
          {label}
        </Text>
      </HStack>
      <Heading level={3} style={SUMMARY_CARD_VALUE_STYLE}>
        {value}
      </Heading>
    </HStack>
  </Card>
);

type LoginMethodProviderTriggerProps = {
  isConfigured: boolean;
  isEnabled: boolean;
  provider: AuthProvider;
  title: string;
};

const LoginMethodProviderTrigger = ({
  isConfigured,
  isEnabled,
  provider,
  title,
}: LoginMethodProviderTriggerProps) => {
  const { t } = useTranslation();

  return (
    <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap" style={PROVIDER_TRIGGER_STYLE}>
      <HStack gap={3} style={PROVIDER_HEADER_STYLE} vAlign="center">
        <div style={PROVIDER_ICON_STYLE}>{getProviderIcon(provider)}</div>
        <Text type="body" weight="semibold">
          {title}
        </Text>
      </HStack>
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Badge
          variant={isConfigured ? "success" : "neutral"}
          label={t(
            isConfigured
              ? "admin.loginMethods.status.configured"
              : "admin.loginMethods.status.notConfigured",
          )}
        />
        <Badge
          variant={isEnabled ? "success" : "neutral"}
          label={t(
            isEnabled ? "admin.loginMethods.status.enabled" : "admin.loginMethods.status.disabled",
          )}
        />
      </HStack>
    </HStack>
  );
};

export function LoginMethodsPage({ authToken, isNarrow }: LoginMethodsPageProps) {
  const { i18n, t } = useTranslation();
  const [providers, setProviders] = useState<AuthProviderSettingsItem[]>([]);
  const [form, setForm] = useState<Record<AuthProvider, AuthProviderFormState>>(
    createFormState([]),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [savingProvider, setSavingProvider] = useState<AuthProvider>();
  const [feedbackBanner, setFeedbackBanner] = useState<AdminFeedbackBannerState>();
  const [revealProvider, setRevealProvider] = useState<AuthProvider>();
  const [revealEmailCode, setRevealEmailCode] = useState("");
  const [revealedClientSecret, setRevealedClientSecret] = useState("");
  const [revealCodeExpiresAt, setRevealCodeExpiresAt] = useState<string>();
  const [revealCodeSendCooldownSeconds, setRevealCodeSendCooldownSeconds] = useState(0);
  const [revealCodeNowTick, setRevealCodeNowTick] = useState(Date.now());
  const [isRevealCodeSending, setIsRevealCodeSending] = useState(false);
  const [isRevealingSecret, setIsRevealingSecret] = useState(false);

  const activeLocale = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  const { dialog: revealAltchaDialog, runWithAltcha: runRevealWithAltcha } =
    useAltchaVerificationDialog({
      copy: getAltchaVerificationDialogCopy(activeLocale),
      language: activeLocale,
      onFeedback: (feedback) => setFeedbackBanner(createAdminFeedbackBanner(feedback)),
    });
  const revealForm = revealProvider === undefined ? undefined : form[revealProvider];
  const revealProviderLabel =
    revealProvider === undefined
      ? ""
      : revealForm?.displayName || t(`admin.loginMethods.providers.${revealProvider}`);
  const isSaving = savingProvider !== undefined;
  const enabledProviderCount = AUTH_PROVIDER_ORDER.filter(
    (provider) => form[provider].enabled,
  ).length;
  const completeProviderCount = AUTH_PROVIDER_ORDER.filter((provider) =>
    isProviderConfigurationComplete(form[provider]),
  ).length;
  const isRevealCodeCoolingDown = revealCodeSendCooldownSeconds > 0;
  const sendRevealCodeLabel = isRevealCodeCoolingDown
    ? t("admin.loginMethods.secret.sendCodeCountdown", {
        time: formatCountdown(revealCodeSendCooldownSeconds),
      })
    : t("admin.loginMethods.secret.sendCode");
  const revealCountdownText = useMemo(() => {
    if (revealCodeExpiresAt === undefined) {
      return undefined;
    }

    const milliseconds = new Date(revealCodeExpiresAt).getTime() - revealCodeNowTick;
    if (Number.isNaN(milliseconds) || milliseconds <= 0) {
      return t("admin.loginMethods.secret.codeExpired");
    }

    return t("admin.loginMethods.secret.codeCountdown", {
      time: formatCountdown(Math.ceil(milliseconds / 1000)),
    });
  }, [revealCodeExpiresAt, revealCodeNowTick, t]);

  useEffect(() => {
    let isMounted = true;

    const loadProviders = async () => {
      setIsLoading(true);

      try {
        const response = await getAuthProviderSettings(authToken, activeLocale);
        if (isMounted) {
          setProviders(response.items);
          setForm(createFormState(response.items));
        }
      } catch (error) {
        if (isMounted) {
          setFeedbackBanner(
            createAdminFeedbackBanner({
              status: "error",
              title: getErrorMessage(error, t("admin.loginMethods.toast.loadFailed")),
            }),
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadProviders();

    return () => {
      isMounted = false;
    };
  }, [authToken, t]);

  useEffect(() => {
    if (revealCodeSendCooldownSeconds <= 0) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setRevealCodeSendCooldownSeconds((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [revealCodeSendCooldownSeconds]);

  useEffect(() => {
    if (revealCodeExpiresAt === undefined) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setRevealCodeNowTick(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [revealCodeExpiresAt]);

  const updateProviderForm = (provider: AuthProvider, patch: Partial<AuthProviderFormState>) => {
    setForm((current) => ({
      ...current,
      [provider]: {
        ...current[provider],
        ...patch,
      },
    }));
  };

  const applySavedProvider = (item: AuthProviderSettingsItem) => {
    setProviders((current) => {
      const nextItems = current.filter((providerItem) => providerItem.provider !== item.provider);
      return [...nextItems, item].sort(
        (left, right) =>
          AUTH_PROVIDER_ORDER.indexOf(left.provider) - AUTH_PROVIDER_ORDER.indexOf(right.provider),
      );
    });
    setForm((current) => ({
      ...current,
      [item.provider]: {
        clientId: item.clientId,
        clientSecret: "",
        displayName: item.displayName,
        enabled: item.enabled,
        hasClientSecret: item.hasClientSecret,
        redirectUri: item.redirectUri,
        scopes: item.scopes.join(", "),
      },
    }));
  };

  const saveProvider = async (provider: AuthProvider) => {
    const nextForm = form[provider];
    const hasPendingSecret = nextForm.clientSecret.trim().length > 0;

    if (
      nextForm.enabled &&
      (nextForm.clientId.trim().length === 0 ||
        nextForm.redirectUri.trim().length === 0 ||
        (!nextForm.hasClientSecret && !hasPendingSecret))
    ) {
      setFeedbackBanner(
        createAdminFeedbackBanner({
          status: "error",
          title: t("admin.loginMethods.validation.enableRequired"),
        }),
      );
      return;
    }

    const payload: UpdateAuthProviderSettingsPayload = {
      clientId: nextForm.clientId,
      displayName: nextForm.displayName,
      enabled: nextForm.enabled,
      redirectUri: nextForm.redirectUri,
      scopes: splitScopes(nextForm.scopes),
      ...(hasPendingSecret ? { clientSecret: nextForm.clientSecret } : {}),
    };

    setFeedbackBanner(undefined);
    setSavingProvider(provider);

    try {
      const response = await updateAuthProviderSettings({
        locale: activeLocale,
        payload,
        provider,
        token: authToken,
      });
      applySavedProvider(response.item);
      setFeedbackBanner(
        createAdminFeedbackBanner({
          status: "success",
          title: t("admin.loginMethods.toast.saveSuccess", {
            provider: response.item.displayName,
          }),
        }),
      );
    } catch (error) {
      setFeedbackBanner(
        createAdminFeedbackBanner({
          status: "error",
          title: getErrorMessage(error, t("admin.loginMethods.toast.saveFailed")),
        }),
      );
    } finally {
      setSavingProvider(undefined);
    }
  };

  const openSecretRevealDialog = (provider: AuthProvider) => {
    if (!form[provider].hasClientSecret) {
      setFeedbackBanner(
        createAdminFeedbackBanner({
          status: "error",
          title: t("admin.loginMethods.secret.notConfigured"),
        }),
      );
      return;
    }

    setRevealProvider(provider);
    setRevealEmailCode("");
    setRevealedClientSecret("");
    setRevealCodeExpiresAt(undefined);
    setRevealCodeSendCooldownSeconds(0);
    setRevealCodeNowTick(Date.now());
  };

  const closeSecretRevealDialog = () => {
    setRevealProvider(undefined);
    setRevealEmailCode("");
    setRevealedClientSecret("");
    setRevealCodeExpiresAt(undefined);
    setRevealCodeSendCooldownSeconds(0);
    setIsRevealCodeSending(false);
    setIsRevealingSecret(false);
  };

  const sendRevealCode = async () => {
    if (revealProvider === undefined || revealCodeSendCooldownSeconds > 0 || isRevealCodeSending) {
      return;
    }
    const provider = revealProvider;
    setFeedbackBanner(undefined);
    setIsRevealCodeSending(true);

    try {
      const action = await runRevealWithAltcha({
        runAction: (altcha) =>
          sendAuthProviderClientSecretRevealCode({
            altcha,
            locale: activeLocale,
            provider,
            token: authToken,
          }),
        successMessage: (response) =>
          getAltchaSuccessMessage(
            activeLocale,
            response.sent ? "email-code" : "email-code-request",
          ),
      });
      if (action.status === "cancelled") {
        return;
      }
      const response = action.value;
      setRevealCodeExpiresAt(response.expiresAt);
      setRevealCodeNowTick(Date.now());
      setRevealCodeSendCooldownSeconds(SECRET_REVEAL_CODE_COOLDOWN_SECONDS);
    } catch (error) {
      setFeedbackBanner(
        createAdminFeedbackBanner({
          status: "error",
          title: getErrorMessage(error, t("admin.loginMethods.secret.revealFailed")),
        }),
      );
    } finally {
      setIsRevealCodeSending(false);
    }
  };

  const revealClientSecret = async () => {
    if (revealProvider === undefined) {
      return;
    }

    if (revealEmailCode.trim().length === 0) {
      setFeedbackBanner(
        createAdminFeedbackBanner({
          status: "error",
          title: t("admin.loginMethods.secret.codeRequired"),
        }),
      );
      return;
    }

    setFeedbackBanner(undefined);
    setIsRevealingSecret(true);

    try {
      const response = await revealAuthProviderClientSecret({
        emailCode: revealEmailCode,
        locale: activeLocale,
        provider: revealProvider,
        token: authToken,
      });
      setRevealedClientSecret(response.item.clientSecret);
      setFeedbackBanner(
        createAdminFeedbackBanner({
          status: "success",
          title: t("admin.loginMethods.secret.revealSuccess", {
            provider: revealProviderLabel,
          }),
        }),
      );
    } catch (error) {
      setFeedbackBanner(
        createAdminFeedbackBanner({
          status: "error",
          title: getErrorMessage(error, t("admin.loginMethods.secret.revealFailed")),
        }),
      );
    } finally {
      setIsRevealingSecret(false);
    }
  };

  const copyRevealedSecret = async () => {
    try {
      await navigator.clipboard.writeText(revealedClientSecret);
      setFeedbackBanner(
        createAdminFeedbackBanner({
          status: "success",
          title: t("admin.loginMethods.secret.copied"),
        }),
      );
    } catch {
      setFeedbackBanner(
        createAdminFeedbackBanner({
          status: "error",
          title: t("admin.loginMethods.secret.copyFailed"),
        }),
      );
    }
  };

  if (isLoading) {
    return (
      <Card>
        <LoadingStatus label={t("admin.loginMethods.loading")} />
      </Card>
    );
  }

  return (
    <>
      {revealAltchaDialog}
      <AdminFeedbackBanner banner={feedbackBanner} onDismiss={() => setFeedbackBanner(undefined)} />
      <VStack gap={4} style={PAGE_PANEL_STYLE}>
        <Text type="supporting" color="secondary">
          {t("admin.loginMethods.description")}
        </Text>
        <Grid columns={{ minWidth: isNarrow ? 220 : 260, max: 3 }} gap={isNarrow ? 3 : 4}>
          <LoginMethodSummaryCard
            label={t("admin.loginMethods.summary.total")}
            value={AUTH_PROVIDER_ORDER.length}
          />
          <LoginMethodSummaryCard
            label={t("admin.loginMethods.summary.enabled")}
            value={enabledProviderCount}
          />
          <LoginMethodSummaryCard
            label={t("admin.loginMethods.summary.complete")}
            value={completeProviderCount}
          />
        </Grid>
        <div style={PANEL_GROUP_FRAME_STYLE}>
          <CollapsibleGroup type="single">
            <VStack gap={0}>
              {AUTH_PROVIDER_ORDER.map((provider, index) => {
                const providerForm = form[provider];
                const providerItem = providers.find((item) => item.provider === provider);
                const providerTitle =
                  providerForm.displayName ||
                  providerItem?.displayName ||
                  t(`admin.loginMethods.providers.${provider}`);
                const providerConfigured =
                  providerForm.clientId.trim().length > 0 && providerForm.hasClientSecret;
                const providerIsSaving = savingProvider === provider;

                return (
                  <Fragment key={provider}>
                    <Collapsible
                      value={provider}
                      trigger={
                        <LoginMethodProviderTrigger
                          isConfigured={providerConfigured}
                          isEnabled={providerForm.enabled}
                          provider={provider}
                          title={providerTitle}
                        />
                      }
                    >
                      <VStack gap={4} style={PROVIDER_PANEL_BODY_STYLE}>
                        <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap">
                          <Text type="supporting" color="secondary">
                            {t(`admin.loginMethods.descriptions.${provider}`)}
                          </Text>
                          <Citation
                            number={1}
                            variant="label"
                            source={{
                              icon: <ExternalLink size={12} />,
                              title: t("admin.loginMethods.actions.get"),
                              url: AUTH_PROVIDER_GET_URLS[provider],
                            }}
                          />
                        </HStack>

                        <Divider />

                        <Switch
                          label={t("admin.loginMethods.fields.enabled")}
                          description={t("admin.loginMethods.fields.enabledDescription")}
                          value={providerForm.enabled}
                          onChange={(enabled) => updateProviderForm(provider, { enabled })}
                          labelPosition="start"
                          labelSpacing="spread"
                        />

                        <Grid
                          columns={{ minWidth: isNarrow ? 220 : 260 }}
                          gap={3}
                          style={FORM_GRID_STYLE}
                        >
                          <TextInput
                            label={t("admin.loginMethods.fields.displayName")}
                            value={providerForm.displayName}
                            onChange={(displayName) =>
                              updateProviderForm(provider, { displayName })
                            }
                            placeholder={t(`admin.loginMethods.providers.${provider}`)}
                          />
                          <TextInput
                            label={t("admin.loginMethods.fields.clientId")}
                            value={providerForm.clientId}
                            onChange={(clientId) => updateProviderForm(provider, { clientId })}
                            placeholder={t("admin.loginMethods.placeholders.clientId")}
                          />
                          <TextInput
                            label={t("admin.loginMethods.fields.clientSecret")}
                            startIcon={<KeyRound size={16} />}
                            type="password"
                            value={providerForm.clientSecret}
                            onChange={(clientSecret) =>
                              updateProviderForm(provider, { clientSecret })
                            }
                            placeholder={t("admin.loginMethods.placeholders.clientSecret")}
                          />
                          <TextInput
                            label={t("admin.loginMethods.fields.redirectUri")}
                            value={providerForm.redirectUri}
                            onChange={(redirectUri) =>
                              updateProviderForm(provider, { redirectUri })
                            }
                            placeholder={t("admin.loginMethods.placeholders.redirectUri")}
                          />
                        </Grid>

                        <TextArea
                          label={t("admin.loginMethods.fields.scopes")}
                          value={providerForm.scopes}
                          onChange={(scopes) => updateProviderForm(provider, { scopes })}
                          placeholder={t("admin.loginMethods.placeholders.scopes")}
                          rows={2}
                        />

                        <HStack gap={2} hAlign="end" style={ACTION_ROW_STYLE} wrap="wrap">
                          <StackItem size="fill">
                            <Text type="supporting" color="secondary">
                              {t("admin.loginMethods.secret.keepExisting")}
                            </Text>
                          </StackItem>
                          <Button
                            label={t("admin.loginMethods.secret.viewSaved")}
                            icon={<Eye size={16} />}
                            variant="secondary"
                            width={isNarrow ? "100%" : undefined}
                            isDisabled={isSaving || !providerForm.hasClientSecret}
                            onClick={() => openSecretRevealDialog(provider)}
                          />
                          <Button
                            label={
                              providerIsSaving
                                ? t("admin.loginMethods.actions.saving")
                                : t("admin.loginMethods.actions.save")
                            }
                            icon={<Save size={16} />}
                            variant="primary"
                            width={isNarrow ? "100%" : undefined}
                            isLoading={providerIsSaving}
                            isDisabled={isSaving}
                            onClick={() => void saveProvider(provider)}
                          />
                        </HStack>
                      </VStack>
                    </Collapsible>
                    {index < AUTH_PROVIDER_ORDER.length - 1 ? <Divider /> : null}
                  </Fragment>
                );
              })}
            </VStack>
          </CollapsibleGroup>
        </div>
      </VStack>

      {revealProvider !== undefined && (
        <Dialog
          aria-label={t("admin.loginMethods.secret.revealTitle", {
            provider: revealProviderLabel,
          })}
          isOpen
          width={520}
          maxHeight="calc(100dvh - 32px)"
          variant={isNarrow ? "fullscreen" : "standard"}
          purpose="form"
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              closeSecretRevealDialog();
            }
          }}
        >
          <VStack gap={4}>
            <HStack gap={3} hAlign="between" vAlign="start">
              <VStack gap={1} style={DIALOG_TITLE_STYLE}>
                <Heading level={2}>
                  {t("admin.loginMethods.secret.revealTitle", {
                    provider: revealProviderLabel,
                  })}
                </Heading>
                <Text type="supporting" color="secondary">
                  {t("admin.loginMethods.secret.revealDescription")}
                </Text>
              </VStack>
              <IconButton
                label={t("actions.close")}
                icon={<X size={18} />}
                size="sm"
                variant="ghost"
                onClick={closeSecretRevealDialog}
              />
            </HStack>

            {revealedClientSecret.length === 0 ? (
              <VStack gap={3}>
                <TextInput
                  label={t("admin.loginMethods.secret.emailCode")}
                  value={revealEmailCode}
                  onChange={setRevealEmailCode}
                  placeholder={t("admin.loginMethods.secret.emailCodePlaceholder")}
                />
                {revealCountdownText !== undefined && (
                  <Text type="supporting" color="secondary">
                    {revealCountdownText}
                  </Text>
                )}
                <HStack gap={2} hAlign="end" wrap="wrap">
                  <Button
                    label={sendRevealCodeLabel}
                    icon={<Mail size={16} />}
                    variant="secondary"
                    width={isNarrow ? "100%" : undefined}
                    isLoading={isRevealCodeSending}
                    isDisabled={isRevealCodeCoolingDown || isRevealCodeSending || isRevealingSecret}
                    onClick={() => void sendRevealCode()}
                  />
                  <Button
                    label={t("admin.loginMethods.secret.reveal")}
                    icon={<Eye size={16} />}
                    variant="primary"
                    width={isNarrow ? "100%" : undefined}
                    isLoading={isRevealingSecret}
                    isDisabled={isRevealCodeSending || isRevealingSecret}
                    onClick={() => void revealClientSecret()}
                  />
                </HStack>
              </VStack>
            ) : (
              <VStack gap={3}>
                <VStack gap={2}>
                  <Text type="label">{t("admin.loginMethods.fields.clientSecret")}</Text>
                  <div style={SECRET_VALUE_BOX_STYLE}>
                    <Text type="body">{revealedClientSecret}</Text>
                  </div>
                </VStack>
                <HStack gap={2} hAlign="end" wrap="wrap">
                  <Button
                    label={t("admin.loginMethods.secret.copy")}
                    icon={<Copy size={16} />}
                    variant="secondary"
                    width={isNarrow ? "100%" : undefined}
                    onClick={() => void copyRevealedSecret()}
                  />
                  <Button
                    label={t("actions.close")}
                    variant="primary"
                    width={isNarrow ? "100%" : undefined}
                    onClick={closeSecretRevealDialog}
                  />
                </HStack>
              </VStack>
            )}
          </VStack>
        </Dialog>
      )}
    </>
  );
}
