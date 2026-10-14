import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  AtSign,
  Clock3,
  KeyRound,
  MapPin,
  MonitorCheck,
  Plus,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserCircle,
} from "lucide-react";

import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Collapsible, CollapsibleGroup } from "@astryxdesign/core/Collapsible";
import { Divider } from "@astryxdesign/core/Divider";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Switch } from "@astryxdesign/core/Switch";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Tokenizer } from "@astryxdesign/core/Tokenizer";
import { createStaticSource } from "@astryxdesign/core/Typeahead";
import type { SearchableItem } from "@astryxdesign/core/Typeahead";

import {
  AdminFeedbackBanner,
  createAdminFeedbackBanner,
} from "../components/admin-feedback-banner";
import type { AdminFeedbackBannerState } from "../components/admin-feedback-banner";
import { MediaAssetField } from "../components/media-asset-field";
import type {
  AdminProfileLocalizations,
  AdminProfileTranslation,
  AdminLoginInfo,
  AdminSocialLink,
  AdminUser,
  UpdateAdminSettingsPayload,
} from "../../../../shared/admin-api";
import {
  getAdminSettings,
  updateAdminSettings,
  uploadMediaAsset,
} from "../../../../shared/admin-api";
import { normalizeLanguage } from "../../../../shared/i18n";
import { formatDateTimeInTimeZone } from "../../../../shared/time-zone";

type ErrorMap = Record<string, string>;

type SocialLinkItem = AdminSocialLink & {
  id: string;
};

type ProfileTagItemData = {
  __createdValue?: string;
};

type ProfileTagItem = SearchableItem<ProfileTagItemData>;

type AdminSettingsFormState = {
  nameZh: string;
  nameEn: string;
  username: string;
  email: string;
  avatarUrl: string;
  bioZh: string;
  bioEn: string;
  tagsZh: string;
  tagsEn: string;
  socialLinks: SocialLinkItem[];
  blogUrl: string;
  commentEmailNotifications: boolean;
  newPostEmailNotifications: boolean;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type AdminSettingsTextField =
  | "nameZh"
  | "nameEn"
  | "username"
  | "email"
  | "avatarUrl"
  | "bioZh"
  | "bioEn"
  | "tagsZh"
  | "tagsEn"
  | "blogUrl"
  | "currentPassword"
  | "newPassword"
  | "confirmPassword";

type AdminSettingsTagField = "tagsZh" | "tagsEn";

type SocialLinkField = "label" | "url";

type SettingsSaveTarget = "profile" | "account-security" | "login-info" | "preferences";

type SaveSettingsResult = "saved" | "validation-error" | "request-error";

type AdminSettingsPageProps = {
  authToken: string;
  user: AdminUser;
  isNarrow: boolean;
  timeZone: string;
  onUserUpdated: (user: AdminUser) => void;
};

const EMPTY_ERRORS: ErrorMap = {};

const EMPTY_LOGIN_INFO: AdminLoginInfo = {
  lastLoginAt: null,
  lastLoginTimeZone: null,
  lastLoginTimeZoneOffsetMinutes: null,
  lastLoginDevice: null,
  lastLoginIp: null,
  lastLoginLocation: null,
  lastLoginMethod: null,
  recentLogins: [],
};

const SAVE_TARGET_LABEL_KEYS: Record<SettingsSaveTarget, string> = {
  profile: "admin.settings.sections.profile",
  "account-security": "admin.settings.sections.accountSecurity",
  "login-info": "admin.settings.sections.loginInfo",
  preferences: "admin.settings.sections.preferences",
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

const SUMMARY_CARD_VALUE_STYLE: CSSProperties = {
  overflowWrap: "anywhere",
};

const PANEL_GROUP_FRAME_STYLE: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-container)",
  overflow: "hidden",
  padding: 12,
};

const LOGIN_INFO_PANEL_STYLE: CSSProperties = {
  background: "var(--color-background-muted)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  padding: 16,
};

const LOGIN_INFO_RECORD_STYLE: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  padding: 12,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const splitValues = (raw: string) =>
  raw
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);

const createTagItems = (values: string[]): ProfileTagItem[] => {
  const seenKeys = new Set<string>();

  return values.reduce<ProfileTagItem[]>((items, value) => {
    const label = value.trim();
    const key = label.toLocaleLowerCase();
    if (label.length === 0 || seenKeys.has(key)) {
      return items;
    }

    seenKeys.add(key);
    return [...items, { id: label, label }];
  }, []);
};

const createTagsText = (items: ProfileTagItem[]) =>
  createTagItems(items.map((item) => item.label))
    .map((item) => item.label)
    .join(", ");

const createItemId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const isValidUrl = (value: string) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const isValidMediaAssetUrl = (value: string) => {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return true;
  }

  if (trimmedValue.startsWith("/uploads/")) {
    return true;
  }

  return isValidUrl(trimmedValue);
};

const toSocialLinkItems = (links: AdminSocialLink[]) =>
  links.map((link) => ({
    id: createItemId("social"),
    label: link.label,
    url: link.url,
  }));

