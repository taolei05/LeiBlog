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
import { useMemo, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { AppIcon } from "../../../shared/icons";
import {
  isSetupComplete,
  markSetupComplete,
  SETUP_COMPLETE_STORAGE_KEY,
  signInAdminSession,
} from "../../../shared/routing/adminGuards";
import { ThemeSwitcher } from "../../../shared/theme/ThemeSwitcher";

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
  const [completed, setCompleted] = useState(isSetupComplete);
  const currentStepMeta = setupSteps[currentStep];
  const nextPath = useMemo(() => {
    const state = location.state as { next?: string } | null;

    return state?.next?.startsWith("/admin") ? state.next : "/admin";
  }, [location.state]);

  function updateField(key: keyof SetupFormState) {
    return createChangeHandler(setFormState, key);
  }

  function completeSetup() {
    markSetupComplete();
    signInAdminSession("admin");
    setCompleted(true);
    void navigate(nextPath, { replace: true });
  }

  if (completed) {
    return (
      <main className="setup-page">
        <Card className="setup-card setup-card--done">
          <AppIcon name="checkmarkCircle" size={28} />
          <Card.Header>
            <Card.Title>首次配置已完成</Card.Title>
            <Card.Description>
              本地标记 `{SETUP_COMPLETE_STORAGE_KEY}` 已写入，后台守卫会放行 admin 和 demo 角色。
            </Card.Description>
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
            <p>后台守卫已接入，未完成配置前会停留在这个向导页。</p>
          </div>
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
              completeSetup();
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
                <SetupTextArea
                  className="form-grid__wide"
                  label="SEO 描述"
                  onChange={updateField("seoDescription")}
                  value={formState.seoDescription}
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
                <Button type="submit">
                  <AppIcon name="save" />
                  完成配置并进入后台
                </Button>
              )}
            </div>
          </Form>
        </Card>
      </div>
    </main>
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
