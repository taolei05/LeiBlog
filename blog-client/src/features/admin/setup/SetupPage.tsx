import {
  AlertDialog,
  Button,
  Card,
  Description,
  Drawer,
  FieldError,
  Form,
  Input,
  Label,
  Switch,
  TextArea,
  TextField,
} from "@heroui/react";
import type { ChangeEvent, Dispatch, ReactNode, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { InteractiveCursor } from "../../../app/blog/InteractiveCursor";
import { AppIcon } from "../../../shared/icons";
import { signInAdminSession } from "../../../shared/routing/adminGuards";
import { ThemeSwitcher } from "../../../shared/theme/ThemeSwitcher";
import { showErrorToast, showSuccessToast } from "../../../shared/toast/operation-toast";
import type { SetupSubmitStepKey } from "../shared/admin-api";
import {
  completeInitialSetup,
  createDemoSession,
  getSetupStatus,
  isSetupSubmitStepError,
  loginAdmin,
  uploadSetupAsset,
} from "../shared/admin-api";

const setupSteps = [
  {
    description: "创建首个后台管理员，并保留个人展示信息。",
    icon: "personCircle",
    label: "管理员",
  },
  {
    description: "配置站点名称、描述、Logo 和建站时间。",
    icon: "home",
    label: "站点信息",
  },
  {
    description: "补齐 SEO、版权、邮件和翻译等基础集成。",
    icon: "settings",
    label: "基础配置",
  },
  {
    description: "填写备案信息，便于前台页脚统一展示。",
    icon: "shield",
    label: "备案配置",
  },
] as const;

type SetupFormState = {
  adminAvatar: string;
  adminDescription: string;
  adminEmail: string;
  adminName: string;
  adminPassword: string;
  adminTags: string;
  adminUsername: string;
  commentsEnabled: boolean;
  copyright: string;
  deeplApiKey: string;
  favicon: string;
  foundedAt: string;
  icpNumber: string;
  icpUrl: string;
  ipGeolocationApiKey: string;
  policeNumber: string;
  policeUrl: string;
  resendApiKey: string;
  resendDomain: string;
  seoDescription: string;
  seoKeywords: string;
  seoTitle: string;
  siteDescription: string;
  siteLogoDark: string;
  siteLogoLight: string;
  siteName: string;
};

type SetupUploadField = "adminAvatar" | "favicon" | "siteLogoDark" | "siteLogoLight";

type SetupUploadState = Record<SetupUploadField, File | null>;

const setupUploadFolders: Record<SetupUploadField, "avatars" | "site"> = {
  adminAvatar: "avatars",
  favicon: "site",
  siteLogoDark: "site",
  siteLogoLight: "site",
};

const setupSubmitStepIndexes: Record<SetupSubmitStepKey, number> = {
  admin: 0,
  complete: 3,
  filing: 3,
  "site-config": 2,
  "site-info": 1,
};

const initialFormState: SetupFormState = {
  adminAvatar: "",
  adminDescription: "",
  adminEmail: "",
  adminName: "",
  adminPassword: "",
  adminTags: "",
  adminUsername: "admin",
  commentsEnabled: true,
  copyright: "© LeiBlog",
  deeplApiKey: "",
  favicon: "",
  foundedAt: getLocalDateTimeValue(),
  icpNumber: "",
  icpUrl: "",
  ipGeolocationApiKey: "",
  policeNumber: "",
  policeUrl: "",
  resendApiKey: "",
  resendDomain: "",
  seoDescription: "",
  seoKeywords: "LeiBlog, 个人博客, 工程实践",
  seoTitle: "LeiBlog",
  siteDescription: "一个内容优先的个人博客。",
  siteLogoDark: "",
  siteLogoLight: "",
  siteName: "LeiBlog",
};

const initialUploadState: SetupUploadState = {
  adminAvatar: null,
  favicon: null,
  siteLogoDark: null,
  siteLogoLight: null,
};

function getLocalDateTimeValue(date = new Date()) {
  const timezoneOffset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function createChangeHandler(
  setFormState: Dispatch<SetStateAction<SetupFormState>>,
  key: keyof SetupFormState,
) {
  return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormState((state) => ({
      ...state,
      [key]: event.target.value,
    }));
  };
}

export function SetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [formState, setFormState] = useState(initialFormState);
  const [pendingUploads, setPendingUploads] = useState<SetupUploadState>(initialUploadState);
  const [completed, setCompleted] = useState(false);
  const [isCompleteConfirmOpen, setIsCompleteConfirmOpen] = useState(false);
  const [isSetupDrawerOpen, setIsSetupDrawerOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentStepMeta = setupSteps[currentStep];
  const nextPath = useMemo(() => {
    const state = location.state as { next?: string } | null;

    return state?.next?.startsWith("/admin") ? state.next : "/admin";
  }, [location.state]);

  function updateField(key: keyof SetupFormState) {
    return createChangeHandler(setFormState, key);
  }

  function updatePendingUpload(key: SetupUploadField, file: File | null) {
    setPendingUploads((state) => ({
      ...state,
      [key]: file,
    }));
  }

  async function resolveUploadedAsset(key: SetupUploadField, nextState: SetupFormState) {
    const file = pendingUploads[key];
    if (!file) return nextState[key];

    const response = await uploadSetupAsset({
      file,
      fileName: file.name,
      folderSlug: setupUploadFolders[key],
    });

    return response.accessUrl;
  }

  async function resolveSetupAssets() {
    setStatusMessage("正在上传本地图片...");

    const adminAvatar = await resolveUploadedAsset("adminAvatar", formState);
    const siteLogoLight = await resolveUploadedAsset("siteLogoLight", formState);
    const siteLogoDark = await resolveUploadedAsset("siteLogoDark", formState);
    const favicon = await resolveUploadedAsset("favicon", formState);
    const nextState = {
      ...formState,
      adminAvatar,
      favicon,
      siteLogoDark,
      siteLogoLight,
    };

    setFormState(nextState);
    return nextState;
  }

  useEffect(() => {
    let isActive = true;

    async function loadSetupStatus() {
      try {
        const setup = await getSetupStatus();
        if (!isActive) return;
        setCompleted(setup.isCompleted);
      } catch {
        if (!isActive) return;
        setStatusMessage("无法读取初始化状态，请确认后端服务已启动。");
      }
    }

    void loadSetupStatus();

    return () => {
      isActive = false;
    };
  }, []);

  async function completeSetup() {
    setIsSubmitting(true);
    setStatusMessage("");

    try {
      const setupState = await resolveSetupAssets();
      await completeInitialSetup({
        admin: {
          avatarUrl: setupState.adminAvatar || undefined,
          description: setupState.adminDescription,
          email: setupState.adminEmail || undefined,
          name: setupState.adminName || undefined,
          password: setupState.adminPassword,
          tags: splitList(setupState.adminTags),
          username: setupState.adminUsername,
        },
        filing: {
          icpNumber: setupState.icpNumber || undefined,
          icpUrl: setupState.icpUrl || undefined,
          policeNumber: setupState.policeNumber || undefined,
          policeUrl: setupState.policeUrl || undefined,
        },
        siteConfig: {
          commentsEnabled: setupState.commentsEnabled,
          copyright: setupState.copyright,
          deeplApiKey: setupState.deeplApiKey || undefined,
          ipgeolocationApiKey: setupState.ipGeolocationApiKey || undefined,
          resendApiKey: setupState.resendApiKey || undefined,
          resendDomain: setupState.resendDomain || undefined,
          seoDescription: setupState.seoDescription,
          seoKeywords: splitList(setupState.seoKeywords),
          seoTitle: setupState.seoTitle,
        },
        siteInfo: {
          description: setupState.siteDescription,
          establishedAt: setupState.foundedAt,
          faviconUrl: setupState.favicon || undefined,
          logoDarkUrl: setupState.siteLogoDark || undefined,
          logoLightUrl: setupState.siteLogoLight || undefined,
          siteName: setupState.siteName,
        },
      });
      const nextSession = await loginAdmin(setupState.adminUsername, setupState.adminPassword);
      signInAdminSession(nextSession);
      setCompleted(true);
      showSuccessToast(
        "配置成功，欢迎进入 LeiBlog 管理后台",
        `欢迎你 ${nextSession.user.name ?? nextSession.user.username}`,
      );
      void navigate(nextPath, { replace: true });
    } catch (error) {
      if (isSetupSubmitStepError(error)) {
        setCurrentStep(setupSubmitStepIndexes[error.step]);
      }

      const message = error instanceof Error ? error.message : "初始化失败";
      setStatusMessage(message);
      showErrorToast("配置失败", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function enterReadonlyDemo() {
    setIsSubmitting(true);
    setStatusMessage("");

    try {
      const nextSession = await createDemoSession();
      signInAdminSession(nextSession);
      void navigate(nextPath, { replace: true });
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "演示会话创建失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (completed) {
    return (
      <main className="setup-page">
        <InteractiveCursor />
        <Card className="setup-card setup-card--done">
          <AppIcon name="checkmarkCircle" size={28} />
          <Card.Header>
            <Card.Title>首次配置已完成</Card.Title>
            <Card.Description>管理员已创建，可以返回后台登录页进入控制台。</Card.Description>
          </Card.Header>
          <Card.Footer className="setup-card__footer">
            <Button onPress={() => navigate("/admin")}>
              <AppIcon name="logIn" />
              进入后台
            </Button>
          </Card.Footer>
        </Card>
      </main>
    );
  }

  return (
    <main className="setup-page setup-page--wizard">
      <InteractiveCursor />
      <div className="setup-shell">
        <aside className="setup-shell__aside setup-shell__aside--desktop">
          <SetupSidebarContent
            currentStep={currentStep}
            isSubmitting={isSubmitting}
            onEnterReadonlyDemo={() => void enterReadonlyDemo()}
          />
        </aside>

        <Card className="setup-wizard">
          <div className="setup-wizard__topbar">
            <div>
              <p className="eyebrow">步骤 {currentStep + 1} / 4</p>
              <h2>
                <AppIcon name={currentStepMeta.icon} />
                {currentStepMeta.label}
              </h2>
            </div>
            <Button
              className="setup-drawer-trigger"
              onPress={() => setIsSetupDrawerOpen(true)}
              type="button"
              variant="secondary"
            >
              <AppIcon name="menu" />
              配置步骤
            </Button>
          </div>

          <Form
            className="setup-wizard__form"
            onSubmit={(event) => {
              event.preventDefault();
              if (currentStep < setupSteps.length - 1) {
                setCurrentStep((step) => Math.min(setupSteps.length - 1, step + 1));
                return;
              }
              setIsCompleteConfirmOpen(true);
            }}
          >
            {currentStep === 0 ? (
              <div className="form-grid">
                <SetupTextField
                  autoComplete="username"
                  description="用于登录后台，建议使用英文、数字或下划线。"
                  isRequired
                  label="用户名"
                  onChange={updateField("adminUsername")}
                  type="text"
                  value={formState.adminUsername}
                />
                <SetupTextField
                  autoComplete="new-password"
                  description="至少填写一个安全密码，后续可在用户管理中修改。"
                  isRequired
                  label="密码"
                  onChange={updateField("adminPassword")}
                  type="password"
                  value={formState.adminPassword}
                />
                <SetupTextField
                  autoComplete="email"
                  description="用于接收验证码和后台安全通知。"
                  label="邮箱"
                  onChange={updateField("adminEmail")}
                  type="email"
                  value={formState.adminEmail}
                />
                <SetupTextField
                  autoComplete="name"
                  description="前台展示用昵称或姓名。"
                  label="显示名称"
                  onChange={updateField("adminName")}
                  type="text"
                  value={formState.adminName}
                />
                <SetupTextField
                  description="多个标签请用逗号分隔。"
                  label="个人标签"
                  onChange={updateField("adminTags")}
                  placeholder="例如：全栈, 写作, 摄影"
                  type="text"
                  value={formState.adminTags}
                />
                <SetupTextField
                  description="可填写图片链接，也可以从本地上传。"
                  label="头像链接"
                  localFile={pendingUploads.adminAvatar}
                  onChange={updateField("adminAvatar")}
                  onFileChange={(file) => updatePendingUpload("adminAvatar", file)}
                  type="url"
                  value={formState.adminAvatar}
                />
                <SetupTextArea
                  className="form-grid__wide"
                  description="用于管理员个人资料展示。"
                  label="个人描述"
                  onChange={updateField("adminDescription")}
                  value={formState.adminDescription}
                />
              </div>
            ) : null}

            {currentStep === 1 ? (
              <div className="form-grid">
                <SetupTextField
                  description="前台和后台都会显示这个站点名称。"
                  isRequired
                  label="站点名称"
                  onChange={updateField("siteName")}
                  type="text"
                  value={formState.siteName}
                />
                <SetupTextField
                  description="记录建站时间，按本地时间保存。"
                  isRequired
                  label="建站时间"
                  onChange={updateField("foundedAt")}
                  trailingControl={
                    <Button
                      onPress={() =>
                        setFormState((state) => ({ ...state, foundedAt: getLocalDateTimeValue() }))
                      }
                      type="button"
                      variant="tertiary"
                    >
                      <AppIcon name="calendar" />
                      此刻
                    </Button>
                  }
                  type="datetime-local"
                  value={formState.foundedAt}
                />
                <SetupTextArea
                  className="form-grid__wide"
                  description="用于首页、SEO 和站点介绍。"
                  isRequired
                  label="站点描述"
                  onChange={updateField("siteDescription")}
                  value={formState.siteDescription}
                />
                <SetupTextField
                  description="浅色主题下显示的 Logo 图片链接。"
                  label="浅色 Logo"
                  localFile={pendingUploads.siteLogoLight}
                  onChange={updateField("siteLogoLight")}
                  onFileChange={(file) => updatePendingUpload("siteLogoLight", file)}
                  type="url"
                  value={formState.siteLogoLight}
                />
                <SetupTextField
                  description="深色主题下显示的 Logo 图片链接。"
                  label="深色 Logo"
                  localFile={pendingUploads.siteLogoDark}
                  onChange={updateField("siteLogoDark")}
                  onFileChange={(file) => updatePendingUpload("siteLogoDark", file)}
                  type="url"
                  value={formState.siteLogoDark}
                />
                <SetupTextField
                  description="浏览器标签页和收藏夹图标。"
                  label="favicon"
                  localFile={pendingUploads.favicon}
                  onChange={updateField("favicon")}
                  onFileChange={(file) => updatePendingUpload("favicon", file)}
                  type="url"
                  value={formState.favicon}
                />
              </div>
            ) : null}

            {currentStep === 2 ? (
              <div className="form-grid">
                <SetupTextField
                  description="默认用于浏览器标题和搜索结果标题。"
                  label="SEO 标题"
                  onChange={updateField("seoTitle")}
                  type="text"
                  value={formState.seoTitle}
                />
                <SetupTextArea
                  className="form-grid__wide"
                  description="建议控制在搜索结果摘要可读范围内。"
                  label="SEO 描述"
                  onChange={updateField("seoDescription")}
                  value={formState.seoDescription}
                />
                <SetupTextField
                  description="多个关键词请用逗号分隔。"
                  label="SEO 关键词"
                  onChange={updateField("seoKeywords")}
                  placeholder="用逗号分隔"
                  type="text"
                  value={formState.seoKeywords}
                />
                <SetupTextField
                  description="用于前台页脚版权展示。"
                  label="版权信息"
                  onChange={updateField("copyright")}
                  type="text"
                  value={formState.copyright}
                />
                <SetupTextField
                  description="Resend 已验证的发信域名。"
                  label="Resend 域名"
                  onChange={updateField("resendDomain")}
                  type="text"
                  value={formState.resendDomain}
                />
                <SetupTextField
                  description="用于发送注册、找回密码和安全验证码邮件。"
                  label="Resend API key"
                  onChange={updateField("resendApiKey")}
                  type="password"
                  value={formState.resendApiKey}
                />
                <SetupTextField
                  description="用于自动翻译标题并生成 slug。"
                  label="DeepL API key"
                  onChange={updateField("deeplApiKey")}
                  type="password"
                  value={formState.deeplApiKey}
                />
                <SetupTextField
                  description="用于识别登录 IP、地点和设备信息。"
                  label="IPGeolocation API key"
                  onChange={updateField("ipGeolocationApiKey")}
                  type="password"
                  value={formState.ipGeolocationApiKey}
                />
                <Switch
                  className="form-grid__wide"
                  isSelected={formState.commentsEnabled}
                  onChange={(isSelected) =>
                    setFormState((state) => ({ ...state, commentsEnabled: isSelected }))
                  }
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <Switch.Content>
                    <strong>开启评论</strong>
                    <span>后续评论管理会读取这个站点配置。</span>
                  </Switch.Content>
                </Switch>
              </div>
            ) : null}

            {currentStep === 3 ? (
              <div className="form-grid">
                <SetupTextField
                  description="工信部 ICP 备案号。"
                  label="ICP备案号"
                  onChange={updateField("icpNumber")}
                  type="text"
                  value={formState.icpNumber}
                />
                <SetupTextField
                  description="ICP备案信息对应的官方链接。"
                  label="ICP备案网址"
                  onChange={updateField("icpUrl")}
                  type="url"
                  value={formState.icpUrl}
                />
                <SetupTextField
                  description="公安联网备案号。"
                  label="公安备案号"
                  onChange={updateField("policeNumber")}
                  type="text"
                  value={formState.policeNumber}
                />
                <SetupTextField
                  description="公安备案信息对应的官方链接。"
                  label="公安备案网址"
                  onChange={updateField("policeUrl")}
                  type="url"
                  value={formState.policeUrl}
                />
              </div>
            ) : null}

            <div className="setup-wizard__footer">
              <Button
                isDisabled={currentStep === 0}
                onPress={() => setCurrentStep((step) => Math.max(0, step - 1))}
                type="button"
                variant="tertiary"
              >
                上一步
              </Button>
              {currentStep < setupSteps.length - 1 ? (
                <Button
                  onPress={() =>
                    setCurrentStep((step) => Math.min(setupSteps.length - 1, step + 1))
                  }
                  type="button"
                >
                  下一步
                </Button>
              ) : (
                <Button isDisabled={isSubmitting} type="submit">
                  <AppIcon name="save" />
                  完成配置并进入后台
                </Button>
              )}
            </div>
            {statusMessage ? <p className="front-form-note">{statusMessage}</p> : null}
          </Form>
        </Card>
      </div>
      <AlertDialog>
        <AlertDialog.Backdrop
          isOpen={isCompleteConfirmOpen}
          onOpenChange={setIsCompleteConfirmOpen}
          variant="blur"
        >
          <AlertDialog.Container placement="center" size="sm">
            <AlertDialog.Dialog>
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="warning" />
                <AlertDialog.Heading>确认完成首次配置？</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>完成后将创建管理员、保存站点配置并进入后台控制台。</p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="tertiary">
                  取消
                </Button>
                <Button
                  isDisabled={isSubmitting}
                  onPress={() => {
                    setIsCompleteConfirmOpen(false);
                    void completeSetup();
                  }}
                  variant="primary"
                >
                  确认完成
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
      <Drawer.Backdrop
        isOpen={isSetupDrawerOpen}
        onOpenChange={setIsSetupDrawerOpen}
        variant="blur"
      >
        <Drawer.Content className="setup-drawer-content" placement="left">
          <Drawer.Dialog aria-label="初始化配置步骤" className="setup-drawer-dialog">
            <Drawer.CloseTrigger />
            <Drawer.Body className="setup-drawer-body">
              <SetupSidebarContent
                currentStep={currentStep}
                isSubmitting={isSubmitting}
                onEnterReadonlyDemo={() => {
                  setIsSetupDrawerOpen(false);
                  void enterReadonlyDemo();
                }}
              />
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </main>
  );
}

function splitList(value: string) {
  return [
    ...new Set(
      value
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

type SetupSidebarContentProps = {
  currentStep: number;
  isSubmitting: boolean;
  onEnterReadonlyDemo: () => void;
};

function SetupSidebarContent({
  currentStep,
  isSubmitting,
  onEnterReadonlyDemo,
}: SetupSidebarContentProps) {
  return (
    <>
      <div className="setup-shell__brand-row">
        <NavBrand />
        <ThemeSwitcher />
      </div>
      <div className="setup-shell__intro">
        <p className="eyebrow">首次配置</p>
        <h1>完成 4 步后进入后台</h1>
        <p>没有管理员时只能停留在初始化页，或进入只读演示后台。</p>
      </div>
      <Button
        isDisabled={isSubmitting}
        onPress={onEnterReadonlyDemo}
        type="button"
        variant="secondary"
      >
        <AppIcon name="shield" />
        只读演示进入后台
      </Button>
      <ol className="setup-steps">
        {setupSteps.map((step, index) => (
          <li
            className={
              index === currentStep
                ? "setup-steps__item is-active"
                : index < currentStep
                  ? "setup-steps__item is-complete"
                  : "setup-steps__item"
            }
            key={step.label}
          >
            <span className="setup-steps__index">{index + 1}</span>
            <span>
              <strong>
                <AppIcon name={step.icon} />
                {step.label}
              </strong>
              <small>{step.description}</small>
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

function NavBrand() {
  return (
    <a aria-label="LeiBlog 首页" className="brand-link" href="/">
      <span aria-hidden="true" className="brand-mark">
        L
      </span>
      <span>LeiBlog</span>
    </a>
  );
}

type SetupTextFieldProps = {
  autoComplete?: string;
  className?: string;
  description?: string;
  fieldError?: string;
  isRequired?: boolean;
  label: string;
  localFile?: File | null;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onFileChange?: (file: File | null) => void;
  placeholder?: string;
  trailingControl?: ReactNode;
  type?: "datetime-local" | "email" | "password" | "text" | "url";
  value: string;
};

function SetupTextField({
  className,
  description,
  fieldError,
  isRequired,
  label,
  localFile,
  onFileChange,
  trailingControl,
  type = "text",
  ...props
}: SetupTextFieldProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const descriptionText = description ?? (isRequired ? "必填" : undefined);
  const input = <Input {...props} type={type} />;

  return (
    <TextField className={className} fullWidth isRequired={isRequired}>
      <Label>{label}</Label>
      {trailingControl ? (
        <div className="setup-field-control-row">
          {input}
          <div className="setup-field-control-row__action">{trailingControl}</div>
        </div>
      ) : (
        input
      )}
      {onFileChange ? (
        <div className="setup-asset-field">
          <input
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
            className="visually-hidden"
            onChange={(event) => {
              onFileChange(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
            ref={fileInputRef}
            type="file"
          />
          <Button
            onPress={() => fileInputRef.current?.click()}
            size="sm"
            type="button"
            variant="tertiary"
          >
            <AppIcon name="cloudUpload" />
            本地上传
          </Button>
          {localFile ? (
            <>
              <span>{localFile.name}</span>
              <Button onPress={() => onFileChange(null)} size="sm" type="button" variant="ghost">
                清除
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
      {descriptionText ? <Description>{descriptionText}</Description> : null}
      <FieldError>{fieldError ?? `${label}格式不正确`}</FieldError>
    </TextField>
  );
}

type SetupTextAreaProps = {
  className?: string;
  description?: string;
  fieldError?: string;
  isRequired?: boolean;
  label: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  value: string;
};

function SetupTextArea({
  className,
  description,
  fieldError,
  isRequired,
  label,
  ...props
}: SetupTextAreaProps) {
  const descriptionText = description ?? (isRequired ? "必填" : undefined);

  return (
    <TextField className={className} fullWidth isRequired={isRequired}>
      <Label>{label}</Label>
      <TextArea {...props} rows={4} />
      {descriptionText ? <Description>{descriptionText}</Description> : null}
      <FieldError>{fieldError ?? `${label}格式不正确`}</FieldError>
    </TextField>
  );
}