type CreateFormStateParameters = {
  profileLocalizations?: AdminProfileLocalizations;
  socialLinks: AdminSocialLink[];
  user: AdminUser;
};

const createFormState = ({
  profileLocalizations,
  user,
  socialLinks,
}: CreateFormStateParameters): AdminSettingsFormState => ({
  nameZh: profileLocalizations?.zhCN.name ?? user.name ?? "",
  nameEn: profileLocalizations?.en.name ?? "",
  username: user.username,
  email: user.email,
  avatarUrl: user.avatarUrl ?? "",
  bioZh: profileLocalizations?.zhCN.bio ?? user.bio ?? "",
  bioEn: profileLocalizations?.en.bio ?? "",
  tagsZh: (profileLocalizations?.zhCN.tags ?? user.tags).join(", "),
  tagsEn: (profileLocalizations?.en.tags ?? []).join(", "),
  socialLinks: toSocialLinkItems(socialLinks),
  blogUrl: user.blogUrl ?? "",
  commentEmailNotifications: user.commentEmailNotifications,
  newPostEmailNotifications: user.newPostEmailNotifications,
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});

const mergeFormForSaveTarget = ({
  base,
  current,
  target,
}: {
  base: AdminSettingsFormState;
  current: AdminSettingsFormState;
  target: SettingsSaveTarget;
}): AdminSettingsFormState => {
  if (target === "profile") {
    return {
      ...base,
      nameZh: current.nameZh,
      nameEn: current.nameEn,
      username: current.username,
      email: current.email,
      avatarUrl: current.avatarUrl,
      bioZh: current.bioZh,
      bioEn: current.bioEn,
      tagsZh: current.tagsZh,
      tagsEn: current.tagsEn,
      socialLinks: current.socialLinks,
      blogUrl: current.blogUrl,
    };
  }

  if (target === "account-security") {
    return {
      ...base,
      currentPassword: current.currentPassword,
      newPassword: current.newPassword,
      confirmPassword: current.confirmPassword,
    };
  }

  if (target === "preferences") {
    return {
      ...base,
      commentEmailNotifications: current.commentEmailNotifications,
      newPostEmailNotifications: current.newPostEmailNotifications,
    };
  }

  return base;
};

const applySavedTargetToForm = ({
  current,
  saved,
  target,
}: {
  current: AdminSettingsFormState;
  saved: AdminSettingsFormState;
  target: SettingsSaveTarget;
}): AdminSettingsFormState => {
  if (target === "profile") {
    return {
      ...current,
      nameZh: saved.nameZh,
      nameEn: saved.nameEn,
      username: saved.username,
      email: saved.email,
      avatarUrl: saved.avatarUrl,
      bioZh: saved.bioZh,
      bioEn: saved.bioEn,
      tagsZh: saved.tagsZh,
      tagsEn: saved.tagsEn,
      socialLinks: saved.socialLinks,
      blogUrl: saved.blogUrl,
    };
  }

  if (target === "account-security") {
    return {
      ...current,
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    };
  }

  if (target === "preferences") {
    return {
      ...current,
      commentEmailNotifications: saved.commentEmailNotifications,
      newPostEmailNotifications: saved.newPostEmailNotifications,
    };
  }

  return current;
};

const addRequiredError = (errors: ErrorMap, key: string, value: string, message: string) => {
  if (!value.trim()) {
    errors[key] = message;
  }
};

const addUrlError = (errors: ErrorMap, key: string, value: string, message: string) => {
  const trimmedValue = value.trim();
  if (trimmedValue.length > 0 && !isValidUrl(trimmedValue)) {
    errors[key] = message;
  }
};

