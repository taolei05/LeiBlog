import { useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Archive, Database, Download, FileArchive, ShieldCheck, UploadCloud } from "lucide-react";

import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { Spinner } from "@astryxdesign/core/Spinner";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";

import type { BackupImportResponse, BackupPreviewResponse } from "../../../../shared/admin-api";
import {
  downloadBackupArchive,
  importBackupArchive,
  previewBackupArchive,
} from "../../../../shared/admin-api";
import { normalizeLanguage } from "../../../../shared/i18n";
import { formatDateTimeInTimeZone } from "../../../../shared/time-zone";
import {
  AdminFeedbackBanner,
  createAdminFeedbackBanner,
} from "../components/admin-feedback-banner";
import type { AdminFeedbackBannerState } from "../components/admin-feedback-banner";

type BackupPageProps = {
  authToken: string;
  isNarrow: boolean;
  timeZone: string;
};

type BackupOperation = "export" | "import" | "preview";

const hiddenInputStyle: CSSProperties = {
  display: "none",
};

const pageStackStyle: CSSProperties = {
  width: "100%",
};

const summaryIconStyle: CSSProperties = {
  color: "var(--color-text-secondary)",
};

const actionCardStyle: CSSProperties = {
  minHeight: 190,
};

const selectedFileStyle: CSSProperties = {
  minWidth: 0,
};

const tableListStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
  width: "100%",
};

const tableItemStyle: CSSProperties = {
  alignItems: "center",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-control)",
  display: "flex",
  justifyContent: "space-between",
  minWidth: 0,
  padding: "10px 12px",
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const formatBytes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let nextValue = value;
  let unitIndex = 0;

  while (nextValue >= 1024 && unitIndex < units.length - 1) {
    nextValue /= 1024;
    unitIndex += 1;
  }

  return `${unitIndex === 0 || nextValue >= 10 ? nextValue.toFixed(0) : nextValue.toFixed(1)} ${
    units[unitIndex]
  }`;
};

const totalTableRows = (preview?: BackupPreviewResponse | BackupImportResponse) =>
  Object.values(preview?.tables ?? {}).reduce((total, count) => total + count, 0);

type BackupSummaryCardProps = {
  icon: ReactNode;
  label: string;
  value: string;
};

const BackupSummaryCard = ({ icon, label, value }: BackupSummaryCardProps) => (
  <Card padding={4}>
    <VStack gap={3}>
      <HStack gap={2} vAlign="center">
        <span style={summaryIconStyle}>{icon}</span>
        <Text type="label" color="secondary">
          {label}
        </Text>
      </HStack>
      <Heading level={3}>{value}</Heading>
    </VStack>
  </Card>
);

