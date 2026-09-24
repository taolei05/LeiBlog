import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";

import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "./styles.css";

import { Center } from "@astryxdesign/core/Center";
import { InternationalizationProvider, getLocaleDirection } from "@astryxdesign/core/i18n";
import { LayerProvider } from "@astryxdesign/core/Layer";
import { Spinner } from "@astryxdesign/core/Spinner";
import zhCN from "@astryxdesign/core/locales/zh-CN.json";
import { Theme } from "@astryxdesign/core/theme";
import type { MessagesByLocale } from "@astryxdesign/core/i18n";
import type { ThemeMode } from "@astryxdesign/core/theme";

import {
  AdminFeedbackBanner,
  createAdminFeedbackBanner,
} from "./app/components/admin-feedback-banner";
import type {
  AdminFeedbackBannerState,
  CreateAdminFeedbackBannerParams,
} from "./app/components/admin-feedback-banner";
import { AdminShellPage } from "./app/admin-shell/page";
import { InitialSetupPage } from "./app/initial-setup/page";
import { LoginPage } from "./app/login-card/page";
import { getAdminMe, getAdminSetupStatus, logoutAdmin } from "../../shared/admin-api";
import type { AdminAuthState, AdminSetupStatus, AdminUser } from "../../shared/admin-api";
import { normalizeLanguage } from "../../shared/i18n";
import { neutralTheme } from "../../shared/themes/neutral/neutral";
import "../../shared/themes/neutral/neutral.css";

const ASTRYX_MESSAGES: MessagesByLocale = { "zh-CN": zhCN };
const THEME_STORAGE_KEY = "leiblog-theme";
const ADMIN_AUTH_STORAGE_KEY = "leiblog-admin-auth";
const ADMIN_HOME_PATH = "/admin/";
const ADMIN_SETUP_PATH = "/admin/initial-setup";
const APP_THEME_MODES = ["light", "dark"] as const;
const OPEN_BLOG_NAVIGATION_DELAY_MS = 800;
type AppThemeMode = Extract<ThemeMode, (typeof APP_THEME_MODES)[number]>;

type AdminExperienceProps = {
  themeMode: AppThemeMode;
  onToggleThemeMode: () => void;
};

const normalizeThemeMode = (mode?: string | null): AppThemeMode =>
  mode === "dark" ? "dark" : "light";

const getInitialThemeMode = (): AppThemeMode => {
  if (typeof window === "undefined") {
    return "light";
  }

  const savedMode = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedMode) {
    return normalizeThemeMode(savedMode);
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const isStoredAdminUser = (value: unknown): value is AdminUser => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    record.role === "admin" &&
    typeof record.username === "string" &&
    typeof record.email === "string" &&
    Array.isArray(record.tags) &&
    record.tags.every((tag) => typeof tag === "string") &&
    typeof record.commentEmailNotifications === "boolean" &&
    typeof record.newPostEmailNotifications === "boolean"
  );
};

const isStoredAdminAuthState = (value: unknown): value is AdminAuthState => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.token === "string" && isStoredAdminUser(record.user);
};

const readStoredAuthState = () => {
  if (typeof window === "undefined") {
    return undefined;
  }

  const rawState = window.localStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
  if (rawState === null) {
    return undefined;
  }

  const parsedState: unknown = JSON.parse(rawState);
  return isStoredAdminAuthState(parsedState) ? parsedState : undefined;
};

const writeStoredAuthState = (authState: AdminAuthState) => {
  window.localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, JSON.stringify(authState));
};