const addMediaAssetUrlError = (errors: ErrorMap, key: string, value: string, message: string) => {
  if (!isValidMediaAssetUrl(value)) {
    errors[key] = message;
  }
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const formatLoginDateTime = ({
  fallback,
  language,
  timeZone,
  value,
}: {
  fallback: string;
  language: string;
  timeZone: string;
  value: string | null;
}) => {
  return formatDateTimeInTimeZone({
    fallback,
    language,
    timeZone,
    value,
  });
};

const isPrivateLoginIp = (ip: string | null) => {
  if (ip === null) {
    return false;
  }

  const [first = 0, second = 0] = ip.split(".").map(Number);
  return (
    ip === "::1" ||
    ip.startsWith("fc") ||
    ip.startsWith("fd") ||
    ip.startsWith("fe80") ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
};

type SettingsSummaryCardProps = {
  label: string;
  value: string;
  icon: ReactNode;
};

const SettingsSummaryCard = ({ label, value, icon }: SettingsSummaryCardProps) => {
  return (
    <Card padding={4} style={SUMMARY_CARD_STYLE}>
      <HStack gap={4} vAlign="center">
        <div style={SUMMARY_CARD_ACCENT_STYLE} />
        <VStack gap={3}>
          <HStack gap={2} vAlign="center">
            {icon}
            <Text type="label" color="secondary">
              {label}
            </Text>
          </HStack>
          <Heading level={3} style={SUMMARY_CARD_VALUE_STYLE}>
            {value}
          </Heading>
        </VStack>
      </HStack>
    </Card>
  );
};

type LoginInfoMetricProps = {
  icon: ReactNode;
  label: string;
  value: string;
};

const LoginInfoMetric = ({ icon, label, value }: LoginInfoMetricProps) => {
  return (
    <Card padding={4}>
      <VStack gap={2}>
        <HStack gap={2} vAlign="center">
          {icon}
          <Text type="label" color="secondary">
            {label}
          </Text>
        </HStack>
        <Text type="body" weight="semibold" style={SUMMARY_CARD_VALUE_STYLE}>
          {value}
        </Text>
      </VStack>
    </Card>
  );
};

type SettingsPanelTriggerProps = {
  title: string;
  icon: ReactNode;
};

const SettingsPanelTrigger = ({ title, icon }: SettingsPanelTriggerProps) => {
  return (
    <HStack gap={2} vAlign="center">
      {icon}
      <Text type="body" weight="semibold">
        {title}
      </Text>
    </HStack>
  );
};

type SettingsPanelSaveButtonProps = {
  isDisabled?: boolean;
  isLoading: boolean;
  isNarrow: boolean;
  label: string;
  loadingLabel: string;
  onClick: () => void;
};

const SettingsPanelSaveButton = ({
  isDisabled = false,
  isLoading,
  isNarrow,
  label,
  loadingLabel,
  onClick,
}: SettingsPanelSaveButtonProps) => {
  return (
    <HStack gap={3} hAlign="end" wrap="wrap">
      <Button
        label={isLoading ? loadingLabel : label}
        icon={<Save size={16} />}
        variant="primary"
        width={isNarrow ? "100%" : undefined}
        isLoading={isLoading}
        isDisabled={isDisabled}
        onClick={onClick}
      />
    </HStack>
  );
};

export function AdminSettingsPage({
  authToken,
  user,
  isNarrow,
  timeZone,
  onUserUpdated,
}: AdminSettingsPageProps) {
  const { i18n, t } = useTranslation();
  const language = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  const [form, setForm] = useState(() => createFormState({ user, socialLinks: [] }));
  const [savedForm, setSavedForm] = useState(() => createFormState({ user, socialLinks: [] }));
  const [isLoading, setIsLoading] = useState(true);
  const [savingTarget, setSavingTarget] = useState<SettingsSaveTarget>();
  const [saveConfirmationTarget, setSaveConfirmationTarget] = useState<SettingsSaveTarget>();
  const [attemptedSaveTarget, setAttemptedSaveTarget] = useState<SettingsSaveTarget>();
  const [loginInfo, setLoginInfo] = useState<AdminLoginInfo>(EMPTY_LOGIN_INFO);
  const [feedbackBanner, setFeedbackBanner] = useState<AdminFeedbackBannerState>();
  const [avatarFile, setAvatarFile] = useState<File>();

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      setIsLoading(true);
      setFeedbackBanner(undefined);

      try {
        const settings = await getAdminSettings(authToken, language);
        if (!isMounted) {
          return;
        }

        const nextForm = createFormState(settings);
        setForm(nextForm);
        setSavedForm(nextForm);
        setLoginInfo(settings.loginInfo);
        setAvatarFile(undefined);
        onUserUpdated(settings.user);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message = getErrorMessage(error, t("admin.settings.toast.loadFailed"));
        setFeedbackBanner(createAdminFeedbackBanner({ status: "error", title: message }));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, [authToken, language, onUserUpdated, t]);

  const tagZhValues = useMemo(() => splitValues(form.tagsZh), [form.tagsZh]);
  const tagZhItems = useMemo(() => createTagItems(tagZhValues), [tagZhValues]);
  const tagZhSearchSource = useMemo(() => createStaticSource(tagZhItems), [tagZhItems]);
  const tagEnValues = useMemo(() => splitValues(form.tagsEn), [form.tagsEn]);
  const tagEnItems = useMemo(() => createTagItems(tagEnValues), [tagEnValues]);
  const tagEnSearchSource = useMemo(() => createStaticSource(tagEnItems), [tagEnItems]);
  const isSaving = savingTarget !== undefined;
  const saveConfirmationCopy =
    saveConfirmationTarget === undefined
      ? undefined
      : {
          title: t("admin.settings.confirmSave.title", {
            section: t(SAVE_TARGET_LABEL_KEYS[saveConfirmationTarget]),
          }),
          description: t("admin.settings.confirmSave.description", {
            section: t(SAVE_TARGET_LABEL_KEYS[saveConfirmationTarget]),
          }),
        };

  const createErrorsForTarget = (
    target: SettingsSaveTarget,
    targetForm: AdminSettingsFormState,
  ) => {
    const nextErrors: ErrorMap = {};

    if (target === "profile") {
      addRequiredError(
        nextErrors,
        "username",
        targetForm.username,
        t("admin.settings.validation.usernameRequired"),
      );
      addRequiredError(
        nextErrors,
        "email",
        targetForm.email,
        t("admin.settings.validation.emailRequired"),
      );

      if (targetForm.email.trim().length > 0 && !EMAIL_PATTERN.test(targetForm.email.trim())) {
        nextErrors.email = t("admin.settings.validation.emailInvalid");
      }

      addMediaAssetUrlError(
        nextErrors,
        "avatarUrl",
        targetForm.avatarUrl,
        t("admin.settings.validation.avatarInvalid"),
      );
      addUrlError(
        nextErrors,
        "blogUrl",
        targetForm.blogUrl,
        t("admin.settings.validation.blogInvalid"),
      );

      targetForm.socialLinks.forEach((link) => {
        addUrlError(
          nextErrors,
          `social-${link.id}`,
          link.url,
          t("admin.settings.validation.socialInvalid"),
        );
      });

      return nextErrors;
    }

    if (target === "account-security") {
      const wantsPasswordChange =
        targetForm.currentPassword.length > 0 ||
        targetForm.newPassword.length > 0 ||
        targetForm.confirmPassword.length > 0;

      if (wantsPasswordChange && targetForm.newPassword.length === 0) {
        nextErrors.newPassword = t("admin.settings.validation.newPasswordRequired");
      }

      if (targetForm.newPassword.length > 0 && targetForm.currentPassword.length === 0) {
        nextErrors.currentPassword = t("admin.settings.validation.currentPasswordRequired");
      }

      if (targetForm.newPassword.length > 0 && targetForm.newPassword.length < 8) {
        nextErrors.newPassword = t("admin.settings.validation.passwordTooShort");
      }

      if (
        targetForm.newPassword.length > 0 &&
        targetForm.newPassword !== targetForm.confirmPassword
      ) {
        nextErrors.confirmPassword = t("admin.settings.validation.passwordMismatch");
      }
    }

    return nextErrors;
  };

  const shownErrors = useMemo(() => {
    if (attemptedSaveTarget === undefined) {
      return EMPTY_ERRORS;
    }

    return createErrorsForTarget(attemptedSaveTarget, form);
  }, [attemptedSaveTarget, form, t]);

  const updateTextField = (field: AdminSettingsTextField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateTags = (field: AdminSettingsTagField, items: ProfileTagItem[]) => {
    setForm((current) => ({ ...current, [field]: createTagsText(items) }));
  };

  const renderTagItem = (item: ProfileTagItem) => {
    const createdValue = item.auxiliaryData?.__createdValue;

    if (createdValue) {
      return t("admin.settings.createTag", { tag: createdValue });
    }

    return item.label;
  };

  const updateSocialLink = (id: string, field: SocialLinkField, value: string) => {
    setForm((current) => ({
      ...current,
      socialLinks: current.socialLinks.map((link) =>
        link.id === id ? { ...link, [field]: value } : link,
      ),
    }));
  };

  const addSocialLink = () => {
    setForm((current) => ({
      ...current,
      socialLinks: [...current.socialLinks, { id: createItemId("social"), label: "", url: "" }],
    }));
  };

  const removeSocialLink = (id: string) => {
    setForm((current) => ({
      ...current,
      socialLinks: current.socialLinks.filter((link) => link.id !== id),
    }));
  };

  const createPayload = (targetForm: AdminSettingsFormState): UpdateAdminSettingsPayload => ({
    profileLocalizations: {
      zhCN: {
        name: targetForm.nameZh.trim(),
        bio: targetForm.bioZh.trim(),
        tags: splitValues(targetForm.tagsZh),
      },
      en: {
        name: targetForm.nameEn.trim(),
        bio: targetForm.bioEn.trim(),
        tags: splitValues(targetForm.tagsEn),
      },
    },
    username: targetForm.username.trim(),
    email: targetForm.email.trim(),
    avatarUrl: targetForm.avatarUrl.trim(),
    tagLocale: language,
    socialLinks: targetForm.socialLinks
      .map((link) => ({
        label: link.label.trim(),
        url: link.url.trim(),
      }))
      .filter((link) => link.label.length > 0 || link.url.length > 0),
    blogUrl: targetForm.blogUrl.trim(),
    commentEmailNotifications: targetForm.commentEmailNotifications,
    newPostEmailNotifications: targetForm.newPostEmailNotifications,
    currentPassword: targetForm.currentPassword,
    newPassword: targetForm.newPassword,
  });

  const createSaveSuccessBanner = (profileTranslation?: AdminProfileTranslation) => {
    const title = t("admin.settings.toast.saveSuccess");
    if (profileTranslation === undefined || profileTranslation.status === "not-needed") {
      return createAdminFeedbackBanner({
        status: "success",
        title,
      });
    }

    const targetLocales = profileTranslation.targetLocales ?? [profileTranslation.targetLocale];
    const targetLanguage = t(
      targetLocales.length > 1
        ? "admin.settings.translationTarget.both"
        : targetLocales[0] === "en"
          ? "admin.settings.translationTarget.english"
          : "admin.settings.translationTarget.chinese",
    );

    switch (profileTranslation.status) {
      case "completed":
        return createAdminFeedbackBanner({
          description: t("admin.settings.translation.completed", {
            language: targetLanguage,
          }),
          status: "success",
          title,
        });
      case "missing-api-key":
        return createAdminFeedbackBanner({
          description: t("admin.settings.translation.missingApiKey", {
            language: targetLanguage,
          }),
          status: "warning",
          title,
        });
      case "incomplete":
        return createAdminFeedbackBanner({
          description: t("admin.settings.translation.incomplete", {
            language: targetLanguage,
          }),
          status: "warning",
          title,
        });
      default: {
        const exhaustiveStatus: never = profileTranslation.status;
        throw new Error("Unhandled translation status.", { cause: exhaustiveStatus });
      }
    }
  };

  const saveSettings = async (target: SettingsSaveTarget): Promise<SaveSettingsResult> => {
    let targetForm = mergeFormForSaveTarget({
      base: savedForm,
      current: form,
      target,
    });
    const targetErrors = createErrorsForTarget(target, targetForm);

    setAttemptedSaveTarget(target);
    setFeedbackBanner(undefined);

    if (Object.keys(targetErrors).length > 0) {
      return "validation-error";
    }

    setSavingTarget(target);
    try {
      if (target === "profile" && avatarFile !== undefined) {
        const uploadedAvatar = await uploadMediaAsset({
          file: avatarFile,
          folderSlug: "avatars",
          token: authToken,
        });
        targetForm = { ...targetForm, avatarUrl: uploadedAvatar.accessUrl };
      }

      const settings = await updateAdminSettings({
        token: authToken,
        payload: createPayload(targetForm),
      });

      const nextSavedForm = createFormState(settings);
      setSavedForm(nextSavedForm);
      setForm((current) =>
        applySavedTargetToForm({
          current,
          saved: nextSavedForm,
          target,
        }),
      );
      setAttemptedSaveTarget(undefined);
      if (target === "profile") {
        setAvatarFile(undefined);
      }
      onUserUpdated(settings.user);
      setFeedbackBanner(
        createSaveSuccessBanner(target === "profile" ? settings.profileTranslation : undefined),
      );
      return "saved";
    } catch (error) {
      const message = getErrorMessage(error, t("admin.settings.toast.saveFailed"));
      setFeedbackBanner(createAdminFeedbackBanner({ status: "error", title: message }));
      return "request-error";
    } finally {
      setSavingTarget(undefined);
    }
  };

  const requestSaveConfirmation = (target: SettingsSaveTarget) => {
    setSaveConfirmationTarget(target);
  };

  const handleConfirmSave = async () => {
    if (saveConfirmationTarget === undefined) {
      return;
    }

    await saveSettings(saveConfirmationTarget);
    setSaveConfirmationTarget(undefined);
  };

  const emptyLoginValue = t("admin.settings.summary.latestLoginPlaceholder");
  const latestLoginAt = formatLoginDateTime({
    fallback: emptyLoginValue,
    language,
    timeZone: loginInfo.lastLoginTimeZone ?? timeZone,
    value: loginInfo.lastLoginAt,
  });
  type GetLoginLocationLabelParameters = {
    ip: string | null;
    location: string | null;
  };

  const getLoginLocationLabel = ({ ip, location }: GetLoginLocationLabelParameters) => {
    if (location !== null && location.trim().length > 0) {
      return location.trim();
    }

    if (isPrivateLoginIp(ip)) {
      return t("admin.settings.loginInfo.localNetworkLocation");
    }

    return t("admin.settings.loginInfo.unknownLocation");
  };
  const getLoginDeviceLabel = (device: string | null) =>
    device ?? t("admin.settings.loginInfo.unrecordedDevice");
  const getRecentLoginDetails = (event: AdminLoginInfo["recentLogins"][number]) =>
    [
      event.ip,
      getLoginLocationLabel({ ip: event.ip, location: event.location }),
      getLoginDeviceLabel(event.device),
    ]
      .filter((value) => value !== null)
      .join(" / ") || t("admin.settings.loginInfo.unknown");
  const latestLoginIp = loginInfo.lastLoginIp ?? emptyLoginValue;
  const latestLoginLocation = getLoginLocationLabel({
    ip: loginInfo.lastLoginIp,
    location: loginInfo.lastLoginLocation,
  });
  const latestLoginDevice = getLoginDeviceLabel(loginInfo.lastLoginDevice);
  const latestLoginMethod =
    loginInfo.lastLoginMethod === null
      ? emptyLoginValue
      : t(`admin.settings.loginInfo.method.${loginInfo.lastLoginMethod}`);

  return (
    <>
      <AdminFeedbackBanner banner={feedbackBanner} onDismiss={() => setFeedbackBanner(undefined)} />
      <VStack gap={5}>
        {isLoading && (
          <HStack gap={2} vAlign="center">
            <Spinner label={t("admin.settings.loading")} />
            <Text type="supporting" color="secondary">
              {t("admin.settings.loading")}
            </Text>
          </HStack>
        )}

        <Grid columns={{ minWidth: isNarrow ? 220 : 260, max: 3 }} gap={isNarrow ? 3 : 4}>
          <SettingsSummaryCard
            label={t("admin.settings.summary.currentAccount")}
            value={form.username.trim() || user.username}
            icon={<UserCircle size={16} />}
          />
          <SettingsSummaryCard
            label={t("admin.settings.summary.email")}
            value={form.email.trim() || user.email}
            icon={<AtSign size={16} />}
          />
          <SettingsSummaryCard
            label={t("admin.settings.summary.latestLogin")}
            value={latestLoginAt}
            icon={<Clock3 size={16} />}
          />
        </Grid>

        <div style={PANEL_GROUP_FRAME_STYLE}>
          <CollapsibleGroup type="single">
            <VStack gap={3}>
              <Collapsible
                value="profile"
                trigger={
                  <SettingsPanelTrigger
                    title={t("admin.settings.sections.profile")}
                    icon={<UserCircle size={18} />}
                  />
                }
              >
                <VStack gap={4}>
                  <Text type="supporting" color="secondary">
                    {t("admin.settings.descriptions.profile")}
                  </Text>
                  <FormLayout defaultOptionality="optional">
                    <Grid columns={{ minWidth: isNarrow ? 220 : 160, max: 4 }} gap={3}>
                      <TextInput
                        label={t("admin.settings.nameZh")}
                        value={form.nameZh}
                        onChange={(value) => updateTextField("nameZh", value)}
                        placeholder={t("initialSetup.admin.namePlaceholder")}
                      />
                      <TextInput
                        label={t("admin.settings.nameEn")}
                        value={form.nameEn}
                        onChange={(value) => updateTextField("nameEn", value)}
                        placeholder={t("admin.settings.nameEnPlaceholder")}
                      />
                      <TextInput
                        label={t("admin.settings.username")}
                        isRequired
                        value={form.username}
                        onChange={(value) => updateTextField("username", value)}
                        placeholder={t("initialSetup.admin.usernamePlaceholder")}
                        status={
                          shownErrors.username
                            ? { type: "error", message: shownErrors.username }
                            : undefined
                        }
                      />
                      <TextInput
                        label={t("admin.settings.email")}
                        isRequired
                        type="email"
                        value={form.email}
                        onChange={(value) => updateTextField("email", value)}
                        placeholder={t("initialSetup.admin.emailPlaceholder")}
                        status={
                          shownErrors.email
                            ? { type: "error", message: shownErrors.email }
                            : undefined
                        }
                      />
                    </Grid>
                    <MediaAssetField
                      label={t("admin.settings.avatarUrl")}
                      value={form.avatarUrl}
                      onChange={(value) => updateTextField("avatarUrl", value)}
                      localFile={avatarFile}
                      localImageEditorKind="avatar"
                      onLocalFileChange={setAvatarFile}
                      folderSlug="avatars"
                      token={authToken}
                      placeholder={t("initialSetup.admin.avatarPlaceholder")}
                      previewVariant="avatar"
                      isDisabled={isLoading || isSaving}
                      status={
                        shownErrors.avatarUrl
                          ? { type: "error", message: shownErrors.avatarUrl }
                          : undefined
                      }
                    />
                    <Grid columns={{ minWidth: isNarrow ? 220 : 260, max: 2 }} gap={3}>
                      <TextInput
                        label={t("admin.settings.bioZh")}
                        value={form.bioZh}
                        onChange={(value) => updateTextField("bioZh", value)}
                        placeholder={t("initialSetup.admin.bioPlaceholder")}
                      />
                      <TextInput
                        label={t("admin.settings.bioEn")}
                        value={form.bioEn}
                        onChange={(value) => updateTextField("bioEn", value)}
                        placeholder={t("admin.settings.bioEnPlaceholder")}
                      />
                    </Grid>
                    <Tokenizer
                      label={t("admin.settings.tagsZh")}
                      value={tagZhItems}
                      searchSource={tagZhSearchSource}
                      onChange={(items) => updateTags("tagsZh", items)}
                      renderItem={renderTagItem}
                      placeholder={t("admin.settings.tagsPlaceholder")}
                      description={t("admin.settings.tagsZhDescription")}
                      hasCreate
                      hasClear
                      hasEntriesOnFocus
                      debounceMs={0}
                    />
                    <Tokenizer
                      label={t("admin.settings.tagsEn")}
                      value={tagEnItems}
                      searchSource={tagEnSearchSource}
                      onChange={(items) => updateTags("tagsEn", items)}
                      renderItem={renderTagItem}
                      placeholder={t("admin.settings.tagsEnPlaceholder")}
                      description={t("admin.settings.tagsEnDescription")}
                      hasCreate
                      hasClear
                      hasEntriesOnFocus
                      debounceMs={0}
                    />
                    <Divider />
                    <TextInput
                      label={t("admin.settings.blogUrl")}
                      value={form.blogUrl}
                      onChange={(value) => updateTextField("blogUrl", value)}
                      placeholder={t("initialSetup.admin.blogUrlPlaceholder")}
                      status={
                        shownErrors.blogUrl
                          ? { type: "error", message: shownErrors.blogUrl }
                          : undefined
                      }
                    />
                    <HStack gap={3} vAlign="center" wrap="wrap">
                      <StackItem size="fill">
                        <Text type="label">{t("admin.settings.socialLinks")}</Text>
                      </StackItem>
                      <Button
                        label={t("actions.addSocialLink")}
                        icon={<Plus size={16} />}
                        variant="secondary"
                        width={isNarrow ? "100%" : undefined}
                        onClick={addSocialLink}
                      />
                    </HStack>
                    {form.socialLinks.length === 0 && (
                      <Text type="supporting" color="secondary">
                        {t("admin.settings.socialEmpty")}
                      </Text>
                    )}
                    {form.socialLinks.map((link) => (
                      <Grid key={link.id} columns={{ minWidth: isNarrow ? 220 : 240 }} gap={3}>
                        <TextInput
                          label={t("admin.settings.linkLabel")}
                          value={link.label}
                          onChange={(value) => updateSocialLink(link.id, "label", value)}
                          placeholder={t("initialSetup.admin.linkLabelPlaceholder")}
                        />
                        <TextInput
                          label={t("admin.settings.linkUrl")}
                          value={link.url}
                          onChange={(value) => updateSocialLink(link.id, "url", value)}
                          placeholder={t("initialSetup.admin.linkUrlPlaceholder")}
                          status={
                            shownErrors[`social-${link.id}`]
                              ? { type: "error", message: shownErrors[`social-${link.id}`] }
                              : undefined
                          }
                        />
                        <HStack gap={2} vAlign="end">
                          <Button
                            label={t("actions.remove")}
                            icon={<Trash2 size={16} />}
                            variant="ghost"
                            onClick={() => removeSocialLink(link.id)}
                          />
                        </HStack>
                      </Grid>
                    ))}
                  </FormLayout>
                  <SettingsPanelSaveButton
                    isLoading={savingTarget === "profile"}
                    isDisabled={isLoading || isSaving}
                    isNarrow={isNarrow}
                    label={t("actions.save")}
                    loadingLabel={t("actions.saving")}
                    onClick={() => requestSaveConfirmation("profile")}
                  />
                </VStack>
              </Collapsible>

              <Divider />

              <Collapsible
                value="account-security"
                trigger={
                  <SettingsPanelTrigger
                    title={t("admin.settings.sections.accountSecurity")}
                    icon={<ShieldCheck size={18} />}
                  />
                }
              >
                <VStack gap={4}>
                  <Text type="supporting" color="secondary">
                    {t("admin.settings.descriptions.security")}
                  </Text>
                  <FormLayout defaultOptionality="optional">
                    <Grid columns={{ minWidth: isNarrow ? 220 : 260 }} gap={3}>
                      <TextInput
                        label={t("admin.settings.currentPassword")}
                        type="password"
                        value={form.currentPassword}
                        onChange={(value) => updateTextField("currentPassword", value)}
                        placeholder={t("admin.settings.currentPasswordPlaceholder")}
                        status={
                          shownErrors.currentPassword
                            ? { type: "error", message: shownErrors.currentPassword }
                            : undefined
                        }
                      />
                      <TextInput
                        label={t("admin.settings.newPassword")}
                        type="password"
                        value={form.newPassword}
                        onChange={(value) => updateTextField("newPassword", value)}
                        placeholder={t("admin.settings.newPasswordPlaceholder")}
                        status={
                          shownErrors.newPassword
                            ? { type: "error", message: shownErrors.newPassword }
                            : undefined
                        }
                      />
                      <TextInput
                        label={t("admin.settings.confirmPassword")}
                        type="password"
                        value={form.confirmPassword}
                        onChange={(value) => updateTextField("confirmPassword", value)}
                        placeholder={t("admin.settings.confirmPasswordPlaceholder")}
                        status={
                          shownErrors.confirmPassword
                            ? { type: "error", message: shownErrors.confirmPassword }
                            : undefined
                        }
                      />
                    </Grid>
                  </FormLayout>
                  <SettingsPanelSaveButton
                    isLoading={savingTarget === "account-security"}
                    isDisabled={isLoading || isSaving}
                    isNarrow={isNarrow}
                    label={t("actions.save")}
                    loadingLabel={t("actions.saving")}
                    onClick={() => requestSaveConfirmation("account-security")}
                  />
                </VStack>
              </Collapsible>

              <Divider />

              <Collapsible
                value="login-info"
                trigger={
                  <SettingsPanelTrigger
                    title={t("admin.settings.sections.loginInfo")}
                    icon={<MonitorCheck size={18} />}
                  />
                }
              >
                <VStack gap={3}>
                  <Text type="supporting" color="secondary">
                    {t("admin.settings.descriptions.loginInfo")}
                  </Text>
                  <Grid columns={{ minWidth: isNarrow ? 220 : 240 }} gap={3}>
                    <LoginInfoMetric
                      icon={<Clock3 size={16} />}
                      label={t("admin.settings.loginInfo.lastLogin")}
                      value={latestLoginAt}
                    />
                    <LoginInfoMetric
                      icon={<AtSign size={16} />}
                      label={t("admin.settings.loginInfo.ip")}
                      value={latestLoginIp}
                    />
                    <LoginInfoMetric
                      icon={<MapPin size={16} />}
                      label={t("admin.settings.loginInfo.location")}
                      value={latestLoginLocation}
                    />
                    <LoginInfoMetric
                      icon={<MonitorCheck size={16} />}
                      label={t("admin.settings.loginInfo.device")}
                      value={latestLoginDevice}
                    />
                    <LoginInfoMetric
                      icon={<KeyRound size={16} />}
                      label={t("admin.settings.loginInfo.methodLabel")}
                      value={latestLoginMethod}
                    />
                  </Grid>
                  <div style={LOGIN_INFO_PANEL_STYLE}>
                    <VStack gap={3}>
                      <Heading level={3}>{t("admin.settings.loginInfo.recentRecords")}</Heading>
                      {loginInfo.recentLogins.length === 0 ? (
                        <Text type="supporting" color="secondary">
                          {t("admin.settings.loginInfo.emptyRecent")}
                        </Text>
                      ) : (
                        loginInfo.recentLogins.map((event) => (
                          <div key={event.id} style={LOGIN_INFO_RECORD_STYLE}>
                            <VStack gap={2}>
                              <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
                                <Text type="body" weight="semibold">
                                  {formatLoginDateTime({
                                    fallback: emptyLoginValue,
                                    language,
                                    timeZone: event.timeZone ?? timeZone,
                                    value: event.createdAt,
                                  })}
                                </Text>
                                <Badge
                                  label={t(
                                    event.success
                                      ? "admin.settings.loginInfo.success"
                                      : "admin.settings.loginInfo.failed",
                                  )}
                                  variant={event.success ? "success" : "error"}
                                />
                              </HStack>
                              <Text type="supporting" color="secondary">
                                {getRecentLoginDetails(event)}
                              </Text>
                              {event.failureReason === null ? null : (
                                <Text type="supporting" color="secondary">
                                  {t("admin.settings.loginInfo.failureReason", {
                                    reason: event.failureReason,
                                  })}
                                </Text>
                              )}
                            </VStack>
                          </div>
                        ))
                      )}
                    </VStack>
                  </div>
                </VStack>
              </Collapsible>

              <Divider />

              <Collapsible
                value="preferences"
                trigger={
                  <SettingsPanelTrigger
                    title={t("admin.settings.sections.preferences")}
                    icon={<SlidersHorizontal size={18} />}
                  />
                }
              >
                <VStack gap={4}>
                  <Text type="supporting" color="secondary">
                    {t("admin.settings.descriptions.preferences")}
                  </Text>
                  <Grid columns={{ minWidth: isNarrow ? 220 : 260 }} gap={3}>
                    <Switch
                      label={t("initialSetup.admin.commentEmailNotifications")}
                      description={t("initialSetup.admin.commentEmailNotificationsDescription")}
                      value={form.commentEmailNotifications}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, commentEmailNotifications: value }))
                      }
                      labelPosition="start"
                      labelSpacing="spread"
                    />
                    <Switch
                      label={t("initialSetup.admin.newPostEmailNotifications")}
                      description={t("initialSetup.admin.newPostEmailNotificationsDescription")}
                      value={form.newPostEmailNotifications}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, newPostEmailNotifications: value }))
                      }
                      labelPosition="start"
                      labelSpacing="spread"
                    />
                  </Grid>
                  <SettingsPanelSaveButton
                    isLoading={savingTarget === "preferences"}
                    isDisabled={isLoading || isSaving}
                    isNarrow={isNarrow}
                    label={t("actions.save")}
                    loadingLabel={t("actions.saving")}
                    onClick={() => requestSaveConfirmation("preferences")}
                  />
                </VStack>
              </Collapsible>
            </VStack>
          </CollapsibleGroup>
        </div>
      </VStack>
      {saveConfirmationCopy !== undefined && (
        <AlertDialog
          isOpen
          title={saveConfirmationCopy.title}
          description={saveConfirmationCopy.description}
          cancelLabel={t("actions.cancel")}
          actionLabel={t("actions.save")}
          actionVariant="primary"
          isActionLoading={saveConfirmationTarget === savingTarget}
          onAction={() => {
            void handleConfirmSave();
          }}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setSaveConfirmationTarget(undefined);
            }
          }}
        />
      )}
    </>
  );
}
