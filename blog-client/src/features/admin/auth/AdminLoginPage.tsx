import {
  Button,
  Card,
  Chip,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  TextField,
} from "@heroui/react";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { InteractiveCursor } from "../../../app/blog/InteractiveCursor";
import { AppIcon } from "../../../shared/icons";
import { PasswordInputGroup } from "../../../shared/password-input-group";
import { signInAdminSession, useAdminSession } from "../../../shared/routing/adminGuards";
import { ThemeSwitcher } from "../../../shared/theme/ThemeSwitcher";
import { showErrorToast, showSuccessToast } from "../../../shared/toast/operation-toast";
import { createDemoSession, loginAdmin } from "../shared/admin-api";

export function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useAdminSession();
  const [identifier, setIdentifier] = useState("admin");
  const [password, setPassword] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextPath = useMemo(() => {
    const state = location.state as { next?: string } | null;

    return state?.next?.startsWith("/admin") ? state.next : "/admin";
  }, [location.state]);

  if (session.isAuthenticated && (session.role === "admin" || session.role === "demo")) {
    return <Navigate replace to={nextPath} />;
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage("");
    setIsSubmitting(true);

    try {
      const nextSession = await loginAdmin(identifier, password);
      if (nextSession.user.role !== "admin" && nextSession.user.role !== "demo") {
        setStatusMessage("普通用户不能进入后台。");
        showErrorToast("登录失败：普通用户不能进入后台。");
        return;
      }

      signInAdminSession(nextSession);
      showSuccessToast(`登录成功，欢迎你 ${nextSession.user.name ?? nextSession.user.username}`);
      void navigate(nextPath, { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "登录失败";
      setStatusMessage(message);
      showErrorToast(`登录失败：${message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function enterReadonlyDemo() {
    setStatusMessage("");
    setIsSubmitting(true);

    try {
      const nextSession = await createDemoSession();
      signInAdminSession(nextSession);
      showSuccessToast(`登录成功，欢迎你 ${nextSession.user.name ?? nextSession.user.username}`);
      void navigate(nextPath, { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "演示会话创建失败";
      setStatusMessage(message);
      showErrorToast(`登录失败：${message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="setup-page admin-login-page">
      <InteractiveCursor />
      <Card className="admin-login-card">
        <Card.Header className="admin-login-card__header">
          <div>
            <p className="eyebrow">后台登录</p>
            <Card.Title>
              <AppIcon name="shield" />
              进入 LeiBlog 控制台
            </Card.Title>
            <Card.Description>管理员和 demo 账户可进入后台，demo 会保持只读。</Card.Description>
          </div>
          <ThemeSwitcher />
        </Card.Header>
        <Form className="admin-login-card__form" onSubmit={submitLogin}>
          <TextField fullWidth isRequired>
            <Label>用户名或邮箱</Label>
            <Input
              autoComplete="username"
              onChange={(event) => setIdentifier(event.target.value)}
              type="text"
              value={identifier}
            />
            <Description>请输入管理员或 demo 账户的用户名/邮箱。</Description>
            <FieldError>用户名或邮箱不能为空</FieldError>
          </TextField>
          <TextField fullWidth isRequired>
            <Label>密码</Label>
            <PasswordInputGroup
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              value={password}
            />
            <Description>后台登录密码区分大小写。</Description>
            <FieldError>密码不能为空</FieldError>
          </TextField>
          <div className="admin-login-card__meta">
            <Chip color="accent" variant="soft">
              <Chip.Label>admin 全权限</Chip.Label>
            </Chip>
            <Chip color="warning" variant="soft">
              <Chip.Label>demo 只读</Chip.Label>
            </Chip>
          </div>
          <div className="admin-login-card__actions">
            <Button isDisabled={isSubmitting} type="submit">
              <AppIcon name="logIn" />
              登录后台
            </Button>
            <Button
              isDisabled={isSubmitting}
              onPress={() => void enterReadonlyDemo()}
              type="button"
              variant="tertiary"
            >
              <AppIcon name="shield" />
              只读演示
            </Button>
          </div>
          {statusMessage ? <p className="front-form-note">{statusMessage}</p> : null}
        </Form>
      </Card>
    </main>
  );
}
