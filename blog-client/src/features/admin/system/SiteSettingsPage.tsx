import {
  Button,
  Card,
  Chip,
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
import { MediaAssetField } from "../shared/media-asset-field";

type SiteInfoState = {
  description: string;
  establishedAt: string;
  faviconUrl: string;
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

type FilingState = {
  icpNumber: string;
  icpUrl: string;
  policeNumber: string;
  policeUrl: string;
};

type SiteInfoItem = {
  description: string;
  establishedAt: string;
  faviconUrl: string | null;
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
  icpUrl: string | null;
  policeNumber: string | null;
  policeUrl: string | null;
};

type ApiKeyItem = {
  deeplApiKey: string | null;
  ipgeolocationApiKey: string | null;
  resendApiKey: string | null;
};

type SecretFieldKey = "deeplApiKey" | "ipgeolocationApiKey" | "resendApiKey" | "resendDomain";

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

type IntegrationLoginInfo = {
  device: string;
  ip: string;
  location: string;
};

const defaultSiteInfo: SiteInfoState = {
  description: "",
  establishedAt: toLocalDateTimeValue(new Date()),
  faviconUrl: "",
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
  icpNumber: "",
  icpUrl: "",
  policeNumber: "",
  policeUrl: "",
};

function toLocalDateTimeValue(date: Date) {
  const timezoneOffset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function toOptional(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
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
  const [keyFlags, setKeyFlags] = useState({
    hasDeepLApiKey: false,
    hasIpgeolocationApiKey: false,
    hasResendApiKey: false,
  });
  const [revealKey, setRevealKey] = useState<SecretFieldKey | null>(null);
  const [emailCode, setEmailCode] = useState("");
  const [revealedValue, setRevealedValue] = useState("");
  const [testModalState, setTestModalState] = useState<TestModalState | null>(null);
  const [testText, setTestText] = useState("你好，LeiBlog");
  const [testResult, setTestResult] = useState("");
  const [testLogin, setTestLogin] = useState<IntegrationLoginInfo | null>(null);
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const isReadOnly = session.isReadOnly;

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
        icpNumber: filingResponse.item.icpNumber ?? "",
        icpUrl: filingResponse.item.icpUrl ?? "",
        policeNumber: filingResponse.item.policeNumber ?? "",
        policeUrl: filingResponse.item.policeUrl ?? "",
      });
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  async function saveSiteInfo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

      await adminFetch("/admin/system/site-info", {
        body: {
          description: siteInfo.description,
          establishedAt: new Date(siteInfo.establishedAt).toISOString(),
          faviconUrl: toOptional(faviconUrl),
          logoDarkUrl: toOptional(logoDarkUrl),
          logoLightUrl: toOptional(logoLightUrl),
          siteName: siteInfo.siteName,
        },
        method: "PATCH",
      });
      setLogoLightFile(null);
      setLogoDarkFile(null);
      setFaviconFile(null);
      updateNotice("站点信息已保存");
      await loadSettings();
    } catch (error) {
      updateNotice(error instanceof Error ? error.message : "站点信息保存失败");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveSiteConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

  async function saveFiling(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    try {
      await adminFetch("/admin/system/filing", {
        body: {
          icpNumber: toOptional(filing.icpNumber),
          icpUrl: toOptional(filing.icpUrl),
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

  async function sendRevealCode() {
    try {
      const response = await adminFetch<{ devCode?: string; sent: boolean }>(
        "/admin/system/api-keys/email-code",
        { method: "POST" },
      );
      updateNotice(
        response.devCode ? `验证码已生成：${response.devCode}` : "验证码已发送到管理员邮箱",
      );
    } catch (error) {
      updateNotice(error instanceof Error ? error.message : "验证码发送失败");
    }
  }

  async function revealSecretValue() {
    if (!revealKey) return;
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
      setRevealedValue(
        revealKey === "resendDomain" ? siteConfig.resendDomain : (keys[revealKey] ?? "未配置"),
      );
      updateNotice("验证通过，已显示密钥");
    } catch (error) {
      updateNotice(error instanceof Error ? error.message : "API Key 查看失败");
    }
  }

  function openRevealModal(key: SecretFieldKey) {
    setRevealKey(key);
    setEmailCode("");
    setRevealedValue("");
  }

  function openTestModal(state: TestModalState) {
    setTestModalState(state);
    setTestResult("");
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
      setTestResult(response.message);
      showOperationToast(response.message, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Resend 测试失败";
      setTestResult(message);
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
      setTestResult(message);
      showOperationToast(message, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "DeepL 测试失败";
      setTestResult(message);
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
      setTestResult(response.message);
      setTestLogin(response.login ?? null);
      showOperationToast(response.message, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "IPGeolocation 测试失败";
      setTestResult(message);
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

      <div className="site-settings-grid">
        <SettingsCard icon="home" title="站点信息">
          <Form className="settings-form" onSubmit={saveSiteInfo}>
            <SettingsTextField
              isRequired
              label="站点名称"
              onChange={createInputHandler<SiteInfoState>({
                key: "siteName",
                setState: setSiteInfo,
              })}
              value={siteInfo.siteName}
            />
            <SettingsTextArea
              label="描述"
              onChange={createInputHandler<SiteInfoState>({
                key: "description",
                setState: setSiteInfo,
              })}
              value={siteInfo.description}
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
        </SettingsCard>

        <SettingsCard icon="key" title="站点配置">
          <Form className="settings-form" onSubmit={saveSiteConfig}>
            <SettingsTextField
              label="SEO 标题"
              onChange={createInputHandler<SiteConfigState>({
                key: "seoTitle",
                setState: setSiteConfig,
              })}
              value={siteConfig.seoTitle}
            />
            <SettingsTextArea
              label="SEO 描述"
              onChange={createInputHandler<SiteConfigState>({
                key: "seoDescription",
                setState: setSiteConfig,
              })}
              value={siteConfig.seoDescription}
            />
            <SettingsTextField
              label="SEO 关键词"
              onChange={createInputHandler<SiteConfigState>({
                key: "seoKeywords",
                setState: setSiteConfig,
              })}
              placeholder="React，Elysia，博客"
              value={siteConfig.seoKeywords}
            />
            <SettingsTextArea
              label="版权信息"
              onChange={createInputHandler<SiteConfigState>({
                key: "copyright",
                setState: setSiteConfig,
              })}
              value={siteConfig.copyright}
            />
            <SecretSettingField
              canReveal={Boolean(siteConfig.resendDomain)}
              configured={Boolean(siteConfig.resendDomain)}
              label="Resend 域名"
              onChange={(value) => setSiteConfig((state) => ({ ...state, resendDomain: value }))}
              onReveal={() => openRevealModal("resendDomain")}
              onTest={() => openTestModal({ kind: "resend", target: "domain" })}
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
        </SettingsCard>

        <SettingsCard icon="documentText" title="备案配置">
          <Form className="settings-form" onSubmit={saveFiling}>
            <SettingsTextField
              label="ICP备案号"
              onChange={createInputHandler<FilingState>({
                key: "icpNumber",
                setState: setFiling,
              })}
              value={filing.icpNumber}
            />
            <SettingsTextField
              label="ICP备案网址"
              onChange={createInputHandler<FilingState>({
                key: "icpUrl",
                setState: setFiling,
              })}
              type="url"
              value={filing.icpUrl}
            />
            <SettingsTextField
              label="公安备案号"
              onChange={createInputHandler<FilingState>({
                key: "policeNumber",
                setState: setFiling,
              })}
              value={filing.policeNumber}
            />
            <SettingsTextField
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
        </SettingsCard>
      </div>
      <Modal.Backdrop
        isOpen={revealKey !== null}
        onOpenChange={(isOpen) => {
          if (isOpen) return;
          setRevealKey(null);
        }}
        variant="blur"
      >
        <Modal.Container placement="center" size="sm">
          <Modal.Dialog>
            <div className="admin-form-modal">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Icon>
                  <AppIcon name="eye" />
                </Modal.Icon>
                <div>
                  <Modal.Heading>查看 API Key</Modal.Heading>
                  <p className="admin-form-modal__description">
                    仅管理员可以查看密钥，查看前需要通过管理员邮箱验证码。
                  </p>
                </div>
              </Modal.Header>
              <Modal.Body>
                <div className="settings-form">
                  <Button
                    isDisabled={isReadOnly}
                    onPress={() => void sendRevealCode()}
                    variant="tertiary"
                  >
                    <AppIcon name="mail" />
                    发送邮箱验证码
                  </Button>
                  <InputOTP
                    maxLength={6}
                    onChange={setEmailCode}
                    value={emailCode}
                    variant="secondary"
                  >
                    <InputOTP.Group>
                      {Array.from({ length: 6 }).map((_, index) => (
                        <InputOTP.Slot index={index} key={index} />
                      ))}
                    </InputOTP.Group>
                  </InputOTP>
                  <Button isDisabled={isReadOnly} onPress={() => void revealSecretValue()}>
                    <AppIcon name="eye" />
                    验证并显示
                  </Button>
                  {revealedValue ? (
                    <div className="secret-reveal-panel">
                      <SecretValue label="当前值" value={revealedValue} />
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
        <Modal.Container placement="center" size="sm">
          <Modal.Dialog>
            <div className="admin-form-modal">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Icon>
                  <AppIcon name="sparkles" />
                </Modal.Icon>
                <div>
                  <Modal.Heading>测试配置</Modal.Heading>
                  <p className="admin-form-modal__description">测试结果会在当前弹窗中反馈。</p>
                </div>
              </Modal.Header>
              <Modal.Body>
                <div className="settings-form">
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
                    {testModalState?.kind === "deepl" ? "翻译" : "开始测试"}
                  </Button>
                  {testResult ? <p className="site-settings-card__hint">{testResult}</p> : null}
                  {testLogin ? (
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

function SettingsCard({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon: AppIconName;
  title: string;
}) {
  return (
    <Card className="site-settings-card">
      <Card.Header>
        <Card.Title>
          <AppIcon name={icon} />
          {title}
        </Card.Title>
      </Card.Header>
      {children}
    </Card>
  );
}

function SettingsTextField({
  isRequired,
  label,
  ...props
}: {
  isRequired?: boolean;
  label: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  return (
    <TextField fullWidth isRequired={isRequired}>
      <Label>{label}</Label>
      <Input {...props} />
    </TextField>
  );
}

function SettingsTextArea({
  label,
  ...props
}: {
  label: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  value: string;
}) {
  return (
    <TextField fullWidth>
      <Label>{label}</Label>
      <TextArea {...props} rows={4} />
    </TextField>
  );
}

type SecretSettingFieldProps = {
  canReveal: boolean;
  configured: boolean;
  label: string;
  onChange: (value: string) => void;
  onReveal: () => void;
  onTest: () => void;
  placeholder?: string;
  testLabel: string;
  value: string;
};

function SecretSettingField({
  canReveal,
  configured,
  label,
  onChange,
  onReveal,
  onTest,
  placeholder,
  testLabel,
  value,
}: SecretSettingFieldProps) {
  return (
    <TextField fullWidth>
      <Label>{label}</Label>
      <InputGroup fullWidth variant="secondary">
        <InputGroup.Prefix>
          <AppIcon name="key" size={16} />
        </InputGroup.Prefix>
        <InputGroup.Input
          onChange={(event) => onChange(event.target.value)}
          placeholder={value ? undefined : configured ? "••••••••" : placeholder}
          type="password"
          value={value}
        />
        <InputGroup.Suffix className="secret-input-actions">
          <Button
            isDisabled={!canReveal}
            isIconOnly
            aria-label={`查看${label}`}
            onPress={onReveal}
            size="sm"
            type="button"
            variant="ghost"
          >
            <AppIcon name="eye" size={16} />
          </Button>
          <Button onPress={onTest} size="sm" type="button" variant="tertiary">
            {testLabel}
          </Button>
        </InputGroup.Suffix>
      </InputGroup>
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
