import { AlertDialog, Button, Card, Chip, Description, Label, ProgressBar } from "@heroui/react";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { useMemo, useRef, useState } from "react";

import { AppIcon } from "../../../shared/icons";
import { showOperationToast } from "../../../shared/toast/operation-toast";
import { AdminDataPage } from "../shared/AdminDataPage";
import { adminFetch, fetchAdminBlob } from "../shared/admin-api";

type BackupManifest = {
  createdAt: string;
  format: "leiblog-backup";
  media: {
    included: boolean;
    total: number;
    totalBytes: number;
  };
  sensitiveFieldsExcluded: string[];
  tables: string[];
  version: number;
};

type BackupPreviewResponse = {
  manifest: BackupManifest;
  media: {
    included: boolean;
    total: number;
    totalBytes: number;
  };
  ok: boolean;
  sensitiveConfigExported: boolean;
  tables: Record<string, number>;
};

type BackupImportResponse = {
  importedMedia: number;
  importedRows: number;
  ok: boolean;
  tables: Record<string, number>;
};

type LocalBackupPreview = {
  entries: number;
  manifest: BackupManifest | null;
  mediaEntries: number;
  tableRows: number;
};

type BackupOperation = "export" | "import" | "preview";

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let nextValue = value;
  let unitIndex = 0;

  while (nextValue >= 1024 && unitIndex < units.length - 1) {
    nextValue /= 1024;
    unitIndex += 1;
  }

  return `${nextValue >= 10 || unitIndex === 0 ? nextValue.toFixed(0) : nextValue.toFixed(1)} ${
    units[unitIndex]
  }`;
}

function formatDate(value: string | undefined) {
  if (!value) return "未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function totalRows(tables: Record<string, number> | undefined) {
  return Object.values(tables ?? {}).reduce((total, value) => total + value, 0);
}

function createBackupFormData(file: File, mode?: "replace") {
  const formData = new FormData();
  formData.set("file", file);
  if (mode) formData.set("mode", mode);
  return formData;
}

async function previewZipLocally(file: File): Promise<LocalBackupPreview> {
  const zip = await JSZip.loadAsync(file);
  const manifestText = await zip.file("manifest.json")?.async("string");
  const dataText = await zip.file("data.json")?.async("string");
  const mediaText = await zip.file("media-manifest.json")?.async("string");
  const manifest = manifestText ? (JSON.parse(manifestText) as BackupManifest) : null;
  const data = dataText ? (JSON.parse(dataText) as { tables?: Record<string, unknown[]> }) : null;
  const media = mediaText ? (JSON.parse(mediaText) as { entries?: unknown[] }) : null;

  return {
    entries: Object.keys(zip.files).length,
    manifest,
    mediaEntries: Array.isArray(media?.entries) ? media.entries.length : 0,
    tableRows: Object.values(data?.tables ?? {}).reduce(
      (count, rows) => count + (Array.isArray(rows) ? rows.length : 0),
      0,
    ),
  };
}

