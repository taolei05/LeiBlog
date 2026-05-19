import {
  Button,
  Card,
  Description,
  Form,
  Input,
  Label,
  Switch,
  TextArea,
  TextField,
} from "@heroui/react";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { AppIcon } from "../../../shared/icons";
import { signInAdminSession } from "../../../shared/routing/adminGuards";
import { ThemeSwitcher } from "../../../shared/theme/ThemeSwitcher";
import {
  completeInitialSetup,
  createDemoSession,
  getSetupStatus,
  loginAdmin,
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
  const [completed, setCompleted] = useState(false);
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
      await completeInitialSetup({
        admin: {
          avatarUrl: formState.adminAvatar || undefined,
          description: formState.adminDescription,
          email: formState.adminEmail || undefined,
          name: formState.adminName || undefined,
          password: formState.adminPassword,
          tags: splitList(formState.adminTags),
          username: formState.adminUsername,
        },
        filing: {
          icpNumber: formState.icpNumber || undefined,
          icpUrl: formState.icpUrl || undefined,
          policeNumber: formState.policeNumber || undefined,
          policeUrl: formState.policeUrl || undefined,
        },
        siteConfig: {
          commentsEnabled: formState.commentsEnabled,
          copyright: formState.copyright,
          deeplApiKey: formState.deeplApiKey || undefined,
          ipgeolocationApiKey: formState.ipGeolocationApiKey || undefined,
          resendApiKey: formState.resendApiKey || undefined,
          resendDomain: formState.resendDomain || undefined,
          seoDescription: formState.seoDescription,
          seoKeywords: splitList(formState.seoKeywords),
          seoTitle: formState.seoTitle,
        },
        siteInfo: {
          description: formState.siteDescription,
          establishedAt: formState.foundedAt,
          faviconUrl: formState.favicon || undefined,
          logoDarkUrl: formState.siteLogoDark || undefined,
          logoLightUrl: formState.siteLogoLight || undefined,
          siteName: formState.siteName,
        },
      });
      const nextSession = await loginAdmin(formState.adminUsername, formState.adminPassword);
      signInAdminSession(nextSession);
      setCompleted(true);
      void navigate(nextPath, { replace: true });
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "初始化失败");
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
      <div className="setup-shell">
        <aside className="setup-shell__aside">
          <NavBrand />
          <div className="setup-shell__intro">
            <p className="eyebrow">首次配置</p>
            <h1>完成 4 步后进入后台</h1>
            <p>没有管理员时只能停留在初始化页，或进入只读演示后台。</p>
          </div>
          <Button
            isDisabled={isSubmitting}
            onPress={() => void enterReadonlyDemo()}
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
            <ThemeSwitcher />
          </div>

          <Form
            className="setup-wizard__form"
            onSubmit={(event) => {
              event.preventDefault();
              void completeSetup();
            }}
          >
            {currentStep === 0 ? (
              <div className="form-grid">
                <SetupTextField
                  autoComplete="username"
                  isRequired
                  label="用户名"
                  onChange={updateField("adminUsername")}
                  value={formState.adminUsername}
                />
                <SetupTextField
                  autoComplete="new-password"
                  isRequired
                  label="密码"
                  onChange={updateField("adminPassword")}
                  type="password"
                  value={formState.adminPassword}
                />
                <SetupTextField
                  autoComplete="email"
                  label="邮箱"
                  onChange={updateField("adminEmail")}
                  type="email"
                  value={formState.adminEmail}
                />
                <SetupTextField
                  autoComplete="name"
                  label="显示名称"
                  onChange={updateField("adminName")}
                  value={formState.adminName}
                />
                <SetupTextField
                  label="个人标签"
                  onChange={updateField("adminTags")}
                  placeholder="例如：全栈, 写作, 摄影"
                  value={formState.adminTags}
                />
                <SetupTextField
                  label="头像链接"
                  onChange={updateField("adminAvatar")}
                  type="url"
                  value={formState.adminAvatar}
                />
                <SetupTextArea
                  className="form-grid__wide"
                  label="个人描述"
                  onChange={updateField("adminDescription")}
                  value={formState.adminDescription}
                />
              </div>
            ) : null}

            {currentStep === 1 ? (
              <div className="form-grid">
                <SetupTextField
                  isRequired
                  label="站点名称"
                  onChange={updateField("siteName")}
                  value={formState.siteName}
                />
                <SetupTextField
                  isRequired
                  label="建站时间"
                  onChange={updateField("foundedAt")}
                  type="datetime-local"
                  value={formState.foundedAt}
                />
                <SetupTextArea
                  className="form-grid__wide"
                  isRequired
                  label="站点描述"
                  onChange={updateField("siteDescription")}
                  value={formState.siteDescription}
                />
                <SetupTextField
                  label="浅色 Logo"
                  onChange={updateField("siteLogoLight")}
                  type="url"
                  value={formState.siteLogoLight}
                />
                <SetupTextField
                  label="深色 Logo"
                  onChange={updateField("siteLogoDark")}
                  type="url"
                  value={formState.siteLogoDark}
                />
                <SetupTextField
                  label="favicon"
                  onChange={updateField("favicon")}
                  type="url"
                  value={formState.favicon}
                />
                <Button
                  className="form-grid__inline-action"
                  onPress={() =>
                    setFormState((state) => ({ ...state, foundedAt: getLocalDateTimeValue() }))
                  }
                  type="button"
                  variant="tertiary"
                >
                  <AppIcon name="calendar" />
                  此刻
                </Button>
              </div>
            ) : null}

            {currentStep === 2 ? (
              <div className="form-grid">
                <SetupTextField
                  label="SEO 标题"
                  onChange={updateField("seoTitle")}
                  value={formState.seoTitle}
                />
                <SetupTextArea
                  className="form-grid__wide"
                  label="SEO 描述"
                  onChange={updateField("seoDescription")}
                  value={formState.seoDescription}
                />
                <SetupTextField
                  label="SEO 关键词"
                  onChange={updateField("seoKeywords")}
                  placeholder="用逗号分隔"
                  value={formState.seoKeywords}
                />
                <SetupTextField
                  label="版权信息"
                  onChange={updateField("copyright")}
                  value={formState.copyright}
                />
                <SetupTextField
                  label="Resend 域名"
                  onChange={updateField("resendDomain")}
                  value={formState.resendDomain}
                />
                <SetupTextField
                  label="Resend API key"
                  onChange={updateField("resendApiKey")}
                  type="password"
                  value={formState.resendApiKey}
                />
                <SetupTextField
                  label="DeepL API key"
                  onChange={updateField("deeplApiKey")}
                  type="password"
                  value={formState.deeplApiKey}
                />
                <SetupTextField
                  label="IPGeolocation API key"
                  onChange={updateField("ipGeolocationApiKey")}
                  type="password"
                  value={formState.ipGeolocationApiKey}
                />
                <Switch
                  className="setup-switch form-grid__wide"
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
                  label="ICP备案号"
                  onChange={updateField("icpNumber")}
                  value={formState.icpNumber}
                />
                <SetupTextField
                  label="ICP备案网址"
                  onChange={updateField("icpUrl")}
                  type="url"
                  value={formState.icpUrl}
                />
                <SetupTextField
                  label="公安备案号"
                  onChange={updateField("policeNumber")}
                  value={formState.policeNumber}
                />
                <SetupTextField
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

function SetupTextField({
  className,
  isRequired,
  label,
  ...props
}: {
  autoComplete?: string;
  className?: string;
  isRequired?: boolean;
  label: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  return (
    <TextField className={className} fullWidth isRequired={isRequired}>
      <Label>{label}</Label>
      <Input {...props} />
      {isRequired ? <Description>必填</Description> : null}
    </TextField>
  );
}

function SetupTextArea({
  className,
  isRequired,
  label,
  ...props
}: {
  className?: string;
  isRequired?: boolean;
  label: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  value: string;
}) {
  return (
    <TextField className={className} fullWidth isRequired={isRequired}>
      <Label>{label}</Label>
      <TextArea {...props} rows={4} />
      {isRequired ? <Description>必填</Description> : null}
    </TextField>
  );
}
