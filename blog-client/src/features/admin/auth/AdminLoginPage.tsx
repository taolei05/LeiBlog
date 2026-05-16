import { Button, Card, Chip, Form, Input, Label, TextField } from "@heroui/react";
import { useMemo, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { AppIcon } from "../../../shared/icons";
import {
  isSetupComplete,
  signInAdminSession,
  useAdminSession,
  type AdminRole,
} from "../../../shared/routing/adminGuards";
import { ThemeSwitcher } from "../../../shared/theme/ThemeSwitcher";

export function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useAdminSession();
  const [identifier, setIdentifier] = useState("admin");
  const [password, setPassword] = useState("");
  const nextPath = useMemo(() => {
    const state = location.state as { next?: string } | null;

    return state?.next?.startsWith("/admin") ? state.next : "/admin";
  }, [location.state]);

  if (!isSetupComplete()) {
    return <Navigate replace state={{ next: nextPath }} to="/admin/setup" />;
  }

  if (session.isAuthenticated && (session.role === "admin" || session.role === "demo")) {
    return <Navigate replace to={nextPath} />;
  }

  function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    completeLogin(identifier.toLowerCase() === "demo" ? "demo" : "admin");
  }

  function completeLogin(role: AdminRole) {
    signInAdminSession(role);
    void navigate(nextPath, { replace: true });
  }

  return (
    <main className="setup-page admin-login-page">
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
              value={identifier}
            />
          </TextField>
          <TextField fullWidth isRequired>
            <Label>密码</Label>
            <Input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
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
            <Button type="submit">
              <AppIcon name="logIn" />
              登录后台
            </Button>
            <Button onPress={() => completeLogin("demo")} type="button" variant="tertiary">
              <AppIcon name="shield" />
              只读演示
            </Button>
          </div>
        </Form>
      </Card>
    </main>
  );
}
