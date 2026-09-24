import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CloudUpload,
  FileCheck2,
  Globe2,
  Image,
  Images,
  MessageSquareText,
  Plus,
  Save,
  Search,
  Settings2,
  Trash2,
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
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";

import type {
  SiteFilingRecord,
  SiteSettings,
  SiteSettingsLocalizations,
  SiteSettingsTranslation,
  UpdateSiteSettingsPayload,
} from "../../../../shared/admin-api";
import { getSiteSettings, updateSiteSettings } from "../../../../shared/admin-api";
import {
  AdminFeedbackBanner,
  createAdminFeedbackBanner,
} from "../components/admin-feedback-banner";
import type { AdminFeedbackBannerState } from "../components/admin-feedback-banner";

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
  coverUrlDraft: string;
  coverUrls: string;
  homepageCopyZh: string;
  homepageCopyEn: string;
  lightLogoUrl: string;
  darkLogoUrl: string;
  faviconUrl: string;
  seoTitleZh: string;
  seoTitleEn: string;
  seoDescriptionZh: string;
  seoDescriptionEn: string;
  seoKeywords: string;
  copyright: string;
  commentsEnabled: boolean;
  resendDomain: string;
  resendApiKey: string;
  deeplApiKey: string;
  ipGeolocationApiKey: string;
  resendApiKeyConfigured: boolean;
  deeplApiKeyConfigured: boolean;
  ipGeolocationApiKeyConfigured: boolean;
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
  | "coverUrlDraft"
  | "coverUrls"
  | "homepageCopyZh"
  | "homepageCopyEn"
  | "lightLogoUrl"
  | "darkLogoUrl"
  | "faviconUrl"
  | "seoTitleZh"
  | "seoTitleEn"
  | "seoDescriptionZh"
  | "seoDescriptionEn"
  | "seoKeywords"
  | "copyright"
  | "resendDomain"
  | "resendApiKey"
  | "deeplApiKey"
  | "ipGeolocationApiKey"
  | "policeRecordNumber"
  | "policeRecordUrl";

type IcpRecordField = "number" | "url";

type SiteSettingsSaveTarget = "site" | "basics" | "filings";

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

const MAX_HOMEPAGE_COVERS = 12;

const COVER_PREVIEW_CARD_STYLE: CSSProperties = {
  minWidth: 0,
};

const COVER_PREVIEW_IMAGE_STYLE: CSSProperties = {
  aspectRatio: "16 / 9",
  borderRadius: "var(--radius-control)",
  display: "block",
  objectFit: "cover",
  width: "100%",
};

const COVER_PREVIEW_URL_STYLE: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const BRAND_ASSET_PREVIEW_CARD_STYLE: CSSProperties = {
  boxSizing: "border-box",
  minWidth: 0,
  width: "100%",
};

const BRAND_ASSET_PREVIEW_ROW_STYLE: CSSProperties = {
  minWidth: 0,
  width: "100%",
};

const BRAND_ASSET_FIELD_STACK_STYLE: CSSProperties = {
  minWidth: 0,
  width: "100%",
};

const BRAND_ASSET_LOGO_FRAME_STYLE: CSSProperties = {
  alignItems: "center",
  background: "var(--color-surface-subtle)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-control)",
  display: "flex",
  flex: "0 0 96px",
  height: 54,
  justifyContent: "center",
  overflow: "hidden",
  padding: 8,
};

const BRAND_ASSET_FAVICON_FRAME_STYLE: CSSProperties = {
  alignItems: "center",
  background: "var(--color-surface-subtle)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-control)",
  display: "flex",
  flex: "0 0 44px",
  height: 44,
  justifyContent: "center",
  overflow: "hidden",
  padding: 6,
};

const BRAND_ASSET_IMAGE_STYLE: CSSProperties = {
  display: "block",
  height: "100%",
  objectFit: "contain",
  width: "100%",
};

const BRAND_ASSET_URL_STYLE: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  width: "100%",
};

const DATE_TIME_MINUTE_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;

const splitValues = (raw: string) =>
  raw
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);

