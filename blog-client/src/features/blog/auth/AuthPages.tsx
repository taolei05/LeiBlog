import {
  Accordion,
  AlertDialog,
  Button,
  Card,
  Input,
  InputOTP,
  Label,
  Modal,
  TextArea,
  TextField,
} from "@heroui/react";
import type { Key } from "@heroui/react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { getAdminApiBaseUrl, resolveApiAssetUrl } from "../../../shared/api/api-base-url";
import { AppIcon } from "../../../shared/icons";
import { LocalImageEditorDialog } from "../../../shared/media/local-image-editor";
import { showOperationToast } from "../../../shared/toast/operation-toast";
import { ThemeSwitcher } from "../../../shared/theme/ThemeSwitcher";
import { useTheme } from "../../../shared/theme/ThemeProviderLite";
import { BlogPageHeader } from "../shared/BlogComponents";

type AuthDialogMode = "login" | "register";
type BlogUserRole = "admin" | "demo" | "user";
type ProfilePanelMode = "email" | "password" | "profile" | "theme";
type ProfileConfirmAction = "change-email" | "change-password" | "logout" | "save-profile";

type BlogAuthUser = {
  avatarUrl: string | null;
  blogUrl: string | null;
  createdAt: string;
  description: string;
  email: string | null;
  id: string;
  lastLoginAt: string | null;
  lastLoginDevice: string | null;
  lastLoginIp: string | null;
  lastLoginLocation: string | null;
  name: string | null;
  role: BlogUserRole;
  tags: string[];
  username: string;
};

type BlogSession = {
  token: string;
  user: BlogAuthUser;
};

type EmailCodeResponse = {
  devCode?: string;
  expiresAt: string;
  ok: boolean;
  sent: boolean;
  validMinutes: number;
};

type ProfileFormState = {
  avatarUrl: string;
  blogUrl: string;
  description: string;
  name: string;
  tags: string;
};

type EmailChangeFormState = {
  email: string;
  emailCode: string;
};

type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
};

type AuthShellProps = {
  children: ReactNode;
  description: string;
  icon: "key" | "lockClosed" | "personAdd";
  title: string;
};

type AuthDialogProps = {
  emailCodeStatus: string;
  isOpen: boolean;
  isRegisterCodeSending: boolean;
  isSubmitting: boolean;
  loginForm: {
    identifier: string;
    password: string;
  };
  mode: AuthDialogMode;
  onClose: () => void;
  onLoginChange: (field: "identifier" | "password", value: string) => void;
  onModeChange: (mode: AuthDialogMode) => void;
  onRegisterChange: (
    field: "email" | "emailCode" | "name" | "password" | "username",
    value: string,
  ) => void;
  onRequestRegisterCode: () => void;
  onSubmitLogin: (event: FormEvent<HTMLFormElement>) => void;
  onSubmitRegister: (event: FormEvent<HTMLFormElement>) => void;
  registerCodeCountdownSeconds: number;
  registerCodeValidMinutes: number | null;
  registerForm: {
    email: string;
    emailCode: string;
    name: string;
    password: string;
    username: string;
  };
  registerSendLabel: string;
  registerSendRemainingSeconds: number;
};

type UserProfilePageProps = {
  initialDialog?: AuthDialogMode;
};

const AUTH_API_BASE_URL = getAdminApiBaseUrl();
const BLOG_SESSION_KEY = "leiblog:blog-session";
const BLOG_SESSION_CHANGE_EVENT = "leiblog:blog-session-change";
const REGISTER_CODE_RESEND_COOLDOWN_MS = 60_000;
const REGISTER_CODE_RESEND_STORAGE_KEY = "leiblog:blog:register-code-resend-available-at";
const EMAIL_CHANGE_CODE_RESEND_STORAGE_KEY = "leiblog:blog:email-change-code-resend-available-at";
const profileConfirmCopy: Record<
  ProfileConfirmAction,
  {
    confirmLabel: string;
    description: string;
    status: "danger" | "warning";
    title: string;
  }
