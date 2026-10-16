import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { UploadProgressList, useUploadProgress } from "../../../../shared/upload-progress";
import {
  Copy,
  CloudUpload,
  ExternalLink,
  Eye,
  FileCheck2,
  Globe2,
  Image,
  KeyRound,
  Mail,
  MessageSquareText,
  Plus,
  Save,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";

import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Citation } from "@astryxdesign/core/Citation";
import { Collapsible, CollapsibleGroup } from "@astryxdesign/core/Collapsible";
import { Divider } from "@astryxdesign/core/Divider";
import { Dialog } from "@astryxdesign/core/Dialog";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { Grid } from "@astryxdesign/core/Grid";
import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Selector } from "@astryxdesign/core/Selector";
import { Switch } from "@astryxdesign/core/Switch";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";

import type {
  SiteFilingRecord,
  SiteSettings,
  SiteSettingsApiKeys,
  SiteSettingsIntegrationTestResponse,
  SiteSettingsLocalizations,
  SiteSettingsTranslation,
  UpdateSiteSettingsPayload,
} from "../../../../shared/admin-api";
import {
  getSiteSettings,
  revealSiteSettingsApiKeys,
  sendSiteSettingsApiKeyRevealCode,
  testDeepLApiKey,
  testIpGeolocationApiKey,
  testExchangeRateApiKey,
  testResendApiKey,
  updateSiteSettings,
  uploadMediaAsset,
} from "../../../../shared/admin-api";
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
import { MediaAssetField, MultiMediaAssetField } from "../components/media-asset-field";
import { TextTokenizer } from "../../../../shared/text-tokenizer";
import {
  createTimeZoneOptions,
  formatCurrentMinuteInTimeZone,
  formatTimeZoneOffset,
  getSystemTimeZone,
  isValidTimeZone,
  normalizeTimeZone,
} from "../../../../shared/time-zone";

type ErrorMap = Record<string, string>;

type IcpRecordItem = SiteFilingRecord & {
  id: string;
};

type SiteSettingsFormState = {
  siteNameZh: string;
  siteNameEn: string;
  foundedAt: string;
  siteDescriptionZh: string;
  siteDescriptionEn: string;
  coverUrls: string;
  homepageCopyZh: string;
  homepageCopyEn: string;
  lightLogoUrl: string;
  darkLogoUrl: string;
  faviconUrl: string;
  timeZone: string;
  seoTitleZh: string;
  seoTitleEn: string;
  seoDescriptionZh: string;
  seoDescriptionEn: string;
  seoKeywords: string[];
  copyright: string;
  commentsEnabled: boolean;
  resendDomain: string;
  resendApiKey: string;
  deeplApiKey: string;
  ipGeolocationApiKey: string;
  exchangeRateApiKey: string;
  r2AccessKeyId: string;
  r2AccountId: string;
  r2Bucket: string;
  r2Enabled: boolean;
  r2PublicBaseUrl: string;
  r2SecretAccessKey: string;
  resendApiKeyConfigured: boolean;
  deeplApiKeyConfigured: boolean;
  ipGeolocationApiKeyConfigured: boolean;
  exchangeRateApiKeyConfigured: boolean;
  r2SecretAccessKeyConfigured: boolean;
  icpRecords: IcpRecordItem[];
  policeRecordNumber: string;
  policeRecordUrl: string;
};

type SiteSettingsTextField =
  | "siteNameZh"
  | "siteNameEn"
  | "foundedAt"
  | "siteDescriptionZh"
  | "siteDescriptionEn"
  | "coverUrls"
  | "homepageCopyZh"
  | "homepageCopyEn"
  | "lightLogoUrl"
  | "darkLogoUrl"
  | "faviconUrl"
  | "timeZone"
  | "seoTitleZh"
  | "seoTitleEn"
  | "seoDescriptionZh"
  | "seoDescriptionEn"
  | "copyright"
  | "resendDomain"
  | "resendApiKey"
  | "deeplApiKey"
  | "ipGeolocationApiKey"
  | "exchangeRateApiKey"
  | "r2AccessKeyId"
  | "r2AccountId"
  | "r2Bucket"
  | "r2PublicBaseUrl"
  | "r2SecretAccessKey"
  | "policeRecordNumber"
  | "policeRecordUrl";

type IcpRecordField = "number" | "url";

type SiteSettingsSaveTarget = "site" | "basics" | "filings" | "storage";

type SiteSettingsIntegrationTestTarget = "deepl" | "ipGeolocation" | "resend" | "exchangeRate";

type SiteSettingsSecretKey =
  | "exchangeRateApiKey"
  | "deeplApiKey"
  | "ipGeolocationApiKey"
  | "r2SecretAccessKey"
  | "resendApiKey";

type SiteSettingsPageProps = {
  authToken: string;
  isNarrow: boolean;
  onSettingsUpdated?: (settings: SiteSettings) => void;
};

const EMPTY_ERRORS: ErrorMap = {};

const SAVE_TARGET_LABEL_KEYS: Record<SiteSettingsSaveTarget, string> = {
  site: "admin.siteSettings.sections.site",
  basics: "admin.siteSettings.sections.basics",
  filings: "admin.siteSettings.sections.filings",
  storage: "admin.siteSettings.sections.storage",
};

const SECRET_FIELD_LABEL_KEYS: Record<SiteSettingsSecretKey, string> = {
  exchangeRateApiKey: "admin.siteSettings.fields.exchangeRateApiKey",
  deeplApiKey: "initialSetup.basics.deeplApiKey",
  ipGeolocationApiKey: "initialSetup.basics.ipGeolocationApiKey",
  r2SecretAccessKey: "admin.siteSettings.fields.r2SecretAccessKey",
  resendApiKey: "initialSetup.basics.resendApiKey",
};

const API_KEY_GET_URLS: Record<SiteSettingsSecretKey, string> = {
  exchangeRateApiKey: "https://app.exchangerate-api.com/",
  deeplApiKey: "https://www.deepl.com/your-account/keys",
  ipGeolocationApiKey: "https://app.ipgeolocation.io/signup",
  r2SecretAccessKey: "https://dash.cloudflare.com/?to=/:account/r2/api-tokens",
  resendApiKey: "https://resend.com/api-keys",
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

const SECRET_FIELD_ROW_STYLE: CSSProperties = {
  alignItems: "end",
  display: "grid",
  gap: 8,
  gridTemplateColumns: "minmax(220px, 0.85fr) minmax(260px, 1.15fr) minmax(300px, 1fr)",
  width: "100%",
};

const SECRET_FIELD_ROW_NARROW_STYLE: CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "1fr",
  width: "100%",
};

const SECRET_FIELD_HEADER_STYLE: CSSProperties = {
  minHeight: 34,
};

const SECRET_FIELD_INPUT_STYLE: CSSProperties = {
  minWidth: 0,
};

const SECRET_ACTION_GRID_STYLE: CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  minWidth: 0,
  width: "100%",
};

const SECRET_VALUE_BOX_STYLE: CSSProperties = {
  background: "var(--color-bg-soft)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-container)",
  minHeight: 46,
  overflowWrap: "anywhere",
  padding: "12px 14px",
};

const SECRET_REVEAL_DIALOG_STYLE: CSSProperties = {
  maxWidth: "100%",
};

const SECRET_REVEAL_DIALOG_TITLE_STYLE: CSSProperties = {
  minWidth: 0,
};

const MAX_HOMEPAGE_COVERS = 12;

const SECRET_REVEAL_CODE_COOLDOWN_SECONDS = 60;

const DATE_TIME_MINUTE_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;

const splitValues = (raw: string) =>
  raw
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);

const createItemId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const padDateUnit = (value: number) => value.toString().padStart(2, "0");

