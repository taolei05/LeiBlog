import { useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { LockKeyhole, Moon, Sun } from "lucide-react";

import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Center } from "@astryxdesign/core/Center";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { VStack } from "@astryxdesign/core/Layout";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { HStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useMediaQuery } from "@astryxdesign/core/hooks";
import type { ThemeMode } from "@astryxdesign/core/theme";

import { loginAdmin } from "../../../../shared/admin-api";
import type { AdminAuthState } from "../../../../shared/admin-api";
import {
  getAltchaVerificationDialogCopy,
  useAltchaVerificationDialog,
} from "../../../../shared/altcha-challenge";
import { getAltchaSuccessMessage } from "../../../../shared/altcha-feedback";
import type { AltchaFeedback } from "../../../../shared/altcha-feedback";
import { APP_LANGUAGES, changeAppLanguage, normalizeLanguage } from "../../../../shared/i18n";

const ADMIN_INVALID_CREDENTIALS_MESSAGE = "Invalid username/email or password.";

type LoginPageProps = {
  onAuthenticated: (authState: AdminAuthState) => void;
  onAuthenticationFailed: (message: string) => void;
  onFeedback: (feedback: AltchaFeedback) => void;
  onToggleThemeMode: () => void;
  themeMode: ThemeMode;
};

const pageStyle: CSSProperties = {
  backgroundColor: "var(--color-background-body)",
  minHeight: "100vh",
  position: "relative",
};

const contentStyle: CSSProperties = {
  maxWidth: 400,
  width: "100%",
};

const loginCardStyle: CSSProperties = {
  position: "relative",
};

const cardControlsStyle: CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  zIndex: 1,
};

const cardHeadingStyle: CSSProperties = {
  paddingTop: 24,
};

export function LoginPage({
  onAuthenticated,
  onAuthenticationFailed,
  onFeedback,
  onToggleThemeMode,
  themeMode,
}: LoginPageProps) {
  const { i18n, t } = useTranslation();
  const language = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  const isNarrow = useMediaQuery("(max-width: 480px)");
  const isDarkTheme = themeMode === "dark";
  const themeToggleLabel = t(isDarkTheme ? "theme.switchToLight" : "theme.switchToDark");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const loginPendingRef = useRef(false);
  const { dialog: altchaDialog, runWithAltcha } = useAltchaVerificationDialog({
    copy: getAltchaVerificationDialogCopy(language),
    language,
    onFeedback,
  });

  const handleLogin = async () => {
    if (loginPendingRef.current) {
      return;
    }
    if (!identifier.trim() || !password) {
      setLoginError(t("admin.login.validation.required"));
      return;
    }

    loginPendingRef.current = true;
    setIsLoading(true);
    setLoginError(undefined);

    try {
      const action = await runWithAltcha({
        runAction: (altcha) => loginAdmin({ altcha, identifier, locale: language, password }),
        successMessage: getAltchaSuccessMessage(language, "login"),
      });
      if (action.status === "cancelled") {
        return;
      }
      onAuthenticated(action.value);
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : t("admin.login.validation.failed");
      const message =
        rawMessage === ADMIN_INVALID_CREDENTIALS_MESSAGE
          ? t("admin.login.validation.invalidCredentials")
          : rawMessage;
      setLoginError(message);
      onAuthenticationFailed(message);
    } finally {
      loginPendingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleLogin();
  };

  return (
    <>
      {altchaDialog}
      <Center axis="both" padding={isNarrow ? 3 : 6} style={pageStyle}>
        <VStack gap={4} hAlign="center" style={contentStyle}>
          <VStack gap={2} hAlign="center">
            <Icon icon={LockKeyhole} size="lg" />
            <Text type="body" weight="bold" size="lg">
              {t("admin.product")}
            </Text>
          </VStack>

          <Card padding={isNarrow ? 5 : 8} width="100%" style={loginCardStyle}>
            <HStack gap={1} vAlign="center" style={cardControlsStyle}>
              <SegmentedControl
                label={t("language.label")}
                value={language}
                onChange={(nextLanguage) => changeAppLanguage(normalizeLanguage(nextLanguage))}
                size="sm"
              >
                {APP_LANGUAGES.map((item) => (
                  <SegmentedControlItem
                    key={item}
                    value={item}
                    label={t(`language.${item === "zh-CN" ? "zh" : "en"}`)}
                  />
                ))}
              </SegmentedControl>
              <IconButton
                label={themeToggleLabel}
                tooltip={themeToggleLabel}
                icon={isDarkTheme ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
                variant="ghost"
                size="sm"
                onClick={onToggleThemeMode}
              />
            </HStack>
            <form onSubmit={handleSubmit}>
              <VStack gap={4} hAlign="stretch">
                <VStack gap={1} hAlign="center" style={cardHeadingStyle}>
                  <Heading level={2}>{t("admin.login.title")}</Heading>
                  <Text type="body" color="secondary" size="sm">
                    {t("admin.login.subtitle")}
                  </Text>
                </VStack>

                <VStack gap={2}>
                  <TextInput
                    label={t("admin.login.identifier")}
                    isLabelHidden
                    placeholder={t("admin.login.identifierPlaceholder")}
                    value={identifier}
                    onChange={(value) => {
                      setIdentifier(value);
                      setLoginError(undefined);
                    }}
                    size="lg"
                    hasAutoFocus
                    autoComplete="username"
                  />
                  <TextInput
                    label={t("admin.login.password")}
                    isLabelHidden
                    placeholder={t("admin.login.passwordPlaceholder")}
                    type="password"
                    value={password}
                    onChange={(value) => {
                      setPassword(value);
                      setLoginError(undefined);
                    }}
                    size="lg"
                    status={
                      loginError === undefined
                        ? undefined
                        : {
                            type: "error",
                            message: loginError,
                          }
                    }
                    autoComplete="current-password"
                  />
                </VStack>

                <Button
                  label={t("admin.login.submit")}
                  variant="primary"
                  size="lg"
                  type="submit"
                  isLoading={isLoading}
                />
              </VStack>
            </form>
          </Card>
        </VStack>
      </Center>
    </>
  );
}