const createItemId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const padDateUnit = (value: number) => value.toString().padStart(2, "0");

const formatCurrentMinute = () => {
  const now = new Date();

  return [
    `${now.getFullYear()}-${padDateUnit(now.getMonth() + 1)}-${padDateUnit(now.getDate())}`,
    `${padDateUnit(now.getHours())}:${padDateUnit(now.getMinutes())}`,
  ].join(" ");
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

  return {
    siteNameZh: localizations.zhCN.siteName,
    siteNameEn: localizations.en.siteName,
    foundedAt: settings.site.foundedAt || formatCurrentMinute(),
    siteDescriptionZh: localizations.zhCN.siteDescription,
    siteDescriptionEn: localizations.en.siteDescription,
    coverUrlDraft: "",
    coverUrls: settings.site.coverUrls.join("\n"),
    homepageCopyZh: localizations.zhCN.homepageCopy,
    homepageCopyEn: localizations.en.homepageCopy,
    lightLogoUrl: settings.site.lightLogoUrl,
    darkLogoUrl: settings.site.darkLogoUrl,
    faviconUrl: settings.site.faviconUrl,
    seoTitleZh: localizations.zhCN.seoTitle,
    seoTitleEn: localizations.en.seoTitle,
    seoDescriptionZh: localizations.zhCN.seoDescription,
    seoDescriptionEn: localizations.en.seoDescription,
    seoKeywords: settings.basics.seoKeywords.join(", "),
    copyright: settings.basics.copyright,
    commentsEnabled: settings.basics.commentsEnabled,
    resendDomain: settings.basics.resendDomain,
    resendApiKey: "",
    deeplApiKey: "",
    ipGeolocationApiKey: "",
    resendApiKeyConfigured: settings.basics.resendApiKeyConfigured,
    deeplApiKeyConfigured: settings.basics.deeplApiKeyConfigured,
    ipGeolocationApiKeyConfigured: settings.basics.ipGeolocationApiKeyConfigured,
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
      foundedAt: formatCurrentMinute(),
      siteDescription: "",
      coverUrls: [],
      homepageCopy: "",
      lightLogoUrl: "",
      darkLogoUrl: "",
      faviconUrl: "",
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

type MoveHomepageCoverParameters = {
  direction: -1 | 1;
  index: number;
};

type HomepageCoverPreviewGridProps = {
  coverUrls: string[];
  isDisabled: boolean;
  isNarrow: boolean;
  onMove: (parameters: MoveHomepageCoverParameters) => void;
  onRemove: (index: number) => void;
};

const HomepageCoverPreviewGrid = ({
  coverUrls,
  isDisabled,
  isNarrow,
  onMove,
  onRemove,
}: HomepageCoverPreviewGridProps) => {
  const { t } = useTranslation();

  if (coverUrls.length === 0) {
    return null;
  }

  return (
    <Grid columns={{ minWidth: isNarrow ? 180 : 200, max: 4 }} gap={3}>
      {coverUrls.map((coverUrl, index) => (
        <Card key={`${coverUrl}-${index}`} padding={3} style={COVER_PREVIEW_CARD_STYLE}>
          <VStack gap={2}>
            <img
              alt={t("admin.siteSettings.coverPreview.alt", { index: index + 1 })}
              loading="lazy"
              src={coverUrl}
              style={COVER_PREVIEW_IMAGE_STYLE}
            />
            <VStack gap={1}>
              <Text type="label" weight="semibold">
                {t(
                  index === 0
                    ? "admin.siteSettings.coverPreview.primaryTitle"
                    : "admin.siteSettings.coverPreview.title",
                  { index: index + 1 },
                )}
              </Text>
              <div title={coverUrl} style={COVER_PREVIEW_URL_STYLE}>
                <Text type="supporting" color="secondary">
                  {coverUrl}
                </Text>
              </div>
            </VStack>
            <Grid columns={{ minWidth: 84, max: 2 }} gap={2}>
              <Button
                label={t("actions.moveUp")}
                icon={<ArrowUp size={16} />}
                variant="secondary"
                isDisabled={isDisabled || index === 0}
                onClick={() => onMove({ direction: -1, index })}
              />
              <Button
                label={t("actions.moveDown")}
                icon={<ArrowDown size={16} />}
                variant="secondary"
                isDisabled={isDisabled || index === coverUrls.length - 1}
                onClick={() => onMove({ direction: 1, index })}
              />
            </Grid>
            <Button
              label={t("actions.remove")}
              icon={<Trash2 size={16} />}
              variant="ghost"
              width="100%"
              isDisabled={isDisabled}
              onClick={() => onRemove(index)}
            />
          </VStack>
        </Card>
      ))}
    </Grid>
  );
};

type BrandAssetPreviewProps = {
  alt: string;
  label: string;
  value: string;
  variant: "favicon" | "logo";
};

const BrandAssetPreview = ({ alt, label, value, variant }: BrandAssetPreviewProps) => {
  const assetUrl = value.trim();

  if (assetUrl.length === 0 || !isValidUrl(assetUrl)) {
    return null;
  }

  return (
    <Card padding={3} style={BRAND_ASSET_PREVIEW_CARD_STYLE}>
      <HStack gap={3} vAlign="center" style={BRAND_ASSET_PREVIEW_ROW_STYLE}>
        <div
          style={
            variant === "favicon"
              ? BRAND_ASSET_FAVICON_FRAME_STYLE
              : BRAND_ASSET_LOGO_FRAME_STYLE
          }
        >
          <img alt={alt} loading="lazy" src={assetUrl} style={BRAND_ASSET_IMAGE_STYLE} />
        </div>
        <StackItem size="fill">
          <VStack gap={1}>
            <Text type="label" weight="semibold">
              {label}
            </Text>
            <div title={assetUrl} style={BRAND_ASSET_URL_STYLE}>
              <Text type="supporting" color="secondary">
                {assetUrl}
              </Text>
            </div>
          </VStack>
        </StackItem>
      </HStack>
    </Card>
  );
};

export function SiteSettingsPage({
  authToken,
  isNarrow,
  onSettingsUpdated,
}: SiteSettingsPageProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState(createEmptyFormState);
  const [isLoading, setIsLoading] = useState(true);
  const [savingTarget, setSavingTarget] = useState<SiteSettingsSaveTarget>();
  const [saveConfirmationTarget, setSaveConfirmationTarget] = useState<SiteSettingsSaveTarget>();
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<AdminFeedbackBannerState>();

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

  const coverUrlValues = useMemo(() => splitValues(form.coverUrls), [form.coverUrls]);
  const keywordValues = useMemo(() => splitValues(form.seoKeywords), [form.seoKeywords]);
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

    coverUrlValues.forEach((url, index) => {
      addUrlError(
        nextErrors,
        "coverUrls",
        url,
        t("initialSetup.validation.coverInvalid", { index: index + 1 }),
      );
    });

    addUrlError(nextErrors, "lightLogoUrl", form.lightLogoUrl, t("initialSetup.validation.lightLogoInvalid"));
    addUrlError(nextErrors, "darkLogoUrl", form.darkLogoUrl, t("initialSetup.validation.darkLogoInvalid"));
    addUrlError(nextErrors, "faviconUrl", form.faviconUrl, t("initialSetup.validation.faviconInvalid"));

    form.icpRecords.forEach((record) => {
      addUrlError(nextErrors, `icp-${record.id}`, record.url, t("initialSetup.validation.icpInvalid"));
    });
    addUrlError(nextErrors, "policeRecordUrl", form.policeRecordUrl, t("initialSetup.validation.policeInvalid"));

    return nextErrors;
  }, [
    coverUrlValues,
    form.darkLogoUrl,
    form.faviconUrl,
    form.foundedAt,
    form.icpRecords,
    form.lightLogoUrl,
    form.policeRecordUrl,
    t,
  ]);

  const shownErrors = hasAttemptedSubmit ? errors : EMPTY_ERRORS;

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

  const moveCoverUrl = ({ direction, index }: MoveHomepageCoverParameters) => {
    setForm((current) => {
      const currentCoverUrls = splitValues(current.coverUrls);
      const nextIndex = index + direction;

      if (nextIndex < 0 || nextIndex >= currentCoverUrls.length) {
        return current;
      }

      const nextCoverUrls = [...currentCoverUrls];
      const [movedCoverUrl] = nextCoverUrls.splice(index, 1);

      if (movedCoverUrl === undefined) {
        return current;
      }

      nextCoverUrls.splice(nextIndex, 0, movedCoverUrl);

      return { ...current, coverUrls: nextCoverUrls.join("\n") };
    });
  };

  const removeCoverUrl = (index: number) => {
    setForm((current) => {
      const nextCoverUrls = splitValues(current.coverUrls).filter(
        (_coverUrl, coverIndex) => coverIndex !== index,
      );

      return { ...current, coverUrls: nextCoverUrls.join("\n") };
    });
  };

  const addCoverUrl = () => {
    const nextCoverUrl = form.coverUrlDraft.trim();
    if (nextCoverUrl.length === 0) {
      return;
    }

    if (!isValidUrl(nextCoverUrl)) {
      setFeedbackBanner(
        createAdminFeedbackBanner({
          status: "error",
          title: t("admin.siteSettings.coverPreview.invalidDraft"),
        }),
      );
      return;
    }

    if (coverUrlValues.length >= MAX_HOMEPAGE_COVERS) {
      setFeedbackBanner(
        createAdminFeedbackBanner({
          status: "warning",
          title: t("admin.siteSettings.coverPreview.limitReached", {
            max: MAX_HOMEPAGE_COVERS,
          }),
        }),
      );
      return;
    }

    setForm((current) => ({
      ...current,
      coverUrlDraft: "",
      coverUrls: [...coverUrlValues, nextCoverUrl].join("\n"),
    }));
    setFeedbackBanner(
      createAdminFeedbackBanner({
        status: "success",
        title: t("admin.siteSettings.coverPreview.added"),
      }),
    );
  };

  const showCoverPickerPlaceholder = (kind: "local" | "media") => {
    setFeedbackBanner(
      createAdminFeedbackBanner({
        status: "warning",
        title: t(
          kind === "media"
            ? "admin.siteSettings.coverPreview.mediaPlaceholder"
            : "admin.siteSettings.coverPreview.localPlaceholder",
        ),
      }),
    );
  };

  const createPayload = (): UpdateSiteSettingsPayload => ({
    siteLocalizations: {
      zhCN: {
        siteName: form.siteNameZh.trim(),
        siteDescription: form.siteDescriptionZh.trim(),
        homepageCopy: form.homepageCopyZh.trim(),
        seoTitle: form.seoTitleZh.trim(),
        seoDescription: form.seoDescriptionZh.trim(),
      },
      en: {
        siteName: form.siteNameEn.trim(),
        siteDescription: form.siteDescriptionEn.trim(),
        homepageCopy: form.homepageCopyEn.trim(),
        seoTitle: form.seoTitleEn.trim(),
        seoDescription: form.seoDescriptionEn.trim(),
      },
    },
    site: {
      foundedAt: form.foundedAt.trim(),
      coverUrls: coverUrlValues,
      lightLogoUrl: form.lightLogoUrl.trim(),
      darkLogoUrl: form.darkLogoUrl.trim(),
      faviconUrl: form.faviconUrl.trim(),
    },
    basics: {
      seoKeywords: keywordValues,
      copyright: form.copyright.trim(),
      commentsEnabled: form.commentsEnabled,
      resendDomain: form.resendDomain.trim(),
      resendApiKey: form.resendApiKey.trim(),
      deeplApiKey: form.deeplApiKey.trim(),
      ipGeolocationApiKey: form.ipGeolocationApiKey.trim(),
    },
    filings: {
      icpRecords: form.icpRecords
        .map((record) => ({
          number: record.number.trim(),
          url: record.url.trim(),
        }))
        .filter((record) => record.number.length > 0 || record.url.length > 0),
      policeRecordNumber: form.policeRecordNumber.trim(),
      policeRecordUrl: form.policeRecordUrl.trim(),
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

    const targetLocales = siteTranslation.targetLocales ?? [
      siteTranslation.targetLocale,
    ];
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
        throw new Error(`Unhandled site translation status: ${exhaustiveStatus}`);
      }
    }
  };

  const saveSettings = async (target: SiteSettingsSaveTarget): Promise<boolean> => {
    setHasAttemptedSubmit(true);
    setFeedbackBanner(undefined);

    if (Object.keys(errors).length > 0) {
      return false;
    }

    setSavingTarget(target);
    try {
      const settings = await updateSiteSettings({
        token: authToken,
        payload: createPayload(),
      });

      setForm(createFormState(settings));
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

    const didSave = await saveSettings(saveConfirmationTarget);
    if (didSave || Object.keys(errors).length > 0) {
      setSaveConfirmationTarget(undefined);
    }
  };

  const secretStatusLabel = (isConfigured: boolean) =>
    t(isConfigured ? "admin.siteSettings.secret.configured" : "admin.siteSettings.secret.notConfigured");

  return (
    <>
      <AdminFeedbackBanner
        banner={feedbackBanner}
        onDismiss={() => setFeedbackBanner(undefined)}
      />
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
                          onClick={() => updateTextField("foundedAt", formatCurrentMinute())}
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
                    <VStack gap={2}>
                      <TextInput
                        label={t("initialSetup.site.covers")}
                        value={form.coverUrlDraft}
                        onChange={(value) => updateTextField("coverUrlDraft", value)}
                        placeholder={t("admin.siteSettings.coverPreview.draftPlaceholder")}
                        description={t("initialSetup.site.coversDescription")}
                        status={
                          shownErrors.coverUrls
                            ? { type: "error", message: shownErrors.coverUrls }
                            : form.coverUrlDraft.trim().length > 0 &&
                                !isValidUrl(form.coverUrlDraft)
                              ? {
                                  type: "error",
                                  message: t("admin.siteSettings.coverPreview.invalidDraft"),
                                }
                              : undefined
                        }
                      />
                      <HStack gap={2} wrap="wrap">
                        <Button
                          label={t("admin.siteSettings.coverPreview.addLink")}
                          icon={<CheckCircle2 size={16} />}
                          variant="secondary"
                          width={isNarrow ? "100%" : undefined}
                          isDisabled={
                            isLoading ||
                            isSaving ||
                            coverUrlValues.length >= MAX_HOMEPAGE_COVERS
                          }
                          onClick={addCoverUrl}
                        />
                        <Button
                          label={t("admin.siteSettings.coverPreview.mediaLibrary")}
                          icon={<Images size={16} />}
                          variant="secondary"
                          width={isNarrow ? "100%" : undefined}
                          isDisabled={isLoading || isSaving}
                          onClick={() => showCoverPickerPlaceholder("media")}
                        />
                        <Button
                          label={t("admin.siteSettings.coverPreview.localUpload")}
                          icon={<CloudUpload size={16} />}
                          variant="secondary"
                          width={isNarrow ? "100%" : undefined}
                          isDisabled={isLoading || isSaving}
                          onClick={() => showCoverPickerPlaceholder("local")}
                        />
                      </HStack>
                      <Text type="supporting" color="secondary">
                        {t("admin.siteSettings.coverPreview.countSummary", {
                          count: coverUrlValues.length,
                          max: MAX_HOMEPAGE_COVERS,
                        })}
                      </Text>
                      <HomepageCoverPreviewGrid
                        coverUrls={coverUrlValues}
                        isDisabled={isLoading || isSaving}
                        isNarrow={isNarrow}
                        onMove={moveCoverUrl}
                        onRemove={removeCoverUrl}
                      />
                    </VStack>
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
                      <VStack gap={2} style={BRAND_ASSET_FIELD_STACK_STYLE}>
                        <TextInput
                          label={t("initialSetup.site.lightLogo")}
                          value={form.lightLogoUrl}
                          onChange={(value) => updateTextField("lightLogoUrl", value)}
                          placeholder={t("initialSetup.site.lightLogoPlaceholder")}
                          status={
                            shownErrors.lightLogoUrl
                              ? { type: "error", message: shownErrors.lightLogoUrl }
                              : undefined
                          }
                        />
                        <BrandAssetPreview
                          alt={t("admin.siteSettings.brandPreview.lightLogoAlt")}
                          label={t("admin.siteSettings.brandPreview.lightLogo")}
                          value={form.lightLogoUrl}
                          variant="logo"
                        />
                      </VStack>
                      <VStack gap={2} style={BRAND_ASSET_FIELD_STACK_STYLE}>
                        <TextInput
                          label={t("initialSetup.site.darkLogo")}
                          value={form.darkLogoUrl}
                          onChange={(value) => updateTextField("darkLogoUrl", value)}
                          placeholder={t("initialSetup.site.darkLogoPlaceholder")}
                          status={
                            shownErrors.darkLogoUrl
                              ? { type: "error", message: shownErrors.darkLogoUrl }
                              : undefined
                          }
                        />
                        <BrandAssetPreview
                          alt={t("admin.siteSettings.brandPreview.darkLogoAlt")}
                          label={t("admin.siteSettings.brandPreview.darkLogo")}
                          value={form.darkLogoUrl}
                          variant="logo"
                        />
                      </VStack>
                      <VStack gap={2} style={BRAND_ASSET_FIELD_STACK_STYLE}>
                        <TextInput
                          label={t("initialSetup.site.favicon")}
                          value={form.faviconUrl}
                          onChange={(value) => updateTextField("faviconUrl", value)}
                          placeholder={t("initialSetup.site.faviconPlaceholder")}
                          status={
                            shownErrors.faviconUrl
                              ? { type: "error", message: shownErrors.faviconUrl }
                              : undefined
                          }
                        />
                        <BrandAssetPreview
                          alt={t("admin.siteSettings.brandPreview.faviconAlt")}
                          label={t("admin.siteSettings.brandPreview.favicon")}
                          value={form.faviconUrl}
                          variant="favicon"
                        />
                      </VStack>
                    </Grid>
                  </FormLayout>
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
                    <TextInput
                      label={t("initialSetup.basics.seoKeywords")}
                      value={form.seoKeywords}
                      onChange={(value) => updateTextField("seoKeywords", value)}
                      description={t("initialSetup.basics.seoKeywordsDescription")}
                    />
                    {keywordValues.length > 0 && (
                      <HStack gap={2} wrap="wrap">
                        {keywordValues.map((keyword) => (
                          <Badge key={keyword} variant="neutral" label={keyword} />
                        ))}
                      </HStack>
                    )}
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
                      onChange={(value) => setForm((current) => ({ ...current, commentsEnabled: value }))}
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
                      <TextInput
                        label={t("initialSetup.basics.resendApiKey")}
                        type="password"
                        value={form.resendApiKey}
                        onChange={(value) => updateTextField("resendApiKey", value)}
                        placeholder={t("admin.siteSettings.secret.placeholder")}
                        description={secretStatusLabel(form.resendApiKeyConfigured)}
                      />
                      <TextInput
                        label={t("initialSetup.basics.deeplApiKey")}
                        type="password"
                        value={form.deeplApiKey}
                        onChange={(value) => updateTextField("deeplApiKey", value)}
                        placeholder={t("admin.siteSettings.secret.placeholder")}
                        description={secretStatusLabel(form.deeplApiKeyConfigured)}
                      />
                      <TextInput
                        label={t("initialSetup.basics.ipGeolocationApiKey")}
                        type="password"
                        value={form.ipGeolocationApiKey}
                        onChange={(value) => updateTextField("ipGeolocationApiKey", value)}
                        placeholder={t("admin.siteSettings.secret.placeholder")}
                        description={secretStatusLabel(form.ipGeolocationApiKeyConfigured)}
                      />
                    </Grid>
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
