import { Component, Suspense } from "react";
import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";

import { Center } from "@astryxdesign/core/Center";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Spinner } from "@astryxdesign/core/Spinner";
import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";

type AdminContentBoundaryProps = PropsWithChildren<{
  errorMessage: string;
  retryLabel: string;
  minHeight: string;
}>;

class AdminContentBoundary extends Component<AdminContentBoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    if (this.state.failed) {
      return (
        <Center minHeight={this.props.minHeight} padding={6}>
          <VStack gap={3} hAlign="center">
            <Text role="alert">{this.props.errorMessage}</Text>
            <IconButton
              label={this.props.retryLabel}
              tooltip={this.props.retryLabel}
              icon={<RefreshCw size={18} />}
              onClick={() => window.location.reload()}
            />
          </VStack>
        </Center>
      );
    }
    return this.props.children;
  }
}

type AdminAsyncContentProps = PropsWithChildren<{ fullPage?: boolean }>;

export const AdminAsyncContent = ({ children, fullPage = false }: AdminAsyncContentProps) => {
  const { t } = useTranslation();
  const minHeight = fullPage ? "100vh" : "calc(var(--spacing-8) * 4)";
  return (
    <AdminContentBoundary
      errorMessage={t("admin.asyncContent.failed")}
      retryLabel={t("admin.asyncContent.retry")}
      minHeight={minHeight}
    >
      <Suspense
        fallback={
          <Center minHeight={minHeight} padding={6}>
            <Spinner label={t("admin.asyncContent.loading")} />
          </Center>
        }
      >
        {children}
      </Suspense>
    </AdminContentBoundary>
  );
};
