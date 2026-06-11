import {
  Accordion,
  AlertDialog,
  Avatar,
  Button,
  Chip,
  FieldError,
  Form,
  InputGroup,
  Label,
  TextField,
} from "@heroui/react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { resolveApiAssetUrl } from "../../../shared/api/api-base-url";
import type { AppIconName } from "../../../shared/icons";
import { AppIcon } from "../../../shared/icons";
import { signOutAdminSession } from "../../../shared/routing/adminGuards";
import { showOperationToast } from "../../../shared/toast/operation-toast";
import { AdminDataPage } from "../shared/AdminDataPage";
import { AdminInputGroupField, AdminTextAreaGroupField } from "../shared/admin-form-modal";
import {
  adminFetch,
  readStoredAdminSession,
  uploadAdminMediaFile,
  writeAdminSession,
} from "../shared/admin-api";
import { MediaAssetField } from "../shared/media-asset-field";

type AdminProfile = {
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
  role: "admin" | "user";
  socialLinks: Record<string, string>;
  tags: string[];
  updatedAt: string;
  username: string;
};

type ProfileFormState = {
  avatarUrl: string;
  blogUrl: string;
  description: string;
  name: string;
  tags: string;
};

type PasswordFormState = {
  confirmPassword: string;
  currentPassword: string;
  newPassword: string;
};

type SocialLinkDraft = {
  id: string;
  platform: string;
  url: string;
};

type AdminAccountSaveKind = "profile" | "security";

const saveConfirmationCopy: Record<
  AdminAccountSaveKind,
  {
    confirmLabel: string;
    description: string;
    title: string;
  }
> = {
  profile: {
    confirmLabel: "确认保存",
    description: "保存后，昵称、头像、描述、标签、博客链接和社交链接会立即更新。",
    title: "确认保存个人资料？",
  },
  security: {
    confirmLabel: "确认保存",
    description: "保存后，邮箱会直接更新；若填写了新密码，当前会话将退出并要求重新登录。",
    title: "确认保存安全设置？",
  },
};

const emptyProfileForm: ProfileFormState = {
  avatarUrl: "",
  blogUrl: "",
  description: "",
  name: "",
  tags: "",
};

const emptyPasswordForm: PasswordFormState = {
  confirmPassword: "",
  currentPassword: "",
  newPassword: "",
};

function createSocialLinkDraft(platform = "", url = ""): SocialLinkDraft {
  return {
    id: `${platform || "social"}-${Math.random().toString(36).slice(2)}`,
    platform,
    url,
  };
}

function toProfileForm(profile: AdminProfile): ProfileFormState {
  return {
    avatarUrl: profile.avatarUrl ?? "",
    blogUrl: profile.blogUrl ?? "",
    description: profile.description,
    name: profile.name ?? "",
    tags: profile.tags.join("，"),
  };
}

function toSocialLinkDrafts(links: Record<string, string>) {
  const drafts = Object.entries(links).map(([platform, url]) =>
    createSocialLinkDraft(platform, url),
  );

  return drafts.length > 0 ? drafts : [createSocialLinkDraft()];
}

function toSocialLinks(drafts: SocialLinkDraft[]) {
  return Object.fromEntries(
    drafts
      .map((draft) => [draft.platform.trim(), draft.url.trim()])
      .filter(([platform, url]) => platform && url),
  );
}