export const BackupPage = ({ authToken, isNarrow, timeZone }: BackupPageProps) => {
  const { i18n, t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File>();
  const [serverPreview, setServerPreview] = useState<BackupPreviewResponse>();
  const [lastImport, setLastImport] = useState<BackupImportResponse>();
  const [operation, setOperation] = useState<BackupOperation>();
  const [pendingImportFile, setPendingImportFile] = useState<File>();
  const [banner, setBanner] = useState<AdminFeedbackBannerState>();
  const language = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  const isBusy = operation !== undefined;
  const previewCreatedAt =
    serverPreview === undefined
      ? t("admin.backups.preview.emptyDate")
      : formatDateTimeInTimeZone({
          fallback: serverPreview.manifest.createdAt,
          language,
          timeZone,
          value: serverPreview.manifest.createdAt,
        });
  const summaryCards = useMemo(
    () => [
      {
        icon: <FileArchive size={18} />,
        label: t("admin.backups.summary.format"),
        value: serverPreview?.manifest.format ?? "ZIP",
      },
      {
        icon: <Database size={18} />,
        label: t("admin.backups.summary.rows"),
        value: String(totalTableRows(serverPreview)),
      },
      {
        icon: <Archive size={18} />,
        label: t("admin.backups.summary.media"),
        value: String(serverPreview?.media.total ?? 0),
      },
    ],
    [serverPreview, t],
  );

  const showBanner = (nextBanner: Omit<AdminFeedbackBannerState, "id">) => {
    setBanner(createAdminFeedbackBanner(nextBanner));
  };

  const handleExport = async () => {
    if (isBusy) {
      return;
    }

    setOperation("export");
    try {
      await downloadBackupArchive({ token: authToken });
      showBanner({
        status: "success",
        title: t("admin.backups.feedback.exportSuccess"),
      });
    } catch (error) {
      showBanner({
        description: getErrorMessage(error, t("admin.backups.feedback.exportFailedDescription")),
        status: "error",
        title: t("admin.backups.feedback.exportFailed"),
      });
    } finally {
      setOperation(undefined);
    }
  };

  const handlePreview = async (file: File) => {
    setOperation("preview");
    setServerPreview(undefined);
    setLastImport(undefined);

    try {
      const preview = await previewBackupArchive({ file, token: authToken });
      setServerPreview(preview);
      showBanner({
        status: "success",
        title: t("admin.backups.feedback.previewSuccess"),
      });
    } catch (error) {
      setSelectedFile(undefined);
      showBanner({
        description: getErrorMessage(error, t("admin.backups.feedback.previewFailedDescription")),
        status: "error",
        title: t("admin.backups.feedback.previewFailed"),
      });
    } finally {
      setOperation(undefined);
    }
  };

  const selectFile = (file?: File) => {
    if (file === undefined) {
      return;
    }

    setSelectedFile(file);
    void handlePreview(file);
  };

  const handleImport = async () => {
    if (pendingImportFile === undefined || isBusy) {
      return;
    }

    setOperation("import");
    try {
      const response = await importBackupArchive({
        file: pendingImportFile,
        mode: "replace",
        token: authToken,
      });
      setLastImport(response);
      setPendingImportFile(undefined);
      showBanner({
        description: t("admin.backups.feedback.importSuccessDescription", {
          media: response.importedMedia,
          rows: response.importedRows,
        }),
        status: "success",
        title: t("admin.backups.feedback.importSuccess"),
      });
    } catch (error) {
      showBanner({
        description: getErrorMessage(error, t("admin.backups.feedback.importFailedDescription")),
        status: "error",
        title: t("admin.backups.feedback.importFailed"),
      });
    } finally {
      setOperation(undefined);
    }
  };

  return (
    <>
      <AdminFeedbackBanner banner={banner} onDismiss={() => setBanner(undefined)} />
      <VStack gap={4} style={pageStackStyle}>
        <Grid columns={{ minWidth: isNarrow ? 160 : 220, max: 3 }} gap={isNarrow ? 3 : 4}>
          {summaryCards.map((card) => (
            <BackupSummaryCard
              key={card.label}
              icon={card.icon}
              label={card.label}
              value={card.value}
            />
          ))}
        </Grid>

        <Grid columns={{ minWidth: isNarrow ? 220 : 320, max: 2 }} gap={isNarrow ? 3 : 4}>
          <Card padding={isNarrow ? 4 : 5} style={actionCardStyle}>
            <VStack gap={4}>
              <VStack gap={2}>
                <HStack gap={2} vAlign="center">
                  <Download size={18} />
                  <Heading level={2}>{t("admin.backups.export.title")}</Heading>
                </HStack>
                <Text type="supporting" color="secondary">
                  {t("admin.backups.export.description")}
                </Text>
              </VStack>
              <Button
                label={
                  operation === "export"
                    ? t("admin.backups.export.progress")
                    : t("admin.backups.export.action")
                }
                icon={<Download size={16} />}
                variant="primary"
                width={isNarrow ? "100%" : undefined}
                isDisabled={isBusy}
                isLoading={operation === "export"}
                onClick={() => {
                  void handleExport();
                }}
              />
            </VStack>
          </Card>

          <Card padding={isNarrow ? 4 : 5} style={actionCardStyle}>
            <VStack gap={4}>
              <VStack gap={2}>
                <HStack gap={2} vAlign="center">
                  <UploadCloud size={18} />
                  <Heading level={2}>{t("admin.backups.import.title")}</Heading>
                </HStack>
                <Text type="supporting" color="secondary">
                  {t("admin.backups.import.description")}
                </Text>
              </VStack>
              <input
                ref={inputRef}
                accept=".zip,application/zip"
                style={hiddenInputStyle}
                type="file"
                onChange={(event) => {
                  selectFile(event.currentTarget.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Button
                  label={
                    operation === "preview"
                      ? t("admin.backups.import.previewing")
                      : t("admin.backups.import.choose")
                  }
                  icon={<FileArchive size={16} />}
                  variant="secondary"
                  width={isNarrow ? "100%" : undefined}
                  isDisabled={isBusy}
                  isLoading={operation === "preview"}
                  onClick={() => inputRef.current?.click()}
                />
                <Button
                  label={t("admin.backups.import.action")}
                  icon={<UploadCloud size={16} />}
                  variant="destructive"
                  width={isNarrow ? "100%" : undefined}
                  isDisabled={isBusy || selectedFile === undefined || serverPreview === undefined}
                  isLoading={operation === "import"}
                  onClick={() => setPendingImportFile(selectedFile)}
                />
              </HStack>
              {selectedFile !== undefined && (
                <Text type="supporting" color="secondary" style={selectedFileStyle} maxLines={1}>
                  {t("admin.backups.import.selectedFile", {
                    name: selectedFile.name,
                    size: formatBytes(selectedFile.size),
                  })}
                </Text>
              )}
            </VStack>
          </Card>
        </Grid>

        {(serverPreview !== undefined || lastImport !== undefined || operation === "preview") && (
          <Card padding={isNarrow ? 4 : 5}>
            <VStack gap={4}>
              <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap">
                <VStack gap={1}>
                  <Heading level={2}>{t("admin.backups.preview.title")}</Heading>
                  <Text type="supporting" color="secondary">
                    {previewCreatedAt}
                  </Text>
                </VStack>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <Badge
                    label={t("admin.backups.preview.rows", {
                      count: totalTableRows(serverPreview),
                    })}
                  />
                  <Badge
                    label={t("admin.backups.preview.media", {
                      count: serverPreview?.media.total ?? 0,
                    })}
                    variant="neutral"
                  />
                  <Badge
                    label={
                      serverPreview?.sensitiveConfigExported
                        ? t("admin.backups.preview.sensitiveIncluded")
                        : t("admin.backups.preview.sensitiveExcluded")
                    }
                    variant={serverPreview?.sensitiveConfigExported ? "error" : "success"}
                  />
                </HStack>
              </HStack>

              {operation === "preview" && (
                <HStack gap={2} vAlign="center">
                  <Spinner size="sm" />
                  <Text type="supporting" color="secondary">
                    {t("admin.backups.import.previewing")}
                  </Text>
                </HStack>
              )}

              {serverPreview !== undefined && (
                <VStack gap={3}>
                  <HStack gap={2} vAlign="center" wrap="wrap">
                    <Badge
                      label={t("admin.backups.preview.mediaSize", {
                        size: formatBytes(serverPreview.media.totalBytes),
                      })}
                      variant="neutral"
                    />
                    <Badge
                      label={t("admin.backups.preview.version", {
                        version: serverPreview.manifest.version,
                      })}
                      variant="neutral"
                    />
                  </HStack>
                  <div style={tableListStyle}>
                    {Object.entries(serverPreview.tables).map(([table, count]) => (
                      <div key={table} style={tableItemStyle}>
                        <Text type="label" maxLines={1}>
                          {table}
                        </Text>
                        <Badge label={t("admin.backups.preview.tableRows", { count })} />
                      </div>
                    ))}
                  </div>
                </VStack>
              )}

              {lastImport !== undefined && (
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <ShieldCheck size={16} />
                  <Text type="supporting" color="secondary">
                    {t("admin.backups.preview.lastImport", {
                      media: lastImport.importedMedia,
                      rows: lastImport.importedRows,
                    })}
                  </Text>
                </HStack>
              )}
            </VStack>
          </Card>
        )}
      </VStack>
      {pendingImportFile !== undefined && (
        <AlertDialog
          isOpen
          title={t("admin.backups.confirmImport.title")}
          description={t("admin.backups.confirmImport.description", {
            file: pendingImportFile.name,
          })}
          cancelLabel={t("actions.cancel")}
          actionLabel={t("admin.backups.confirmImport.action")}
          actionVariant="destructive"
          isActionLoading={operation === "import"}
          onAction={() => {
            void handleImport();
          }}
          onOpenChange={(isOpen) => {
            if (!isOpen && operation !== "import") {
              setPendingImportFile(undefined);
            }
          }}
        />
      )}
    </>
  );
};
