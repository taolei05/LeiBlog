import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { Grid } from "@astryxdesign/core/Grid";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Layout, LayoutContent, LayoutFooter, LayoutHeader } from "@astryxdesign/core/Layout";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Step, Stepper } from "@astryxdesign/core/Stepper";
import { Switch } from "@astryxdesign/core/Switch";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useMediaQuery } from "@astryxdesign/core/hooks";
import type { ThemeMode } from "@astryxdesign/core/theme";
import { Moon, Sun } from "lucide-react";

import { APP_LANGUAGES, changeAppLanguage, normalizeLanguage } from "../../../../shared/i18n";
import type { AdminAuthState, InitialSetupPayload } from "../../../../shared/admin-api";
import { completeInitialSetup, uploadInitialSetupMediaAsset } from "../../../../shared/admin-api";
import { UploadProgressList, useUploadProgress } from "../../../../shared/upload-progress";
import { MediaAssetField, MultiMediaAssetField } from "../components/media-asset-field";
import { TextTokenizer } from "../components/text-tokenizer";
import {
  createTimeZoneOptions,
  formatCurrentMinuteInTimeZone,
  formatTimeZoneOffset,
  getSystemTimeZone,
  isValidTimeZone,
  normalizeTimeZone,
} from "../../../../shared/time-zone";

type ErrorMap = Record<string, string>;

type LinkItem = {
  id: string;
  label: string;
  url: string;
};

type FilingRecord = {
  id: string;
  number: string;
  url: string;
};

type LinkItemField = "label" | "url";

type FilingRecordField = "number" | "url";

type InitialSetupPageProps = {
  requiresSetupToken?: boolean;
  themeMode: Extract<ThemeMode, "light" | "dark">;
  onToggleThemeMode: () => void;
  onComplete: (authState: AdminAuthState) => void;
  onSubmitFailed: (message: string) => void;
};

const EMPTY_ERRORS: ErrorMap = {};

const INITIAL_SOCIAL_LINKS: LinkItem[] = [];

const INITIAL_ICP_RECORDS: FilingRecord[] = [{ id: "icp-main", number: "", url: "" }];

const FOOTER_ZONE_STYLE: CSSProperties = { flexBasis: 0 };
const MOBILE_FULL_WIDTH_STYLE: CSSProperties = {
  flexBasis: "100%",
  minWidth: 0,
  width: "100%",
};
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_TIME_MINUTE_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;

const splitValues = (raw: string) =>
  raw
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);