const clearStoredAuthState = () => {
  window.localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const getAdminDisplayName = (user: AdminUser) => {
  const name = user.name?.trim();
  return name ? name : user.username;
};

function AdminExperience({ themeMode, onToggleThemeMode }: AdminExperienceProps) {
  const { i18n, t } = useTranslation();
  const language = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  const [authState, setAuthState] = useState<AdminAuthState | undefined>();
  const [setupStatus, setSetupStatus] = useState<AdminSetupStatus | undefined>();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [feedbackBanner, setFeedbackBanner] = useState<AdminFeedbackBannerState>();

  const showFeedbackBanner = useCallback((params: CreateAdminFeedbackBannerParams) => {
    setFeedbackBanner(createAdminFeedbackBanner(params));
  }, []);

  useEffect(() => {
    let isMounted = true;

    const checkStartupState = async () => {
      try {
        const nextSetupStatus = await getAdminSetupStatus();
        if (!isMounted) {
          return;
        }

        setSetupStatus(nextSetupStatus);

        if (nextSetupStatus.requiresSetup) {
          clearStoredAuthState();
          setAuthState(undefined);
          if (window.location.pathname !== ADMIN_SETUP_PATH) {
            window.history.replaceState(null, "", ADMIN_SETUP_PATH);
          }
          return;
        }

        if (window.location.pathname === ADMIN_SETUP_PATH) {
          window.history.replaceState(null, "", ADMIN_HOME_PATH);
        }

        const storedState = readStoredAuthState();
        if (storedState === undefined) {
          return;
        }

        const user = await getAdminMe(storedState.token, language);
        if (!isMounted) {
          return;
        }

        const nextState = { token: storedState.token, user };
        writeStoredAuthState(nextState);
        setAuthState(nextState);
      } catch {
        clearStoredAuthState();
      } finally {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      }
    };

    void checkStartupState();

    return () => {
      isMounted = false;
    };
  }, [language]);

  const handleAuthenticated = (nextAuthState: AdminAuthState) => {
    writeStoredAuthState(nextAuthState);
    setAuthState(nextAuthState);
    showFeedbackBanner({
      status: "success",
      title: t("admin.toast.loginSuccess", { name: getAdminDisplayName(nextAuthState.user) }),
    });
  };

  const handleAuthenticationFailed = (message: string) => {
    showFeedbackBanner({
      status: "error",
      title: message || t("admin.toast.loginFailed"),
    });
  };

  const handleSetupComplete = (nextAuthState: AdminAuthState) => {
    setSetupStatus({ hasAdmin: true, requiresSetup: false });
    writeStoredAuthState(nextAuthState);
    setAuthState(nextAuthState);
    window.history.replaceState(null, "", ADMIN_HOME_PATH);
    showFeedbackBanner({
      status: "success",
      title: t("admin.toast.setupSuccess"),
    });
  };

  const handleSetupFailed = (message: string) => {
    showFeedbackBanner({
      status: "error",
      title: message || t("admin.toast.setupFailed"),
    });
  };

  const handleLogout = async () => {
    const token = authState?.token;

    if (token !== undefined) {
      try {
        await logoutAdmin(token);
      } catch (error) {
        showFeedbackBanner({
          status: "error",
          title: getErrorMessage(error, t("admin.toast.logoutFailed")),
        });
        return;
      }
    }

    clearStoredAuthState();
    setAuthState(undefined);
    showFeedbackBanner({
      status: "success",
      title: t("admin.toast.logoutSuccess"),
    });
  };

  const handleUserUpdated = useCallback((user: AdminUser) => {
    setAuthState((currentState) => {
      if (currentState === undefined) {
        return currentState;
      }

      const nextState = { token: currentState.token, user };
      writeStoredAuthState(nextState);
      return nextState;
    });
  }, []);

  const handleOpenBlog = () => {
    showFeedbackBanner({
      status: "success",
      title: t("admin.toast.openBlogSuccess"),
    });

    window.setTimeout(() => {
      try {
        window.location.assign("/");
      } catch {
        showFeedbackBanner({
          status: "error",
          title: t("admin.toast.openBlogFailed"),
        });
      }
    }, OPEN_BLOG_NAVIGATION_DELAY_MS);
  };

  const feedbackBannerNode = (
    <AdminFeedbackBanner
      banner={feedbackBanner}
      onDismiss={() => setFeedbackBanner(undefined)}
    />
  );

  if (isCheckingSession) {
    return (
      <Center axis="both" padding={6} style={{ minHeight: "100vh" }}>
        <Spinner label="Loading" />
      </Center>
    );
  }

  if (setupStatus?.requiresSetup) {
    return (
      <>
        {feedbackBannerNode}
        <InitialSetupPage
          themeMode={themeMode}
          onToggleThemeMode={onToggleThemeMode}
          onComplete={handleSetupComplete}
          onSubmitFailed={handleSetupFailed}
        />
      </>
    );
  }

  if (authState === undefined) {
    return (
      <>
        {feedbackBannerNode}
        <LoginPage
          onAuthenticated={handleAuthenticated}
          onAuthenticationFailed={handleAuthenticationFailed}
        />
      </>
    );
  }

  return (
    <>
      {feedbackBannerNode}
      <AdminShellPage
        authToken={authState.token}
        user={authState.user}
        themeMode={themeMode}
        onToggleThemeMode={onToggleThemeMode}
        onUserUpdated={handleUserUpdated}
        onLogout={handleLogout}
        onOpenBlog={handleOpenBlog}
      />
    </>
  );
}

function App() {
  const { i18n } = useTranslation();
  const [themeMode, setThemeMode] = useState<AppThemeMode>(getInitialThemeMode);
  const language = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  const direction = getLocaleDirection(language);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
  }, [direction, language]);

  const toggleThemeMode = () => {
    setThemeMode((currentMode) => {
      const nextMode = currentMode === "dark" ? "light" : "dark";
      window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
      return nextMode;
    });
  };

  return (
    <InternationalizationProvider locale={language} messages={ASTRYX_MESSAGES} dir={direction}>
      <Theme theme={neutralTheme} mode={themeMode}>
        <LayerProvider>
          <AdminExperience themeMode={themeMode} onToggleThemeMode={toggleThemeMode} />
        </LayerProvider>
      </Theme>
    </InternationalizationProvider>
  );
}

const rootElement = document.getElementById("app");

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
