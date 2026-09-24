import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { LockKeyhole } from "lucide-react";

import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Center } from "@astryxdesign/core/Center";
import { Icon } from "@astryxdesign/core/Icon";
import { VStack } from "@astryxdesign/core/Layout";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useMediaQuery } from "@astryxdesign/core/hooks";

import { loginAdmin } from "../../../../shared/admin-api";
import type { AdminAuthState } from "../../../../shared/admin-api";
import { normalizeLanguage } from "../../../../shared/i18n";

type LoginPageProps = {
  onAuthenticated: (authState: AdminAuthState) => void;
  onAuthenticationFailed: (message: string) => void;
};

const pageStyle: CSSProperties = {
  backgroundColor: "var(--color-background-body)",
  minHeight: "100vh",
};

const contentStyle: CSSProperties = {
  maxWidth: 400,
  width: "100%",
};

export function LoginPage({ onAuthenticated, onAuthenticationFailed }: LoginPageProps) {
  const { i18n, t } = useTranslation();
  const language = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  const isNarrow = useMediaQuery("(max-width: 480px)");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      setLoginError(t("admin.login.validation.required"));
      return;
    }

    setIsLoading(true);
    setLoginError(undefined);

    try {
      const authState = await loginAdmin({
        identifier,
        locale: language,
        password,
      });
      onAuthenticated(authState);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("admin.login.validation.failed");
      setLoginError(message);
      onAuthenticationFailed(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleLogin();
  };

  return (
    <Center axis="both" padding={isNarrow ? 3 : 6} style={pageStyle}>
      <VStack gap={4} hAlign="center" style={contentStyle}>
        <VStack gap={2} hAlign="center">
          <Icon icon={LockKeyhole} size="lg" />
          <Text type="body" weight="bold" size="lg">
            {t("admin.product")}
          </Text>
        </VStack>

        <Card padding={isNarrow ? 5 : 8} width="100%">
          <form onSubmit={handleSubmit}>
            <VStack gap={4} hAlign="stretch">
              <VStack gap={1} hAlign="center">
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
  );
}