> = {
  "change-email": {
    confirmLabel: "确认修改",
    description: "确认后会使用当前填写的新邮箱和验证码修改账号邮箱。",
    status: "warning",
    title: "确认修改邮箱？",
  },
  "change-password": {
    confirmLabel: "确认更新",
    description: "确认后会更新当前账号密码，成功后需要重新登录。",
    status: "warning",
    title: "确认更新密码？",
  },
  logout: {
    confirmLabel: "确认退出",
    description: "退出后需要重新登录才能继续管理个人资料和参与互动。",
    status: "danger",
    title: "确认退出登录？",
  },
  "save-profile": {
    confirmLabel: "确认保存",
    description: "确认后会保存昵称、头像、博客链接、标签和个人描述，并同步到评论区身份展示。",
    status: "warning",
    title: "确认保存资料？",
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown) {
  const stringValue = readString(value).trim();
  return stringValue ? stringValue : null;
}

function readRole(value: unknown): BlogUserRole {
  return value === "admin" || value === "demo" || value === "user" ? value : "user";
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseBlogUser(value: unknown): BlogAuthUser | null {
  if (!isRecord(value)) return null;

  const id = readString(value.id);
  const username = readString(value.username);
  if (!id || !username) return null;

  return {
    avatarUrl: readNullableString(value.avatarUrl),
    blogUrl: readNullableString(value.blogUrl),
    createdAt: readString(value.createdAt),
    description: readString(value.description),
    email: readNullableString(value.email),
    id,
    lastLoginAt: readNullableString(value.lastLoginAt),
    lastLoginDevice: readNullableString(value.lastLoginDevice),
    lastLoginIp: readNullableString(value.lastLoginIp),
    lastLoginLocation: readNullableString(value.lastLoginLocation),
    name: readNullableString(value.name),
    role: readRole(value.role),
    tags: readStringArray(value.tags),
    username,
  };
}

function parseBlogSession(value: unknown): BlogSession | null {
  if (!isRecord(value)) return null;

  const token = readString(value.token);
  const user = parseBlogUser(value.user);

  if (!token || !user) return null;

  return { token, user };
}

function readBlogSession() {
  const storage = getBrowserStorage();
  if (!storage) return null;

  try {
    const storedValue = storage.getItem(BLOG_SESSION_KEY);
    if (!storedValue) return null;
    return parseBlogSession(JSON.parse(storedValue));
  } catch {
    return null;
  }
}

function notifyBlogSessionChange() {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new Event(BLOG_SESSION_CHANGE_EVENT));
}

function writeBlogSession(session: BlogSession) {
  getBrowserStorage()?.setItem(BLOG_SESSION_KEY, JSON.stringify(session));
  notifyBlogSessionChange();
}

function clearBlogSession() {
  getBrowserStorage()?.removeItem(BLOG_SESSION_KEY);
  notifyBlogSessionChange();
}

function readProfilePanelMode(value: string | null): ProfilePanelMode | null {
  if (value === "email" || value === "password" || value === "profile" || value === "theme") {
    return value;
  }

  return null;
}

async function readResponseJson(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function getApiErrorMessage(payload: unknown, fallback: string) {
  if (!isRecord(payload)) return fallback;

  const message = readNullableString(payload.message) ?? readNullableString(payload.error);
  return message ?? fallback;
}

async function authJsonRequest<T>(
  path: string,
  options: {
    body?: unknown;
    method: "GET" | "PATCH" | "POST";
    token?: string;
  },
): Promise<T> {
  const response = await fetch(`${AUTH_API_BASE_URL}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    method: options.method,
  });
  const payload = await readResponseJson(response);

  if (!response.ok) {
    throw new Error(getApiErrorMessage(payload, `请求失败：${response.status}`));
  }

  return payload as T;
}

async function authFormRequest<T>(
  path: string,
  options: {
    body: FormData;
    method: "POST";
    token: string;
  },
): Promise<T> {
  const response = await fetch(`${AUTH_API_BASE_URL}${path}`, {
    body: options.body,
    headers: {
      Authorization: `Bearer ${options.token}`,
    },
    method: options.method,
  });
  const payload = await readResponseJson(response);

  if (!response.ok) {
    throw new Error(getApiErrorMessage(payload, `请求失败：${response.status}`));
  }

  return payload as T;
}

function parseMeResponse(payload: unknown) {
  if (!isRecord(payload)) throw new Error("个人资料响应格式不正确");

  const user = parseBlogUser(payload.user);
  if (!user) throw new Error("个人资料响应格式不正确");

  return user;
}

async function loginBlogUser(identifier: string, password: string) {
  const payload = await authJsonRequest<unknown>("/auth/login", {
    body: { identifier, password },
    method: "POST",
  });
  const session = parseBlogSession(payload);

  if (!session) {
    throw new Error("登录响应格式不正确");
  }

  return session;
}

async function registerBlogUser(input: {
  email: string;
  emailCode: string;
  name: string;
  password: string;
  username: string;
}) {
  const payload = await authJsonRequest<unknown>("/auth/register", {
    body: {
      email: input.email,
      emailCode: input.emailCode,
      name: input.name.trim() || undefined,
      password: input.password,
      username: input.username,
    },
    method: "POST",
  });
  const session = parseBlogSession(payload);

  if (!session) {
    throw new Error("注册响应格式不正确");
  }

  return session;
}

async function requestRegisterEmailCode(email: string) {
  return authJsonRequest<EmailCodeResponse>("/auth/email-code", {
    body: { email, purpose: "register" },
    method: "POST",
  });
}

async function fetchCurrentBlogUser(token: string) {
  const payload = await authJsonRequest<unknown>("/me/", {
    method: "GET",
    token,
  });

  return parseMeResponse(payload);
}

async function updateCurrentBlogUserProfile(
  token: string,
  input: {
    avatarUrl: string | null;
    blogUrl: string | null;
    description: string;
    name: string | null;
    tags: string[];
  },
) {
  const payload = await authJsonRequest<unknown>("/me/", {
    body: input,
    method: "PATCH",
    token,
  });

  return parseMeResponse(payload);
}

async function uploadCurrentBlogUserAvatar(token: string, file: File) {
  const formData = new FormData();
  formData.set("file", file);

  const payload = await authFormRequest<unknown>("/me/avatar", {
    body: formData,
    method: "POST",
    token,
  });

  if (!isRecord(payload)) throw new Error("头像上传响应格式不正确");
  const accessUrl = readString(payload.accessUrl);
  if (!accessUrl) throw new Error("头像上传响应格式不正确");

  return accessUrl;
}

async function requestEmailChangeEmailCode(token: string, email: string) {
  return authJsonRequest<EmailCodeResponse>("/me/email-change-code", {
    body: { email },
    method: "POST",
    token,
  });
}

async function confirmCurrentBlogUserEmail(
  token: string,
  input: {
    email: string;
    emailCode: string;
  },
) {
  const payload = await authJsonRequest<unknown>("/me/email", {
    body: input,
    method: "PATCH",
    token,
  });

  return parseMeResponse(payload);
}

async function updateCurrentBlogUserPassword(
  token: string,
  input: {
    currentPassword: string;
    newPassword: string;
  },
) {
  return authJsonRequest<{ ok: boolean }>("/me/password", {
    body: input,
    method: "PATCH",
    token,
  });
}

async function logoutBlogUser(token: string) {
  return authJsonRequest<{ ok: boolean }>("/auth/logout", {
    method: "POST",
    token,
  });
}

function getDisplayName(user: BlogAuthUser) {
  return user.name ?? user.username;
}

function createProfileFormState(user: BlogAuthUser | null): ProfileFormState {
  return {
    avatarUrl: user?.avatarUrl ?? "",
    blogUrl: user?.blogUrl ?? "",
    description: user?.description ?? "",
    name: user?.name ?? "",
    tags: user?.tags.join(", ") ?? "",
  };
}

function createEmailChangeFormState(user: BlogAuthUser | null): EmailChangeFormState {
  return {
    email: user?.email ?? "",
    emailCode: "",
  };
}

function createPasswordFormState(): PasswordFormState {
  return {
    currentPassword: "",
    newPassword: "",
  };
}

function optionalText(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function parseTags(value: string) {
  return [
    ...new Set(
      value
        .split(/[，,]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
}

function getBrowserStorage() {
  if (typeof window === "undefined") return null;
  if (!("localStorage" in window) || !window.localStorage) return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function formatCountdown(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function readCodeResendAvailableAt(storageKey: string) {
  const storage = getBrowserStorage();
  if (!storage) return null;

  const storedValue = Number(storage.getItem(storageKey));
  if (!Number.isFinite(storedValue) || storedValue <= Date.now()) {
    storage.removeItem(storageKey);
    return null;
  }

  return storedValue;
}

function readRegisterCodeResendAvailableAt() {
  return readCodeResendAvailableAt(REGISTER_CODE_RESEND_STORAGE_KEY);
}

function readEmailChangeCodeResendAvailableAt() {
  return readCodeResendAvailableAt(EMAIL_CHANGE_CODE_RESEND_STORAGE_KEY);
}

function formatDateTime(value: string | null) {
  if (!value) return "暂无记录";

  return new Date(value).toLocaleString("zh-CN");
}

function AuthShell({ children, description, icon, title }: AuthShellProps) {
  return (
    <section className="front-stack auth-page">
      <BlogPageHeader description={description} eyebrow="用户区" icon={icon} title={title} />
      <Card className="front-form-card auth-card">{children}</Card>
    </section>
  );
}

function AuthDialog({
  emailCodeStatus,
  isOpen,
  isRegisterCodeSending,
  isSubmitting,
  loginForm,
  mode,
  onClose,
  onLoginChange,
  onModeChange,
  onRegisterChange,
  onRequestRegisterCode,
  onSubmitLogin,
  onSubmitRegister,
  registerCodeCountdownSeconds,
  registerCodeValidMinutes,
  registerForm,
  registerSendLabel,
  registerSendRemainingSeconds,
}: AuthDialogProps) {
  const isLoginMode = mode === "login";

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (open) return;
        onClose();
      }}
      variant="blur"
    >
      <Modal.Container placement="center" scroll="inside" size="lg">
        <Modal.Dialog className="front-auth-dialog">
          <div className="front-auth-modal">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon>
                <AppIcon name={isLoginMode ? "key" : "personAdd"} />
              </Modal.Icon>
              <div>
                <Modal.Heading>{isLoginMode ? "登录 LeiBlog" : "注册 LeiBlog"}</Modal.Heading>
                <p className="front-auth-modal__description">
                  {isLoginMode
                    ? "登录后可管理个人资料、留言身份和站内互动记录。"
                    : "注册后可保存资料、参与评论，并维护自己的前台身份。"}
                </p>
              </div>
            </Modal.Header>
            <Modal.Body>
              {isLoginMode ? (
                <form className="front-card-form" id="front-login-form" onSubmit={onSubmitLogin}>
                  <TextField fullWidth isRequired>
                    <Label>用户名或邮箱</Label>
                    <Input
                      autoComplete="username"
                      onChange={(event) => onLoginChange("identifier", event.target.value)}
                      placeholder="admin@example.com"
                      value={loginForm.identifier}
                    />
                  </TextField>
                  <TextField fullWidth isRequired>
                    <Label>密码</Label>
                    <Input
                      autoComplete="current-password"
                      onChange={(event) => onLoginChange("password", event.target.value)}
                      type="password"
                      value={loginForm.password}
                    />
                  </TextField>
                  <p className="front-auth-modal__switch">
                    <span>还没有账号？</span>
                    <button onClick={() => onModeChange("register")} type="button">
                      注册账号
                    </button>
                    <Link to="/forgot-password">找回密码</Link>
                  </p>
                </form>
              ) : (
                <form
                  className="front-card-form"
                  id="front-register-form"
                  onSubmit={onSubmitRegister}
                >
                  <TextField fullWidth isRequired>
                    <Label>用户名</Label>
                    <Input
                      autoComplete="username"
                      onChange={(event) => onRegisterChange("username", event.target.value)}
                      placeholder="例如：river-reader"
                      value={registerForm.username}
                    />
                  </TextField>
                  <TextField fullWidth>
                    <Label>昵称 / 姓名</Label>
                    <Input
                      autoComplete="name"
                      onChange={(event) => onRegisterChange("name", event.target.value)}
                      placeholder="前台显示名称"
                      value={registerForm.name}
                    />
                  </TextField>
                  <div className="front-auth-code-row">
                    <TextField fullWidth isRequired>
                      <Label>邮箱</Label>
                      <Input
                        autoComplete="email"
                        onChange={(event) => onRegisterChange("email", event.target.value)}
                        placeholder="name@example.com"
                        type="email"
                        value={registerForm.email}
                      />
                    </TextField>
                    <Button
                      isDisabled={
                        isRegisterCodeSending ||
                        !registerForm.email.trim() ||
                        registerSendRemainingSeconds > 0
                      }
                      onPress={onRequestRegisterCode}
                      type="button"
                      variant="tertiary"
                    >
                      <AppIcon name="mail" />
                      {registerSendLabel}
                    </Button>
                  </div>
                  <p className="front-form-note">{emailCodeStatus}</p>
                  <TextField fullWidth isRequired>
                    <Label>验证码</Label>
                    <InputOTP
                      className="front-auth-otp"
                      maxLength={6}
                      onChange={(value) => onRegisterChange("emailCode", value)}
                      pushPasswordManagerStrategy="none"
                      value={registerForm.emailCode}
                      variant="secondary"
                    >
                      <InputOTP.Group>
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTP.Slot index={index} key={index} />
                        ))}
                      </InputOTP.Group>
                    </InputOTP>
                  </TextField>
                  {registerCodeCountdownSeconds > 0 ? (
                    <div className="secret-reveal-countdown">
                      <AppIcon name="calendar" />
                      <span>有效期 {registerCodeValidMinutes ?? 10} 分钟</span>
                      <strong>{formatCountdown(registerCodeCountdownSeconds)}</strong>
                    </div>
                  ) : null}
                  <TextField fullWidth isRequired>
                    <Label>密码</Label>
                    <Input
                      autoComplete="new-password"
                      onChange={(event) => onRegisterChange("password", event.target.value)}
                      placeholder="至少 8 位"
                      type="password"
                      value={registerForm.password}
                    />
                  </TextField>
                  <p className="front-auth-modal__switch">
                    <span>已有账号？</span>
                    <button onClick={() => onModeChange("login")} type="button">
                      立即登录
                    </button>
                  </p>
                </form>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button onPress={onClose} type="button" variant="tertiary">
                取消
              </Button>
              <Button
                form={isLoginMode ? "front-login-form" : "front-register-form"}
                isDisabled={isSubmitting}
                type="submit"
              >
                <AppIcon name={isLoginMode ? "logIn" : "personAdd"} />
                {isSubmitting
                  ? isLoginMode
                    ? "登录中"
                    : "注册中"
                  : isLoginMode
                    ? "登录"
                    : "注册账号"}
              </Button>
            </Modal.Footer>
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

export function LoginPage() {
  return <UserProfilePage initialDialog="login" />;
}

export function RegisterPage() {
  return <UserProfilePage initialDialog="register" />;
}

export function ForgotPasswordPage() {
  return (
    <AuthShell description="通过邮箱验证码找回账号密码。" icon="lockClosed" title="找回密码">
      <TextField fullWidth isRequired>
        <Label>邮箱</Label>
        <Input autoComplete="email" placeholder="name@example.com" type="email" />
      </TextField>
      <Button isDisabled>
        <AppIcon name="mail" />
        发送验证码
      </Button>
    </AuthShell>
  );
}

export function UserProfilePage({ initialDialog }: UserProfilePageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [session, setSession] = useState<BlogSession | null>(() => readBlogSession());
  const [dialogMode, setDialogMode] = useState<AuthDialogMode | null>(initialDialog ?? null);
  const [profileAccordionKeys, setProfileAccordionKeys] = useState<Set<Key>>(() => {
    const initialPanelMode = readProfilePanelMode(searchParams.get("panel"));

    return initialPanelMode ? new Set([initialPanelMode]) : new Set();
  });
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [pendingProfileAction, setPendingProfileAction] = useState<ProfileConfirmAction | null>(
    null,
  );
  const [isRegisterCodeSending, setIsRegisterCodeSending] = useState(false);
  const [isEmailCodeSending, setIsEmailCodeSending] = useState(false);
  const [registerCodeExpiresAt, setRegisterCodeExpiresAt] = useState<string | null>(null);
  const [registerCodeValidMinutes, setRegisterCodeValidMinutes] = useState<number | null>(null);
  const [registerCodeCountdownSeconds, setRegisterCodeCountdownSeconds] = useState(0);
  const [registerResendAvailableAt, setRegisterResendAvailableAt] = useState<number | null>(null);
  const [registerResendCountdownSeconds, setRegisterResendCountdownSeconds] = useState(0);
  const [emailCodeExpiresAt, setEmailCodeExpiresAt] = useState<string | null>(null);
  const [emailCodeValidMinutes, setEmailCodeValidMinutes] = useState<number | null>(null);
  const [emailCodeCountdownSeconds, setEmailCodeCountdownSeconds] = useState(0);
  const [emailResendAvailableAt, setEmailResendAvailableAt] = useState<number | null>(null);
  const [emailResendCountdownSeconds, setEmailResendCountdownSeconds] = useState(0);
  const [emailCodeStatus, setEmailCodeStatus] = useState("验证码会发送到注册邮箱，10 分钟内有效。");
  const [loginForm, setLoginForm] = useState({ identifier: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    email: "",
    emailCode: "",
    name: "",
    password: "",
    username: "",
  });
  const [profileForm, setProfileForm] = useState<ProfileFormState>(() =>
    createProfileFormState(session?.user ?? null),
  );
  const [emailForm, setEmailForm] = useState<EmailChangeFormState>(() =>
    createEmailChangeFormState(session?.user ?? null),
  );
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(() =>
    createPasswordFormState(),
  );
  const [emailStatus, setEmailStatus] = useState("验证码会发送到新邮箱，10 分钟内有效。");
  const [profileStatus, setProfileStatus] = useState("资料变更会同步影响评论区展示身份。");
  const [avatarLocalFile, setAvatarLocalFile] = useState<File | null>(null);
  const [avatarEditorFile, setAvatarEditorFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const user = session?.user ?? null;
  const sessionToken = session?.token ?? null;
  const profilePanelQueryValue = searchParams.get("panel");

  useEffect(() => {
    if (initialDialog) {
      setDialogMode(initialDialog);
    }
  }, [initialDialog]);

  useEffect(() => {
    function syncProfileSession() {
      const nextSession = readBlogSession();
      setSession(nextSession);

      if (nextSession) return;

      setAvatarEditorFile(null);
      setAvatarLocalFile(null);
      setEmailForm(createEmailChangeFormState(null));
      setPasswordForm(createPasswordFormState());
      setPendingProfileAction(null);
      setProfileAccordionKeys(new Set());
      setProfileForm(createProfileFormState(null));
    }

    window.addEventListener(BLOG_SESSION_CHANGE_EVENT, syncProfileSession);
    window.addEventListener("storage", syncProfileSession);
    window.addEventListener("focus", syncProfileSession);

    return () => {
      window.removeEventListener(BLOG_SESSION_CHANGE_EVENT, syncProfileSession);
      window.removeEventListener("storage", syncProfileSession);
      window.removeEventListener("focus", syncProfileSession);
    };
  }, []);

  useEffect(() => {
    const nextPanelMode = readProfilePanelMode(profilePanelQueryValue);

    setProfileAccordionKeys(nextPanelMode ? new Set([nextPanelMode]) : new Set());
  }, [profilePanelQueryValue]);

  useEffect(() => {
    if (!user) return;

    setProfileForm(createProfileFormState(user));
    setEmailForm(createEmailChangeFormState(user));
  }, [user?.id]);

  useEffect(() => {
    if (!sessionToken) return undefined;

    const token = sessionToken;
    let isActive = true;

    async function refreshProfile() {
      try {
        const nextUser = await fetchCurrentBlogUser(token);
        if (!isActive) return;

        setProfileForm(createProfileFormState(nextUser));
        setEmailForm(createEmailChangeFormState(nextUser));
        setSession((current) => {
          if (!current || current.token !== token) return current;

          const nextSession = { ...current, user: nextUser };
          writeBlogSession(nextSession);

          return nextSession;
        });
      } catch (error) {
        if (!isActive) return;
        showOperationToast(
          error instanceof Error ? `个人资料刷新失败：${error.message}` : "个人资料刷新失败",
        );
      }
    }

    void refreshProfile();

    return () => {
      isActive = false;
    };
  }, [sessionToken]);

  useEffect(() => {
    if (!avatarLocalFile) {
      setAvatarPreviewUrl("");
      return undefined;
    }

    const nextPreviewUrl = URL.createObjectURL(avatarLocalFile);
    setAvatarPreviewUrl(nextPreviewUrl);

    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [avatarLocalFile]);

  useEffect(() => {
    setRegisterResendAvailableAt(readRegisterCodeResendAvailableAt());
    setEmailResendAvailableAt(readEmailChangeCodeResendAvailableAt());
  }, []);

  useEffect(() => {
    if (!registerCodeExpiresAt) {
      setRegisterCodeCountdownSeconds(0);

      return;
    }

    const expiresAt = registerCodeExpiresAt;

    function updateCountdown() {
      const remainingSeconds = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000);

      setRegisterCodeCountdownSeconds(Math.max(0, remainingSeconds));
    }

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);

    return () => window.clearInterval(timer);
  }, [registerCodeExpiresAt]);

  useEffect(() => {
    if (!registerResendAvailableAt) {
      setRegisterResendCountdownSeconds(0);

      return;
    }

    const availableAt = registerResendAvailableAt;

    function updateCountdown() {
      const remainingSeconds = Math.ceil((availableAt - Date.now()) / 1000);

      if (remainingSeconds <= 0) {
        getBrowserStorage()?.removeItem(REGISTER_CODE_RESEND_STORAGE_KEY);
        setRegisterResendAvailableAt(null);
        setRegisterResendCountdownSeconds(0);

        return;
      }

      setRegisterResendCountdownSeconds(remainingSeconds);
    }

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);

    return () => window.clearInterval(timer);
  }, [registerResendAvailableAt]);

  useEffect(() => {
    if (!emailCodeExpiresAt) {
      setEmailCodeCountdownSeconds(0);

      return;
    }

    const expiresAt = emailCodeExpiresAt;

    function updateCountdown() {
      const remainingSeconds = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000);

      setEmailCodeCountdownSeconds(Math.max(0, remainingSeconds));
    }

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);

    return () => window.clearInterval(timer);
  }, [emailCodeExpiresAt]);

  useEffect(() => {
    if (!emailResendAvailableAt) {
      setEmailResendCountdownSeconds(0);

      return;
    }

    const availableAt = emailResendAvailableAt;

    function updateCountdown() {
      const remainingSeconds = Math.ceil((availableAt - Date.now()) / 1000);

      if (remainingSeconds <= 0) {
        getBrowserStorage()?.removeItem(EMAIL_CHANGE_CODE_RESEND_STORAGE_KEY);
        setEmailResendAvailableAt(null);
        setEmailResendCountdownSeconds(0);

        return;
      }

      setEmailResendCountdownSeconds(remainingSeconds);
    }

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);

    return () => window.clearInterval(timer);
  }, [emailResendAvailableAt]);

  function updateLoginForm(field: "identifier" | "password", value: string) {
    setLoginForm((current) => ({ ...current, [field]: value }));
  }

  function updateRegisterForm(
    field: "email" | "emailCode" | "name" | "password" | "username",
    value: string,
  ) {
    setRegisterForm((current) => ({ ...current, [field]: value }));
  }

  function updateProfileForm(field: keyof ProfileFormState, value: string) {
    setProfileForm((current) => ({ ...current, [field]: value }));
  }

  function updateEmailForm(field: keyof EmailChangeFormState, value: string) {
    setEmailForm((current) => ({ ...current, [field]: value }));
  }

  function updatePasswordForm(field: keyof PasswordFormState, value: string) {
    setPasswordForm((current) => ({ ...current, [field]: value }));
  }

  function handleProfileAccordionChange(keys: Set<Key>) {
    const firstKey = Array.from(keys)[0];
    const nextPanelMode = typeof firstKey === "string" ? readProfilePanelMode(firstKey) : null;
    const nextSearchParams = new URLSearchParams(searchParams);

    if (nextPanelMode) {
      nextSearchParams.set("panel", nextPanelMode);
    } else {
      nextSearchParams.delete("panel");
    }

    setSearchParams(nextSearchParams, { replace: true });
    setProfileAccordionKeys(nextPanelMode ? new Set([nextPanelMode]) : new Set());
  }

  function closeProfilePanel() {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("panel");
    setSearchParams(nextSearchParams, { replace: true });
    setProfileAccordionKeys(new Set());
  }

  function updateSessionUser(nextUser: BlogAuthUser) {
    setSession((current) => {
      if (!current) return current;

      const nextSession = { ...current, user: nextUser };
      writeBlogSession(nextSession);

      return nextSession;
    });
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmittingAuth(true);

    try {
      const nextSession = await loginBlogUser(loginForm.identifier.trim(), loginForm.password);
      writeBlogSession(nextSession);
      setSession(nextSession);
      setDialogMode(null);
      showOperationToast(`登录成功，欢迎你 ${getDisplayName(nextSession.user)}`);
    } catch (error) {
      showOperationToast(error instanceof Error ? `登录失败：${error.message}` : "登录失败");
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  async function requestRegisterCode() {
    const email = registerForm.email.trim();
    if (!email) {
      showOperationToast("请输入邮箱后再发送验证码", "warning");
      return;
    }

    setIsRegisterCodeSending(true);
    try {
      const result = await requestRegisterEmailCode(email);
      const resendAvailableAt = Date.now() + REGISTER_CODE_RESEND_COOLDOWN_MS;
      const status = result.sent
        ? `验证码已发送到 ${email}，${result.validMinutes} 分钟内有效。`
        : result.devCode
          ? `开发环境验证码已生成：${result.devCode}`
          : `验证码已生成，${result.validMinutes} 分钟内有效。`;
      setEmailCodeStatus(status);
      setRegisterCodeExpiresAt(result.expiresAt);
      setRegisterCodeValidMinutes(result.validMinutes);
      setRegisterResendAvailableAt(resendAvailableAt);
      setRegisterResendCountdownSeconds(Math.ceil(REGISTER_CODE_RESEND_COOLDOWN_MS / 1000));
      getBrowserStorage()?.setItem(REGISTER_CODE_RESEND_STORAGE_KEY, String(resendAvailableAt));

      if (result.devCode) {
        setRegisterForm((current) => ({ ...current, emailCode: result.devCode ?? "" }));
      }

      showOperationToast(status, result.sent ? "success" : "info");
    } catch (error) {
      showOperationToast(
        error instanceof Error ? `验证码发送失败：${error.message}` : "验证码发送失败",
      );
    } finally {
      setIsRegisterCodeSending(false);
    }
  }

  async function submitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmittingAuth(true);

    try {
      const nextSession = await registerBlogUser({
        email: registerForm.email.trim(),
        emailCode: registerForm.emailCode.trim(),
        name: registerForm.name.trim(),
        password: registerForm.password,
        username: registerForm.username.trim(),
      });
      writeBlogSession(nextSession);
      setSession(nextSession);
      setDialogMode(null);
      showOperationToast(`注册成功，欢迎你 ${getDisplayName(nextSession.user)}`);
    } catch (error) {
      showOperationToast(error instanceof Error ? `注册失败：${error.message}` : "注册失败");
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  function requestLogout() {
    if (!session) return;

    setPendingProfileAction("logout");
  }

  async function logout() {
    if (!session) return;

    try {
      await logoutBlogUser(session.token);
      showOperationToast("退出登录成功");
    } catch (error) {
      showOperationToast(
        error instanceof Error ? `退出登录失败：${error.message}` : "退出登录失败",
      );
    } finally {
      clearBlogSession();
      setSession(null);
    }
  }

  async function requestEmailCode() {
    if (!session) return;

    const email = emailForm.email.trim();
    if (!email) {
      showOperationToast("请输入新邮箱后再发送验证码", "warning");
      return;
    }

    if (email === user?.email) {
      showOperationToast("新邮箱与当前邮箱一致", "warning");
      return;
    }

    setIsEmailCodeSending(true);

    try {
      const result = await requestEmailChangeEmailCode(session.token, email);
      const resendAvailableAt = Date.now() + REGISTER_CODE_RESEND_COOLDOWN_MS;
      const status = result.sent
        ? `验证码已发送到 ${email}，${result.validMinutes} 分钟内有效。`
        : result.devCode
          ? `开发环境验证码已生成：${result.devCode}`
          : `验证码已生成，${result.validMinutes} 分钟内有效。`;

      setEmailStatus(status);
      setEmailCodeExpiresAt(result.expiresAt);
      setEmailCodeValidMinutes(result.validMinutes);
      setEmailResendAvailableAt(resendAvailableAt);
      setEmailResendCountdownSeconds(Math.ceil(REGISTER_CODE_RESEND_COOLDOWN_MS / 1000));
      getBrowserStorage()?.setItem(EMAIL_CHANGE_CODE_RESEND_STORAGE_KEY, String(resendAvailableAt));

      if (result.devCode) {
        setEmailForm((current) => ({ ...current, emailCode: result.devCode ?? "" }));
      }

      showOperationToast(status, result.sent ? "success" : "info");
    } catch (error) {
      showOperationToast(
        error instanceof Error ? `验证码发送失败：${error.message}` : "验证码发送失败",
      );
    } finally {
      setIsEmailCodeSending(false);
    }
  }

  function requestSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) return;

    setPendingProfileAction("save-profile");
  }

  async function saveProfile() {
    if (!session) return;

    setIsSavingProfile(true);

    try {
      const uploadedAvatarUrl = avatarLocalFile
        ? await uploadCurrentBlogUserAvatar(session.token, avatarLocalFile)
        : null;
      const nextUser = await updateCurrentBlogUserProfile(session.token, {
        avatarUrl: uploadedAvatarUrl ?? optionalText(profileForm.avatarUrl),
        blogUrl: optionalText(profileForm.blogUrl),
        description: profileForm.description.trim(),
        name: optionalText(profileForm.name),
        tags: parseTags(profileForm.tags),
      });

      updateSessionUser(nextUser);
      setProfileForm(createProfileFormState(nextUser));
      setAvatarLocalFile(null);
      setProfileStatus("资料已保存，评论区展示身份会同步更新。");
      closeProfilePanel();
      showOperationToast("个人资料保存成功");
    } catch (error) {
      showOperationToast(
        error instanceof Error ? `个人资料保存失败：${error.message}` : "个人资料保存失败",
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  function requestConfirmEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) return;

    const email = emailForm.email.trim();
    const emailCode = emailForm.emailCode.trim();
    if (!email || !emailCode) {
      showOperationToast("请填写新邮箱和验证码", "warning");
      return;
    }

    setPendingProfileAction("change-email");
  }

  async function confirmEmail() {
    if (!session) return;

    const email = emailForm.email.trim();
    const emailCode = emailForm.emailCode.trim();
    if (!email || !emailCode) {
      showOperationToast("请填写新邮箱和验证码", "warning");
      return;
    }

    setIsSavingEmail(true);

    try {
      const nextUser = await confirmCurrentBlogUserEmail(session.token, {
        email,
        emailCode,
      });

      updateSessionUser(nextUser);
      setEmailForm(createEmailChangeFormState(nextUser));
      setEmailCodeExpiresAt(null);
      setEmailStatus("邮箱已修改成功。");
      closeProfilePanel();
      showOperationToast("邮箱修改成功");
    } catch (error) {
      showOperationToast(
        error instanceof Error ? `邮箱修改失败：${error.message}` : "邮箱修改失败",
      );
    } finally {
      setIsSavingEmail(false);
    }
  }

  function requestSavePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) return;

    if (passwordForm.newPassword.length < 8) {
      showOperationToast("新密码至少需要 8 位", "warning");
      return;
    }

    setPendingProfileAction("change-password");
  }

  async function savePassword() {
    if (!session) return;

    if (passwordForm.newPassword.length < 8) {
      showOperationToast("新密码至少需要 8 位", "warning");
      return;
    }

    setIsSavingPassword(true);

    try {
      await updateCurrentBlogUserPassword(session.token, {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      clearBlogSession();
      setSession(null);
      setPasswordForm(createPasswordFormState());
      closeProfilePanel();
      setDialogMode("login");
      showOperationToast("密码已更新，请重新登录");
    } catch (error) {
      showOperationToast(
        error instanceof Error ? `密码更新失败：${error.message}` : "密码更新失败",
      );
    } finally {
      setIsSavingPassword(false);
    }
  }

  function selectAvatarFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (file) {
      setAvatarEditorFile(file);
    }

    event.target.value = "";
  }

  function confirmPendingProfileAction() {
    const action = pendingProfileAction;
    if (!action) return;

    setPendingProfileAction(null);

    switch (action) {
      case "change-email":
        void confirmEmail();
        return;
      case "change-password":
        void savePassword();
        return;
      case "logout":
        void logout();
        return;
      case "save-profile":
        void saveProfile();
        return;
      default: {
        const exhaustiveAction: never = action;
        return exhaustiveAction;
      }
    }
  }

  const userAvatarUrl = resolveApiAssetUrl(user?.avatarUrl);
  const profilePreviewAvatarUrl = avatarPreviewUrl || userAvatarUrl;
  const pendingProfileConfirm = pendingProfileAction
    ? profileConfirmCopy[pendingProfileAction]
    : null;
  const registerSendLabel =
    registerResendCountdownSeconds > 0
      ? `重新发送验证码 ${registerResendCountdownSeconds}s`
      : isRegisterCodeSending
        ? "发送中"
        : registerCodeExpiresAt
          ? "重新发送验证码"
          : "发送验证码";
  const emailSendLabel =
    emailResendCountdownSeconds > 0
      ? `重新发送验证码 ${emailResendCountdownSeconds}s`
      : isEmailCodeSending
        ? "发送中"
        : emailCodeExpiresAt
          ? "重新发送验证码"
          : "发送验证码";

  return (
    <section className="front-stack auth-page">
      <BlogPageHeader
        description={
          user
            ? "维护头像、昵称、邮箱、链接和公开简介，让留言与互动更有辨识度。"
            : "个人页集中处理注册、登录和前台身份信息。"
        }
        eyebrow="用户区"
        icon="personCircle"
        title="个人中心"
      />

      {!user ? (
        <div className="front-profile-guest">
          <Card className="front-form-card front-profile-hero-card">
            <Card.Header>
              <Card.Title>
                <AppIcon name="personCircle" />
                登录后管理你的 LeiBlog 身份
              </Card.Title>
              <Card.Description>
                前台账号用于评论、头像、标签、博客链接和个人展示信息。登录与注册现在都在弹窗中完成。
              </Card.Description>
            </Card.Header>
            <div className="front-profile-actions">
              <Button onPress={() => setDialogMode("login")}>
                <AppIcon name="logIn" />
                登录
              </Button>
              <Button onPress={() => setDialogMode("register")} variant="tertiary">
                <AppIcon name="personAdd" />
                注册账号
              </Button>
            </div>
          </Card>

          <div className="front-profile-feature-grid">
            {[
              ["chatbubbles", "评论身份", "使用头像、昵称和标签展示在文章评论区。"],
              ["link", "个人链接", "维护博客链接和公开简介，便于读者了解你。"],
              ["colorPalette", "偏好设置", "前台主题和阅读偏好会继续放在个人区。"],
            ].map(([icon, title, description]) => (
              <Card className="front-profile-feature-card" key={title}>
                <AppIcon name={icon as "chatbubbles" | "colorPalette" | "link"} />
                <strong>{title}</strong>
                <p>{description}</p>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="front-profile-layout">
          <Accordion
            className="front-profile-accordion"
            expandedKeys={profileAccordionKeys}
            hideSeparator
            variant="surface"
            onExpandedChange={handleProfileAccordionChange}
          >
            <Accordion.Item
              className="site-settings-card front-profile-accordion-card"
              id="profile"
            >
              <Accordion.Heading>
                <Accordion.Trigger>
                  <AppIcon name="personCircle" />
                  资料修改
                  <Accordion.Indicator />
                </Accordion.Trigger>
              </Accordion.Heading>
              <Accordion.Panel>
                <Accordion.Body>
                  <form
                    className="front-card-form front-profile-accordion-form"
                    onSubmit={requestSaveProfile}
                  >
                    <TextField fullWidth>
                      <Label>昵称</Label>
                      <Input
                        autoComplete="name"
                        onChange={(event) => updateProfileForm("name", event.target.value)}
                        placeholder="你的昵称"
                        value={profileForm.name}
                      />
                    </TextField>
                    <TextField fullWidth>
                      <Label>头像链接</Label>
                      <Input
                        inputMode="url"
                        onChange={(event) => updateProfileForm("avatarUrl", event.target.value)}
                        placeholder="/uploads/avatars/... 或 https://images.example/avatar.png"
                        type="text"
                        value={profileForm.avatarUrl}
                      />
                    </TextField>
                    <div className="front-avatar-upload-field">
                      <Label>上传头像</Label>
                      <input
                        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                        className="visually-hidden"
                        onChange={selectAvatarFile}
                        ref={avatarInputRef}
                        type="file"
                      />
                      <div className="front-avatar-upload-control">
                        <Button
                          onPress={() => avatarInputRef.current?.click()}
                          type="button"
                          variant="tertiary"
                        >
                          <AppIcon name="cloudUpload" />
                          本地选择
                        </Button>
                        <span>{avatarLocalFile ? avatarLocalFile.name : "未选择本地头像"}</span>
                      </div>
                    </div>
                    {avatarPreviewUrl ? (
                      <div className="front-avatar-upload-preview">
                        <img alt="头像预览" src={avatarPreviewUrl} />
                      </div>
                    ) : null}
                    {avatarLocalFile ? (
                      <div className="front-form-actions">
                        <Button
                          onPress={() => setAvatarEditorFile(avatarLocalFile)}
                          type="button"
                          variant="tertiary"
                        >
                          <AppIcon name="create" />
                          重新编辑头像
                        </Button>
                        <Button
                          onPress={() => {
                            setAvatarLocalFile(null);
                            setProfileStatus("已移除本地头像预览。");
                          }}
                          type="button"
                          variant="danger-soft"
                        >
                          <AppIcon name="close" />
                          移除头像
                        </Button>
                      </div>
                    ) : null}
                    <TextField fullWidth>
                      <Label>博客链接</Label>
                      <Input
                        onChange={(event) => updateProfileForm("blogUrl", event.target.value)}
                        placeholder="https://example.com"
                        type="url"
                        value={profileForm.blogUrl}
                      />
                    </TextField>
                    <TextField fullWidth>
                      <Label>个人标签</Label>
                      <Input
                        onChange={(event) => updateProfileForm("tags", event.target.value)}
                        placeholder="React, 摄影, 写作"
                        value={profileForm.tags}
                      />
                    </TextField>
                    <TextField fullWidth>
                      <Label>个人描述</Label>
                      <TextArea
                        onChange={(event) => updateProfileForm("description", event.target.value)}
                        placeholder="喜欢记录工程实践、阅读笔记和生活观察。"
                        rows={4}
                        value={profileForm.description}
                      />
                    </TextField>
                    <p className="front-form-note">{profileStatus}</p>
                    <div className="front-profile-accordion-actions">
                      <Button onPress={closeProfilePanel} type="button" variant="tertiary">
                        取消
                      </Button>
                      <Button isDisabled={isSavingProfile} type="submit">
                        <AppIcon name="save" />
                        {isSavingProfile ? "保存中" : "保存资料"}
                      </Button>
                    </div>
                  </form>
                </Accordion.Body>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item className="site-settings-card front-profile-accordion-card" id="email">
              <Accordion.Heading>
                <Accordion.Trigger>
                  <AppIcon name="mail" />
                  修改邮箱
                  <Accordion.Indicator />
                </Accordion.Trigger>
              </Accordion.Heading>
              <Accordion.Panel>
                <Accordion.Body>
                  <form
                    className="front-card-form front-profile-accordion-form"
                    onSubmit={requestConfirmEmail}
                  >
                    <p className="front-form-note">{emailStatus}</p>
                    <TextField fullWidth isRequired>
                      <Label>新邮箱</Label>
                      <Input
                        autoComplete="email"
                        onChange={(event) => updateEmailForm("email", event.target.value)}
                        placeholder="new@example.com"
                        type="email"
                        value={emailForm.email}
                      />
                    </TextField>
                    <TextField fullWidth isRequired>
                      <Label>验证码</Label>
                      <InputOTP
                        className="front-auth-otp"
                        maxLength={6}
                        onChange={(value) => updateEmailForm("emailCode", value)}
                        pushPasswordManagerStrategy="none"
                        value={emailForm.emailCode}
                        variant="secondary"
                      >
                        <InputOTP.Group>
                          {Array.from({ length: 6 }).map((_, index) => (
                            <InputOTP.Slot index={index} key={index} />
                          ))}
                        </InputOTP.Group>
                      </InputOTP>
                    </TextField>
                    {emailCodeCountdownSeconds > 0 ? (
                      <div className="secret-reveal-countdown">
                        <AppIcon name="calendar" />
                        <span>有效期 {emailCodeValidMinutes ?? 10} 分钟</span>
                        <strong>{formatCountdown(emailCodeCountdownSeconds)}</strong>
                      </div>
                    ) : null}
                    <div className="front-profile-accordion-actions">
                      <Button
                        isDisabled={
                          isEmailCodeSending ||
                          !emailForm.email.trim() ||
                          emailResendCountdownSeconds > 0
                        }
                        onPress={requestEmailCode}
                        type="button"
                        variant="tertiary"
                      >
                        <AppIcon name="mail" />
                        {emailSendLabel}
                      </Button>
                      <Button isDisabled={isSavingEmail} type="submit">
                        <AppIcon name="checkmarkCircle" />
                        {isSavingEmail ? "提交中" : "确认修改"}
                      </Button>
                    </div>
                  </form>
                </Accordion.Body>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item
              className="site-settings-card front-profile-accordion-card"
              id="password"
            >
              <Accordion.Heading>
                <Accordion.Trigger>
                  <AppIcon name="lockClosed" />
                  修改密码
                  <Accordion.Indicator />
                </Accordion.Trigger>
              </Accordion.Heading>
              <Accordion.Panel>
                <Accordion.Body>
                  <form
                    className="front-card-form front-profile-accordion-form"
                    onSubmit={requestSavePassword}
                  >
                    <p className="front-form-note">更新成功后会退出当前会话，需要重新登录。</p>
                    <TextField fullWidth isRequired>
                      <Label>当前密码</Label>
                      <Input
                        autoComplete="current-password"
                        onChange={(event) =>
                          updatePasswordForm("currentPassword", event.target.value)
                        }
                        type="password"
                        value={passwordForm.currentPassword}
                      />
                    </TextField>
                    <TextField fullWidth isRequired>
                      <Label>新密码</Label>
                      <Input
                        autoComplete="new-password"
                        onChange={(event) => updatePasswordForm("newPassword", event.target.value)}
                        placeholder="至少 8 位"
                        type="password"
                        value={passwordForm.newPassword}
                      />
                    </TextField>
                    <div className="front-profile-accordion-actions">
                      <Button onPress={closeProfilePanel} type="button" variant="tertiary">
                        取消
                      </Button>
                      <Button isDisabled={isSavingPassword} type="submit">
                        <AppIcon name="key" />
                        {isSavingPassword ? "更新中" : "更新密码"}
                      </Button>
                    </div>
                  </form>
                </Accordion.Body>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item className="site-settings-card front-profile-accordion-card" id="theme">
              <Accordion.Heading>
                <Accordion.Trigger>
                  <AppIcon name="colorPalette" />
                  前台主题
                  <Accordion.Indicator />
                </Accordion.Trigger>
              </Accordion.Heading>
              <Accordion.Panel>
                <Accordion.Body>
                  <FrontThemeSettingsContent />
                </Accordion.Body>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>

          <aside className="front-profile-side">
            <Card className="front-form-card front-profile-summary">
              <div className="front-profile-summary__header">
                <span className="front-profile-avatar">
                  {profilePreviewAvatarUrl ? (
                    <img alt="" src={profilePreviewAvatarUrl} />
                  ) : (
                    getDisplayName(user).slice(0, 1)
                  )}
                </span>
                <div className="front-profile-meta">
                  <strong>{getDisplayName(user)}</strong>
                  <span>{user.email ?? "未设置邮箱"}</span>
                  <small>
                    {user.role === "admin"
                      ? "管理员"
                      : user.role === "demo"
                        ? "演示账号"
                        : "普通用户"}
                  </small>
                </div>
              </div>
              <dl className="front-profile-login-list">
                <div>
                  <dt>最近登录</dt>
                  <dd>{formatDateTime(user.lastLoginAt)}</dd>
                </div>
                <div>
                  <dt>登录 IP</dt>
                  <dd>{user.lastLoginIp ?? "暂无记录"}</dd>
                </div>
                <div>
                  <dt>地点 / 设备</dt>
                  <dd>
                    {[user.lastLoginLocation, user.lastLoginDevice].filter(Boolean).join(" · ") ||
                      "暂无记录"}
                  </dd>
                </div>
              </dl>
              <div className="front-profile-actions front-profile-actions--single">
                <Button onPress={requestLogout} variant="danger-soft">
                  <AppIcon name="logOut" />
                  退出登录
                </Button>
              </div>
            </Card>
          </aside>
        </div>
      )}

      {user ? (
        <LocalImageEditorDialog
          file={avatarEditorFile}
          isOpen={avatarEditorFile !== null}
          kind="avatar"
          onApply={(file) => {
            setAvatarLocalFile(file);
            setAvatarEditorFile(null);
            setProfileStatus(`头像已编辑：${file.name}`);
          }}
          onCancel={() => setAvatarEditorFile(null)}
        />
      ) : null}

      {pendingProfileConfirm ? (
        <AlertDialog>
          <AlertDialog.Backdrop
            isOpen
            onOpenChange={(isOpen) => {
              if (isOpen) return;
              setPendingProfileAction(null);
            }}
            variant="blur"
          >
            <AlertDialog.Container placement="center" size="sm">
              <AlertDialog.Dialog>
                <AlertDialog.CloseTrigger />
                <AlertDialog.Header>
                  <AlertDialog.Icon status={pendingProfileConfirm.status} />
                  <AlertDialog.Heading>{pendingProfileConfirm.title}</AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <p>{pendingProfileConfirm.description}</p>
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button slot="close" variant="tertiary">
                    取消
                  </Button>
                  <Button
                    onPress={confirmPendingProfileAction}
                    slot="close"
                    variant={pendingProfileConfirm.status === "danger" ? "danger" : "primary"}
                  >
                    {pendingProfileConfirm.confirmLabel}
                  </Button>
                </AlertDialog.Footer>
              </AlertDialog.Dialog>
            </AlertDialog.Container>
          </AlertDialog.Backdrop>
        </AlertDialog>
      ) : null}

      <AuthDialog
        emailCodeStatus={emailCodeStatus}
        isOpen={dialogMode !== null}
        isRegisterCodeSending={isRegisterCodeSending}
        isSubmitting={isSubmittingAuth}
        loginForm={loginForm}
        mode={dialogMode ?? "login"}
        onClose={() => setDialogMode(null)}
        onLoginChange={updateLoginForm}
        onModeChange={setDialogMode}
        onRegisterChange={updateRegisterForm}
        onRequestRegisterCode={requestRegisterCode}
        onSubmitLogin={submitLogin}
        onSubmitRegister={submitRegister}
        registerCodeCountdownSeconds={registerCodeCountdownSeconds}
        registerCodeValidMinutes={registerCodeValidMinutes}
        registerForm={registerForm}
        registerSendLabel={registerSendLabel}
        registerSendRemainingSeconds={registerResendCountdownSeconds}
      />
    </section>
  );
}

function FrontThemeSettingsContent() {
  const { mode, resolvedTheme } = useTheme();

  return (
    <div className="front-theme-accordion-panel">
      <div className="front-theme-accordion-panel__header">
        <div>
          <strong>外观模式</strong>
          <p>
            当前选择为 {mode === "system" ? "跟随系统" : mode === "dark" ? "深色" : "浅色"}，
            实际显示为 {resolvedTheme === "dark" ? "深色" : "浅色"}。
          </p>
        </div>
        <ThemeSwitcher density="roomy" />
      </div>
      <div className="front-theme-grid">
        {[
          ["--cursor-ink", "正文"],
          ["--cursor-surface", "表面"],
          ["--cursor-accent", "强调"],
          ["--cursor-border", "边框"],
        ].map(([token, label]) => (
          <div className="front-theme-token" key={token}>
            <span style={{ background: `var(${token})` }} />
            <strong>{label}</strong>
            <code>{token}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

export function UserThemePage() {
  return (
    <section className="front-stack auth-page">
      <BlogPageHeader
        description="前台主题设置只影响博客前台，后台继续使用管理端主题页。"
        eyebrow="用户区"
        icon="colorPalette"
        title="前台主题"
      />
      <Card className="front-theme-panel">
        <Card.Header>
          <Card.Title>
            <AppIcon name="contrast" />
            外观模式
          </Card.Title>
          <Card.Description>前台主题设置只影响博客前台。</Card.Description>
        </Card.Header>
        <FrontThemeSettingsContent />
      </Card>
    </section>
  );
}