const createItemId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const isValidMinuteTimestamp = (value: string) => {
  const match = DATE_TIME_MINUTE_PATTERN.exec(value);
  if (!match) {
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

const addRequiredError = (errors: ErrorMap, key: string, value: string, message: string) => {
  if (!value.trim()) {
    errors[key] = message;
  }
};

const addUrlError = (errors: ErrorMap, key: string, value: string, message: string) => {
  const trimmedValue = value.trim();
  if (trimmedValue && !isValidUrl(trimmedValue)) {
    errors[key] = message;
  }
};

const addMediaAssetUrlError = (errors: ErrorMap, key: string, value: string, message: string) => {
  if (!isValidMediaAssetUrl(value)) {
    errors[key] = message;
  }
};

const formatList = (values: string[], emptyLabel: string) =>
  values.length > 0 ? values.join(", ") : emptyLabel;

export function InitialSetupPage({
  requiresSetupToken = false,
  themeMode,
  onToggleThemeMode,
  onComplete,
  onSubmitFailed,
}: InitialSetupPageProps) {
  const isNarrow = useMediaQuery("(max-width: 640px)");
  const { t, i18n } = useTranslation();
  const language = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  const { uploads, onUploadProgress } = useUploadProgress();
  const isDarkTheme = themeMode === "dark";
  const themeToggleLabel = t(isDarkTheme ? "theme.switchToLight" : "theme.switchToDark");
  const defaultTags = t("initialSetup.defaults.tags");
  const missingText = t("common.notProvided");
  const steps = useMemo(
    () => [
      {
        label: t("initialSetup.steps.admin.label"),
        description: t("initialSetup.steps.admin.description"),
      },
      {
        label: t("initialSetup.steps.site.label"),
        description: t("initialSetup.steps.site.description"),
      },
      {
        label: t("initialSetup.steps.basics.label"),
        description: t("initialSetup.steps.basics.description"),
      },
      {
        label: t("initialSetup.steps.filings.label"),
        description: t("initialSetup.steps.filings.description"),
      },
    ],
    [t],
  );

  const fieldRefs = {
    setupToken: useRef<HTMLInputElement>(null),
    adminName: useRef<HTMLInputElement>(null),
    username: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    avatarUrl: useRef<HTMLInputElement>(null),
    bio: useRef<HTMLTextAreaElement>(null),
    blogUrl: useRef<HTMLInputElement>(null),
    siteName: useRef<HTMLInputElement>(null),
    foundedAt: useRef<HTMLInputElement>(null),
    siteDescription: useRef<HTMLTextAreaElement>(null),
    coverUrls: useRef<HTMLTextAreaElement>(null),
    homepageCopy: useRef<HTMLTextAreaElement>(null),
    lightLogoUrl: useRef<HTMLInputElement>(null),
    darkLogoUrl: useRef<HTMLInputElement>(null),
    faviconUrl: useRef<HTMLInputElement>(null),
    seoTitle: useRef<HTMLInputElement>(null),
    seoDescription: useRef<HTMLTextAreaElement>(null),
    copyright: useRef<HTMLInputElement>(null),
    resendDomain: useRef<HTMLInputElement>(null),
    resendApiKey: useRef<HTMLInputElement>(null),
    deeplApiKey: useRef<HTMLInputElement>(null),
    ipGeolocationApiKey: useRef<HTMLInputElement>(null),
  };

  const [step, setStep] = useState(0);
  const [attempted, setAttempted] = useState<ReadonlySet<number>>(new Set());

  const [setupToken, setSetupToken] = useState("");
  const [adminName, setAdminName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File>();
  const [bio, setBio] = useState("");
  const [tagValues, setTags] = useState(() => splitValues(defaultTags));
  const [hasCustomizedTags, setHasCustomizedTags] = useState(false);
  const [commentEmailNotifications, setCommentEmailNotifications] = useState(false);
  const [newPostEmailNotifications, setNewPostEmailNotifications] = useState(false);
  const [socialLinks, setSocialLinks] = useState<LinkItem[]>(INITIAL_SOCIAL_LINKS);
  const [blogUrl, setBlogUrl] = useState("");

  const [siteName, setSiteName] = useState("");
  const [timeZone, setTimeZone] = useState(() => getSystemTimeZone());
  const [foundedAt, setFoundedAt] = useState(() =>
    formatCurrentMinuteInTimeZone(getSystemTimeZone()),
  );
  const [siteDescription, setSiteDescription] = useState("");
  const [coverUrls, setCoverUrls] = useState("");
  const [coverFiles, setCoverFiles] = useState<File[]>([]);
  const [homepageCopy, setHomepageCopy] = useState("");
  const [lightLogoUrl, setLightLogoUrl] = useState("");
  const [lightLogoFile, setLightLogoFile] = useState<File>();
  const [darkLogoUrl, setDarkLogoUrl] = useState("");
  const [darkLogoFile, setDarkLogoFile] = useState<File>();
  const [faviconUrl, setFaviconUrl] = useState("");
  const [faviconFile, setFaviconFile] = useState<File>();

  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [keywordValues, setSeoKeywords] = useState<string[]>([]);
  const [copyright, setCopyright] = useState("");
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [resendDomain, setResendDomain] = useState("");
  const [resendApiKey, setResendApiKey] = useState("");
  const [deeplApiKey, setDeeplApiKey] = useState("");
  const [ipGeolocationApiKey, setIpGeolocationApiKey] = useState("");

  const [icpRecords, setIcpRecords] = useState<FilingRecord[]>(INITIAL_ICP_RECORDS);
  const [policeRecordNumber, setPoliceRecordNumber] = useState("");
  const [policeRecordUrl, setPoliceRecordUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!hasCustomizedTags) {
      setTags(splitValues(defaultTags));
    }
  }, [defaultTags, hasCustomizedTags]);

  const coverUrlValues = useMemo(() => splitValues(coverUrls), [coverUrls]);
  const timeZoneOptions = useMemo(
    () => createTimeZoneOptions({ selectedTimeZone: timeZone }),
    [timeZone],
  );

  const updateSocialLink = (id: string, field: LinkItemField, value: string) => {
    setSocialLinks((items) =>
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const updateIcpRecord = (id: string, field: FilingRecordField, value: string) => {
    setIcpRecords((records) =>
      records.map((record) => (record.id === id ? { ...record, [field]: value } : record)),
    );
  };

  const updateTags = (values: string[]) => {
    setHasCustomizedTags(true);
    setTags(values);
  };

  const errorsByStep = useMemo<Array<ErrorMap>>(() => {
    const administrator: ErrorMap = {};
    if (requiresSetupToken) {
      addRequiredError(
        administrator,
        "setupToken",
        setupToken,
        t("initialSetup.admin.setupTokenRequired"),
      );
    }
    addRequiredError(
      administrator,
      "username",
      username,
      t("initialSetup.validation.usernameRequired"),
    );
    addRequiredError(
      administrator,
      "password",
      password,
      t("initialSetup.validation.passwordRequired"),
    );
    addRequiredError(administrator, "email", email, t("initialSetup.validation.emailRequired"));

    if (email.trim() && !EMAIL_PATTERN.test(email.trim())) {
      administrator.email = t("initialSetup.validation.emailInvalid");
    }
    if (password.trim() && password.length < 8) {
      administrator.password = t("initialSetup.validation.passwordTooShort");
    }
    addMediaAssetUrlError(
      administrator,
      "avatarUrl",
      avatarUrl,
      t("initialSetup.validation.avatarInvalid"),
    );
    addUrlError(administrator, "blogUrl", blogUrl, t("initialSetup.validation.blogInvalid"));
    socialLinks.forEach((link) => {
      addUrlError(
        administrator,
        `social-${link.id}`,
        link.url,
        t("initialSetup.validation.socialInvalid"),
      );
    });

    const site: ErrorMap = {};
    if (foundedAt.trim() && !isValidMinuteTimestamp(foundedAt.trim())) {
      site.foundedAt = t("initialSetup.validation.minuteTimestampInvalid");
    }
    if (!isValidTimeZone(timeZone)) {
      site.timeZone = t("initialSetup.validation.timeZoneInvalid");
    }
    coverUrlValues.forEach((url, index) => {
      addMediaAssetUrlError(
        site,
        "coverUrls",
        url,
        t("initialSetup.validation.coverInvalid", { index: index + 1 }),
      );
    });
    addMediaAssetUrlError(
      site,
      "lightLogoUrl",
      lightLogoUrl,
      t("initialSetup.validation.lightLogoInvalid"),
    );
    addMediaAssetUrlError(
      site,
      "darkLogoUrl",
      darkLogoUrl,
      t("initialSetup.validation.darkLogoInvalid"),
    );
    addMediaAssetUrlError(
      site,
      "faviconUrl",
      faviconUrl,
      t("initialSetup.validation.faviconInvalid"),
    );

    const basics: ErrorMap = {};

    const filings: ErrorMap = {};
    icpRecords.forEach((record) => {
      addUrlError(filings, `icp-${record.id}`, record.url, t("initialSetup.validation.icpInvalid"));
    });

    addUrlError(
      filings,
      "policeRecordUrl",
      policeRecordUrl,
      t("initialSetup.validation.policeInvalid"),
    );

    return [administrator, site, basics, filings];
  }, [
    username,
    password,
    email,
    blogUrl,
    avatarUrl,
    socialLinks,
    siteName,
    foundedAt,
    timeZone,
    siteDescription,
    coverUrls,
    homepageCopy,
    requiresSetupToken,
    setupToken,
    lightLogoUrl,
    darkLogoUrl,
    faviconUrl,
    coverUrlValues,
    seoTitle,
    seoDescription,
    keywordValues,
    copyright,
    resendDomain,
    resendApiKey,
    deeplApiKey,
    ipGeolocationApiKey,
    icpRecords,
    policeRecordNumber,
    policeRecordUrl,
    t,
  ]);

  const shownErrors = (index: number) =>
    attempted.has(index) ? (errorsByStep[index] ?? EMPTY_ERRORS) : EMPTY_ERRORS;
  const currentErrors = shownErrors(step);
  const currentStep = steps[step] ?? steps[0];
  const isLastStep = step === steps.length - 1;

  const focusFirstProblem = (errors: ErrorMap) => {
    const [firstProblem] = Object.keys(errors);
    if (!firstProblem) {
      return false;
    }

    fieldRefs[firstProblem as keyof typeof fieldRefs]?.current?.focus();
    return true;
  };

  const markAttempted = (index: number) => {
    setAttempted((previous) => new Set(previous).add(index));
  };

  type CreateSetupPayloadParameters = {
    targetAvatarUrl?: string;
    targetCoverUrlValues?: string[];
    targetDarkLogoUrl?: string;
    targetFaviconUrl?: string;
    targetLightLogoUrl?: string;
  };

  const createSetupPayload = ({
    targetAvatarUrl = avatarUrl.trim(),
    targetCoverUrlValues = coverUrlValues,
    targetDarkLogoUrl = darkLogoUrl.trim(),
    targetFaviconUrl = faviconUrl.trim(),
    targetLightLogoUrl = lightLogoUrl.trim(),
  }: CreateSetupPayloadParameters = {}): InitialSetupPayload => {
    return {
      setupToken: setupToken.trim(),
      admin: {
        name: adminName.trim(),
        username: username.trim(),
        password,
        email: email.trim(),
        avatarUrl: targetAvatarUrl,
        bio: bio.trim(),
        tags: tagValues,
        tagLocale: language,
        socialLinks: socialLinks
          .map((link) => ({
            label: link.label.trim(),
            url: link.url.trim(),
          }))
          .filter((link) => link.label.length > 0 || link.url.length > 0),
        blogUrl: blogUrl.trim(),
        commentEmailNotifications,
        newPostEmailNotifications,
      },
      site: {
        siteName: siteName.trim(),
        foundedAt: foundedAt.trim(),
        siteDescription: siteDescription.trim(),
        coverUrls: targetCoverUrlValues,
        homepageCopy: homepageCopy.trim(),
        lightLogoUrl: targetLightLogoUrl,
        darkLogoUrl: targetDarkLogoUrl,
        faviconUrl: targetFaviconUrl,
        timeZone: normalizeTimeZone(timeZone),
      },
      basics: {
        seoTitle: seoTitle.trim(),
        seoDescription: seoDescription.trim(),
        seoKeywords: keywordValues,
        copyright: copyright.trim(),
        commentsEnabled,
        resendDomain: resendDomain.trim(),
        resendApiKey: resendApiKey.trim(),
        deeplApiKey: deeplApiKey.trim(),
        ipGeolocationApiKey: ipGeolocationApiKey.trim(),
      },
      filings: {
        icpRecords: icpRecords
          .map((record) => ({
            number: record.number.trim(),
            url: record.url.trim(),
          }))
          .filter((record) => record.number.length > 0 || record.url.length > 0),
        policeRecordNumber: policeRecordNumber.trim(),
        policeRecordUrl: policeRecordUrl.trim(),
      },
    };
  };

  const uploadSetupFile = async ({ file, folderSlug }: { file: File; folderSlug: string }) => {
    const uploadedAsset = await uploadInitialSetupMediaAsset({
      onUploadProgress,
      file,
      folderSlug,
      setupToken: setupToken.trim(),
    });

    return uploadedAsset.accessUrl;
  };

  const goNext = async () => {
    if (isSubmitting) {
      return;
    }

    markAttempted(step);

    const errors = errorsByStep[step] ?? EMPTY_ERRORS;
    if (focusFirstProblem(errors)) {
      return;
    }

    if (isLastStep) {
      setIsSubmitting(true);
      try {
        const targetAvatarUrl =
          avatarFile === undefined
            ? avatarUrl.trim()
            : await uploadSetupFile({ file: avatarFile, folderSlug: "avatars" });
        const uploadedCoverUrls =
          coverFiles.length > 0
            ? await Promise.all(
                coverFiles.map((file) => uploadSetupFile({ file, folderSlug: "site" })),
              )
            : [];
        const targetLightLogoUrl =
          lightLogoFile === undefined
            ? lightLogoUrl.trim()
            : await uploadSetupFile({ file: lightLogoFile, folderSlug: "site" });
        const targetDarkLogoUrl =
          darkLogoFile === undefined
            ? darkLogoUrl.trim()
            : await uploadSetupFile({ file: darkLogoFile, folderSlug: "site" });
        const targetFaviconUrl =
          faviconFile === undefined
            ? faviconUrl.trim()
            : await uploadSetupFile({ file: faviconFile, folderSlug: "site" });
        const targetCoverUrlValues = [...coverUrlValues, ...uploadedCoverUrls];

        setAvatarUrl(targetAvatarUrl);
        setCoverUrls(targetCoverUrlValues.join("\n"));
        setLightLogoUrl(targetLightLogoUrl);
        setDarkLogoUrl(targetDarkLogoUrl);
        setFaviconUrl(targetFaviconUrl);
        setAvatarFile(undefined);
        setCoverFiles([]);
        setLightLogoFile(undefined);
        setDarkLogoFile(undefined);
        setFaviconFile(undefined);

        const nextAuthState = await completeInitialSetup(
          createSetupPayload({
            targetAvatarUrl,
            targetCoverUrlValues,
            targetDarkLogoUrl,
            targetFaviconUrl,
            targetLightLogoUrl,
          }),
        );
        onComplete(nextAuthState);
      } catch (error) {
        const message = error instanceof Error ? error.message : t("initialSetup.submit.failed");
        onSubmitFailed(message);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setStep((value) => Math.min(steps.length - 1, value + 1));
  };

  const goTo = (index: number) => {
    if (isSubmitting) {
      return;
    }

    if (index <= step) {
      setStep(index);
      return;
    }

    markAttempted(step);
    const errors = errorsByStep[step] ?? EMPTY_ERRORS;
    if (focusFirstProblem(errors)) {
      return;
    }
    setStep(index);
  };

  const addSocialLink = () => {
    setSocialLinks((items) => [...items, { id: createItemId("social"), label: "", url: "" }]);
  };

  const removeSocialLink = (id: string) => {
    setSocialLinks((items) => items.filter((item) => item.id !== id));
  };

  const addIcpRecord = () => {
    setIcpRecords((records) => [...records, { id: createItemId("icp"), number: "", url: "" }]);
  };

  const removeIcpRecord = (id: string) => {
    setIcpRecords((records) => records.filter((record) => record.id !== id));
  };

  return (
    <Layout
      height="fill"
      contentWidth={880}
      padding={isNarrow ? 3 : 5}
      defaultHasDividers
      header={
        <LayoutHeader hasDivider={false}>
          <VStack gap={isNarrow ? 3 : 5}>
            <HStack gap={3} vAlign="start" wrap="wrap">
              <StackItem size="fill">
                <VStack gap={1}>
                  <HStack gap={2} wrap="wrap">
                    <Badge variant="neutral" label={t("initialSetup.badges.product")} />
                    <Badge variant="neutral" label={t("initialSetup.badges.firstSetup")} />
                  </HStack>
                  <Heading level={1}>{t("initialSetup.title")}</Heading>
                  <Text type="supporting" color="secondary">
                    {t("initialSetup.intro")}
                  </Text>
                </VStack>
              </StackItem>
              <HStack gap={2} vAlign="center">
                <IconButton
                  label={themeToggleLabel}
                  tooltip={themeToggleLabel}
                  icon={
                    isDarkTheme ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />
                  }
                  variant="ghost"
                  size="sm"
                  onClick={onToggleThemeMode}
                />
                <SegmentedControl
                  label={t("language.label")}
                  value={language}
                  onChange={(nextLanguage) => changeAppLanguage(normalizeLanguage(nextLanguage))}
                  size="sm"
                >
                  {APP_LANGUAGES.map((item) => (
                    <SegmentedControlItem
                      key={item}
                      value={item}
                      label={t(`language.${item === "zh-CN" ? "zh" : "en"}`)}
                    />
                  ))}
                </SegmentedControl>
              </HStack>
            </HStack>
            <Stepper
              activeStep={step}
              orientation="horizontal"
              onStepClick={goTo}
              label={t("initialSetup.progressLabel")}
              density="balanced"
              indicatorPosition="on-track"
              horizontalOptions={{
                minimumStepWidth: isNarrow ? 72 : 112,
                collapsedVariant: isNarrow ? "withLabel" : "withLabelAndControls",
              }}
            >
              {steps.map((item, index) => (
                <Step
                  key={item.label}
                  step={index}
                  label={item.label}
                  status={Object.keys(shownErrors(index)).length > 0 ? "error" : undefined}
                />
              ))}
            </Stepper>
          </VStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent label={currentStep.label}>
          <VStack gap={5}>
            {step === 0 && (
              <VStack gap={5}>
                <VStack gap={1}>
                  <Heading level={2}>{t("initialSetup.admin.title")}</Heading>
                  <Text type="supporting" color="secondary">
                    {t("initialSetup.admin.description")}
                  </Text>
                </VStack>
                <FormLayout defaultOptionality="optional">
                  {requiresSetupToken ? (
                    <TextInput
                      label={t("initialSetup.admin.setupToken")}
                      ref={fieldRefs.setupToken}
                      isRequired
                      type="password"
                      value={setupToken}
                      onChange={setSetupToken}
                      placeholder={t("initialSetup.admin.setupTokenPlaceholder")}
                      status={
                        currentErrors.setupToken
                          ? { type: "error", message: currentErrors.setupToken }
                          : undefined
                      }
                    />
                  ) : null}
                  <Grid columns={isNarrow ? 1 : 4} gap={3} align="start">
                    <TextInput
                      label={t("initialSetup.admin.name")}
                      ref={fieldRefs.adminName}
                      value={adminName}
                      onChange={setAdminName}
                      placeholder={t("initialSetup.admin.namePlaceholder")}
                      status={
                        currentErrors.adminName
                          ? { type: "error", message: currentErrors.adminName }
                          : undefined
                      }
                    />
                    <TextInput
                      label={t("initialSetup.admin.username")}
                      ref={fieldRefs.username}
                      isRequired
                      value={username}
                      onChange={setUsername}
                      placeholder={t("initialSetup.admin.usernamePlaceholder")}
                      status={
                        currentErrors.username
                          ? { type: "error", message: currentErrors.username }
                          : undefined
                      }
                    />
                    <TextInput
                      label={t("initialSetup.admin.password")}
                      ref={fieldRefs.password}
                      isRequired
                      type="password"
                      value={password}
                      onChange={setPassword}
                      placeholder={t("initialSetup.admin.passwordPlaceholder")}
                      status={
                        currentErrors.password
                          ? { type: "error", message: currentErrors.password }
                          : undefined
                      }
                    />
                    <TextInput
                      label={t("initialSetup.admin.email")}
                      ref={fieldRefs.email}
                      isRequired
                      type="email"
                      value={email}
                      onChange={setEmail}
                      placeholder={t("initialSetup.admin.emailPlaceholder")}
                      status={
                        currentErrors.email
                          ? { type: "error", message: currentErrors.email }
                          : undefined
                      }
                    />
                  </Grid>
                  <MediaAssetField
                    label={t("initialSetup.admin.avatarUrl")}
                    value={avatarUrl}
                    onChange={setAvatarUrl}
                    localFile={avatarFile}
                    localImageEditorKind="avatar"
                    onLocalFileChange={setAvatarFile}
                    folderSlug="avatars"
                    allowMediaLibrary={false}
                    placeholder={t("initialSetup.admin.avatarPlaceholder")}
                    previewVariant="avatar"
                    isDisabled={isSubmitting}
                    status={
                      currentErrors.avatarUrl
                        ? { type: "error", message: currentErrors.avatarUrl }
                        : undefined
                    }
                  />
                  <TextArea
                    label={t("initialSetup.admin.bio")}
                    ref={fieldRefs.bio}
                    rows={3}
                    value={bio}
                    onChange={setBio}
                    placeholder={t("initialSetup.admin.bioPlaceholder")}
                    status={
                      currentErrors.bio ? { type: "error", message: currentErrors.bio } : undefined
                    }
                  />
                  <TextTokenizer
                    label={t("initialSetup.admin.tags")}
                    value={tagValues}
                    onChange={updateTags}
                    createLabel={(value) => t("initialSetup.createToken", { value })}
                    placeholder={t("admin.settings.tagsPlaceholder")}
                    description={t("initialSetup.admin.tagsDescription")}
                    status={
                      currentErrors.tags
                        ? { type: "error", message: currentErrors.tags }
                        : undefined
                    }
                  />
                  <Grid columns={{ minWidth: 260 }} gap={3}>
                    <Switch
                      label={t("initialSetup.admin.commentEmailNotifications")}
                      description={t("initialSetup.admin.commentEmailNotificationsDescription")}
                      value={commentEmailNotifications}
                      onChange={setCommentEmailNotifications}
                      labelPosition="start"
                      labelSpacing="spread"
                    />
                    <Switch
                      label={t("initialSetup.admin.newPostEmailNotifications")}
                      description={t("initialSetup.admin.newPostEmailNotificationsDescription")}
                      value={newPostEmailNotifications}
                      onChange={setNewPostEmailNotifications}
                      labelPosition="start"
                      labelSpacing="spread"
                    />
                  </Grid>
                  <Divider />
                  <VStack gap={3}>
                    <HStack gap={3} vAlign="center" wrap="wrap">
                      <StackItem size="fill" style={isNarrow ? MOBILE_FULL_WIDTH_STYLE : undefined}>
                        <Text type="label">{t("initialSetup.admin.socialLinks")}</Text>
                      </StackItem>
                      <Button
                        label={t("actions.addSocialLink")}
                        variant="secondary"
                        width={isNarrow ? "100%" : undefined}
                        onClick={addSocialLink}
                      />
                    </HStack>
                    {socialLinks.length === 0 && (
                      <Text type="supporting" color="secondary">
                        {t("initialSetup.admin.socialEmpty")}
                      </Text>
                    )}
                    {socialLinks.map((link) => (
                      <Grid key={link.id} columns={{ minWidth: 220 }} gap={3}>
                        <TextInput
                          label={t("initialSetup.admin.linkLabel")}
                          value={link.label}
                          onChange={(value) => updateSocialLink(link.id, "label", value)}
                          placeholder={t("initialSetup.admin.linkLabelPlaceholder")}
                        />
                        <TextInput
                          label={t("initialSetup.admin.linkUrl")}
                          value={link.url}
                          onChange={(value) => updateSocialLink(link.id, "url", value)}
                          placeholder={t("initialSetup.admin.linkUrlPlaceholder")}
                          status={
                            currentErrors[`social-${link.id}`]
                              ? { type: "error", message: currentErrors[`social-${link.id}`] }
                              : undefined
                          }
                        />
                        <HStack gap={2} vAlign="end">
                          <Button
                            label={t("actions.remove")}
                            variant="ghost"
                            onClick={() => removeSocialLink(link.id)}
                          />
                        </HStack>
                      </Grid>
                    ))}
                  </VStack>
                  <TextInput
                    label={t("initialSetup.admin.blogUrl")}
                    ref={fieldRefs.blogUrl}
                    value={blogUrl}
                    onChange={setBlogUrl}
                    placeholder={t("initialSetup.admin.blogUrlPlaceholder")}
                    status={
                      currentErrors.blogUrl
                        ? { type: "error", message: currentErrors.blogUrl }
                        : undefined
                    }
                  />
                </FormLayout>
              </VStack>
            )}

            {step === 1 && (
              <VStack gap={5}>
                <VStack gap={1}>
                  <Heading level={2}>{t("initialSetup.site.title")}</Heading>
                  <Text type="supporting" color="secondary">
                    {t("initialSetup.site.description")}
                  </Text>
                </VStack>
                <FormLayout defaultOptionality="optional">
                  <Grid columns={isNarrow ? 1 : 3} gap={3} align="start">
                    <TextInput
                      label={t("initialSetup.site.siteName")}
                      ref={fieldRefs.siteName}
                      value={siteName}
                      onChange={setSiteName}
                      placeholder={t("initialSetup.site.siteNamePlaceholder")}
                      status={
                        currentErrors.siteName
                          ? { type: "error", message: currentErrors.siteName }
                          : undefined
                      }
                    />
                    <VStack gap={2}>
                      <TextInput
                        label={t("initialSetup.site.foundedAt")}
                        ref={fieldRefs.foundedAt}
                        value={foundedAt}
                        onChange={setFoundedAt}
                        placeholder={t("initialSetup.site.foundedAtPlaceholder")}
                        status={
                          currentErrors.foundedAt
                            ? { type: "error", message: currentErrors.foundedAt }
                            : undefined
                        }
                      />
                      <HStack>
                        <Button
                          label={t("actions.now")}
                          variant="secondary"
                          width={isNarrow ? "100%" : undefined}
                          onClick={() => setFoundedAt(formatCurrentMinuteInTimeZone(timeZone))}
                        />
                      </HStack>
                    </VStack>
                    <VStack gap={2}>
                      <Selector
                        label={t("initialSetup.site.timeZone")}
                        options={timeZoneOptions}
                        value={timeZone}
                        onChange={setTimeZone}
                        hasSearch
                        searchPlaceholder={t("initialSetup.site.timeZoneSearch")}
                        status={
                          currentErrors.timeZone
                            ? { type: "error", message: currentErrors.timeZone }
                            : undefined
                        }
                      />
                      <HStack>
                        <Button
                          label={t("initialSetup.site.useSystemTimeZone")}
                          variant="secondary"
                          width={isNarrow ? "100%" : undefined}
                          onClick={() => setTimeZone(getSystemTimeZone())}
                        />
                      </HStack>
                    </VStack>
                  </Grid>
                  <Text type="supporting" color="secondary">
                    {t("initialSetup.site.timeZoneDescription", {
                      offset: formatTimeZoneOffset({ timeZone }),
                    })}
                  </Text>
                  <TextArea
                    label={t("initialSetup.site.descriptionLabel")}
                    ref={fieldRefs.siteDescription}
                    rows={3}
                    value={siteDescription}
                    onChange={setSiteDescription}
                    placeholder={t("initialSetup.site.descriptionPlaceholder")}
                    status={
                      currentErrors.siteDescription
                        ? { type: "error", message: currentErrors.siteDescription }
                        : undefined
                    }
                  />
                  <MultiMediaAssetField
                    label={t("initialSetup.site.covers")}
                    values={coverUrlValues}
                    localFiles={coverFiles}
                    onChange={(values) => setCoverUrls(values.join("\n"))}
                    onLocalFilesChange={setCoverFiles}
                    folderSlug="site"
                    allowMediaLibrary={false}
                    placeholder={t("initialSetup.site.coversPlaceholder")}
                    isDisabled={isSubmitting}
                    status={
                      currentErrors.coverUrls
                        ? { type: "error", message: currentErrors.coverUrls }
                        : undefined
                    }
                  />
                  <TextArea
                    label={t("initialSetup.site.homepageCopy")}
                    ref={fieldRefs.homepageCopy}
                    rows={4}
                    value={homepageCopy}
                    onChange={setHomepageCopy}
                    placeholder={t("initialSetup.site.homepageCopyPlaceholder")}
                    status={
                      currentErrors.homepageCopy
                        ? { type: "error", message: currentErrors.homepageCopy }
                        : undefined
                    }
                  />
                  <Grid columns={{ minWidth: 260 }} gap={3}>
                    <MediaAssetField
                      label={t("initialSetup.site.lightLogo")}
                      value={lightLogoUrl}
                      onChange={setLightLogoUrl}
                      localFile={lightLogoFile}
                      onLocalFileChange={setLightLogoFile}
                      folderSlug="site"
                      allowMediaLibrary={false}
                      placeholder={t("initialSetup.site.lightLogoPlaceholder")}
                      isDisabled={isSubmitting}
                      status={
                        currentErrors.lightLogoUrl
                          ? { type: "error", message: currentErrors.lightLogoUrl }
                          : undefined
                      }
                    />
                    <MediaAssetField
                      label={t("initialSetup.site.darkLogo")}
                      value={darkLogoUrl}
                      onChange={setDarkLogoUrl}
                      localFile={darkLogoFile}
                      onLocalFileChange={setDarkLogoFile}
                      folderSlug="site"
                      allowMediaLibrary={false}
                      placeholder={t("initialSetup.site.darkLogoPlaceholder")}
                      isDisabled={isSubmitting}
                      status={
                        currentErrors.darkLogoUrl
                          ? { type: "error", message: currentErrors.darkLogoUrl }
                          : undefined
                      }
                    />
                    <MediaAssetField
                      label={t("initialSetup.site.favicon")}
                      value={faviconUrl}
                      onChange={setFaviconUrl}
                      localFile={faviconFile}
                      onLocalFileChange={setFaviconFile}
                      folderSlug="site"
                      allowMediaLibrary={false}
                      placeholder={t("initialSetup.site.faviconPlaceholder")}
                      previewVariant="favicon"
                      isDisabled={isSubmitting}
                      status={
                        currentErrors.faviconUrl
                          ? { type: "error", message: currentErrors.faviconUrl }
                          : undefined
                      }
                    />
                  </Grid>
                </FormLayout>
              </VStack>
            )}

            {step === 2 && (
              <VStack gap={5}>
                <VStack gap={1}>
                  <Heading level={2}>{t("initialSetup.basics.title")}</Heading>
                  <Text type="supporting" color="secondary">
                    {t("initialSetup.basics.description")}
                  </Text>
                </VStack>
                <FormLayout defaultOptionality="optional">
                  <TextInput
                    label={t("initialSetup.basics.seoTitle")}
                    ref={fieldRefs.seoTitle}
                    value={seoTitle}
                    onChange={setSeoTitle}
                    placeholder={t("initialSetup.basics.seoTitlePlaceholder")}
                    status={
                      currentErrors.seoTitle
                        ? { type: "error", message: currentErrors.seoTitle }
                        : undefined
                    }
                  />
                  <TextArea
                    label={t("initialSetup.basics.seoDescription")}
                    ref={fieldRefs.seoDescription}
                    rows={3}
                    value={seoDescription}
                    onChange={setSeoDescription}
                    placeholder={t("initialSetup.basics.seoDescriptionPlaceholder")}
                    status={
                      currentErrors.seoDescription
                        ? { type: "error", message: currentErrors.seoDescription }
                        : undefined
                    }
                  />
                  <TextTokenizer
                    label={t("initialSetup.basics.seoKeywords")}
                    value={keywordValues}
                    onChange={setSeoKeywords}
                    createLabel={(value) => t("initialSetup.createToken", { value })}
                    placeholder={t("initialSetup.basics.seoKeywordsPlaceholder")}
                    description={t("initialSetup.basics.seoKeywordsDescription")}
                    status={
                      currentErrors.seoKeywords
                        ? { type: "error", message: currentErrors.seoKeywords }
                        : undefined
                    }
                  />
                  <TextInput
                    label={t("initialSetup.basics.copyright")}
                    ref={fieldRefs.copyright}
                    value={copyright}
                    onChange={setCopyright}
                    placeholder={t("initialSetup.basics.copyrightPlaceholder")}
                    status={
                      currentErrors.copyright
                        ? { type: "error", message: currentErrors.copyright }
                        : undefined
                    }
                  />
                  <Switch
                    label={t("initialSetup.basics.comments")}
                    description={t("initialSetup.basics.commentsDescription")}
                    value={commentsEnabled}
                    onChange={setCommentsEnabled}
                    labelPosition="start"
                    labelSpacing="spread"
                  />
                  <Divider />
                  <Grid columns={{ minWidth: 260 }} gap={3}>
                    <TextInput
                      label={t("initialSetup.basics.resendDomain")}
                      ref={fieldRefs.resendDomain}
                      value={resendDomain}
                      onChange={setResendDomain}
                      placeholder={t("initialSetup.basics.resendDomainPlaceholder")}
                      status={
                        currentErrors.resendDomain
                          ? { type: "error", message: currentErrors.resendDomain }
                          : undefined
                      }
                    />
                    <TextInput
                      label={t("initialSetup.basics.resendApiKey")}
                      ref={fieldRefs.resendApiKey}
                      type="password"
                      value={resendApiKey}
                      onChange={setResendApiKey}
                      placeholder={t("initialSetup.basics.secretPlaceholder")}
                      status={
                        currentErrors.resendApiKey
                          ? { type: "error", message: currentErrors.resendApiKey }
                          : undefined
                      }
                    />
                    <TextInput
                      label={t("initialSetup.basics.deeplApiKey")}
                      ref={fieldRefs.deeplApiKey}
                      type="password"
                      value={deeplApiKey}
                      onChange={setDeeplApiKey}
                      placeholder={t("initialSetup.basics.secretPlaceholder")}
                      status={
                        currentErrors.deeplApiKey
                          ? { type: "error", message: currentErrors.deeplApiKey }
                          : undefined
                      }
                    />
                    <TextInput
                      label={t("initialSetup.basics.ipGeolocationApiKey")}
                      ref={fieldRefs.ipGeolocationApiKey}
                      type="password"
                      value={ipGeolocationApiKey}
                      onChange={setIpGeolocationApiKey}
                      placeholder={t("initialSetup.basics.secretPlaceholder")}
                      status={
                        currentErrors.ipGeolocationApiKey
                          ? { type: "error", message: currentErrors.ipGeolocationApiKey }
                          : undefined
                      }
                    />
                  </Grid>
                </FormLayout>
              </VStack>
            )}

            {step === 3 && (
              <VStack gap={5}>
                <VStack gap={1}>
                  <Heading level={2}>{t("initialSetup.filings.title")}</Heading>
                  <Text type="supporting" color="secondary">
                    {t("initialSetup.filings.description")}
                  </Text>
                </VStack>
                <FormLayout defaultOptionality="optional">
                  <VStack gap={3}>
                    <HStack gap={3} vAlign="center" wrap="wrap">
                      <StackItem size="fill" style={isNarrow ? MOBILE_FULL_WIDTH_STYLE : undefined}>
                        <Text type="label">{t("initialSetup.filings.icpSection")}</Text>
                      </StackItem>
                      <Button
                        label={t("actions.addIcpRecord")}
                        variant="secondary"
                        width={isNarrow ? "100%" : undefined}
                        onClick={addIcpRecord}
                      />
                    </HStack>
                    {icpRecords.map((record, index) => (
                      <Grid key={record.id} columns={{ minWidth: 260 }} gap={3}>
                        <TextInput
                          label={t("initialSetup.filings.icpNumber", { index: index + 1 })}
                          value={record.number}
                          onChange={(value) => updateIcpRecord(record.id, "number", value)}
                          placeholder={t("initialSetup.filings.icpNumberPlaceholder")}
                          status={
                            currentErrors[`icp-${record.id}`]
                              ? { type: "error", message: currentErrors[`icp-${record.id}`] }
                              : undefined
                          }
                        />
                        <TextInput
                          label={t("initialSetup.filings.icpUrl", { index: index + 1 })}
                          value={record.url}
                          onChange={(value) => updateIcpRecord(record.id, "url", value)}
                          placeholder={t("initialSetup.filings.icpUrlPlaceholder")}
                        />
                        <HStack gap={2} vAlign="end">
                          <Button
                            label={t("actions.remove")}
                            variant="ghost"
                            isDisabled={icpRecords.length === 1}
                            onClick={() => removeIcpRecord(record.id)}
                          />
                        </HStack>
                      </Grid>
                    ))}
                  </VStack>
                  <Divider />
                  <Grid columns={{ minWidth: 260 }} gap={3}>
                    <TextInput
                      label={t("initialSetup.filings.policeNumber")}
                      value={policeRecordNumber}
                      onChange={setPoliceRecordNumber}
                      placeholder={t("initialSetup.filings.policeNumberPlaceholder")}
                      status={
                        currentErrors.policeRecordNumber
                          ? { type: "error", message: currentErrors.policeRecordNumber }
                          : undefined
                      }
                    />
                    <TextInput
                      label={t("initialSetup.filings.policeUrl")}
                      value={policeRecordUrl}
                      onChange={setPoliceRecordUrl}
                      placeholder={t("initialSetup.filings.policeUrlPlaceholder")}
                      status={
                        currentErrors.policeRecordUrl
                          ? { type: "error", message: currentErrors.policeRecordUrl }
                          : undefined
                      }
                    />
                  </Grid>
                  <Card variant="muted" padding={5}>
                    <VStack gap={3}>
                      <Heading level={3}>{t("initialSetup.summary.title")}</Heading>
                      <MetadataList orientation="vertical">
                        <MetadataListItem label={t("initialSetup.summary.admin")}>
                          {adminName.trim() || missingText} / {username.trim() || missingText}
                        </MetadataListItem>
                        <MetadataListItem label={t("initialSetup.summary.tags")}>
                          {formatList(tagValues, missingText)}
                        </MetadataListItem>
                        <MetadataListItem label={t("initialSetup.summary.emailNotifications")}>
                          {t("initialSetup.admin.commentEmailNotifications")}:{" "}
                          {t(commentEmailNotifications ? "common.enabled" : "common.disabled")} /{" "}
                          {t("initialSetup.admin.newPostEmailNotifications")}:{" "}
                          {t(newPostEmailNotifications ? "common.enabled" : "common.disabled")}
                        </MetadataListItem>
                        <MetadataListItem label={t("initialSetup.summary.site")}>
                          {siteName.trim() || missingText} / {foundedAt.trim() || missingText}
                        </MetadataListItem>
                        <MetadataListItem label={t("initialSetup.summary.timeZone")}>
                          {timeZone}
                        </MetadataListItem>
                        <MetadataListItem label={t("initialSetup.summary.covers")}>
                          {t("initialSetup.summary.coversCount", {
                            count: coverUrlValues.length + coverFiles.length,
                          })}
                        </MetadataListItem>
                        <MetadataListItem label={t("initialSetup.summary.seoKeywords")}>
                          {formatList(keywordValues, missingText)}
                        </MetadataListItem>
                        <MetadataListItem label={t("initialSetup.summary.comments")}>
                          {t(commentsEnabled ? "common.enabled" : "common.disabled")}
                        </MetadataListItem>
                        <MetadataListItem label={t("initialSetup.summary.icp")}>
                          {t("initialSetup.summary.icpCount", {
                            count: icpRecords.filter((record) => record.number.trim()).length,
                          })}
                        </MetadataListItem>
                        <MetadataListItem label={t("initialSetup.summary.police")}>
                          {policeRecordNumber.trim() || missingText}
                        </MetadataListItem>
                      </MetadataList>
                    </VStack>
                  </Card>
                </FormLayout>
              </VStack>
            )}
          </VStack>
        </LayoutContent>
      }
      footer={
        <LayoutFooter>
          <VStack gap={3}>
            <UploadProgressList language={language} uploads={uploads} />
            <HStack gap={3} vAlign="center" wrap="wrap">
              <StackItem size="fill" style={isNarrow ? MOBILE_FULL_WIDTH_STYLE : FOOTER_ZONE_STYLE}>
                <Text type="supporting" color="secondary">
                  {currentStep.description}
                </Text>
              </StackItem>
              <Text type="supporting" color="secondary">
                {step + 1} {t("common.of")} {steps.length}
              </Text>
              <StackItem size="fill" style={isNarrow ? MOBILE_FULL_WIDTH_STYLE : FOOTER_ZONE_STYLE}>
                <HStack gap={3} hAlign={isNarrow ? "start" : "end"} wrap="wrap">
                  <Button
                    label={t("actions.previous")}
                    variant="secondary"
                    width={isNarrow ? "100%" : undefined}
                    isDisabled={step === 0 || isSubmitting}
                    onClick={() => setStep((value) => Math.max(0, value - 1))}
                  />
                  <Button
                    label={
                      isSubmitting
                        ? t("actions.saving")
                        : isLastStep
                          ? t("actions.finish")
                          : t("actions.next")
                    }
                    variant="primary"
                    width={isNarrow ? "100%" : undefined}
                    isLoading={isSubmitting}
                    onClick={goNext}
                  />
                </HStack>
              </StackItem>
            </HStack>
          </VStack>
        </LayoutFooter>
      }
    />
  );
}