export function BackupPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<LocalBackupPreview | null>(null);
  const [serverPreview, setServerPreview] = useState<BackupPreviewResponse | null>(null);
  const [operation, setOperation] = useState<BackupOperation | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const metrics = useMemo(
    () => [
      { label: "备份格式", value: serverPreview?.manifest.format ?? "ZIP" },
      { label: "数据行", value: String(totalRows(serverPreview?.tables)) },
      {
        label: "媒体文件",
        value: String(serverPreview?.media.total ?? localPreview?.mediaEntries ?? 0),
      },
    ],
    [localPreview?.mediaEntries, serverPreview],
  );
  const isBusy = operation !== null;

  async function exportBackup() {
    if (isBusy) return;

    setOperation("export");
    try {
      const { blob, fileName } = await fetchAdminBlob("/admin/backup/export");
      saveAs(blob, fileName);
      showOperationToast("全站备份已开始下载", "success");
    } catch (error) {
      showOperationToast(
        error instanceof Error ? `导出备份失败：${error.message}` : "导出备份失败",
        "danger",
      );
    } finally {
      setOperation(null);
    }
  }

  async function previewBackup(file: File) {
    setOperation("preview");
    setServerPreview(null);
    setLocalPreview(null);

    try {
      const local = await previewZipLocally(file);
      const server = await adminFetch<BackupPreviewResponse>("/admin/backup/preview", {
        body: createBackupFormData(file),
        method: "POST",
      });

      setLocalPreview(local);
      setServerPreview(server);
      showOperationToast("备份文件预览完成", "success");
    } catch (error) {
      setSelectedFile(null);
      showOperationToast(
        error instanceof Error ? `备份文件预览失败：${error.message}` : "备份文件预览失败",
        "danger",
      );
    } finally {
      setOperation(null);
    }
  }

  function selectFile(file: File | undefined) {
    if (!file) return;
    setSelectedFile(file);
    void previewBackup(file);
  }

  async function importBackup() {
    if (!pendingImportFile || isBusy) return;

    setOperation("import");
    try {
      const response = await adminFetch<BackupImportResponse>("/admin/backup/import", {
        body: createBackupFormData(pendingImportFile, "replace"),
        method: "POST",
      });

      setPendingImportFile(null);
      showOperationToast(
        `备份导入完成：恢复 ${response.importedRows} 行数据，写入 ${response.importedMedia} 个媒体文件`,
        "success",
      );
    } catch (error) {
      showOperationToast(
        error instanceof Error ? `导入备份失败：${error.message}` : "导入备份失败",
        "danger",
      );
    } finally {
      setOperation(null);
    }
  }

  return (
    <AdminDataPage
      description="导出站点业务数据和媒体文件，也可以用备份包恢复到当前服务器。密钥类配置不会写入备份包。"
      eyebrow="系统"
      icon="archive"
      metrics={metrics}
      title="全站备份"
      wide
    >
      <div className="backup-page-grid">
        <Card className="admin-data-card backup-action-card">
          <Card.Header>
            <Card.Title>
              <AppIcon name="download" />
              导出备份
            </Card.Title>
            <Card.Description>
              生成包含数据库业务数据和媒体文件的 zip 备份，敏感配置字段会被自动排除。
            </Card.Description>
          </Card.Header>
          <div className="backup-action-card__body">
            <Description>
              默认包含文章、分类、标签、评论、用户、导航、站点信息、登录方式公开配置以及媒体文件。
            </Description>
            <div className="backup-action-card__actions">
              <Button isDisabled={isBusy} onPress={exportBackup} variant="primary">
                <AppIcon name="download" />
                导出全站备份
              </Button>
            </div>
          </div>
        </Card>

        <Card className="admin-data-card backup-action-card">
          <Card.Header>
            <Card.Title>
              <AppIcon name="cloudUpload" />
              导入恢复
            </Card.Title>
            <Card.Description>
              选择备份包后先在浏览器解析并请求服务器校验，确认后再执行替换恢复。
            </Card.Description>
          </Card.Header>
          <div className="backup-action-card__body">
            <input
              accept=".zip,application/zip"
              className="visually-hidden"
              onChange={(event) => selectFile(event.currentTarget.files?.[0])}
              ref={inputRef}
              type="file"
            />
            <div className="backup-action-card__actions">
              <Button
                isDisabled={isBusy}
                onPress={() => inputRef.current?.click()}
                variant="secondary"
              >
                <AppIcon name="folderOpen" />
                选择备份文件
              </Button>
              <Button
                isDisabled={!selectedFile || !serverPreview || isBusy}
                onPress={() => setPendingImportFile(selectedFile)}
                variant="danger"
              >
                <AppIcon name="cloudUpload" />
                导入并恢复
              </Button>
            </div>
            {selectedFile ? (
              <p className="backup-selected-file">
                {selectedFile.name} · {formatBytes(selectedFile.size)}
              </p>
            ) : null}
          </div>
        </Card>
      </div>

      {operation ? (
        <div className="backup-operation-progress">
          <ProgressBar aria-label="备份操作进度" isIndeterminate>
            <Label>
              {operation === "export"
                ? "正在生成备份"
                : operation === "preview"
                  ? "正在预览备份"
                  : "正在导入备份"}
            </Label>
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
        </div>
      ) : null}

      {localPreview || serverPreview ? (
        <div className="backup-package-summary">
          <div className="backup-package-summary__header">
            <div>
              <h3>备份包摘要</h3>
              <p>
                {formatDate(serverPreview?.manifest.createdAt ?? localPreview?.manifest?.createdAt)}
              </p>
            </div>
            <div className="backup-package-summary__chips">
              <Chip variant="secondary">ZIP 条目 {localPreview?.entries ?? 0}</Chip>
              <Chip variant="secondary">数据行 {totalRows(serverPreview?.tables)}</Chip>
              <Chip variant="secondary">
                媒体 {serverPreview?.media.total ?? localPreview?.mediaEntries ?? 0}
              </Chip>
              {serverPreview?.sensitiveConfigExported ? (
                <Chip variant="secondary">包含敏感字段</Chip>
              ) : (
                <Chip variant="secondary">密钥未导出</Chip>
              )}
            </div>
          </div>
          <div className="backup-table-counts">
            {Object.entries(serverPreview?.tables ?? {})
              .filter(([, count]) => count > 0)
              .map(([table, count]) => (
                <span key={table}>
                  <strong>{table}</strong>
                  <small>{count}</small>
                </span>
              ))}
          </div>
        </div>
      ) : null}

      <AlertDialog>
        <AlertDialog.Backdrop
          isOpen={Boolean(pendingImportFile)}
          onOpenChange={(isOpen) => {
            if (isOpen) return;
            setPendingImportFile(null);
          }}
          variant="blur"
        >
          <AlertDialog.Container placement="center" size="sm">
            <AlertDialog.Dialog>
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="warning" />
                <AlertDialog.Heading>确认导入全站备份？</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>
                  导入会用备份数据替换当前站点的非敏感业务数据，并把备份包内媒体文件写入当前服务器。
                  当前服务器的 API Key、OAuth Client Secret 和 R2 Secret 会保留。
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="tertiary">
                  取消
                </Button>
                <Button onPress={importBackup} slot="close" variant="danger">
                  确认导入
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </AdminDataPage>
  );
}