function toTags(value: string) {
  return [
    ...new Set(
      value
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function formatLoginValue(value: string | null, fallback = "未记录") {
  return value?.trim() ? value : fallback;
}

function formatLoginTime(value: string | null) {
  return value ? new Date(value).toLocaleString("zh-CN") : "从未登录";
}

function syncAdminSession(profile: AdminProfile) {
  const session = readStoredAdminSession();
  if (!session) return;

  writeAdminSession({
    ...session,
    user: {
      ...session.user,
      avatarUrl: profile.avatarUrl,
      email: profile.email,
      name: profile.name,
    },
  });
}

export function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [profileForm, setProfileForm] = useState(emptyProfileForm);
  const [socialLinks, setSocialLinks] = useState<SocialLinkDraft[]>(() => [
    createSocialLinkDraft(),
  ]);
  const [avatarLocalFile, setAvatarLocalFile] = useState<File | null>(null);
  const [email, setEmail] = useState("");
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [pendingSave, setPendingSave] = useState<AdminAccountSaveKind | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadProfile() {
      try {
        const response = await adminFetch<{ user: AdminProfile }>("/me/");
        if (!isActive) return;

        setProfile(response.user);
        setProfileForm(toProfileForm(response.user));
        setSocialLinks(toSocialLinkDrafts(response.user.socialLinks));
        setEmail(response.user.email ?? "");
      } catch (error) {
        if (!isActive) return;
        showOperationToast(error instanceof Error ? error.message : "管理员资料读取失败", "danger");
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void loadProfile();

    return () => {
      isActive = false;
    };
  }, []);

  function updateProfileForm(key: keyof ProfileFormState, value: string) {
    setProfileForm((state) => ({ ...state, [key]: value }));
  }

  function updatePasswordForm(key: keyof PasswordFormState, value: string) {
    setPasswordForm((state) => ({ ...state, [key]: value }));
  }

  function updateSocialLink(id: string, key: "platform" | "url", value: string) {
    setSocialLinks((drafts) =>
      drafts.map((draft) => (draft.id === id ? { ...draft, [key]: value } : draft)),
    );
  }

  function requestProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setPendingSave("profile");
  }

  async function saveProfile() {
    try {
      setIsSavingProfile(true);
      const avatarUrl = avatarLocalFile
        ? (
            await uploadAdminMediaFile({
              file: avatarLocalFile,
              folderSlug: "avatars",
            })
          ).item.accessUrl
        : profileForm.avatarUrl;
      const response = await adminFetch<{ user: AdminProfile }>("/me/", {
        body: {
          avatarUrl: avatarUrl.trim() || null,
          blogUrl: profileForm.blogUrl.trim() || null,
          description: profileForm.description.trim(),
          name: profileForm.name.trim() || null,
          socialLinks: toSocialLinks(socialLinks),
          tags: toTags(profileForm.tags),
        },
        method: "PATCH",
      });

      setProfile(response.user);
      setProfileForm(toProfileForm(response.user));
      setSocialLinks(toSocialLinkDrafts(response.user.socialLinks));
      setAvatarLocalFile(null);
      syncAdminSession(response.user);
      showOperationToast("管理员资料已保存", "success");
    } catch (error) {
      showOperationToast(error instanceof Error ? error.message : "管理员资料保存失败", "danger");
    } finally {
      setIsSavingProfile(false);
    }
  }

  function shouldChangePassword() {
    return Object.values(passwordForm).some((value) => value.trim());
  }

  function validateSecuritySettings() {
    if (!email.trim()) {
      showOperationToast("请先填写邮箱", "warning");
      return false;
    }

    if (!shouldChangePassword()) {
      return true;
    }

    if (!passwordForm.currentPassword.trim()) {
      showOperationToast("修改密码前请填写当前密码", "warning");
      return false;
    }
    if (passwordForm.newPassword.length < 8) {
      showOperationToast("新密码至少需要 8 位", "warning");
      return false;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showOperationToast("两次输入的新密码不一致", "warning");
      return false;
    }

    return true;
  }

  function requestSecuritySave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateSecuritySettings()) return;

    setPendingSave("security");
  }

  async function saveSecuritySettings() {
    if (!profile || !validateSecuritySettings()) {
      if (!profile) {
        showOperationToast("管理员资料仍在读取，请稍后再试", "warning");
      }
      return;
    }

    try {
      setIsSavingSecurity(true);
      const response = await adminFetch<{ user: AdminProfile }>(`/admin/users/${profile.id}`, {
        body: { email: email.trim() },
        method: "PATCH",
      });

      setProfile(response.user);
      setEmail(response.user.email ?? "");
      syncAdminSession(response.user);

      if (!shouldChangePassword()) {
        showOperationToast("安全设置已保存", "success");
        return;
      }

      await adminFetch("/me/password", {
        body: {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        },
        method: "PATCH",
      });
      setPasswordForm(emptyPasswordForm);
      signOutAdminSession();
      showOperationToast("安全设置已保存，请重新登录", "success");
      void navigate("/admin/login", { replace: true });
    } catch (error) {
      showOperationToast(error instanceof Error ? error.message : "安全设置保存失败", "danger");
    } finally {
      setIsSavingSecurity(false);
    }
  }

  function confirmPendingSave() {
    if (pendingSave === "profile") {
      void saveProfile();
      return;
    }

    if (pendingSave === "security") {
      void saveSecuritySettings();
    }
  }

  return (
    <AdminDataPage
      description="只面向当前登录管理员：维护资料、安全信息，查看最近登录痕迹。"
      eyebrow="系统"
      icon="personCircle"
      metricGridClassName="admin-profile-metric-grid"
      metrics={[
        { label: "当前账号", value: profile?.username ?? (isLoading ? "读取中" : "--") },
        { label: "邮箱", value: profile?.email ?? "未设置" },
        { label: "最近登录", value: formatLoginTime(profile?.lastLoginAt ?? null) },
      ]}
      title="管理员设置"
      wide
    >
      <Accordion className="site-settings-accordion" hideSeparator variant="surface">
        <AdminAccountAccordionItem icon="personCircle" id="profile" title="个人资料">
          <div className="admin-account-card__header">
            <div className="admin-account-identity">
              <Avatar size="lg">
                {profileForm.avatarUrl ? (
                  <Avatar.Image
                    alt={profileForm.name || profile?.username || "管理员头像"}
                    src={resolveApiAssetUrl(profileForm.avatarUrl)}
                  />
                ) : null}
                <Avatar.Fallback>
                  {(profileForm.name || profile?.username || "A").slice(0, 1).toUpperCase()}
                </Avatar.Fallback>
              </Avatar>
              <div>
                <h3>公开资料</h3>
                <p>维护当前管理员的昵称、头像和展示信息。</p>
              </div>
            </div>
            <Chip color="accent" variant="soft">
              <Chip.Label>仅管理员可编辑社交链接</Chip.Label>
            </Chip>
          </div>
          <Form className="admin-account-form" onSubmit={requestProfileSave}>
            <div className="admin-account-card__content">
              <div className="admin-account-field-grid">
                <AdminInputGroupField
                  autoComplete="name"
                  icon="personCircle"
                  label="昵称"
                  onChange={(value) => updateProfileForm("name", value)}
                  placeholder="管理员展示名称"
                  value={profileForm.name}
                />
                <AdminInputGroupField
                  icon="link"
                  label="博客链接"
                  onChange={(value) => updateProfileForm("blogUrl", value)}
                  placeholder="https://..."
                  type="url"
                  value={profileForm.blogUrl}
                />
                <AdminInputGroupField
                  icon="pricetags"
                  label="标签"
                  onChange={(value) => updateProfileForm("tags", value)}
                  placeholder="作者，编辑，摄影"
                  value={profileForm.tags}
                />
                <div className="admin-account-field-grid__span">
                  <MediaAssetField
                    folderSlug="avatars"
                    label="头像"
                    localFile={avatarLocalFile}
                    onChange={(value) => updateProfileForm("avatarUrl", value)}
                    onLocalFileChange={setAvatarLocalFile}
                    value={profileForm.avatarUrl}
                  />
                </div>
              </div>
              <AdminTextAreaGroupField
                icon="documentText"
                label="描述"
                onChange={(value) => updateProfileForm("description", value)}
                placeholder="介绍一下当前管理员"
                rows={4}
                value={profileForm.description}
              />
              <section className="admin-account-social-panel">
                <div className="admin-account-social-panel__heading">
                  <div>
                    <h3>社交链接</h3>
                    <p>可登记多个平台链接。</p>
                  </div>
                  <Button
                    onPress={() => setSocialLinks((drafts) => [...drafts, createSocialLinkDraft()])}
                    size="sm"
                    type="button"
                    variant="tertiary"
                  >
                    <AppIcon name="link" />
                    添加链接
                  </Button>
                </div>
                <div className="admin-account-social-list">
                  {socialLinks.map((draft) => (
                    <div className="admin-account-social-row" key={draft.id}>
                      <TextField fullWidth>
                        <Label>平台</Label>
                        <InputGroup fullWidth variant="secondary">
                          <InputGroup.Prefix>
                            <AppIcon name="at" size={16} />
                          </InputGroup.Prefix>
                          <InputGroup.Input
                            onChange={(event) =>
                              updateSocialLink(draft.id, "platform", event.target.value)
                            }
                            placeholder="github"
                            type="text"
                            value={draft.platform}
                          />
                        </InputGroup>
                        <FieldError>平台名称格式不正确</FieldError>
                      </TextField>
                      <TextField fullWidth>
                        <Label>链接</Label>
                        <InputGroup fullWidth variant="secondary">
                          <InputGroup.Prefix>
                            <AppIcon name="link" size={16} />
                          </InputGroup.Prefix>
                          <InputGroup.Input
                            onChange={(event) =>
                              updateSocialLink(draft.id, "url", event.target.value)
                            }
                            placeholder="https://..."
                            type="url"
                            value={draft.url}
                          />
                        </InputGroup>
                        <FieldError>社交链接格式不正确</FieldError>
                      </TextField>
                      <Button
                        aria-label="移除社交链接"
                        isDisabled={socialLinks.length === 1}
                        isIconOnly
                        onPress={() =>
                          setSocialLinks((drafts) =>
                            drafts.length === 1
                              ? drafts
                              : drafts.filter((item) => item.id !== draft.id),
                          )
                        }
                        type="button"
                        variant="danger-soft"
                      >
                        <AppIcon name="trash" />
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
            <div className="admin-account-card__footer">
              <Button isDisabled={isLoading || isSavingProfile} type="submit">
                <AppIcon name="save" />
                保存资料
              </Button>
            </div>
          </Form>
        </AdminAccountAccordionItem>

        <AdminAccountAccordionItem icon="shield" id="security" title="账号安全">
          <div className="admin-account-section-copy">
            <h3>邮箱与密码</h3>
            <p>邮箱可直接保存；填写密码字段时会同时修改当前账号密码。</p>
          </div>
          <Form className="admin-account-security" onSubmit={requestSecuritySave}>
            <div className="admin-account-security__form">
              <AdminInputGroupField
                autoComplete="email"
                icon="mail"
                isRequired
                label="邮箱"
                onChange={setEmail}
                placeholder="name@example.com"
                type="email"
                value={email}
              />
            </div>
            <div className="admin-account-security__form">
              <AdminInputGroupField
                autoComplete="current-password"
                description="不修改密码时可留空。"
                icon="lockClosed"
                label="当前密码"
                onChange={(value) => updatePasswordForm("currentPassword", value)}
                placeholder="输入当前密码"
                type="password"
                value={passwordForm.currentPassword}
              />
              <AdminInputGroupField
                autoComplete="new-password"
                icon="key"
                label="新密码"
                onChange={(value) => updatePasswordForm("newPassword", value)}
                placeholder="至少 8 位"
                type="password"
                value={passwordForm.newPassword}
              />
              <AdminInputGroupField
                autoComplete="new-password"
                icon="shield"
                label="确认新密码"
                onChange={(value) => updatePasswordForm("confirmPassword", value)}
                placeholder="再次输入新密码"
                type="password"
                value={passwordForm.confirmPassword}
              />
            </div>
            <div className="admin-account-card__footer">
              <Button isDisabled={isLoading || isSavingSecurity} type="submit">
                <AppIcon name="save" />
                保存安全设置
              </Button>
            </div>
          </Form>
        </AdminAccountAccordionItem>

        <AdminAccountAccordionItem icon="desktop" id="login" title="登录信息">
          <div className="admin-account-section-copy">
            <h3>最近一次登录记录</h3>
            <p>只读展示当前账号的登录时间、IP、地点和设备。</p>
          </div>
          <dl className="admin-account-login-grid">
            <div>
              <dt>最近登录时间</dt>
              <dd>{formatLoginTime(profile?.lastLoginAt ?? null)}</dd>
            </div>
            <div>
              <dt>IP</dt>
              <dd>{formatLoginValue(profile?.lastLoginIp ?? null)}</dd>
            </div>
            <div>
              <dt>地点</dt>
              <dd>{formatLoginValue(profile?.lastLoginLocation ?? null)}</dd>
            </div>
            <div>
              <dt>设备</dt>
              <dd>{formatLoginValue(profile?.lastLoginDevice ?? null)}</dd>
            </div>
          </dl>
        </AdminAccountAccordionItem>

        <AdminAccountAccordionItem icon="sparkles" id="preferences" title="偏好">
          <div className="admin-account-section-copy">
            <h3>偏好设置</h3>
            <p className="admin-account-preference-note">主题与编辑体验偏好会在这里继续扩展。</p>
          </div>
        </AdminAccountAccordionItem>
      </Accordion>
      {pendingSave ? (
        <AlertDialog>
          <AlertDialog.Backdrop
            isOpen
            onOpenChange={(isOpen) => {
              if (isOpen) return;
              setPendingSave(null);
            }}
            variant="blur"
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
                    isDisabled={pendingSave === "profile" ? isSavingProfile : isSavingSecurity}
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
    </AdminDataPage>
  );
}

type AdminAccountAccordionItemProps = {
  children: ReactNode;
  icon: AppIconName;
  id: string;
  title: string;
};

function AdminAccountAccordionItem({ children, icon, id, title }: AdminAccountAccordionItemProps) {
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
        <Accordion.Body>
          <div className="admin-account-accordion-body">{children}</div>
        </Accordion.Body>
      </Accordion.Panel>
    </Accordion.Item>
  );
}
