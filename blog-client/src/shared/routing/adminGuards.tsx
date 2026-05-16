import { useMemo, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

export const ADMIN_ROLE_STORAGE_KEY = "leiblog:admin-role";
export const ADMIN_AUTH_STORAGE_KEY = "leiblog:admin-authenticated";
export const SETUP_COMPLETE_STORAGE_KEY = "leiblog:setup-complete";

export type AdminRole = "admin" | "demo" | "user";

type AdminSession = {
  displayName: string;
  isAuthenticated: boolean;
  isReadOnly: boolean;
  role: AdminRole;
  status: "anonymous" | "authenticated";
};

export type AdminAccessRedirect = {
  state?: {
    next: string;
  };
  to: string;
};

export type AdminAccessState = {
  allowedRoles?: AdminRole[];
  currentPath: string;
  isAuthenticated: boolean;
  role: AdminRole;
  setupComplete: boolean;
};

function readStorageValue(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageValue(key: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The UI can still continue with in-memory state when storage is blocked.
  }
}

function removeStorageValue(key: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures and let the guard fall back on its in-memory read.
  }
}

export function isSetupComplete() {
  return readStorageValue(SETUP_COMPLETE_STORAGE_KEY) === "true";
}

export function markSetupComplete() {
  writeStorageValue(SETUP_COMPLETE_STORAGE_KEY, "true");
}

export function signInAdminSession(role: AdminRole = "admin") {
  writeStorageValue(ADMIN_AUTH_STORAGE_KEY, "true");
  writeStorageValue(ADMIN_ROLE_STORAGE_KEY, role);
}

export function signOutAdminSession() {
  removeStorageValue(ADMIN_AUTH_STORAGE_KEY);
}

function readAdminAuthenticated() {
  return readStorageValue(ADMIN_AUTH_STORAGE_KEY) === "true";
}

function readAdminRole(): AdminRole {
  const storedRole = readStorageValue(ADMIN_ROLE_STORAGE_KEY);

  return parseAdminRole(storedRole);
}

export function parseAdminRole(value: unknown, fallback: AdminRole = "admin") {
  return value === "admin" || value === "demo" || value === "user" ? value : fallback;
}

export function isAdminRoleAllowed(role: AdminRole, allowedRoles: AdminRole[] = ["admin", "demo"]) {
  return allowedRoles.includes(role);
}

export function getAdminAccessRedirect({
  allowedRoles = ["admin", "demo"],
  currentPath,
  isAuthenticated,
  role,
  setupComplete,
}: AdminAccessState): AdminAccessRedirect | null {
  if (!setupComplete) {
    return { state: { next: currentPath }, to: "/admin/setup" };
  }

  if (!isAuthenticated) {
    return { state: { next: currentPath }, to: "/admin/login" };
  }

  if (!isAdminRoleAllowed(role, allowedRoles)) {
    return { to: "/" };
  }

  return null;
}

export function useAdminSession(): AdminSession {
  const [isAuthenticated] = useState(readAdminAuthenticated);
  const [role] = useState<AdminRole>(readAdminRole);

  return useMemo(
    () => ({
      displayName: role === "demo" ? "Demo 账户" : "Lei 管理员",
      isAuthenticated,
      isReadOnly: role === "demo",
      role,
      status: isAuthenticated ? ("authenticated" as const) : ("anonymous" as const),
    }),
    [isAuthenticated, role],
  );
}

export function RequireSetupComplete({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [setupComplete] = useState(isSetupComplete);

  if (!setupComplete) {
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
