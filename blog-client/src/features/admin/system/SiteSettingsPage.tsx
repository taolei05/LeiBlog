import {
  Accordion,
  AlertDialog,
  Button,
  Chip,
  Description,
  FieldError,
  Form,
  Input,
  InputGroup,
  InputOTP,
  Label,
  Modal,
  Switch,
  TextArea,
  TextField,
} from "@heroui/react";
import type { ChangeEvent, Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import { useEffect, useState } from "react";

import type { AppIconName } from "../../../shared/icons";
import { AppIcon } from "../../../shared/icons";
import { useAdminSession } from "../../../shared/routing/adminGuards";
import { showOperationToast } from "../../../shared/toast/operation-toast";
import { adminFetch, uploadAdminMediaFile } from "../shared/admin-api";
import { MediaAssetField, MultiMediaAssetField } from "../shared/media-asset-field";

type SiteInfoState = {
  description: string;
  establishedAt: string;
  faviconUrl: string;
  homeCoverUrls: string[];
  homeSlogan: string;
  logoDarkUrl: string;
  logoLightUrl: string;
  siteName: string;
};

type SiteConfigState = {
  commentsEnabled: boolean;
  copyright: string;
  deeplApiKey: string;
  ipgeolocationApiKey: string;
  resendApiKey: string;
  resendDomain: string;
  seoDescription: string;
  seoKeywords: string;
  seoTitle: string;
};

type IcpRecordState = {
  id: string;
  number: string;
  url: string;
};

type IcpRecordItem = {
  number: string;
  url: string | null;
};

type FilingState = {
  icpRecords: IcpRecordState[];
  policeNumber: string;
  policeUrl: string;
};

type SiteInfoItem = {
  description: string;
  establishedAt: string;
  faviconUrl: string | null;
  homeCoverUrls?: string[];
  homeSlogan: string;
  logoDarkUrl: string | null;
  logoLightUrl: string | null;
  siteName: string;
};

type SiteConfigItem = {
  commentsEnabled: boolean;
  copyright: string;
  hasDeepLApiKey: boolean;
  hasIpgeolocationApiKey: boolean;
  hasResendApiKey: boolean;
  resendDomain: string | null;
  seoDescription: string;
  seoKeywords: string[];
  seoTitle: string;
};

type FilingItem = {
  icpNumber: string | null;
  icpRecords?: IcpRecordItem[];
  icpUrl: string | null;
  policeNumber: string | null;
  policeUrl: string | null;
};

type ApiKeyItem = {
  deeplApiKey: string | null;
  ipgeolocationApiKey: string | null;
  resendApiKey: string | null;
};

type ApiKeyEmailCodeResult = {
  expiresAt: string;
  sent: boolean;
  validMinutes: number;
};

type SecretFieldKey = "deeplApiKey" | "ipgeolocationApiKey" | "resendApiKey" | "resendDomain";

type SiteSettingsSaveKind = "filing" | "site-config" | "site-info";

type TestModalState =
  | {
      kind: "deepl";
    }
  | {
      kind: "ipgeolocation";
    }
  | {
      kind: "resend";
      target: "apiKey" | "domain";
    };

type TestResultState = {
  message: string;
  status: "danger" | "success";
};

const secretRevealCopy: Record<
  SecretFieldKey,
  {
    description: string;
    title: string;
    valueLabel: string;
  }
> = {
  deeplApiKey: {
    description: "正在查看 DeepL API Key。查看前需要通过管理员邮箱验证码。",
    title: "查看 DeepL API Key",
    valueLabel: "DeepL API Key",
  },
  ipgeolocationApiKey: {
    description: "正在查看 IPGeolocation API Key。查看前需要通过管理员邮箱验证码。",
    title: "查看 IPGeolocation API Key",
    valueLabel: "IPGeolocation API Key",
  },
  resendApiKey: {
    description:
      "正在查看 Resend API Key。验证码会发送到管理员邮箱；Resend 未配置已验证域名时，只能向注册 Resend 的邮箱发送邮件，请先配置 Resend 域名。",
    title: "查看 Resend API Key",
    valueLabel: "Resend API Key",
  },
  resendDomain: {
    description: "Resend 域名不是密钥，可直接复制。",
    title: "查看 Resend 域名",
    valueLabel: "Resend 域名",
  },
};

type IntegrationLoginInfo = {
  device: string;
  ip: string;
  location: string;
};

const saveConfirmationCopy: Record<
  SiteSettingsSaveKind,
  {
    confirmLabel: string;
    description: string;
    title: string;
  }
> = {
  filing: {
    confirmLabel: "确认保存",
    description: "保存后，前台页脚会按最新备案信息展示。",
    title: "确认保存备案配置？",
  },
  "site-config": {
    confirmLabel: "确认保存",
    description: "保存后，SEO、集成配置和评论开关会立即按最新设置生效。",
    title: "确认保存站点配置？",
  },
  "site-info": {
    confirmLabel: "确认保存",
    description: "保存后，站点名称、Logo、favicon、首页封面和首页文案会更新。",
    title: "确认保存站点信息？",
  },
};

const defaultSiteInfo: SiteInfoState = {
  description: "",
  establishedAt: toLocalDateTimeValue(new Date()),
  faviconUrl: "",
  homeCoverUrls: [],
  homeSlogan: "",
  logoDarkUrl: "",
  logoLightUrl: "",
  siteName: "",
};

const defaultSiteConfig: SiteConfigState = {
  commentsEnabled: true,
  copyright: "",
  deeplApiKey: "",
  ipgeolocationApiKey: "",
  resendApiKey: "",
  resendDomain: "",
  seoDescription: "",
  seoKeywords: "",
  seoTitle: "",
};

const defaultFiling: FilingState = {
  icpRecords: [createEmptyIcpRecord()],
  policeNumber: "",
  policeUrl: "",
};

const revealCodeResendCooldownMs = 60_000;
const revealCodeResendStorageKey = "leiblog:admin:api-key-reveal-code-resend-available-at";

function createEmptyIcpRecord(id = "icp-record-1"): IcpRecordState {
  return {
    id,
    number: "",
    url: "",
  };
}

function toIcpRecordStates(item: FilingItem) {
  const records =
    item.icpRecords && item.icpRecords.length > 0
      ? item.icpRecords
      : item.icpNumber
        ? [{ number: item.icpNumber, url: item.icpUrl }]
        : [];

  if (records.length === 0) return [createEmptyIcpRecord()];

  return records.map((record, index) => ({
    id: `icp-record-${index + 1}`,
    number: record.number,
    url: record.url ?? "",
  }));
}

function toIcpRecordPayload(records: IcpRecordState[]) {
  return records
    .map((record) => ({
      number: record.number.trim(),
      url: toOptional(record.url),
    }))
    .filter((record) => record.number);
}

function toLocalDateTimeValue(date: Date) {
  const timezoneOffset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function toOptional(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function toOptionalList(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function getLoadedHomeCoverUrls(item: SiteInfoItem) {
  return toOptionalList(item.homeCoverUrls ?? []);
}

function formatCountdown(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function readRevealCodeResendAvailableAt() {
  const rawValue = window.localStorage.getItem(revealCodeResendStorageKey);

  if (!rawValue) {
    return null;
  }

  const availableAt = Number(rawValue);

  if (!Number.isFinite(availableAt) || availableAt <= Date.now()) {
    window.localStorage.removeItem(revealCodeResendStorageKey);

    return null;
  }

  return availableAt;
}

function getTestModalCopy(state: TestModalState | null) {
  if (!state) {
    return {
      actionLabel: "开始测试",
      description: "测试结果会在当前弹窗中反馈。",
      resultTitle: "测试结果",
      title: "测试配置",
    };
  }

  switch (state.kind) {
    case "deepl":
      return {
        actionLabel: "翻译测试",
        description: "输入一段中文文本，验证 DeepL API Key 是否可正常翻译。",
        resultTitle: "DeepL API Key 测试结果",
        title: "测试 DeepL API Key",
      };
    case "ipgeolocation":
      return {
        actionLabel: "开始测试",
        description: "读取当前管理员最近一次登录 IP、地点和设备，验证定位服务是否可用。",
        resultTitle: "IPGeolocation API Key 测试结果",
        title: "测试 IPGeolocation API Key",
      };
    case "resend":
      return state.target === "domain"
        ? {
            actionLabel: "测试域名",
            description: "验证 Resend 发信域名配置是否可用；成功后会发送提醒邮件到管理员邮箱。",
            resultTitle: "Resend 域名测试结果",
            title: "测试 Resend 域名",
          }
        : {
            actionLabel: "测试 API Key",
            description: "验证 Resend API Key 是否可用；成功后会发送提醒邮件到管理员邮箱。",
            resultTitle: "Resend API Key 测试结果",
            title: "测试 Resend API Key",
          };
    default: {
      const exhaustiveState: never = state;

      return exhaustiveState;
    }
  }
}

function splitKeywords(value: string) {
  return [
    ...new Set(
      value
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function createInputHandler<T extends Record<string, unknown>>({
  key,
  setState,
}: {
  key: keyof T;
  setState: Dispatch<SetStateAction<T>>;
}) {
  return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setState((state) => ({ ...state, [key]: event.target.value }));
  };
}

export function SiteSettingsPage() {
  const session = useAdminSession();
  const [siteInfo, setSiteInfo] = useState<SiteInfoState>(defaultSiteInfo);
  const [siteConfig, setSiteConfig] = useState<SiteConfigState>(defaultSiteConfig);
  const [filing, setFiling] = useState<FilingState>(defaultFiling);
  const [logoLightFile, setLogoLightFile] = useState<File | null>(null);
  const [logoDarkFile, setLogoDarkFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [homeCoverFiles, setHomeCoverFiles] = useState<File[]>([]);
  const [keyFlags, setKeyFlags] = useState({
    hasDeepLApiKey: false,
    hasIpgeolocationApiKey: false,
    hasResendApiKey: false,
  });
  const [revealKey, setRevealKey] = useState<SecretFieldKey | null>(null);
  const [emailCode, setEmailCode] = useState("");
  const [revealedValue, setRevealedValue] = useState("");
  const [revealCodeExpiresAt, setRevealCodeExpiresAt] = useState<string | null>(null);
  const [revealCodeValidMinutes, setRevealCodeValidMinutes] = useState<number | null>(null);
  const [revealCountdownSeconds, setRevealCountdownSeconds] = useState(0);
  const [revealResendAvailableAt, setRevealResendAvailableAt] = useState<number | null>(null);
  const [revealResendCountdownSeconds, setRevealResendCountdownSeconds] = useState(0);
  const [testModalState, setTestModalState] = useState<TestModalState | null>(null);
  const [testText, setTestText] = useState("你好，LeiBlog");
  const [testResult, setTestResult] = useState<TestResultState | null>(null);
  const [testLogin, setTestLogin] = useState<IntegrationLoginInfo | null>(null);
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [pendingSave, setPendingSave] = useState<SiteSettingsSaveKind | null>(null);
  const isReadOnly = session.isReadOnly;
  const isResendDomainReveal = revealKey === "resendDomain";
  const revealCopy = revealKey ? secretRevealCopy[revealKey] : secretRevealCopy.resendApiKey;
  const isSecretRevealed = Boolean(revealedValue);
  const revealSendLabel =
    revealResendCountdownSeconds > 0
      ? `重新发送验证码 ${revealResendCountdownSeconds}s`
      : revealCodeExpiresAt
        ? "重新发送验证码"
        : "发送验证码";
  const testModalCopy = getTestModalCopy(testModalState);

  function updateNotice(message: string) {
    setNotice(message);
    showOperationToast(message);
  }

  async function loadSettings() {
    const [siteInfoResponse, siteConfigResponse, filingResponse] = await Promise.all([
      adminFetch<{ item: SiteInfoItem | null }>("/admin/system/site-info"),
      adminFetch<{ item: SiteConfigItem | null }>("/admin/system/site-config"),
      adminFetch<{ item: FilingItem | null }>("/admin/system/filing"),
    ]);

    if (siteInfoResponse.item) {
      setSiteInfo({
        description: siteInfoResponse.item.description,
        establishedAt: toLocalDateTimeValue(new Date(siteInfoResponse.item.establishedAt)),
        faviconUrl: siteInfoResponse.item.faviconUrl ?? "",
        homeCoverUrls: getLoadedHomeCoverUrls(siteInfoResponse.item),
        homeSlogan: siteInfoResponse.item.homeSlogan,
        logoDarkUrl: siteInfoResponse.item.logoDarkUrl ?? "",
        logoLightUrl: siteInfoResponse.item.logoLightUrl ?? "",
        siteName: siteInfoResponse.item.siteName,
      });
    }

    if (siteConfigResponse.item) {
      setSiteConfig({
        commentsEnabled: siteConfigResponse.item.commentsEnabled,
        copyright: siteConfigResponse.item.copyright,
        deeplApiKey: "",
        ipgeolocationApiKey: "",
        resendApiKey: "",
        resendDomain: siteConfigResponse.item.resendDomain ?? "",
        seoDescription: siteConfigResponse.item.seoDescription,
        seoKeywords: siteConfigResponse.item.seoKeywords.join("，"),
        seoTitle: siteConfigResponse.item.seoTitle,
      });
      setKeyFlags({
        hasDeepLApiKey: siteConfigResponse.item.hasDeepLApiKey,
        hasIpgeolocationApiKey: siteConfigResponse.item.hasIpgeolocationApiKey,
        hasResendApiKey: siteConfigResponse.item.hasResendApiKey,
      });
    }

    if (filingResponse.item) {
      setFiling({
        icpRecords: toIcpRecordStates(filingResponse.item),
        policeNumber: filingResponse.item.policeNumber ?? "",
        policeUrl: filingResponse.item.policeUrl ?? "",
      });
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  useEffect(() => {
    setRevealResendAvailableAt(readRevealCodeResendAvailableAt());
  }, []);

  useEffect(() => {
    if (!revealCodeExpiresAt) {
      setRevealCountdownSeconds(0);

      return;
    }

    const expiresAt = revealCodeExpiresAt;

    function updateCountdown() {
      const remainingSeconds = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000);

      setRevealCountdownSeconds(Math.max(0, remainingSeconds));
    }

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);

    return () => window.clearInterval(timer);
  }, [revealCodeExpiresAt]);

  useEffect(() => {
    if (!revealResendAvailableAt) {
      setRevealResendCountdownSeconds(0);

      return;
    }

    const availableAt = revealResendAvailableAt;

    function updateCountdown() {
      const remainingSeconds = Math.ceil((availableAt - Date.now()) / 1000);

      if (remainingSeconds <= 0) {
        window.localStorage.removeItem(revealCodeResendStorageKey);
        setRevealResendAvailableAt(null);
        setRevealResendCountdownSeconds(0);

        return;
      }

      setRevealResendCountdownSeconds(remainingSeconds);
    }

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);

    return () => window.clearInterval(timer);
  }, [revealResendAvailableAt]);

  function requestSave(kind: SiteSettingsSaveKind, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isReadOnly || isSaving) return;

    setPendingSave(kind);
  }

  function confirmPendingSave() {
    if (!pendingSave) return;

    const saveKind = pendingSave;

    setPendingSave(null);

    switch (saveKind) {
      case "filing":
        void saveFiling();
        return;
      case "site-config":
        void saveSiteConfig();
        return;
      case "site-info":
        void saveSiteInfo();
        return;
      default: {
        const exhaustiveSaveKind: never = saveKind;

        return exhaustiveSaveKind;
      }
    }
  }

  async function saveSiteInfo() {
    setIsSaving(true);

    try {
      const logoLightUrl = logoLightFile
        ? (await uploadAdminMediaFile({ file: logoLightFile, folderSlug: "site" })).item.accessUrl
        : siteInfo.logoLightUrl;
      const logoDarkUrl = logoDarkFile
        ? (await uploadAdminMediaFile({ file: logoDarkFile, folderSlug: "site" })).item.accessUrl
        : siteInfo.logoDarkUrl;
      const faviconUrl = faviconFile
        ? (await uploadAdminMediaFile({ file: faviconFile, folderSlug: "site" })).item.accessUrl
        : siteInfo.faviconUrl;
      const uploadedHomeCoverUrls = await Promise.all(
        homeCoverFiles.map(async (file) => {
          const response = await uploadAdminMediaFile({ file, folderSlug: "site" });
          return response.item.accessUrl;
        }),
      );
      const homeCoverUrls = toOptionalList([...siteInfo.homeCoverUrls, ...uploadedHomeCoverUrls]);

      await adminFetch("/admin/system/site-info", {
        body: {
          description: siteInfo.description,
          establishedAt: new Date(siteInfo.establishedAt).toISOString(),
          faviconUrl: toOptional(faviconUrl),
          homeCoverUrls,
          homeSlogan: siteInfo.homeSlogan,
          logoDarkUrl: toOptional(logoDarkUrl),
          logoLightUrl: toOptional(logoLightUrl),
          siteName: siteInfo.siteName,
        },
        method: "PATCH",
      });
      setLogoLightFile(null);
      setLogoDarkFile(null);
      setFaviconFile(null);
      setHomeCoverFiles([]);
      updateNotice("站点信息已保存");
      await loadSettings();
    } catch (error) {
      updateNotice(error instanceof Error ? error.message : "站点信息保存失败");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveSiteConfig() {
    setIsSaving(true);

    try {
      const body: Record<string, unknown> = {
        commentsEnabled: siteConfig.commentsEnabled,
        copyright: siteConfig.copyright,
        resendDomain: toOptional(siteConfig.resendDomain),
        seoDescription: siteConfig.seoDescription,
        seoKeywords: splitKeywords(siteConfig.seoKeywords),
        seoTitle: siteConfig.seoTitle,
      };

      if (siteConfig.resendApiKey.trim()) body.resendApiKey = siteConfig.resendApiKey.trim();
      if (siteConfig.deeplApiKey.trim()) body.deeplApiKey = siteConfig.deeplApiKey.trim();
      if (siteConfig.ipgeolocationApiKey.trim()) {
        body.ipgeolocationApiKey = siteConfig.ipgeolocationApiKey.trim();
      }

      await adminFetch("/admin/system/site-config", {
        body,
        method: "PATCH",
      });
      updateNotice("站点配置已保存");
      await loadSettings();
    } catch (error) {
      updateNotice(error instanceof Error ? error.message : "站点配置保存失败");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveFiling() {
    setIsSaving(true);

    try {
      await adminFetch("/admin/system/filing", {
        body: {
          icpRecords: toIcpRecordPayload(filing.icpRecords),
          policeNumber: toOptional(filing.policeNumber),
          policeUrl: toOptional(filing.policeUrl),
        },
        method: "PATCH",
      });
      updateNotice("备案配置已保存");
      await loadSettings();
    } catch (error) {
      updateNotice(error instanceof Error ? error.message : "备案配置保存失败");
    } finally {
      setIsSaving(false);
    }
  }

  function updateIcpRecord(index: number, key: "number" | "url", value: string) {
    setFiling((state) => ({
      ...state,
      icpRecords: state.icpRecords.map((record, recordIndex) =>
        recordIndex === index ? { ...record, [key]: value } : record,
      ),
    }));
  }

  function addIcpRecord() {
    setFiling((state) => ({
      ...state,
      icpRecords: [
        ...state.icpRecords,
        createEmptyIcpRecord(`icp-record-${Date.now()}-${state.icpRecords.length + 1}`),
      ],
    }));
  }

  function removeIcpRecord(index: number) {
    setFiling((state) => {
      const icpRecords = state.icpRecords.filter((_, recordIndex) => recordIndex !== index);

      return {
        ...state,
        icpRecords: icpRecords.length > 0 ? icpRecords : [createEmptyIcpRecord()],
      };
    });
  }

  async function sendRevealCode() {
    if (isResendDomainReveal) {
      return;
    }

    if (revealResendCountdownSeconds > 0) {
      updateNotice(`请 ${revealResendCountdownSeconds} 秒后再发送验证码`);

      return;
    }

    try {
      const response = await adminFetch<ApiKeyEmailCodeResult>(
        "/admin/system/api-keys/email-code",
        {
          method: "POST",
        },
      );

      if (response.sent) {
        const resendAvailableAt = Date.now() + revealCodeResendCooldownMs;

        setRevealCodeExpiresAt(response.expiresAt);
        setRevealCodeValidMinutes(response.validMinutes);
        setRevealResendAvailableAt(resendAvailableAt);
        setRevealResendCountdownSeconds(Math.ceil(revealCodeResendCooldownMs / 1000));
        window.localStorage.setItem(revealCodeResendStorageKey, String(resendAvailableAt));
      } else {
        setRevealCodeExpiresAt(null);
        setRevealCodeValidMinutes(null);
      }

      updateNotice(
        response.sent
          ? "验证码已发送到管理员邮箱"
          : "验证码未发送：请先配置 Resend API Key 和已验证的 Resend 域名",
      );
    } catch (error) {
      setRevealCodeExpiresAt(null);
      setRevealCodeValidMinutes(null);
      updateNotice(error instanceof Error ? error.message : "验证码发送失败");
    }
  }

  async function revealSecretValue() {
    if (!revealKey) {
      return;
    }

    if (isResendDomainReveal) {
      setRevealedValue(siteConfig.resendDomain || "未配置");
      updateNotice("已显示 Resend 域名");
      return;
    }

    if (!emailCode.trim()) {
      updateNotice("请输入邮箱验证码");
      return;
    }

    try {
      const response = await adminFetch<{ item: ApiKeyItem }>("/admin/system/api-keys/reveal", {
        body: { emailCode: emailCode.trim() },
        method: "POST",
      });
      const keys = response.item;
      setRevealedValue(keys[revealKey] ?? "未配置");
      updateNotice(`验证通过，已显示 ${secretRevealCopy[revealKey].valueLabel}`);
    } catch (error) {
      updateNotice(error instanceof Error ? error.message : "API Key 查看失败");
    }
  }

  function openRevealModal(key: SecretFieldKey) {
    setRevealKey(key);
    setEmailCode("");
    setRevealedValue(key === "resendDomain" ? siteConfig.resendDomain || "未配置" : "");
    setRevealCodeExpiresAt(null);
    setRevealCodeValidMinutes(null);
    setRevealCountdownSeconds(0);
  }

  function openTestModal(state: TestModalState) {
    setTestModalState(state);
    setTestResult(null);
    setTestLogin(null);
  }

  async function runResendTest(target: "apiKey" | "domain") {
    try {
      setIsTesting(true);
      const response = await adminFetch<{ message: string }>("/admin/system/api-keys/test-resend", {
        body: {
          kind: target,
          resendApiKey: toOptional(siteConfig.resendApiKey),
          resendDomain: toOptional(siteConfig.resendDomain),
        },
        method: "POST",
      });
      setTestResult({ message: response.message, status: "success" });
      showOperationToast(response.message, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Resend 测试失败";
      setTestResult({ message, status: "danger" });
      showOperationToast(message, "danger");
    } finally {
      setIsTesting(false);
    }
  }

  async function runDeepLTest() {
    try {
      setIsTesting(true);
      const response = await adminFetch<{ message: string; translatedText?: string }>(
        "/admin/system/api-keys/test-deepl",
        {
          body: {
            apiKey: toOptional(siteConfig.deeplApiKey),
            text: testText,
          },
          method: "POST",
        },
      );
      const message = `${response.message}：${response.translatedText ?? ""}`;
      setTestResult({ message, status: "success" });
      showOperationToast(message, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "DeepL 测试失败";
      setTestResult({ message, status: "danger" });
      showOperationToast(message, "danger");
    } finally {
      setIsTesting(false);
    }
  }

  async function runIpGeolocationTest() {
    try {
      setIsTesting(true);
      const response = await adminFetch<{
        login?: IntegrationLoginInfo;
        message: string;
      }>("/admin/system/api-keys/test-ipgeolocation", {
        method: "POST",
      });
      setTestResult({ message: response.message, status: "success" });
      setTestLogin(response.login ?? null);
      showOperationToast(response.message, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "IPGeolocation 测试失败";
      setTestResult({ message, status: "danger" });
      showOperationToast(message, "danger");
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <section className="page-stack admin-page admin-page--wide site-settings-page">
      <div className="admin-page__heading">
        <div className="page-heading page-heading--compact">
          <p className="eyebrow">系统</p>
          <h2>
            <AppIcon name="settings" />
            站点设置
          </h2>
          <p>编辑站点信息、SEO、集成密钥、评论开关和备案信息。</p>
        </div>
        {notice ? (
          <Chip color="success" variant="soft">
            <Chip.Label>{notice}</Chip.Label>
          </Chip>
        ) : null}
      </div>

      <Accordion className="site-settings-accordion" hideSeparator variant="surface">
        <SettingsAccordionItem icon="home" id="site-info" title="站点信息">
          <Form className="settings-form" onSubmit={(event) => requestSave("site-info", event)}>
            <SettingsTextField
              description="前台和后台都会显示这个站点名称。"
              isRequired
              label="站点名称"
              onChange={createInputHandler<SiteInfoState>({
                key: "siteName",
                setState: setSiteInfo,
              })}
              type="text"
              value={siteInfo.siteName}
            />
            <SettingsTextArea
              description="用于首页、SEO 和站点介绍。"
              label="描述"
              onChange={createInputHandler<SiteInfoState>({
                key: "description",
                setState: setSiteInfo,
              })}
              value={siteInfo.description}
            />
            <MultiMediaAssetField
              folderSlug="site"
              label="主页封面"
              localFiles={homeCoverFiles}
              onChange={(values) => setSiteInfo((state) => ({ ...state, homeCoverUrls: values }))}
              onLocalFilesChange={setHomeCoverFiles}
              values={siteInfo.homeCoverUrls}
            />
            <SettingsTextArea
              description="前台主页首屏会以打字效果展示这段文案。"
              label="主页文案"
              onChange={createInputHandler<SiteInfoState>({
                key: "homeSlogan",
                setState: setSiteInfo,
              })}
              value={siteInfo.homeSlogan}
            />
            <MediaAssetField
              folderSlug="site"
              label="浅色 Logo"
              localFile={logoLightFile}
              onChange={(value) => setSiteInfo((state) => ({ ...state, logoLightUrl: value }))}
              onLocalFileChange={setLogoLightFile}
              value={siteInfo.logoLightUrl}
            />
            <MediaAssetField
              folderSlug="site"
              label="深色 Logo"
              localFile={logoDarkFile}
              onChange={(value) => setSiteInfo((state) => ({ ...state, logoDarkUrl: value }))}
              onLocalFileChange={setLogoDarkFile}
              value={siteInfo.logoDarkUrl}
            />
            <MediaAssetField
              accept="image/png,image/svg+xml,image/webp,image/x-icon"
              folderSlug="site"
              label="favicon"
              localFile={faviconFile}
              onChange={(value) => setSiteInfo((state) => ({ ...state, faviconUrl: value }))}
              onLocalFileChange={setFaviconFile}
              value={siteInfo.faviconUrl}
            />
            <SettingsTextField
              description="记录站点创建时间，按本地时间编辑。"
              isRequired
              label="建站时间"
              onChange={createInputHandler<SiteInfoState>({
                key: "establishedAt",
                setState: setSiteInfo,
              })}
              type="datetime-local"
              value={siteInfo.establishedAt}
            />
            <Button isDisabled={isReadOnly || isSaving} type="submit">
              <AppIcon name="save" />
              保存站点信息
            </Button>
          </Form>
        </SettingsAccordionItem>

        <SettingsAccordionItem icon="key" id="site-config" title="站点配置">
          <Form className="settings-form" onSubmit={(event) => requestSave("site-config", event)}>
            <SettingsTextField
              description="默认用于浏览器标题和搜索结果标题。"
              label="SEO 标题"
              onChange={createInputHandler<SiteConfigState>({
                key: "seoTitle",
                setState: setSiteConfig,
              })}
              type="text"
              value={siteConfig.seoTitle}
            />
            <SettingsTextArea
              description="用于搜索结果摘要和页面默认描述。"
              label="SEO 描述"
              onChange={createInputHandler<SiteConfigState>({
                key: "seoDescription",
                setState: setSiteConfig,
              })}
              value={siteConfig.seoDescription}
            />
            <SettingsTextField
              description="多个关键词请用逗号分隔。"
              label="SEO 关键词"
              onChange={createInputHandler<SiteConfigState>({
                key: "seoKeywords",
                setState: setSiteConfig,
              })}
              placeholder="React，Elysia，博客"
              type="text"
              value={siteConfig.seoKeywords}
            />
            <SettingsTextArea
              description="用于前台页脚版权展示。"
              label="版权信息"
              onChange={createInputHandler<SiteConfigState>({
                key: "copyright",
                setState: setSiteConfig,
              })}
              value={siteConfig.copyright}
            />
            <SecretSettingField
              configured={Boolean(siteConfig.resendDomain)}
              label="Resend 域名"
              onChange={(value) => setSiteConfig((state) => ({ ...state, resendDomain: value }))}
              onTest={() => openTestModal({ kind: "resend", target: "domain" })}
              description="Resend 已验证的发信域名。"
              inputType="text"
              prefixIcon="globe"
              suffixAction="copy"
              testLabel="测试"
              value={siteConfig.resendDomain}
            />
            <div className="secret-status">
              <SecretChip active={keyFlags.hasResendApiKey} label="Resend API Key" />
              <SecretChip active={keyFlags.hasDeepLApiKey} label="DeepL API Key" />
              <SecretChip active={keyFlags.hasIpgeolocationApiKey} label="IPGeolocation API Key" />
            </div>
            <SecretSettingField
              canReveal={keyFlags.hasResendApiKey}
              configured={keyFlags.hasResendApiKey}
              label="Resend API Key"
              onChange={(value) => setSiteConfig((state) => ({ ...state, resendApiKey: value }))}
              onReveal={() => openRevealModal("resendApiKey")}
              onTest={() => openTestModal({ kind: "resend", target: "apiKey" })}
              description="用于发送注册、找回密码和安全验证码邮件。"
              placeholder="留空则保留当前密钥"
              testLabel="测试"
              value={siteConfig.resendApiKey}
            />
            <SecretSettingField
              canReveal={keyFlags.hasDeepLApiKey}
              configured={keyFlags.hasDeepLApiKey}
              label="DeepL API Key"
              onChange={(value) => setSiteConfig((state) => ({ ...state, deeplApiKey: value }))}
              onReveal={() => openRevealModal("deeplApiKey")}
              onTest={() => openTestModal({ kind: "deepl" })}
              description="用于自动翻译标题并生成 slug。"
              placeholder="留空则保留当前密钥"
              testLabel="测试"
              value={siteConfig.deeplApiKey}
            />
            <SecretSettingField
              canReveal={keyFlags.hasIpgeolocationApiKey}
              configured={keyFlags.hasIpgeolocationApiKey}
              label="IPGeolocation API Key"
              onChange={(value) =>
                setSiteConfig((state) => ({ ...state, ipgeolocationApiKey: value }))
              }
              onReveal={() => openRevealModal("ipgeolocationApiKey")}
              onTest={() => openTestModal({ kind: "ipgeolocation" })}
              description="用于识别登录 IP、地点和设备信息。"
              placeholder="留空则保留当前密钥"
              testLabel="测试"
              value={siteConfig.ipgeolocationApiKey}
            />
            <Switch
              isSelected={siteConfig.commentsEnabled}
              onChange={(isSelected) =>
                setSiteConfig((state) => ({
                  ...state,
                  commentsEnabled: isSelected,
                }))
              }
            >
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Switch.Content>
                <strong>开启评论系统</strong>
                <span>关闭后前台不再接收新评论。</span>
              </Switch.Content>
            </Switch>
            <Button isDisabled={isReadOnly || isSaving} type="submit">
              <AppIcon name="save" />
              保存站点配置
            </Button>
          </Form>
        </SettingsAccordionItem>

        <SettingsAccordionItem icon="documentText" id="filing" title="备案配置">
          <Form className="settings-form" onSubmit={(event) => requestSave("filing", event)}>
            <div className="filing-record-list">
              {filing.icpRecords.map((record, index) => (
                <IcpRecordFields
                  canRemove={filing.icpRecords.length > 1}
                  index={index}
                  key={record.id}
                  onRemove={() => removeIcpRecord(index)}
                  onUpdate={(key, value) => updateIcpRecord(index, key, value)}
                  record={record}
                />
              ))}
            </div>
            <Button
              isDisabled={isReadOnly || isSaving}
              onPress={addIcpRecord}
              type="button"
              variant="tertiary"
            >
              <AppIcon name="create" />
              添加 ICP 备案
            </Button>
            <SettingsTextField
              description="公安联网备案号。"
              label="公安备案号"
              onChange={createInputHandler<FilingState>({
                key: "policeNumber",
                setState: setFiling,
              })}
              type="text"
              value={filing.policeNumber}
            />
            <SettingsTextField
              description="公安备案信息对应的官方链接。"
              label="公安备案网址"
              onChange={createInputHandler<FilingState>({
                key: "policeUrl",
                setState: setFiling,
              })}
              type="url"
              value={filing.policeUrl}
            />
            <Button isDisabled={isReadOnly || isSaving} type="submit">
              <AppIcon name="save" />
              保存备案配置
            </Button>
          </Form>
        </SettingsAccordionItem>
      </Accordion>
      {pendingSave ? (
        <AlertDialog>
          <AlertDialog.Backdrop
            isOpen
            onOpenChange={(isOpen) => {
              if (isOpen) return;
              setPendingSave(null);
            }}
          >
            <AlertDialog.Container placement="center" size="sm">
              <AlertDialog.Dialog>
                <AlertDialog.CloseTrigger />
                <AlertDialog.Header>
                  <AlertDialog.Icon status="warning" />
                  <AlertDialog.Heading>
                    {saveConfirmationCopy[pendingSave].title}
                  </AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <p>{saveConfirmationCopy[pendingSave].description}</p>
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button slot="close" variant="tertiary">
                    取消
                  </Button>
                  <Button
                    isDisabled={isSaving}
                    onPress={confirmPendingSave}
                    slot="close"
                    variant="primary"
                  >
                    {saveConfirmationCopy[pendingSave].confirmLabel}
                  </Button>
                </AlertDialog.Footer>
              </AlertDialog.Dialog>
            </AlertDialog.Container>
          </AlertDialog.Backdrop>
        </AlertDialog>
      ) : null}
      <Modal.Backdrop
        isOpen={revealKey !== null}
        onOpenChange={(isOpen) => {
          if (isOpen) return;
          setRevealKey(null);
        }}
        variant="blur"
      >
        <Modal.Container placement="auto" size="lg">
          <Modal.Dialog>
            <div className="admin-form-modal admin-form-modal--reveal">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Icon>
                  <AppIcon name="eye" />
                </Modal.Icon>
                <div>
                  <Modal.Heading>{revealCopy.title}</Modal.Heading>
                  <p className="admin-form-modal__description">{revealCopy.description}</p>
                </div>
              </Modal.Header>
              <Modal.Body>
                <div className="settings-form">
                  {!isResendDomainReveal && !isSecretRevealed ? (
                    <>
                      <InputOTP
                        className="secret-reveal-otp"
                        maxLength={6}
                        onChange={setEmailCode}
                        pushPasswordManagerStrategy="none"
                        value={emailCode}
                        variant="secondary"
                      >
                        <InputOTP.Group>
                          {Array.from({ length: 6 }).map((_, index) => (
                            <InputOTP.Slot index={index} key={index} />
                          ))}
                        </InputOTP.Group>
                      </InputOTP>
                      {revealCodeExpiresAt ? (
                        <div
                          className="secret-reveal-countdown"
                          data-expired={revealCountdownSeconds <= 0}
                        >
                          <AppIcon name="calendar" />
                          <span>有效期 {revealCodeValidMinutes ?? 10} 分钟</span>
                          <strong>
                            {revealCountdownSeconds > 0
                              ? formatCountdown(revealCountdownSeconds)
                              : "已过期"}
                          </strong>
                        </div>
                      ) : (
                        <p className="secret-reveal-help">
                          验证码有效期为 10 分钟，发送后会显示倒计时。
                        </p>
                      )}
                    </>
                  ) : null}
                  {revealedValue ? (
                    <div className="secret-reveal-panel">
                      <SecretValue label={revealCopy.valueLabel} value={revealedValue} />
                      <Button
                        onPress={() => void navigator.clipboard.writeText(revealedValue)}
                        size="sm"
                        type="button"
                        variant="tertiary"
                      >
                        <AppIcon name="copy" />
                        复制
                      </Button>
                    </div>
                  ) : null}
                </div>
              </Modal.Body>
              {!isResendDomainReveal && !isSecretRevealed ? (
                <Modal.Footer>
                  <Button
                    isDisabled={isReadOnly || revealResendCountdownSeconds > 0}
                    onPress={() => void sendRevealCode()}
                    variant="tertiary"
                  >
                    <AppIcon name="mail" />
                    {revealSendLabel}
                  </Button>
                  <Button isDisabled={isReadOnly} onPress={() => void revealSecretValue()}>
                    <AppIcon name="eye" />
                    验证并显示
                  </Button>
                </Modal.Footer>
              ) : null}
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      <Modal.Backdrop
        isOpen={testModalState !== null}
        onOpenChange={(isOpen) => {
          if (isOpen) return;
          setTestModalState(null);
        }}
        variant="blur"
      >
        <Modal.Container placement="auto" size="sm">
          <Modal.Dialog>
            <div className="admin-form-modal">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Icon>
                  <AppIcon name="sparkles" />
                </Modal.Icon>
                <div>
                  <Modal.Heading>{testModalCopy.title}</Modal.Heading>
                  <p className="admin-form-modal__description">{testModalCopy.description}</p>
                </div>
              </Modal.Header>
              <Modal.Body>
                <div className="settings-form">
                  {testResult ? (
                    <div className="integration-test-result" data-status={testResult.status}>
                      <AppIcon
                        name={testResult.status === "success" ? "checkmarkCircle" : "warning"}
                      />
                      <div>
                        <strong>{testModalCopy.resultTitle}</strong>
                        <p>{testResult.message}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {testModalState?.kind === "deepl" ? (
                        <SettingsTextField
                          label="翻译文本"
                          onChange={(event) => setTestText(event.target.value)}
                          value={testText}
                        />
                      ) : null}
                      {testModalState?.kind === "ipgeolocation" ? (
                        <p className="site-settings-card__hint">
                          将读取当前管理员最近一次登录 IP、地点和设备。
                        </p>
                      ) : null}
                      <Button
                        isDisabled={isTesting}
                        onPress={() => {
                          if (testModalState?.kind === "deepl") {
                            void runDeepLTest();
                            return;
                          }
                          if (testModalState?.kind === "ipgeolocation") {
                            void runIpGeolocationTest();
                            return;
                          }
                          if (testModalState?.kind === "resend") {
                            void runResendTest(testModalState.target);
                          }
                        }}
                      >
                        <AppIcon name="send" />
                        {testModalCopy.actionLabel}
                      </Button>
                    </>
                  )}
                  {testResult && testLogin ? (
                    <div className="secret-reveal-panel">
                      <SecretValue label="登录 IP" value={testLogin.ip} />
                      <SecretValue label="登录地点" value={testLogin.location} />
                      <SecretValue label="登录设备" value={testLogin.device} />
                    </div>
                  ) : null}
                </div>
              </Modal.Body>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </section>
  );
}

type SettingsAccordionItemProps = {
  children: ReactNode;
  icon: AppIconName;
  id: string;
  title: string;
};

function SettingsAccordionItem({ children, icon, id, title }: SettingsAccordionItemProps) {
  return (
    <Accordion.Item className="site-settings-card" id={id}>
      <Accordion.Heading>
        <Accordion.Trigger>
          <AppIcon name={icon} />
          {title}
          <Accordion.Indicator />
        </Accordion.Trigger>
      </Accordion.Heading>
      <Accordion.Panel>
        <Accordion.Body>{children}</Accordion.Body>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

type IcpRecordFieldsProps = {
  canRemove: boolean;
  index: number;
  onRemove: () => void;
  onUpdate: (key: "number" | "url", value: string) => void;
  record: IcpRecordState;
};

function IcpRecordFields({ canRemove, index, onRemove, onUpdate, record }: IcpRecordFieldsProps) {
  return (
    <div className="filing-record-card">
      <div className="filing-record-card__header">
        <strong>ICP备案 {index + 1}</strong>
        {canRemove ? (
          <Button onPress={onRemove} size="sm" type="button" variant="tertiary">
            <AppIcon name="trash" />
            移除
          </Button>
        ) : null}
      </div>
      <SettingsTextField
        description="工信部 ICP 备案号。"
        label="ICP备案号"
        onChange={(event) => onUpdate("number", event.target.value)}
        type="text"
        value={record.number}
      />
      <SettingsTextField
        description="ICP备案信息对应的官方链接。"
        label="ICP备案网址"
        onChange={(event) => onUpdate("url", event.target.value)}
        type="url"
        value={record.url}
      />
    </div>
  );
}

function SettingsTextField({
  description,
  fieldError,
  isRequired,
  label,
  type = "text",
  ...props
}: {
  description?: string;
  fieldError?: string;
  isRequired?: boolean;
  label: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: "datetime-local" | "email" | "password" | "text" | "url";
  value: string;
}) {
  const descriptionText = description ?? (isRequired ? "必填" : undefined);

  return (
    <TextField fullWidth isRequired={isRequired}>
      <Label>{label}</Label>
      <Input {...props} type={type} />
      {descriptionText ? <Description>{descriptionText}</Description> : null}
      <FieldError>{fieldError ?? `${label}格式不正确`}</FieldError>
    </TextField>
  );
}

function SettingsTextArea({
  description,
  fieldError,
  label,
  ...props
}: {
  description?: string;
  fieldError?: string;
  label: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  value: string;
}) {
  return (
    <TextField fullWidth>
      <Label>{label}</Label>
      <TextArea {...props} rows={4} />
      {description ? <Description>{description}</Description> : null}
      <FieldError>{fieldError ?? `${label}格式不正确`}</FieldError>
    </TextField>
  );
}

type SecretSettingFieldProps = {
  canReveal?: boolean;
  configured: boolean;
  description?: string;
  fieldError?: string;
  inputType?: "password" | "text";
  label: string;
  onChange: (value: string) => void;
  onReveal?: () => void;
  onTest: () => void;
  placeholder?: string;
  prefixIcon?: AppIconName;
  suffixAction?: "copy" | "reveal";
  testLabel: string;
  value: string;
};

function SecretSettingField({
  canReveal,
  configured,
  description,
  fieldError,
  inputType = "password",
  label,
  onChange,
  onReveal,
  onTest,
  placeholder,
  prefixIcon = "key",
  suffixAction = "reveal",
  testLabel,
  value,
}: SecretSettingFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const isPasswordField = inputType === "password";
  const isCopyAction = suffixAction === "copy";
  const hasTypedSecret = isPasswordField && Boolean(value.trim());
  const inputTypeValue = isPasswordField && isVisible ? "text" : inputType;
  const placeholderValue = value ? undefined : configured ? "••••••••" : placeholder;
  const revealButtonLabel = isPasswordField
    ? isVisible
      ? `隐藏${label}`
      : hasTypedSecret
        ? `显示${label}`
        : `查看${label}`
    : `查看${label}`;

  function handleRevealPress() {
    if (!onReveal) {
      return;
    }

    if (!isPasswordField) {
      onReveal();
      return;
    }

    const nextIsVisible = !isVisible;

    setIsVisible(nextIsVisible);

    if (nextIsVisible && !value.trim() && configured && canReveal) {
      onReveal();
    }
  }

  async function handleCopyPress() {
    const valueToCopy = value.trim();

    if (!valueToCopy) {
      showOperationToast(`${label}为空，无法复制`, "danger");
      return;
    }

    try {
      await navigator.clipboard.writeText(valueToCopy);
      showOperationToast(`${label}已复制`, "success");
    } catch {
      showOperationToast(`${label}复制失败`, "danger");
    }
  }

  return (
    <TextField className="secret-setting-field" fullWidth>
      <Label>{label}</Label>
      <div className="secret-setting-row">
        <InputGroup fullWidth variant="secondary">
          <InputGroup.Prefix>
            <AppIcon name={prefixIcon} size={16} />
          </InputGroup.Prefix>
          <InputGroup.Input
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholderValue}
            type={inputTypeValue}
            value={value}
          />
          <InputGroup.Suffix className="secret-input-actions">
            {isCopyAction ? (
              <Button
                isDisabled={!value.trim()}
                isIconOnly
                aria-label={`复制${label}`}
                onPress={() => void handleCopyPress()}
                size="sm"
                type="button"
                variant="ghost"
              >
                <AppIcon name="copy" size={16} />
              </Button>
            ) : (
              <Button
                isDisabled={!canReveal && !hasTypedSecret}
                isIconOnly
                aria-label={revealButtonLabel}
                onPress={handleRevealPress}
                size="sm"
                type="button"
                variant="ghost"
              >
                <AppIcon name={isPasswordField && !isVisible ? "eyeOff" : "eye"} size={16} />
              </Button>
            )}
          </InputGroup.Suffix>
        </InputGroup>
        <Button onPress={onTest} type="button" variant="tertiary">
          <AppIcon name="sparkles" />
          {testLabel}
        </Button>
      </div>
      {description ? <Description>{description}</Description> : null}
      <FieldError>{fieldError ?? `${label}格式不正确`}</FieldError>
    </TextField>
  );
}

function SecretChip({ active, label }: { active: boolean; label: string }) {
  return (
    <Chip color={active ? "success" : "default"} size="sm" variant="soft">
      <Chip.Label>
        {label}
        {active ? " 已配置" : " 未配置"}
      </Chip.Label>
    </Chip>
  );
}

function SecretValue({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value ?? "未配置或未查看"}</dd>
    </div>
  );
}
