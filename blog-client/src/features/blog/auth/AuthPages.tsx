import { Button, Card, Input, Label, TextArea, TextField } from "@heroui/react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { AppIcon } from "../../../shared/icons";
import { ThemeSwitcher } from "../../../shared/theme/ThemeSwitcher";
import { useTheme } from "../../../shared/theme/ThemeProviderLite";
import { BlogPageHeader } from "../shared/BlogComponents";

type AuthShellProps = {
  children: ReactNode;
  description: string;
  icon: "key" | "lockClosed" | "personAdd";
  title: string;
};

function AuthShell({ children, description, icon, title }: AuthShellProps) {
  return (
    <section className="front-stack auth-page">
      <BlogPageHeader description={description} eyebrow="用户区" icon={icon} title={title} />
      <Card className="front-form-card auth-card">{children}</Card>
    </section>
  );
}

export function LoginPage() {
  return (
    <AuthShell description="登录后可管理个人资料、留言身份和站内互动记录。" icon="key" title="登录">
      <TextField fullWidth isRequired>
        <Label>用户名或邮箱</Label>
        <Input autoComplete="username" placeholder="admin@example.com" />
      </TextField>
      <TextField fullWidth isRequired>
        <Label>密码</Label>
        <Input autoComplete="current-password" type="password" />
      </TextField>
      <Button isDisabled>
        <AppIcon name="logIn" />
        登录
      </Button>
      <p className="auth-card__links">
        <Link to="/register">注册账号</Link>
        <Link to="/forgot-password">找回密码</Link>
      </p>
    </AuthShell>
  );
}

export function RegisterPage() {
  return (
    <AuthShell
      description="创建账号后可保存资料、收藏文章并参与留言。"
      icon="personAdd"
      title="注册"
    >
      <TextField fullWidth isRequired>
        <Label>用户名</Label>
        <Input autoComplete="username" />
      </TextField>
      <TextField fullWidth isRequired>
        <Label>邮箱</Label>
        <Input autoComplete="email" type="email" />
      </TextField>
      <TextField fullWidth isRequired>
        <Label>密码</Label>
        <Input autoComplete="new-password" type="password" />
      </TextField>
      <Button isDisabled>
        <AppIcon name="personAdd" />
        创建账号
      </Button>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  return (
    <AuthShell
      description="找回密码页先提供邮箱输入和验证码流程占位。"
      icon="lockClosed"
      title="找回密码"
    >
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

export function UserProfilePage() {
  const [emailStatus, setEmailStatus] = useState("验证码会发送到新邮箱，10 分钟内有效。");
  const [profileStatus, setProfileStatus] = useState("资料变更会同步影响评论区展示身份。");

  function requestEmailCode() {
    setEmailStatus("验证码已发送。开发环境会返回 devCode，生产环境通过 Resend 投递。");
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileStatus("资料已在当前页面保存预览，接入接口后会调用 /api/me。");
  }

  function confirmEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailStatus("邮箱修改已提交，后端会校验 email_change_requests 中的验证码。");
  }

  return (
    <section className="front-stack auth-page">
      <BlogPageHeader
        description="维护头像、昵称、邮箱、链接和公开简介，让留言与互动更有辨识度。"
        eyebrow="用户区"
        icon="personCircle"
        title="个人资料"
      />
      <Card className="front-form-card auth-card">
        <form className="front-card-form" onSubmit={saveProfile}>
          <TextField fullWidth>
            <Label>昵称</Label>
            <Input placeholder="LeiBlog 读者" />
          </TextField>
          <TextField fullWidth>
            <Label>头像链接</Label>
            <Input
              placeholder="https://images.unsplash.com/photo-1494790108377-be9c29b29330"
              type="url"
            />
          </TextField>
          <TextField fullWidth>
            <Label>上传头像</Label>
            <Input accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml" type="file" />
          </TextField>
          <TextField fullWidth>
            <Label>博客链接</Label>
            <Input placeholder="https://example.com" type="url" />
          </TextField>
          <TextField fullWidth>
            <Label>个人标签</Label>
            <Input placeholder="React, 摄影, 写作" />
          </TextField>
          <TextField fullWidth>
            <Label>个人描述</Label>
            <TextArea placeholder="喜欢记录工程实践、阅读笔记和生活观察。" rows={4} />
          </TextField>
          <p className="front-form-note">{profileStatus}</p>
          <Button type="submit">
            <AppIcon name="save" />
            保存资料
          </Button>
        </form>
      </Card>

      <Card className="front-form-card auth-card">
        <form className="front-card-form" onSubmit={confirmEmail}>
          <Card.Header>
            <Card.Title>
              <AppIcon name="mail" />
              修改邮箱
            </Card.Title>
            <Card.Description>{emailStatus}</Card.Description>
          </Card.Header>
          <TextField fullWidth isRequired>
            <Label>新邮箱</Label>
            <Input autoComplete="email" placeholder="new@example.com" type="email" />
          </TextField>
          <TextField fullWidth isRequired>
            <Label>验证码</Label>
            <Input inputMode="numeric" placeholder="6 位验证码" />
          </TextField>
          <div className="front-form-actions">
            <Button onPress={requestEmailCode} type="button" variant="tertiary">
              <AppIcon name="mail" />
              发送验证码
            </Button>
            <Button type="submit">
              <AppIcon name="checkmarkCircle" />
              确认修改
            </Button>
          </div>
        </form>
      </Card>

      <Card className="front-form-card auth-card">
        <Card.Header>
          <Card.Title>
            <AppIcon name="lockClosed" />
            安全设置
          </Card.Title>
          <Card.Description>前台用户可修改密码，找回密码流程仍从邮箱验证码开始。</Card.Description>
        </Card.Header>
        <TextField fullWidth>
          <Label>当前密码</Label>
          <Input autoComplete="current-password" type="password" />
        </TextField>
        <TextField fullWidth>
          <Label>新密码</Label>
          <Input autoComplete="new-password" type="password" />
        </TextField>
        <Button>
          <AppIcon name="key" />
          更新密码
        </Button>
      </Card>

      <Link className="front-action-link" to="/profile/theme">
        <AppIcon name="colorPalette" />
        打开前台主题设置
      </Link>
    </section>
  );
}

export function UserThemePage() {
  const { mode, resolvedTheme } = useTheme();

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
          <Card.Description>
            当前选择为 {mode === "system" ? "跟随系统" : mode === "dark" ? "深色" : "浅色"}，
            实际显示为 {resolvedTheme === "dark" ? "深色" : "浅色"}。
          </Card.Description>
        </Card.Header>
        <ThemeSwitcher density="roomy" />
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
      </Card>
    </section>
  );
}
