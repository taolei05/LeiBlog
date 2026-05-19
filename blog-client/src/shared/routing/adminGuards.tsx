import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import type { AdminRole, AdminSession, SetupStatus } from "../../features/admin/shared/admin-api";
import {
  clearAdminSession,
  getSetupStatus,
  readStoredAdminSession,
  writeAdminSession,
} from "../../features/admin/shared/admin-api";
import { resolveApiAssetUrl } from "../api/api-base-url";

type AdminSessionView = {
  avatarUrl?: string;
  displayName: string;
  isAuthenticated: boolean;
  isReadOnly: boolean;
  role: AdminRole;
  status: "anonymous" | "authenticated";
  token: string | null;
  userId?: string;
};

type SetupStatusState =
  | {
      status: "loading";
    }
  | {
      setup: SetupStatus;
      status: "ready";
    }
  | {
      status: "error";
    };

export { type AdminRole };

export function parseAdminRole(value: unknown, fallback: AdminRole = "admin"): AdminRole {
  if (value === "admin" || value === "demo" || value === "user") return value;
  return fallback;
}

export function signInAdminSession(session: AdminSession) {
  writeAdminSession(session);
}

export function signOutAdminSession() {
  clearAdminSession();
}

function toSessionView(session: AdminSession | null): AdminSessionView {
  if (!session) {
    return {
      displayName: "",
      isAuthenticated: false,
      isReadOnly: false,
      role: "user",
      status: "anonymous",
      token: null,
    };
  }

  return {
    avatarUrl: resolveApiAssetUrl(session.user.avatarUrl),
    displayName: session.user.name ?? session.user.username,
    isAuthenticated: true,
    isReadOnly: session.user.role === "demo",
    role: session.user.role,
    status: "authenticated",
    token: session.token,
    userId: session.user.id,
  };
}

export function isAdminRoleAllowed(role: AdminRole, allowedRoles: AdminRole[] = ["admin", "demo"]) {
  return allowedRoles.includes(role);
}

export function getAdminAccessRedirect({
  currentPath,
  isAuthenticated,
  role,
  setupComplete,
}: {
  currentPath: string;
  isAuthenticated: boolean;
  role: AdminRole;
  setupComplete: boolean;
}) {
  if (!setupComplete && role !== "demo") {
    return { state: { next: currentPath }, to: "/admin/setup" };
  }

  if (!isAuthenticated) {
    return { state: { next: currentPath }, to: "/admin/login" };
  }

  if (!isAdminRoleAllowed(role)) {
    return { to: "/" };
  }

  return null;
}

function useSetupStatusState() {
  const [state, setState] = useState<SetupStatusState>({ status: "loading" });

  useEffect(() => {
    let isActive = true;

    async function loadSetupStatus() {
      try {
        const setup = await getSetupStatus();
        if (!isActive) return;
        setState({ setup, status: "ready" });
      } catch {
        if (!isActive) return;
        setState({ status: "error" });
      }
    }

    void loadSetupStatus();

    return () => {
      isActive = false;
    };
  }, []);

  return state;
}

export function useAdminSession(): AdminSessionView {
  const [session] = useState(readStoredAdminSession);

  return useMemo(() => toSessionView(session), [session]);
}

function AdminRouteLoading() {
  return <main className="setup-page">正在检查后台访问状态...</main>;
}

export function RequireSetupComplete({ children }: { children: ReactNode }) {
  const location = useLocation();
  const setupState = useSetupStatusState();
  const session = useAdminSession();

  if (setupState.status === "loading") {
    return <AdminRouteLoading />;
  }

  if (setupState.status === "error") {
    return <Navigate replace to="/500" />;
  }

  if (!setupState.setup.isCompleted && !session.isReadOnly) {
    return <Navigate replace state={{ next: location.pathname }} to="/admin/setup" />;
  }

  return children;
}

export function RequireAdminRole({
  allowedRoles = ["admin", "demo"],
  children,
}: {
  allowedRoles?: AdminRole[];
  children: ReactNode;
}) {
  const session = useAdminSession();

  if (!isAdminRoleAllowed(session.role, allowedRoles)) {
    return <Navigate replace to="/" />;
  }

  return children;
}

export function RequireAdminLogin({ children }: { children: ReactNode }) {
  const location = useLocation();
  const session = useAdminSession();

  if (!session.isAuthenticated) {
    return <Navigate replace state={{ next: location.pathname }} to="/admin/login" />;
  }

  return children;
}

export function RequireAdminAccess({ children }: { children: ReactNode }) {
  return (
    <RequireSetupComplete>
      <RequireAdminLogin>
        <RequireAdminRole>{children}</RequireAdminRole>
      </RequireAdminLogin>
    </RequireSetupComplete>
  );
}