const formatCountdown = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${padDateUnit(remainingSeconds)}`;
};

const isValidMinuteTimestamp = (value: string) => {
  const match = DATE_TIME_MINUTE_PATTERN.exec(value);
  if (match === null) {
    return false;
  }

  const [, yearText = "", monthText = "", dayText = "", hourText = "", minuteText = ""] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const date = new Date(year, month - 1, day, hour, minute);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute
  );
};

const isValidUrl = (value: string) => {
  const trimmedValue = value.trim();
  if (trimmedValue.startsWith("/") && !trimmedValue.startsWith("//")) {
    return true;
  }

  try {
    new URL(trimmedValue);
    return true;
  } catch {
    return false;
  }
};

const addUrlError = (errors: ErrorMap, key: string, value: string, message: string) => {
  const trimmedValue = value.trim();
  if (trimmedValue.length > 0 && !isValidUrl(trimmedValue)) {
    errors[key] = message;
  }
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const toIcpRecordItems = (records: SiteFilingRecord[]) => {
  if (records.length === 0) {
    return [{ id: "icp-main", number: "", url: "" }];
  }

  return records.map((record) => ({
    id: createItemId("icp"),
    number: record.number,
    url: record.url,
  }));
};

const getSiteLocalizations = (settings: SiteSettings): SiteSettingsLocalizations => ({
  zhCN: {
    siteName: settings.siteLocalizations.zhCN.siteName || settings.site.siteName,
    siteDescription:
      settings.siteLocalizations.zhCN.siteDescription || settings.site.siteDescription,
    homepageCopy: settings.siteLocalizations.zhCN.homepageCopy || settings.site.homepageCopy,
    seoTitle: settings.siteLocalizations.zhCN.seoTitle || settings.basics.seoTitle,
    seoDescription:
      settings.siteLocalizations.zhCN.seoDescription || settings.basics.seoDescription,
  },
  en: settings.siteLocalizations.en,
});

const createFormState = (settings: SiteSettings): SiteSettingsFormState => {
  const localizations = getSiteLocalizations(settings);
  const timeZone = normalizeTimeZone(settings.site.timeZone);

  return {
    siteNameZh: localizations.zhCN.siteName,
    siteNameEn: localizations.en.siteName,
    foundedAt: settings.site.foundedAt || formatCurrentMinuteInTimeZone(timeZone),
    siteDescriptionZh: localizations.zhCN.siteDescription,
    siteDescriptionEn: localizations.en.siteDescription,
    coverUrls: settings.site.coverUrls.join("\n"),
    homepageCopyZh: localizations.zhCN.homepageCopy,
    homepageCopyEn: localizations.en.homepageCopy,
    lightLogoUrl: settings.site.lightLogoUrl,
    darkLogoUrl: settings.site.darkLogoUrl,
    faviconUrl: settings.site.faviconUrl,
    timeZone,
    seoTitleZh: localizations.zhCN.seoTitle,
    seoTitleEn: localizations.en.seoTitle,
    seoDescriptionZh: localizations.zhCN.seoDescription,
    seoDescriptionEn: localizations.en.seoDescription,
    seoKeywords: [...settings.basics.seoKeywords],
    copyright: settings.basics.copyright,
    commentsEnabled: settings.basics.commentsEnabled,
    resendDomain: settings.basics.resendDomain,
    resendApiKey: "",
    deeplApiKey: "",
    ipGeolocationApiKey: "",
    exchangeRateApiKey: "",
    r2AccessKeyId: settings.storage.r2AccessKeyId,
    r2AccountId: settings.storage.r2AccountId,
    r2Bucket: settings.storage.r2Bucket,
    r2Enabled: settings.storage.r2Enabled,
    r2PublicBaseUrl: settings.storage.r2PublicBaseUrl,
    r2SecretAccessKey: "",
    resendApiKeyConfigured: settings.basics.resendApiKeyConfigured,
    deeplApiKeyConfigured: settings.basics.deeplApiKeyConfigured,
    ipGeolocationApiKeyConfigured: settings.basics.ipGeolocationApiKeyConfigured,
    exchangeRateApiKeyConfigured: settings.basics.exchangeRateApiKeyConfigured ?? false,
    r2SecretAccessKeyConfigured: settings.storage.r2SecretAccessKeyConfigured,
    icpRecords: toIcpRecordItems(settings.filings.icpRecords),
    policeRecordNumber: settings.filings.policeRecordNumber,
    policeRecordUrl: settings.filings.policeRecordUrl,
  };
};

const createEmptyFormState = (): SiteSettingsFormState =>
  createFormState({
    siteLocalizations: {
      zhCN: {
        siteName: "",
        siteDescription: "",
        homepageCopy: "",
        seoTitle: "",
        seoDescription: "",
      },
      en: {
        siteName: "",
        siteDescription: "",
        homepageCopy: "",
        seoTitle: "",
        seoDescription: "",
      },
    },
    site: {
      siteName: "",
      foundedAt: formatCurrentMinuteInTimeZone(getSystemTimeZone()),
      siteDescription: "",
      coverUrls: [],
      homepageCopy: "",
      lightLogoUrl: "",
      darkLogoUrl: "",
      faviconUrl: "",
      timeZone: getSystemTimeZone(),
    },
    basics: {
      seoTitle: "",
      seoDescription: "",
      seoKeywords: [],
      copyright: "",
      commentsEnabled: true,
      resendDomain: "",
      resendApiKeyConfigured: false,
      deeplApiKeyConfigured: false,
      ipGeolocationApiKeyConfigured: false,
    },
    filings: {
      icpRecords: [],
      policeRecordNumber: "",
      policeRecordUrl: "",
    },
    storage: {
      r2AccessKeyId: "",
      r2AccountId: "",
      r2Bucket: "",
      r2Enabled: false,
      r2PublicBaseUrl: "",
      r2SecretAccessKeyConfigured: false,
    },
  });

type SiteSettingsSummaryCardProps = {
  label: string;
  value: string;
  icon: ReactNode;
};

const SiteSettingsSummaryCard = ({ label, value, icon }: SiteSettingsSummaryCardProps) => {
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

type SiteSettingsPanelTriggerProps = {
  title: string;
  icon: ReactNode;
};

const SiteSettingsPanelTrigger = ({ title, icon }: SiteSettingsPanelTriggerProps) => {
  return (
    <HStack gap={2} vAlign="center">
      {icon}
      <Text type="body" weight="semibold">
        {title}
      </Text>
    </HStack>
  );
};

type SiteSettingsPanelSaveButtonProps = {
  isDisabled?: boolean;
  isLoading: boolean;
  isNarrow: boolean;
  label: string;
  loadingLabel: string;
  onClick: () => void;
};

const SiteSettingsPanelSaveButton = ({
  isDisabled = false,
  isLoading,
  isNarrow,
  label,
  loadingLabel,
  onClick,
}: SiteSettingsPanelSaveButtonProps) => {
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

type SecretTestFieldProps = {
  configured: boolean;
  configuredLabel: string;
  getLabel: string;
  getUrl: string;
  isDisabled: boolean;
  isLoading: boolean;
  isNarrow: boolean;
  label: string;
  notConfiguredLabel: string;
  onChange: (value: string) => void;
  onRevealSaved: () => void;
  onTest: () => void;
  placeholder: string;
  revealSavedLabel: string;
  testLabel: string;
  testingLabel: string;
  value: string;
};

const SecretTestField = ({
  configured,
  configuredLabel,
  getLabel,
  getUrl,
  isDisabled,
  isLoading,
  isNarrow,
  label,
  notConfiguredLabel,
  onChange,
  onRevealSaved,
  onTest,
  placeholder,
  revealSavedLabel,
  testLabel,
  testingLabel,
  value,
}: SecretTestFieldProps) => {
  return (
    <div style={isNarrow ? SECRET_FIELD_ROW_NARROW_STYLE : SECRET_FIELD_ROW_STYLE}>
      <HStack
        gap={2}
        hAlign="between"
        style={SECRET_FIELD_HEADER_STYLE}
        vAlign="center"
        wrap="wrap"
      >
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">{label}</Text>
          <Badge
            variant={configured ? "success" : "neutral"}
            label={configured ? configuredLabel : notConfiguredLabel}
          />
        </HStack>
        <Citation
          number={1}
          variant="label"
          source={{
            icon: <ExternalLink size={12} />,
            title: getLabel,
            url: getUrl,
          }}
        />
      </HStack>
      <div style={SECRET_FIELD_INPUT_STYLE}>
        <TextInput
          label={label}
          isLabelHidden
          startIcon={<KeyRound size={16} />}
          type="password"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />
      </div>
      <div style={SECRET_ACTION_GRID_STYLE}>
        <Button
          label={revealSavedLabel}
          icon={<Eye size={16} />}
          variant="secondary"
          width="100%"
          isDisabled={isDisabled || !configured}
          onClick={onRevealSaved}
        />
        <Button
          label={isLoading ? testingLabel : testLabel}
          icon={<Search size={16} />}
          variant="secondary"
          width="100%"
          isLoading={isLoading}
          isDisabled={isDisabled}
          onClick={onTest}
        />
      </div>
    </div>
  );
};

type SecretRevealFieldProps = {
  configured: boolean;
  configuredLabel: string;
  getLabel: string;
  getUrl: string;
  isDisabled: boolean;
  isNarrow: boolean;
  label: string;
  notConfiguredLabel: string;
  onChange: (value: string) => void;
  onRevealSaved: () => void;
  placeholder: string;
  revealSavedLabel: string;
  value: string;
};

const SecretRevealField = ({
  configured,
  configuredLabel,
  getLabel,
  getUrl,
  isDisabled,
  isNarrow,
  label,
  notConfiguredLabel,
  onChange,
  onRevealSaved,
  placeholder,
  revealSavedLabel,
  value,
}: SecretRevealFieldProps) => {
  return (
    <div style={isNarrow ? SECRET_FIELD_ROW_NARROW_STYLE : SECRET_FIELD_ROW_STYLE}>
      <HStack
        gap={2}
        hAlign="between"
        style={SECRET_FIELD_HEADER_STYLE}
        vAlign="center"
        wrap="wrap"
      >
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Text type="label">{label}</Text>
          <Badge
            variant={configured ? "success" : "neutral"}
            label={configured ? configuredLabel : notConfiguredLabel}
          />
        </HStack>
        <Citation
          number={1}
          variant="label"
          source={{
            icon: <ExternalLink size={12} />,
            title: getLabel,
            url: getUrl,
          }}
        />
      </HStack>
      <div style={SECRET_FIELD_INPUT_STYLE}>
        <TextInput
          label={label}
          isLabelHidden
          startIcon={<KeyRound size={16} />}
          type="password"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />
      </div>
      <Button
        label={revealSavedLabel}
        icon={<Eye size={16} />}
        variant="secondary"
        width="100%"
        isDisabled={isDisabled || !configured}
        onClick={onRevealSaved}
      />
    </div>
  );
};

type SecretValuePanelProps = {
  emptyLabel: string;
  label: string;
  value: string;
};

const SecretValuePanel = ({ emptyLabel, label, value }: SecretValuePanelProps) => (
  <VStack gap={2}>
    <Text type="label">{label}</Text>
    <div style={SECRET_VALUE_BOX_STYLE}>
      <Text type="body" color={value.length > 0 ? "primary" : "secondary"}>
        {value.length > 0 ? value : emptyLabel}
      </Text>
    </div>
  </VStack>
);

export function SiteSettingsPage({
  authToken,
  isNarrow,
  onSettingsUpdated,
}: SiteSettingsPageProps) {
  const { i18n, t } = useTranslation();
  const { uploads, onUploadProgress } = useUploadProgress();
  const [form, setForm] = useState(createEmptyFormState);
  const [isLoading, setIsLoading] = useState(true);
  const [savingTarget, setSavingTarget] = useState<SiteSettingsSaveTarget>();
  const [saveConfirmationTarget, setSaveConfirmationTarget] = useState<SiteSettingsSaveTarget>();
  const [testingTarget, setTestingTarget] = useState<SiteSettingsIntegrationTestTarget>();
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<AdminFeedbackBannerState>();
  const [coverFiles, setCoverFiles] = useState<File[]>([]);
  const [lightLogoFile, setLightLogoFile] = useState<File>();
  const [darkLogoFile, setDarkLogoFile] = useState<File>();
  const [faviconFile, setFaviconFile] = useState<File>();
  const [revealingSecretKey, setRevealingSecretKey] = useState<SiteSettingsSecretKey>();
  const [revealEmailCode, setRevealEmailCode] = useState("");
  const [revealCodeSendCooldownSeconds, setRevealCodeSendCooldownSeconds] = useState(0);
  const [revealCodeExpiresAt, setRevealCodeExpiresAt] = useState<string>();
  const [revealCountdownSeconds, setRevealCountdownSeconds] = useState(0);
  const [revealedApiKeys, setRevealedApiKeys] = useState<SiteSettingsApiKeys>();
  const [isRevealCodeSending, setIsRevealCodeSending] = useState(false);
  const [isRevealingApiKey, setIsRevealingApiKey] = useState(false);
  const activeLocale = i18n.language.toLowerCase().startsWith("en") ? "en" : "zh-CN";
  const { dialog: revealAltchaDialog, runWithAltcha: runRevealWithAltcha } =
    useAltchaVerificationDialog({
      copy: getAltchaVerificationDialogCopy(activeLocale),
      language: activeLocale,
      onFeedback: (feedback) => setFeedbackBanner(createAdminFeedbackBanner(feedback)),
    });

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      setIsLoading(true);
      setFeedbackBanner(undefined);

      try {
        const settings = await getSiteSettings(authToken);
        if (!isMounted) {
          return;
        }

        setForm(createFormState(settings));
        setCoverFiles([]);
        setLightLogoFile(undefined);
        setDarkLogoFile(undefined);
        setFaviconFile(undefined);
        onSettingsUpdated?.(settings);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message = getErrorMessage(error, t("admin.siteSettings.toast.loadFailed"));
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
  }, [authToken, onSettingsUpdated, t]);

  useEffect(() => {
    if (revealCodeExpiresAt === undefined) {
      setRevealCountdownSeconds(0);
      return undefined;
    }

    const updateCountdown = () => {
      const expiresAt = new Date(revealCodeExpiresAt).getTime();
      const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setRevealCountdownSeconds(seconds);
    };

    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [revealCodeExpiresAt]);

  useEffect(() => {
    if (revealCodeSendCooldownSeconds <= 0) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setRevealCodeSendCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [revealCodeSendCooldownSeconds]);

  const coverUrlValues = useMemo(() => splitValues(form.coverUrls), [form.coverUrls]);
  const timeZoneOptions = useMemo(
    () => createTimeZoneOptions({ selectedTimeZone: form.timeZone }),
    [form.timeZone],
  );
  const visibleIcpRecords = useMemo(
    () =>
      form.icpRecords.filter(
        (record) => record.number.trim().length > 0 || record.url.trim().length > 0,
      ),
    [form.icpRecords],
  );
  const isSaving = savingTarget !== undefined;
  const saveConfirmationCopy =
    saveConfirmationTarget === undefined
      ? undefined
      : {
          title: t("admin.siteSettings.confirmSave.title", {
            section: t(SAVE_TARGET_LABEL_KEYS[saveConfirmationTarget]),
          }),
          description: t("admin.siteSettings.confirmSave.description", {
            section: t(SAVE_TARGET_LABEL_KEYS[saveConfirmationTarget]),
          }),
        };

  const errors = useMemo(() => {
    const nextErrors: ErrorMap = {};

    if (form.foundedAt.trim().length > 0 && !isValidMinuteTimestamp(form.foundedAt.trim())) {
      nextErrors.foundedAt = t("initialSetup.validation.minuteTimestampInvalid");
    }
    if (!isValidTimeZone(form.timeZone)) {
      nextErrors.timeZone = t("initialSetup.validation.timeZoneInvalid");
    }

    coverUrlValues.forEach((url, index) => {
      addUrlError(
        nextErrors,
        "coverUrls",
        url,
        t("initialSetup.validation.coverInvalid", { index: index + 1 }),
      );
    });

    addUrlError(
      nextErrors,
      "lightLogoUrl",
      form.lightLogoUrl,
      t("initialSetup.validation.lightLogoInvalid"),
    );
    addUrlError(
      nextErrors,
      "darkLogoUrl",
      form.darkLogoUrl,
      t("initialSetup.validation.darkLogoInvalid"),
    );
    addUrlError(
      nextErrors,
      "faviconUrl",
      form.faviconUrl,
      t("initialSetup.validation.faviconInvalid"),
    );

    form.icpRecords.forEach((record) => {
      addUrlError(
        nextErrors,
        `icp-${record.id}`,
        record.url,
        t("initialSetup.validation.icpInvalid"),
      );
    });
    addUrlError(
      nextErrors,
      "policeRecordUrl",
      form.policeRecordUrl,
      t("initialSetup.validation.policeInvalid"),
    );
    addUrlError(
      nextErrors,
      "r2PublicBaseUrl",
      form.r2PublicBaseUrl,
      t("admin.siteSettings.validation.r2PublicBaseUrlInvalid"),
    );

    return nextErrors;
  }, [
    coverUrlValues,
    form.darkLogoUrl,
    form.faviconUrl,
    form.foundedAt,
    form.icpRecords,
    form.lightLogoUrl,
    form.policeRecordUrl,
    form.r2PublicBaseUrl,
    form.timeZone,
    t,
  ]);

  const shownErrors = hasAttemptedSubmit ? errors : EMPTY_ERRORS;
  const isTesting = testingTarget !== undefined;

  const getActiveLocale = () => activeLocale;

  const updateTextField = (field: SiteSettingsTextField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateIcpRecord = (id: string, field: IcpRecordField, value: string) => {
    setForm((current) => ({
      ...current,
      icpRecords: current.icpRecords.map((record) =>
        record.id === id ? { ...record, [field]: value } : record,
      ),
    }));
  };

  const addIcpRecord = () => {
    setForm((current) => ({
      ...current,
      icpRecords: [...current.icpRecords, { id: createItemId("icp"), number: "", url: "" }],
    }));
  };

  const removeIcpRecord = (id: string) => {
    setForm((current) => {
      const nextRecords = current.icpRecords.filter((record) => record.id !== id);

      return {
        ...current,
        icpRecords:
          nextRecords.length > 0 ? nextRecords : [{ id: createItemId("icp"), number: "", url: "" }],
      };
    });
  };

  const createIntegrationTestSuccessBanner = (result: SiteSettingsIntegrationTestResponse) =>
    createAdminFeedbackBanner({
      ...(result.details === undefined ? {} : { description: result.details }),
      status: "success",
      title: result.message,
    });

  const runIntegrationTest = async (target: SiteSettingsIntegrationTestTarget) => {
    const locale = getActiveLocale();
    setFeedbackBanner(undefined);
    setTestingTarget(target);

    try {
      const result =
        target === "resend"
          ? await testResendApiKey({
              locale,
              resendApiKey: form.resendApiKey,
              resendDomain: form.resendDomain,
              token: authToken,
            })
          : target === "deepl"
            ? await testDeepLApiKey({
                apiKey: form.deeplApiKey,
                locale,
                token: authToken,
              })
            : target === "exchangeRate"
              ? await testExchangeRateApiKey({
                  apiKey: form.exchangeRateApiKey,
                  locale,
                  token: authToken,
                })
              : await testIpGeolocationApiKey({
                  apiKey: form.ipGeolocationApiKey,
                  locale,
                  token: authToken,
                });

      setFeedbackBanner(createIntegrationTestSuccessBanner(result));
    } catch (error) {
      const message = getErrorMessage(error, t("admin.siteSettings.secret.testFailed"));
      setFeedbackBanner(createAdminFeedbackBanner({ status: "error", title: message }));
    } finally {
      setTestingTarget(undefined);
    }
  };

  const openSecretRevealDialog = (key: SiteSettingsSecretKey) => {
    setRevealingSecretKey(key);
    setRevealEmailCode("");
    setRevealCodeExpiresAt(undefined);
    setRevealedApiKeys(undefined);
  };

  const closeSecretRevealDialog = () => {
    setRevealingSecretKey(undefined);
    setRevealEmailCode("");
    setRevealCodeExpiresAt(undefined);
    setRevealedApiKeys(undefined);
  };

  const sendRevealCode = async () => {
    if (revealCodeSendCooldownSeconds > 0 || isRevealCodeSending) {
      return;
    }
    setFeedbackBanner(undefined);
    setIsRevealCodeSending(true);

    try {
      const action = await runRevealWithAltcha({
        runAction: (altcha) =>
          sendSiteSettingsApiKeyRevealCode({
            altcha,
            locale: activeLocale,
            token: authToken,
          }),
        successMessage: (result) =>
          getAltchaSuccessMessage(activeLocale, result.sent ? "email-code" : "email-code-request"),
      });
      if (action.status === "cancelled") {
        return;
      }
      const result = action.value;
      setRevealCodeExpiresAt(result.expiresAt);
      setRevealCodeSendCooldownSeconds(SECRET_REVEAL_CODE_COOLDOWN_SECONDS);
    } catch (error) {
      const message = getErrorMessage(error, t("admin.siteSettings.secret.revealFailed"));
      setFeedbackBanner(createAdminFeedbackBanner({ status: "error", title: message }));
    } finally {
      setIsRevealCodeSending(false);
    }
  };

  const revealSavedApiKeys = async () => {
    if (revealingSecretKey === undefined) {
      return;
    }

    if (revealEmailCode.trim().length === 0) {
      setFeedbackBanner(
        createAdminFeedbackBanner({
          status: "error",
          title: t("admin.siteSettings.secret.codeRequired"),
        }),
      );
      return;
    }

    const label = t(SECRET_FIELD_LABEL_KEYS[revealingSecretKey]);
    setFeedbackBanner(undefined);
    setIsRevealingApiKey(true);

    try {
      const result = await revealSiteSettingsApiKeys({
        emailCode: revealEmailCode,
        locale: getActiveLocale(),
        token: authToken,
      });
      setRevealedApiKeys(result.item);
      setFeedbackBanner(
        createAdminFeedbackBanner({
          status: "success",
          title: t("admin.siteSettings.secret.revealSuccess", { label }),
        }),
      );
    } catch (error) {
      const message = getErrorMessage(error, t("admin.siteSettings.secret.revealFailed"));
      setFeedbackBanner(createAdminFeedbackBanner({ status: "error", title: message }));
    } finally {
      setIsRevealingApiKey(false);
    }
  };

  const copyRevealedSecret = async (value: string) => {
    if (value.length === 0) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setFeedbackBanner(
        createAdminFeedbackBanner({
          status: "success",
          title: t("admin.siteSettings.secret.copied"),
        }),
      );
    } catch {
      setFeedbackBanner(
        createAdminFeedbackBanner({
          status: "error",
          title: t("admin.siteSettings.secret.copyFailed"),
        }),
      );
    }
  };

  type CreatePayloadParameters = {
    targetCoverUrlValues?: string[];
    targetForm?: SiteSettingsFormState;
  };

  const createPayload = ({
    targetCoverUrlValues,
    targetForm = form,
  }: CreatePayloadParameters = {}): UpdateSiteSettingsPayload => ({
    siteLocalizations: {
      zhCN: {
        siteName: targetForm.siteNameZh.trim(),
        siteDescription: targetForm.siteDescriptionZh.trim(),
        homepageCopy: targetForm.homepageCopyZh.trim(),
        seoTitle: targetForm.seoTitleZh.trim(),
        seoDescription: targetForm.seoDescriptionZh.trim(),
      },
      en: {
        siteName: targetForm.siteNameEn.trim(),
        siteDescription: targetForm.siteDescriptionEn.trim(),
        homepageCopy: targetForm.homepageCopyEn.trim(),
        seoTitle: targetForm.seoTitleEn.trim(),
        seoDescription: targetForm.seoDescriptionEn.trim(),
      },
    },
    site: {
      foundedAt: targetForm.foundedAt.trim(),
      coverUrls: targetCoverUrlValues ?? splitValues(targetForm.coverUrls),
      lightLogoUrl: targetForm.lightLogoUrl.trim(),
      darkLogoUrl: targetForm.darkLogoUrl.trim(),
      faviconUrl: targetForm.faviconUrl.trim(),
      timeZone: normalizeTimeZone(targetForm.timeZone),
    },
    basics: {
      seoKeywords: targetForm.seoKeywords,
      copyright: targetForm.copyright.trim(),
      commentsEnabled: targetForm.commentsEnabled,
      resendDomain: targetForm.resendDomain.trim(),
      resendApiKey: targetForm.resendApiKey.trim(),
      deeplApiKey: targetForm.deeplApiKey.trim(),
      ipGeolocationApiKey: targetForm.ipGeolocationApiKey.trim(),
      exchangeRateApiKey: targetForm.exchangeRateApiKey.trim(),
    },
    filings: {
      icpRecords: targetForm.icpRecords
        .map((record) => ({
          number: record.number.trim(),
          url: record.url.trim(),
        }))
        .filter((record) => record.number.length > 0 || record.url.length > 0),
      policeRecordNumber: targetForm.policeRecordNumber.trim(),
      policeRecordUrl: targetForm.policeRecordUrl.trim(),
    },
    storage: {
      r2AccessKeyId: targetForm.r2AccessKeyId.trim(),
      r2AccountId: targetForm.r2AccountId.trim(),
      r2Bucket: targetForm.r2Bucket.trim(),
      r2Enabled: targetForm.r2Enabled,
      r2PublicBaseUrl: targetForm.r2PublicBaseUrl.trim(),
      r2SecretAccessKey: targetForm.r2SecretAccessKey.trim(),
    },
  });

  const createSaveSuccessBanner = (siteTranslation?: SiteSettingsTranslation) => {
    const title = t("admin.siteSettings.toast.saveSuccess");
    if (siteTranslation === undefined || siteTranslation.status === "not-needed") {
      return createAdminFeedbackBanner({
        status: "success",
        title,
      });
    }

    const targetLocales = siteTranslation.targetLocales ?? [siteTranslation.targetLocale];
    const targetLanguage = t(
      targetLocales.length > 1
        ? "admin.settings.translationTarget.both"
        : targetLocales[0] === "en"
          ? "admin.settings.translationTarget.english"
          : "admin.settings.translationTarget.chinese",
    );

    switch (siteTranslation.status) {
      case "completed":
        return createAdminFeedbackBanner({
          description: t("admin.siteSettings.translation.completed", {
            language: targetLanguage,
          }),
          status: "success",
          title,
        });
      case "missing-api-key":
        return createAdminFeedbackBanner({
          description: t("admin.siteSettings.translation.missingApiKey", {
            language: targetLanguage,
          }),
          status: "warning",
          title,
        });
      case "incomplete":
        return createAdminFeedbackBanner({
          description: t("admin.siteSettings.translation.incomplete", {
            language: targetLanguage,
          }),
          status: "warning",
          title,
        });
      default: {
        const exhaustiveStatus: never = siteTranslation.status;
        throw new Error("Unhandled site translation status.", { cause: exhaustiveStatus });
      }
    }
  };

  const uploadSiteFile = async (file: File) => {
    const uploadedAsset = await uploadMediaAsset({
      onUploadProgress,
      file,
      folderSlug: "site",
      token: authToken,
    });

    return uploadedAsset.accessUrl;
  };

  const saveSettings = async (target: SiteSettingsSaveTarget): Promise<boolean> => {
    setHasAttemptedSubmit(true);
    setFeedbackBanner(undefined);

    if (Object.keys(errors).length > 0) {
      return false;
    }

    setSavingTarget(target);
    try {
      let targetForm = form;
      let targetCoverUrlValues = coverUrlValues;

      if (target === "site") {
        const uploadedCoverUrls =
          coverFiles.length > 0 ? await Promise.all(coverFiles.map(uploadSiteFile)) : [];
        const uploadedLightLogoUrl =
          lightLogoFile === undefined ? undefined : await uploadSiteFile(lightLogoFile);
        const uploadedDarkLogoUrl =
          darkLogoFile === undefined ? undefined : await uploadSiteFile(darkLogoFile);
        const uploadedFaviconUrl =
          faviconFile === undefined ? undefined : await uploadSiteFile(faviconFile);

        targetCoverUrlValues = [...coverUrlValues, ...uploadedCoverUrls];
        targetForm = {
          ...form,
          coverUrls: targetCoverUrlValues.join("\n"),
          darkLogoUrl: uploadedDarkLogoUrl ?? form.darkLogoUrl,
          faviconUrl: uploadedFaviconUrl ?? form.faviconUrl,
          lightLogoUrl: uploadedLightLogoUrl ?? form.lightLogoUrl,
        };

        if (
          uploadedCoverUrls.length > 0 ||
          uploadedLightLogoUrl !== undefined ||
          uploadedDarkLogoUrl !== undefined ||
          uploadedFaviconUrl !== undefined
        ) {
          setForm(targetForm);
          setCoverFiles([]);
          setLightLogoFile(undefined);
          setDarkLogoFile(undefined);
          setFaviconFile(undefined);
        }
      }

      const settings = await updateSiteSettings({
        locale: getActiveLocale(),
        token: authToken,
        payload: createPayload({ targetCoverUrlValues, targetForm }),
      });

      setForm(createFormState(settings));
      if (target === "site") {
        setCoverFiles([]);
        setLightLogoFile(undefined);
        setDarkLogoFile(undefined);
        setFaviconFile(undefined);
      }
      onSettingsUpdated?.(settings);
      setFeedbackBanner(createSaveSuccessBanner(settings.siteTranslation));
      return true;
    } catch (error) {
      const message = getErrorMessage(error, t("admin.siteSettings.toast.saveFailed"));
      setFeedbackBanner(createAdminFeedbackBanner({ status: "error", title: message }));
      return false;
    } finally {
      setSavingTarget(undefined);
    }
  };

  const requestSaveConfirmation = (target: SiteSettingsSaveTarget) => {
    setSaveConfirmationTarget(target);
  };

  const handleConfirmSave = async () => {
    if (saveConfirmationTarget === undefined) {
      return;
    }

    const target = saveConfirmationTarget;
    setSaveConfirmationTarget(undefined);
    await saveSettings(target);
  };

  const revealingSecretLabel =
    revealingSecretKey === undefined ? "" : t(SECRET_FIELD_LABEL_KEYS[revealingSecretKey]);
  const revealDialogTitle = t("admin.siteSettings.secret.revealTitle", {
    label: revealingSecretLabel,
  });
  const revealedSecretValue =
    revealingSecretKey === undefined || revealedApiKeys === undefined
      ? ""
      : (revealedApiKeys[revealingSecretKey] ?? "");
  const isRevealCodeCoolingDown = revealCodeSendCooldownSeconds > 0;
  const sendRevealCodeLabel = isRevealCodeCoolingDown
    ? t("admin.siteSettings.secret.sendCodeCountdown", {
        time: formatCountdown(revealCodeSendCooldownSeconds),
      })
    : t("admin.siteSettings.secret.sendCode");
  const revealCountdownText =
    revealCodeExpiresAt === undefined
      ? undefined
      : revealCountdownSeconds > 0
        ? t("admin.siteSettings.secret.codeCountdown", {
            time: formatCountdown(revealCountdownSeconds),
          })
        : t("admin.siteSettings.secret.codeExpired");

  return (
    <>
      {revealAltchaDialog}
      <AdminFeedbackBanner banner={feedbackBanner} onDismiss={() => setFeedbackBanner(undefined)} />
      <VStack gap={5}>
        {isLoading && (
          <HStack gap={2} vAlign="center">
            <Spinner label={t("admin.siteSettings.loading")} />
            <Text type="supporting" color="secondary">
              {t("admin.siteSettings.loading")}
            </Text>
          </HStack>
        )}

        <Grid columns={{ minWidth: isNarrow ? 220 : 260, max: 3 }} gap={isNarrow ? 3 : 4}>
          <SiteSettingsSummaryCard
            label={t("admin.siteSettings.summary.siteName")}
            value={form.siteNameZh.trim() || t("common.notProvided")}
            icon={<Globe2 size={16} />}
          />
          <SiteSettingsSummaryCard
            label={t("admin.siteSettings.summary.comments")}
            value={t(form.commentsEnabled ? "common.enabled" : "common.disabled")}
            icon={<MessageSquareText size={16} />}
          />
          <SiteSettingsSummaryCard
            label={t("admin.siteSettings.summary.icpRecords")}
            value={t("initialSetup.summary.icpCount", { count: visibleIcpRecords.length })}
            icon={<FileCheck2 size={16} />}
          />
        </Grid>

        <div style={PANEL_GROUP_FRAME_STYLE}>
          <CollapsibleGroup type="single">
            <VStack gap={3}>
              <Collapsible
                value="site"
                trigger={
                  <SiteSettingsPanelTrigger
                    title={t("admin.siteSettings.sections.site")}
                    icon={<Image size={18} />}
                  />
                }
              >
                <VStack gap={4}>
                  <Text type="supporting" color="secondary">
                    {t("admin.siteSettings.descriptions.site")}
                  </Text>
                  <FormLayout defaultOptionality="optional">
                    <Grid columns={{ minWidth: isNarrow ? 220 : 220, max: 3 }} gap={3}>
                      <TextInput
                        label={t("admin.siteSettings.fields.siteNameZh")}
                        value={form.siteNameZh}
                        onChange={(value) => updateTextField("siteNameZh", value)}
                        placeholder={t("initialSetup.site.siteNamePlaceholder")}
                      />
                      <TextInput
                        label={t("admin.siteSettings.fields.siteNameEn")}
                        value={form.siteNameEn}
                        onChange={(value) => updateTextField("siteNameEn", value)}
                        placeholder={t("admin.siteSettings.placeholders.siteNameEn")}
                      />
                      <HStack gap={2} vAlign="end" wrap="wrap">
                        <StackItem size="fill">
                          <TextInput
                            label={t("initialSetup.site.foundedAt")}
                            value={form.foundedAt}
                            onChange={(value) => updateTextField("foundedAt", value)}
                            placeholder={t("initialSetup.site.foundedAtPlaceholder")}
                            status={
                              shownErrors.foundedAt
                                ? { type: "error", message: shownErrors.foundedAt }
                                : undefined
                            }
                          />
                        </StackItem>
                        <Button
                          label={t("actions.now")}
                          variant="secondary"
                          width={isNarrow ? "100%" : undefined}
                          onClick={() =>
                            updateTextField(
                              "foundedAt",
                              formatCurrentMinuteInTimeZone(form.timeZone),
                            )
                          }
                        />
                      </HStack>
                      <HStack gap={2} vAlign="end" wrap="wrap">
                        <StackItem size="fill">
                          <Selector
                            label={t("initialSetup.site.timeZone")}
                            options={timeZoneOptions}
                            value={form.timeZone}
                            onChange={(value) => updateTextField("timeZone", value)}
                            hasSearch
                            searchPlaceholder={t("initialSetup.site.timeZoneSearch")}
                            description={t("initialSetup.site.timeZoneDescription", {
                              offset: formatTimeZoneOffset({ timeZone: form.timeZone }),
                            })}
                            status={
                              shownErrors.timeZone
                                ? { type: "error", message: shownErrors.timeZone }
                                : undefined
                            }
                          />
                        </StackItem>
                        <Button
                          label={t("initialSetup.site.useSystemTimeZone")}
                          variant="secondary"
                          width={isNarrow ? "100%" : undefined}
                          onClick={() => updateTextField("timeZone", getSystemTimeZone())}
                        />
                      </HStack>
                    </Grid>
                    <Grid columns={{ minWidth: isNarrow ? 220 : 260, max: 2 }} gap={3}>
                      <TextArea
                        label={t("admin.siteSettings.fields.siteDescriptionZh")}
                        rows={3}
                        value={form.siteDescriptionZh}
                        onChange={(value) => updateTextField("siteDescriptionZh", value)}
                        placeholder={t("initialSetup.site.descriptionPlaceholder")}
                      />
                      <TextArea
                        label={t("admin.siteSettings.fields.siteDescriptionEn")}
                        rows={3}
                        value={form.siteDescriptionEn}
                        onChange={(value) => updateTextField("siteDescriptionEn", value)}
                        placeholder={t("admin.siteSettings.placeholders.siteDescriptionEn")}
                      />
                    </Grid>
                    <MultiMediaAssetField
                      label={t("initialSetup.site.covers")}
                      values={coverUrlValues}
                      localFiles={coverFiles}
                      maxItems={MAX_HOMEPAGE_COVERS}
                      folderSlug="site"
                      token={authToken}
                      onChange={(values) => updateTextField("coverUrls", values.join("\n"))}
                      onLocalFilesChange={setCoverFiles}
                      placeholder={t("admin.siteSettings.coverPreview.draftPlaceholder")}
                      isDisabled={isLoading || isSaving}
                      status={
                        shownErrors.coverUrls
                          ? { type: "error", message: shownErrors.coverUrls }
                          : undefined
                      }
                    />
                    <Grid columns={{ minWidth: isNarrow ? 220 : 260, max: 2 }} gap={3}>
                      <TextArea
                        label={t("admin.siteSettings.fields.homepageCopyZh")}
                        rows={4}
                        value={form.homepageCopyZh}
                        onChange={(value) => updateTextField("homepageCopyZh", value)}
                        placeholder={t("initialSetup.site.homepageCopyPlaceholder")}
                      />
                      <TextArea
                        label={t("admin.siteSettings.fields.homepageCopyEn")}
                        rows={4}
                        value={form.homepageCopyEn}
                        onChange={(value) => updateTextField("homepageCopyEn", value)}
                        placeholder={t("admin.siteSettings.placeholders.homepageCopyEn")}
                      />
                    </Grid>
                    <Grid columns={{ minWidth: isNarrow ? 220 : 260, max: 3 }} gap={3}>
                      <MediaAssetField
                        label={t("initialSetup.site.lightLogo")}
                        value={form.lightLogoUrl}
                        localFile={lightLogoFile}
                        onChange={(value) => updateTextField("lightLogoUrl", value)}
                        onLocalFileChange={setLightLogoFile}
                        folderSlug="site"
                        token={authToken}
                        placeholder={t("initialSetup.site.lightLogoPlaceholder")}
                        isDisabled={isLoading || isSaving}
                        status={
                          shownErrors.lightLogoUrl
                            ? { type: "error", message: shownErrors.lightLogoUrl }
                            : undefined
                        }
                      />
                      <MediaAssetField
                        label={t("initialSetup.site.darkLogo")}
                        value={form.darkLogoUrl}
                        localFile={darkLogoFile}
                        onChange={(value) => updateTextField("darkLogoUrl", value)}
                        onLocalFileChange={setDarkLogoFile}
                        folderSlug="site"
                        token={authToken}
                        placeholder={t("initialSetup.site.darkLogoPlaceholder")}
                        isDisabled={isLoading || isSaving}
                        status={
                          shownErrors.darkLogoUrl
                            ? { type: "error", message: shownErrors.darkLogoUrl }
                            : undefined
                        }
                      />
                      <MediaAssetField
                        label={t("initialSetup.site.favicon")}
                        value={form.faviconUrl}
                        localFile={faviconFile}
                        onChange={(value) => updateTextField("faviconUrl", value)}
                        onLocalFileChange={setFaviconFile}
                        folderSlug="site"
                        token={authToken}
                        placeholder={t("initialSetup.site.faviconPlaceholder")}
                        previewVariant="favicon"
                        isDisabled={isLoading || isSaving}
                        status={
                          shownErrors.faviconUrl
                            ? { type: "error", message: shownErrors.faviconUrl }
                            : undefined
                        }
                      />
                    </Grid>
                  </FormLayout>
                  <UploadProgressList language={activeLocale} uploads={uploads} />
                  <SiteSettingsPanelSaveButton
                    isLoading={savingTarget === "site"}
                    isDisabled={isLoading || isSaving}
                    isNarrow={isNarrow}
                    label={t("actions.save")}
                    loadingLabel={t("actions.saving")}
                    onClick={() => requestSaveConfirmation("site")}
                  />
                </VStack>
              </Collapsible>

              <Divider />

              <Collapsible
                value="basics"
                trigger={
                  <SiteSettingsPanelTrigger
                    title={t("admin.siteSettings.sections.basics")}
                    icon={<Search size={18} />}
                  />
                }
              >
                <VStack gap={4}>
                  <Text type="supporting" color="secondary">
                    {t("admin.siteSettings.descriptions.basics")}
                  </Text>
                  <FormLayout defaultOptionality="optional">
                    <Grid columns={{ minWidth: isNarrow ? 220 : 260, max: 2 }} gap={3}>
                      <TextInput
                        label={t("admin.siteSettings.fields.seoTitleZh")}
                        value={form.seoTitleZh}
                        onChange={(value) => updateTextField("seoTitleZh", value)}
                        placeholder={t("initialSetup.basics.seoTitlePlaceholder")}
                      />
                      <TextInput
                        label={t("admin.siteSettings.fields.seoTitleEn")}
                        value={form.seoTitleEn}
                        onChange={(value) => updateTextField("seoTitleEn", value)}
                        placeholder={t("admin.siteSettings.placeholders.seoTitleEn")}
                      />
                    </Grid>
                    <Grid columns={{ minWidth: isNarrow ? 220 : 260, max: 2 }} gap={3}>
                      <TextArea
                        label={t("admin.siteSettings.fields.seoDescriptionZh")}
                        rows={3}
                        value={form.seoDescriptionZh}
                        onChange={(value) => updateTextField("seoDescriptionZh", value)}
                        placeholder={t("initialSetup.basics.seoDescriptionPlaceholder")}
                      />
                      <TextArea
                        label={t("admin.siteSettings.fields.seoDescriptionEn")}
                        rows={3}
                        value={form.seoDescriptionEn}
                        onChange={(value) => updateTextField("seoDescriptionEn", value)}
                        placeholder={t("admin.siteSettings.placeholders.seoDescriptionEn")}
                      />
                    </Grid>
                    <TextTokenizer
                      label={t("initialSetup.basics.seoKeywords")}
                      value={form.seoKeywords}
                      onChange={(values) =>
                        setForm((current) => ({ ...current, seoKeywords: values }))
                      }
                      createLabel={(value) => t("initialSetup.createToken", { value })}
                      placeholder={t("initialSetup.basics.seoKeywordsPlaceholder")}
                      description={t("initialSetup.basics.seoKeywordsDescription")}
                      isDisabled={isLoading || isSaving}
                    />
                    <TextInput
                      label={t("initialSetup.basics.copyright")}
                      value={form.copyright}
                      onChange={(value) => updateTextField("copyright", value)}
                      placeholder={t("initialSetup.basics.copyrightPlaceholder")}
                    />
                    <Switch
                      label={t("initialSetup.basics.comments")}
                      description={t("initialSetup.basics.commentsDescription")}
                      value={form.commentsEnabled}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, commentsEnabled: value }))
                      }
                      labelPosition="start"
                      labelSpacing="spread"
                    />
                    <Divider />
                    <Grid columns={{ minWidth: isNarrow ? 220 : 260 }} gap={3}>
                      <TextInput
                        label={t("initialSetup.basics.resendDomain")}
                        value={form.resendDomain}
                        onChange={(value) => updateTextField("resendDomain", value)}
                        placeholder={t("initialSetup.basics.resendDomainPlaceholder")}
                      />
                    </Grid>
                    <VStack gap={3}>
                      <SecretTestField
                        configured={form.exchangeRateApiKeyConfigured}
                        configuredLabel={t("admin.siteSettings.secret.configured")}
                        label={t("admin.siteSettings.fields.exchangeRateApiKey")}
                        value={form.exchangeRateApiKey}
                        onChange={(value) => updateTextField("exchangeRateApiKey", value)}
                        placeholder={t("admin.siteSettings.secret.placeholder")}
                        getLabel={t("admin.siteSettings.secret.get")}
                        getUrl={API_KEY_GET_URLS.exchangeRateApiKey}
                        isNarrow={isNarrow}
                        notConfiguredLabel={t("admin.siteSettings.secret.notConfigured")}
                        revealSavedLabel={t("admin.siteSettings.secret.viewSaved")}
                        testLabel={t("admin.siteSettings.secret.test")}
                        testingLabel={t("admin.siteSettings.secret.testing")}
                        isLoading={testingTarget === "exchangeRate"}
                        isDisabled={isLoading || isSaving || isTesting}
                        onRevealSaved={() => openSecretRevealDialog("exchangeRateApiKey")}
                        onTest={() => void runIntegrationTest("exchangeRate")}
                      />
                      <SecretTestField
                        configured={form.resendApiKeyConfigured}
                        configuredLabel={t("admin.siteSettings.secret.configured")}
                        label={t("initialSetup.basics.resendApiKey")}
                        value={form.resendApiKey}
                        onChange={(value) => updateTextField("resendApiKey", value)}
                        placeholder={t("admin.siteSettings.secret.placeholder")}
                        getLabel={t("admin.siteSettings.secret.get")}
                        getUrl={API_KEY_GET_URLS.resendApiKey}
                        isNarrow={isNarrow}
                        notConfiguredLabel={t("admin.siteSettings.secret.notConfigured")}
                        revealSavedLabel={t("admin.siteSettings.secret.viewSaved")}
                        testLabel={t("admin.siteSettings.secret.testResend")}
                        testingLabel={t("admin.siteSettings.secret.testing")}
                        isLoading={testingTarget === "resend"}
                        isDisabled={isLoading || isSaving || isTesting}
                        onRevealSaved={() => openSecretRevealDialog("resendApiKey")}
                        onTest={() => void runIntegrationTest("resend")}
                      />
                      <SecretTestField
                        configured={form.deeplApiKeyConfigured}
                        configuredLabel={t("admin.siteSettings.secret.configured")}
                        label={t("initialSetup.basics.deeplApiKey")}
                        value={form.deeplApiKey}
                        onChange={(value) => updateTextField("deeplApiKey", value)}
                        placeholder={t("admin.siteSettings.secret.placeholder")}
                        getLabel={t("admin.siteSettings.secret.get")}
                        getUrl={API_KEY_GET_URLS.deeplApiKey}
                        isNarrow={isNarrow}
                        notConfiguredLabel={t("admin.siteSettings.secret.notConfigured")}
                        revealSavedLabel={t("admin.siteSettings.secret.viewSaved")}
                        testLabel={t("admin.siteSettings.secret.test")}
                        testingLabel={t("admin.siteSettings.secret.testing")}
                        isLoading={testingTarget === "deepl"}
                        isDisabled={isLoading || isSaving || isTesting}
                        onRevealSaved={() => openSecretRevealDialog("deeplApiKey")}
                        onTest={() => void runIntegrationTest("deepl")}
                      />
                      <SecretTestField
                        configured={form.ipGeolocationApiKeyConfigured}
                        configuredLabel={t("admin.siteSettings.secret.configured")}
                        label={t("initialSetup.basics.ipGeolocationApiKey")}
                        value={form.ipGeolocationApiKey}
                        onChange={(value) => updateTextField("ipGeolocationApiKey", value)}
                        placeholder={t("admin.siteSettings.secret.placeholder")}
                        getLabel={t("admin.siteSettings.secret.get")}
                        getUrl={API_KEY_GET_URLS.ipGeolocationApiKey}
                        isNarrow={isNarrow}
                        notConfiguredLabel={t("admin.siteSettings.secret.notConfigured")}
                        revealSavedLabel={t("admin.siteSettings.secret.viewSaved")}
                        testLabel={t("admin.siteSettings.secret.test")}
                        testingLabel={t("admin.siteSettings.secret.testing")}
                        isLoading={testingTarget === "ipGeolocation"}
                        isDisabled={isLoading || isSaving || isTesting}
                        onRevealSaved={() => openSecretRevealDialog("ipGeolocationApiKey")}
                        onTest={() => void runIntegrationTest("ipGeolocation")}
                      />
                    </VStack>
                    <Text type="supporting" color="secondary">
                      {t("admin.siteSettings.secret.keepExisting")}
                    </Text>
                  </FormLayout>
                  <SiteSettingsPanelSaveButton
                    isLoading={savingTarget === "basics"}
                    isDisabled={isLoading || isSaving}
                    isNarrow={isNarrow}
                    label={t("actions.save")}
                    loadingLabel={t("actions.saving")}
                    onClick={() => requestSaveConfirmation("basics")}
                  />
                </VStack>
              </Collapsible>

              <Divider />

              <Collapsible
                value="filings"
                trigger={
                  <SiteSettingsPanelTrigger
                    title={t("admin.siteSettings.sections.filings")}
                    icon={<Settings2 size={18} />}
                  />
                }
              >
                <VStack gap={4}>
                  <Text type="supporting" color="secondary">
                    {t("admin.siteSettings.descriptions.filings")}
                  </Text>
                  <FormLayout defaultOptionality="optional">
                    <VStack gap={3}>
                      <HStack gap={3} vAlign="center" wrap="wrap">
                        <StackItem size="fill">
                          <Text type="label">{t("initialSetup.filings.icpSection")}</Text>
                        </StackItem>
                        <Button
                          label={t("actions.addIcpRecord")}
                          icon={<Plus size={16} />}
                          variant="secondary"
                          width={isNarrow ? "100%" : undefined}
                          onClick={addIcpRecord}
                        />
                      </HStack>
                      {form.icpRecords.map((record, index) => (
                        <Grid key={record.id} columns={{ minWidth: isNarrow ? 220 : 260 }} gap={3}>
                          <TextInput
                            label={t("initialSetup.filings.icpNumber", { index: index + 1 })}
                            value={record.number}
                            onChange={(value) => updateIcpRecord(record.id, "number", value)}
                            placeholder={t("initialSetup.filings.icpNumberPlaceholder")}
                          />
                          <TextInput
                            label={t("initialSetup.filings.icpUrl", { index: index + 1 })}
                            value={record.url}
                            onChange={(value) => updateIcpRecord(record.id, "url", value)}
                            placeholder={t("initialSetup.filings.icpUrlPlaceholder")}
                            status={
                              shownErrors[`icp-${record.id}`]
                                ? { type: "error", message: shownErrors[`icp-${record.id}`] }
                                : undefined
                            }
                          />
                          <HStack gap={2} vAlign="end">
                            <Button
                              label={t("actions.remove")}
                              icon={<Trash2 size={16} />}
                              variant="ghost"
                              onClick={() => removeIcpRecord(record.id)}
                            />
                          </HStack>
                        </Grid>
                      ))}
                    </VStack>
                    <Divider />
                    <Grid columns={{ minWidth: isNarrow ? 220 : 260 }} gap={3}>
                      <TextInput
                        label={t("initialSetup.filings.policeNumber")}
                        value={form.policeRecordNumber}
                        onChange={(value) => updateTextField("policeRecordNumber", value)}
                        placeholder={t("initialSetup.filings.policeNumberPlaceholder")}
                      />
                      <TextInput
                        label={t("initialSetup.filings.policeUrl")}
                        value={form.policeRecordUrl}
                        onChange={(value) => updateTextField("policeRecordUrl", value)}
                        placeholder={t("initialSetup.filings.policeUrlPlaceholder")}
                        status={
                          shownErrors.policeRecordUrl
                            ? { type: "error", message: shownErrors.policeRecordUrl }
                            : undefined
                        }
                      />
                    </Grid>
                  </FormLayout>
                  <SiteSettingsPanelSaveButton
                    isLoading={savingTarget === "filings"}
                    isDisabled={isLoading || isSaving}
                    isNarrow={isNarrow}
                    label={t("actions.save")}
                    loadingLabel={t("actions.saving")}
                    onClick={() => requestSaveConfirmation("filings")}
                  />
                </VStack>
              </Collapsible>

              <Divider />

              <Collapsible
                value="storage"
                trigger={
                  <SiteSettingsPanelTrigger
                    title={t("admin.siteSettings.sections.storage")}
                    icon={<CloudUpload size={18} />}
                  />
                }
              >
                <VStack gap={4}>
                  <Text type="supporting" color="secondary">
                    {t("admin.siteSettings.descriptions.storage")}
                  </Text>
                  <FormLayout defaultOptionality="optional">
                    <Switch
                      label={t("admin.siteSettings.fields.r2Enabled")}
                      description={t("admin.siteSettings.descriptions.r2Enabled")}
                      value={form.r2Enabled}
                      onChange={(value) => setForm((current) => ({ ...current, r2Enabled: value }))}
                      labelPosition="start"
                      labelSpacing="spread"
                    />
                    <Grid columns={{ minWidth: isNarrow ? 220 : 260, max: 2 }} gap={3}>
                      <TextInput
                        label={t("admin.siteSettings.fields.r2AccountId")}
                        value={form.r2AccountId}
                        onChange={(value) => updateTextField("r2AccountId", value)}
                        placeholder={t("admin.siteSettings.placeholders.r2AccountId")}
                      />
                      <TextInput
                        label={t("admin.siteSettings.fields.r2Bucket")}
                        value={form.r2Bucket}
                        onChange={(value) => updateTextField("r2Bucket", value)}
                        placeholder={t("admin.siteSettings.placeholders.r2Bucket")}
                      />
                    </Grid>
                    <Grid columns={{ minWidth: isNarrow ? 220 : 260, max: 2 }} gap={3}>
                      <TextInput
                        label={t("admin.siteSettings.fields.r2AccessKeyId")}
                        value={form.r2AccessKeyId}
                        onChange={(value) => updateTextField("r2AccessKeyId", value)}
                        placeholder={t("admin.siteSettings.placeholders.r2AccessKeyId")}
                      />
                      <TextInput
                        label={t("admin.siteSettings.fields.r2PublicBaseUrl")}
                        value={form.r2PublicBaseUrl}
                        onChange={(value) => updateTextField("r2PublicBaseUrl", value)}
                        placeholder={t("admin.siteSettings.placeholders.r2PublicBaseUrl")}
                        status={
                          shownErrors.r2PublicBaseUrl
                            ? { type: "error", message: shownErrors.r2PublicBaseUrl }
                            : undefined
                        }
                      />
                    </Grid>
                    <SecretRevealField
                      configured={form.r2SecretAccessKeyConfigured}
                      configuredLabel={t("admin.siteSettings.secret.configured")}
                      label={t("admin.siteSettings.fields.r2SecretAccessKey")}
                      value={form.r2SecretAccessKey}
                      onChange={(value) => updateTextField("r2SecretAccessKey", value)}
                      placeholder={t("admin.siteSettings.secret.placeholder")}
                      getLabel={t("admin.siteSettings.secret.get")}
                      getUrl={API_KEY_GET_URLS.r2SecretAccessKey}
                      isNarrow={isNarrow}
                      notConfiguredLabel={t("admin.siteSettings.secret.notConfigured")}
                      revealSavedLabel={t("admin.siteSettings.secret.viewSaved")}
                      isDisabled={isLoading || isSaving}
                      onRevealSaved={() => openSecretRevealDialog("r2SecretAccessKey")}
                    />
                    <Text type="supporting" color="secondary">
                      {t("admin.siteSettings.secret.keepExisting")}
                    </Text>
                  </FormLayout>
                  <SiteSettingsPanelSaveButton
                    isLoading={savingTarget === "storage"}
                    isDisabled={isLoading || isSaving}
                    isNarrow={isNarrow}
                    label={t("actions.save")}
                    loadingLabel={t("actions.saving")}
                    onClick={() => requestSaveConfirmation("storage")}
                  />
                </VStack>
              </Collapsible>
            </VStack>
          </CollapsibleGroup>
        </div>
      </VStack>
      {revealingSecretKey !== undefined && (
        <Dialog
          aria-label={revealDialogTitle}
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
          <VStack gap={4} style={SECRET_REVEAL_DIALOG_STYLE}>
            <HStack gap={3} hAlign="between" vAlign="start">
              <VStack gap={1} style={SECRET_REVEAL_DIALOG_TITLE_STYLE}>
                <Heading level={2}>{revealDialogTitle}</Heading>
                <Text type="supporting" color="secondary">
                  {t("admin.siteSettings.secret.revealDescription")}
                </Text>
              </VStack>
              <IconButton
                label={t("admin.siteSettings.secret.close")}
                icon={<X size={18} />}
                size="sm"
                variant="ghost"
                onClick={closeSecretRevealDialog}
              />
            </HStack>

            {revealedApiKeys === undefined ? (
              <VStack gap={3}>
                <TextInput
                  label={t("admin.siteSettings.secret.emailCode")}
                  value={revealEmailCode}
                  onChange={setRevealEmailCode}
                  placeholder={t("admin.siteSettings.secret.emailCodePlaceholder")}
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
                    isDisabled={isRevealCodeCoolingDown || isRevealCodeSending || isRevealingApiKey}
                    onClick={() => void sendRevealCode()}
                  />
                  <Button
                    label={t("admin.siteSettings.secret.reveal")}
                    icon={<Eye size={16} />}
                    variant="primary"
                    width={isNarrow ? "100%" : undefined}
                    isLoading={isRevealingApiKey}
                    isDisabled={isRevealCodeSending || isRevealingApiKey}
                    onClick={() => void revealSavedApiKeys()}
                  />
                </HStack>
              </VStack>
            ) : (
              <VStack gap={3}>
                <SecretValuePanel
                  label={revealingSecretLabel}
                  value={revealedSecretValue}
                  emptyLabel={t("admin.siteSettings.secret.revealEmpty")}
                />
                <HStack gap={2} hAlign="end" wrap="wrap">
                  <Button
                    label={t("admin.siteSettings.secret.copy")}
                    icon={<Copy size={16} />}
                    variant="secondary"
                    width={isNarrow ? "100%" : undefined}
                    isDisabled={revealedSecretValue.length === 0}
                    onClick={() => void copyRevealedSecret(revealedSecretValue)}
                  />
                  <Button
                    label={t("admin.siteSettings.secret.close")}
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
