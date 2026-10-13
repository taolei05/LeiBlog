import { lazy, StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";

import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "altcha";
import "altcha/i18n/all";
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
import { AdminAsyncContent } from "./app/components/admin-async-content";
import { LoginPage } from "./app/login-card/page";
import {
  getAdminMe,
  getAdminSetupStatus,
  COOKIE_ADMIN_AUTH_TOKEN,
  logoutAdmin,
} from "../../shared/admin-api";
import { createAuthSessionGuard } from "../../shared/auth-session";
import type { AdminAuthState, AdminSetupStatus, AdminUser } from "../../shared/admin-api";
import { normalizeLanguage } from "../../shared/i18n";
import { neutralTheme } from "../../shared/themes/neutral/neutral";
import "../../shared/themes/neutral/neutral.css";

const AdminShellPage = lazy(async () => ({
  default: (await import("./app/admin-shell/page")).AdminShellPage,
}));
const InitialSetupPage = lazy(async () => ({
  default: (await import("./app/initial-setup/page")).InitialSetupPage,
}));

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

const clearStoredAuthState = () => {
  try {
    window.localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
  } catch {
    // In-memory state can still be cleared when browser storage is unavailable.
  }
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

function AdminExperience({ themeMode, onToggleThemeMode }: AdminExperienceProps) {
  const { i18n, t } = useTranslation();
  const language = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  const [authState, setAuthState] = useState<AdminAuthState | undefined>();
  const [authSessionGuard] = useState(createAuthSessionGuard);
  const [setupStatus, setSetupStatus] = useState<AdminSetupStatus | undefined>();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [feedbackBanner, setFeedbackBanner] = useState<AdminFeedbackBannerState>();

  const showFeedbackBanner = useCallback((params: CreateAdminFeedbackBannerParams) => {
    setFeedbackBanner(createAdminFeedbackBanner(params));
  }, []);

  useEffect(() => {
    let isMounted = true;
    const isCurrentSession = authSessionGuard.capture();

    const checkStartupState = async () => {
      clearStoredAuthState();
      try {
        const nextSetupStatus = await getAdminSetupStatus();
        if (!isMounted || !isCurrentSession()) {
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

        const user = await getAdminMe(COOKIE_ADMIN_AUTH_TOKEN, language);
        if (!isMounted || !isCurrentSession()) {
          return;
        }

        const nextState = { token: COOKIE_ADMIN_AUTH_TOKEN, user };
        setAuthState(nextState);
      } catch {
        if (isMounted && isCurrentSession()) {
          clearStoredAuthState();
          setAuthState(undefined);
        }
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
  }, [authSessionGuard, language]);

  const handleAuthenticated = (nextAuthState: AdminAuthState) => {
    authSessionGuard.invalidate();
    setAuthState(nextAuthState);
  };

  const handleAuthenticationFailed = (message: string) => {
    showFeedbackBanner({
      status: "error",
      title: message || t("admin.toast.loginFailed"),
    });
  };

  const handleSetupComplete = (nextAuthState: AdminAuthState) => {
    authSessionGuard.invalidate();
    setSetupStatus({ hasAdmin: true, requiresSetup: false });
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
    authSessionGuard.invalidate();
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

  const handleUserUpdated = useCallback(
    (user: AdminUser) => {
      authSessionGuard.invalidate();
      setAuthState((currentState) => {
        if (currentState === undefined) {
          return currentState;
        }

        const nextState = { token: currentState.token, user };
        return nextState;
      });
    },
    [authSessionGuard],
  );

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
    <AdminFeedbackBanner banner={feedbackBanner} onDismiss={() => setFeedbackBanner(undefined)} />
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
        <AdminAsyncContent fullPage key="setup">
          <InitialSetupPage
            requiresSetupToken={setupStatus.requiresSetupToken ?? false}
            themeMode={themeMode}
            onToggleThemeMode={onToggleThemeMode}
            onComplete={handleSetupComplete}
            onSubmitFailed={handleSetupFailed}
          />
        </AdminAsyncContent>
      </>
    );
  }

  if (authState === undefined) {
    return (
      <>
        {feedbackBannerNode}
        <LoginPage
          themeMode={themeMode}
          onToggleThemeMode={onToggleThemeMode}
          onAuthenticated={handleAuthenticated}
          onAuthenticationFailed={handleAuthenticationFailed}
          onFeedback={showFeedbackBanner}
        />
      </>
    );
  }

  return (
    <>
      {feedbackBannerNode}
      <AdminAsyncContent fullPage key="authenticated">
        <AdminShellPage
          authToken={authState.token}
          user={authState.user}
          themeMode={themeMode}
          onToggleThemeMode={onToggleThemeMode}
          onUserUpdated={handleUserUpdated}
          onLogout={handleLogout}
          onOpenBlog={handleOpenBlog}
        />
      </AdminAsyncContent>
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
