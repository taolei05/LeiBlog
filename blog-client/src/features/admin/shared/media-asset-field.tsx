import {
  AlertDialog,
  Button,
  Card,
  Description,
  FieldError,
  InputGroup,
  Label,
  Modal,
  TextField,
} from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { resolveApiAssetUrl } from "../../../shared/api/api-base-url";
import type { AppIconName } from "../../../shared/icons";
import { AppIcon } from "../../../shared/icons";
import type { LocalImageEditorKind } from "../../../shared/media/local-image-editor";
import { LocalImageEditorDialog } from "../../../shared/media/local-image-editor";
import { showOperationToast } from "../../../shared/toast/operation-toast";
import { adminFetch } from "./admin-api";

type MediaAssetItem = {
  accessUrl: string;
  fileName: string;
  folderSlug: string | null;
  id: string;
};

type MediaAssetFieldProps = {
  accept?: string;
  canRemoveValue?: boolean;
  folderSlug: string;
  icon?: AppIconName;
  label: string;
  localFile: File | null;
  onChange: (value: string) => void;
  onLocalFileChange: (file: File | null) => void;
  placeholder?: string;
  value: string;
};

type MultiMediaAssetFieldProps = {
  accept?: string;
  folderSlug: string;
  icon?: AppIconName;
  label: string;
  localFiles: File[];
  maxItems?: number;
  onChange: (values: string[]) => void;
  onLocalFilesChange: (files: File[]) => void;
  placeholder?: string;
  values: string[];
};

type PendingCoverRemoval =
  | {
      index: number;
      kind: "local";
      name: string;
    }
  | {
      index: number;
      kind: "stored";
      name: string;
    };

function cleanAssetValues(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function MediaAssetField({
  accept = "image/jpeg,image/png,image/gif,image/webp,image/svg+xml",
  canRemoveValue = false,
  folderSlug,
  icon = "image",
  label,
  localFile,
  onChange,
  onLocalFileChange,
  placeholder = "https://...",
  value,
}: MediaAssetFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<File | null>(null);
  const [items, setItems] = useState<MediaAssetItem[]>([]);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string>();
  const [notice, setNotice] = useState("");
  const folderLabel = useMemo(() => {
    if (folderSlug === "article-covers") return "文章封面";
    if (folderSlug === "avatars") return "头像";
    if (folderSlug === "comments") return "评论";
    if (folderSlug === "site") return "站点";
    return "媒体库";
  }, [folderSlug]);
  const localImageEditorKind = useMemo<LocalImageEditorKind | null>(() => {
    if (folderSlug === "article-covers") return "article-cover";
    if (folderSlug === "avatars") return "avatar";

    return null;
  }, [folderSlug]);
  const previewUrl = localPreviewUrl ?? resolveApiAssetUrl(value);
  const hasStoredValue = value.trim().length > 0;

  useEffect(() => {
    if (!localFile) {
      setLocalPreviewUrl(undefined);
      return undefined;
    }

    const nextPreviewUrl = URL.createObjectURL(localFile);
    setLocalPreviewUrl(nextPreviewUrl);

    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [localFile]);

  useEffect(() => {
    if (!isPickerOpen) return;

    async function loadAssets() {
      try {
        const response = await adminFetch<{ items: MediaAssetItem[] }>(
          `/admin/media/?folderSlug=${encodeURIComponent(folderSlug)}&fileType=image&pageSize=100`,
        );
        setItems(response.items);
        if (response.items.length > 0) {
          setNotice("");
          return;
        }

        setNotice(`${folderLabel}文件夹暂无图片`);
        showOperationToast(`${folderLabel}文件夹暂无图片`, "warning");
      } catch (error) {
        const message = error instanceof Error ? error.message : "媒体读取失败";
        setNotice(message);
        showOperationToast(message, "danger");
      }
    }

    void loadAssets();
  }, [folderLabel, folderSlug, isPickerOpen]);

  return (
    <div className="media-asset-field">
      <TextField fullWidth>
        <Label>{label}</Label>
        <InputGroup fullWidth variant="secondary">
          <InputGroup.Prefix>
            <AppIcon name={icon} size={16} />
          </InputGroup.Prefix>
          <InputGroup.Input
            inputMode="url"
            onChange={(event) => {
              onChange(event.target.value);
              if (localFile) onLocalFileChange(null);
            }}
            placeholder={placeholder}
            type="text"
            value={value}
          />
        </InputGroup>
        <Description>可填写图片链接，也可以从媒体库或本地选择。</Description>
        <FieldError>{label}链接格式不正确</FieldError>
      </TextField>
      <input
        ref={inputRef}
        accept={accept}
        className="visually-hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          if (file && localImageEditorKind) {
            setEditingFile(file);
            event.target.value = "";
            return;
          }

          onLocalFileChange(file);
          if (file) {
            onChange("");
            showOperationToast(`已选择本地文件：${file.name}`, "success");
          }
          event.target.value = "";
        }}
        type="file"
      />
      <div className="media-asset-field__actions">
        <Button onPress={() => setIsPickerOpen(true)} size="sm" type="button" variant="tertiary">
          <AppIcon name="images" />
          从媒体库选择
        </Button>
        <Button
          onPress={() => inputRef.current?.click()}
          size="sm"
          type="button"
          variant="tertiary"
        >
          <AppIcon name="cloudUpload" />
          本地选择
        </Button>
        {localFile ? (
          <Button
            onPress={() => {
              onLocalFileChange(null);
              showOperationToast("已移除本地文件", "success");
            }}
            size="sm"
            type="button"
            variant="danger-soft"
          >
            <AppIcon name="close" />
            移除本地文件
          </Button>
        ) : null}
        {localFile && localImageEditorKind ? (
          <Button
            onPress={() => setEditingFile(localFile)}
            size="sm"
            type="button"
            variant="tertiary"
          >
            <AppIcon name="create" />
            重新编辑
          </Button>
        ) : null}
        {canRemoveValue && hasStoredValue ? (
          <Button
            onPress={() => {
              onChange("");
              onLocalFileChange(null);
              showOperationToast(`已移除${label}`, "success");
            }}
            size="sm"
            type="button"
            variant="danger-soft"
          >
            <AppIcon name="trash" />
            移除当前图片
          </Button>
        ) : null}
      </div>
      <p className="media-asset-field__hint">
        {localFile ? `待上传到「${folderLabel}」：${localFile.name}` : `目标文件夹：${folderLabel}`}
      </p>
      {previewUrl ? (
        <div className="media-asset-field__preview">
          <img alt={`${label}预览`} src={previewUrl} />
        </div>
      ) : null}
      <Modal.Backdrop isOpen={isPickerOpen} onOpenChange={setIsPickerOpen} variant="blur">
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog>
            <div className="admin-form-modal">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Icon>
                  <AppIcon name="images" />
                </Modal.Icon>
                <div>
                  <Modal.Heading>从媒体库选择</Modal.Heading>
                  <p className="admin-form-modal__description">
                    只显示「{folderLabel}」文件夹内的图片。
                  </p>
                </div>
              </Modal.Header>
              <Modal.Body>
                {notice ? <p className="media-asset-field__hint">{notice}</p> : null}
                <div className="media-picker-grid">
                  {items.map((item) => (
                    <Card className="media-picker-card" key={item.id}>
                      <img
                        alt={item.fileName}
                        src={resolveApiAssetUrl(item.accessUrl) ?? item.accessUrl}
                      />
                      <strong>{item.fileName}</strong>
                      <Button
                        onPress={() => {
                          onChange(item.accessUrl);
                          onLocalFileChange(null);
                          setIsPickerOpen(false);
                          showOperationToast(`已选择媒体：${item.fileName}`, "success");
                        }}
                        size="sm"
                        type="button"
                      >
                        <AppIcon name="checkmarkCircle" />
                        使用
                      </Button>
                    </Card>
                  ))}
                </div>
              </Modal.Body>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      <LocalImageEditorDialog
        file={editingFile}
        isOpen={editingFile !== null}
        kind={localImageEditorKind ?? "article-cover"}
        onApply={(file) => {
          onLocalFileChange(file);
          onChange("");
          setEditingFile(null);
          showOperationToast(`已编辑本地图片：${file.name}`, "success");
        }}
        onCancel={() => setEditingFile(null)}
      />
    </div>
  );
}

export function MultiMediaAssetField({
  accept = "image/jpeg,image/png,image/gif,image/webp,image/svg+xml",
  folderSlug,
  icon = "image",
  label,
  localFiles,
  maxItems = 12,
  onChange,
  onLocalFilesChange,
  placeholder = "https://...",
  values,
}: MultiMediaAssetFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [draftUrl, setDraftUrl] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [items, setItems] = useState<MediaAssetItem[]>([]);
  const [localPreviewUrls, setLocalPreviewUrls] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState<PendingCoverRemoval | null>(null);
  const cleanValues = useMemo(() => cleanAssetValues(values), [values]);
  const itemCount = cleanValues.length + localFiles.length;
  const folderLabel = useMemo(() => {
    if (folderSlug === "article-covers") return "文章封面";
    if (folderSlug === "avatars") return "头像";
    if (folderSlug === "comments") return "评论";
    if (folderSlug === "site") return "站点";
    return "媒体库";
  }, [folderSlug]);

  useEffect(() => {
    const previewUrls = localFiles.map((file) => URL.createObjectURL(file));
    setLocalPreviewUrls(previewUrls);

    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [localFiles]);

  useEffect(() => {
    if (!isPickerOpen) return;

    async function loadAssets() {
      try {
        const response = await adminFetch<{ items: MediaAssetItem[] }>(
          `/admin/media/?folderSlug=${encodeURIComponent(folderSlug)}&fileType=image&pageSize=100`,
        );
        setItems(response.items);
        if (response.items.length > 0) {
          setNotice("");
          return;
        }

        setNotice(`${folderLabel}文件夹暂无图片`);
        showOperationToast(`${folderLabel}文件夹暂无图片`, "warning");
      } catch (error) {
        const message = error instanceof Error ? error.message : "媒体读取失败";
        setNotice(message);
        showOperationToast(message, "danger");
      }
    }

    void loadAssets();
  }, [folderLabel, folderSlug, isPickerOpen]);

  function appendValues(nextValues: string[]) {
    const mergedValues = cleanAssetValues([...cleanValues, ...nextValues]).slice(0, maxItems);
    onChange(mergedValues);
  }

  function addDraftUrl() {
    const value = draftUrl.trim();

    if (!value) {
      showOperationToast("请先填写封面链接", "warning");
      return;
    }

    if (itemCount >= maxItems && !cleanValues.includes(value)) {
      showOperationToast(`最多可设置 ${maxItems} 张封面`, "warning");
      return;
    }

    appendValues([value]);
    setDraftUrl("");
    showOperationToast("已添加封面链接", "success");
  }

  function moveValue(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= cleanValues.length) return;

    const nextValues = [...cleanValues];
    const [currentValue] = nextValues.splice(index, 1);
    nextValues.splice(nextIndex, 0, currentValue);
    onChange(nextValues);
  }

  function removeValue(index: number) {
    onChange(cleanValues.filter((_, itemIndex) => itemIndex !== index));
  }

  function removeLocalFile(index: number) {
    onLocalFilesChange(localFiles.filter((_, itemIndex) => itemIndex !== index));
  }

  function confirmPendingRemoval() {
    if (!pendingRemoval) return;

    if (pendingRemoval.kind === "stored") {
      removeValue(pendingRemoval.index);
    } else {
      removeLocalFile(pendingRemoval.index);
    }

    showOperationToast(`已移除${pendingRemoval.name}`, "success");
    setPendingRemoval(null);
  }

  return (
    <div className="media-asset-field multi-media-asset-field">
      <TextField fullWidth>
        <Label>{label}</Label>
        <InputGroup fullWidth variant="secondary">
          <InputGroup.Prefix>
            <AppIcon name={icon} size={16} />
          </InputGroup.Prefix>
          <InputGroup.Input
            inputMode="url"
            onChange={(event) => setDraftUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              addDraftUrl();
            }}
            placeholder={placeholder}
            type="text"
            value={draftUrl}
          />
        </InputGroup>
        <Description>
          可添加多张图片链接，也可以从媒体库或本地选择。前台首页会按顺序轮播。
        </Description>
        <FieldError>{label}链接格式不正确</FieldError>
      </TextField>
      <input
        ref={inputRef}
        accept={accept}
        className="visually-hidden"
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          const availableSlots = Math.max(0, maxItems - itemCount);
          const nextFiles = files.slice(0, availableSlots);

          if (nextFiles.length === 0) {
            showOperationToast(`最多可设置 ${maxItems} 张封面`, "warning");
            event.target.value = "";
            return;
          }

          onLocalFilesChange([...localFiles, ...nextFiles]);
          showOperationToast(`已选择 ${nextFiles.length} 个本地文件`, "success");
          event.target.value = "";
        }}
        type="file"
      />
      <div className="media-asset-field__actions">
        <Button onPress={addDraftUrl} size="sm" type="button" variant="tertiary">
          <AppIcon name="checkmarkCircle" />
          添加链接
        </Button>
        <Button onPress={() => setIsPickerOpen(true)} size="sm" type="button" variant="tertiary">
          <AppIcon name="images" />
          从媒体库选择
        </Button>
        <Button
          onPress={() => inputRef.current?.click()}
          size="sm"
          type="button"
          variant="tertiary"
        >
          <AppIcon name="cloudUpload" />
          本地选择
        </Button>
      </div>
      <p className="media-asset-field__hint">
        已设置 {itemCount} / {maxItems} 张封面；第一张会作为兼容封面。
      </p>
      {itemCount > 0 ? (
        <div className="multi-media-asset-field__grid">
          {cleanValues.map((value, index) => (
            <div className="multi-media-asset-card" key={`${value}-${index}`}>
              <img alt={`${label}${index + 1}`} src={resolveApiAssetUrl(value) ?? value} />
              <div className="multi-media-asset-card__meta">
                <span>{index === 0 ? "主封面" : `封面 ${index + 1}`}</span>
                <small>{value}</small>
              </div>
              <div className="multi-media-asset-card__actions">
                <Button
                  isDisabled={index === 0}
                  onPress={() => moveValue(index, -1)}
                  size="sm"
                  type="button"
                  variant="tertiary"
                >
                  <AppIcon name="arrowUp" />
                  上移
                </Button>
                <Button
                  isDisabled={index === cleanValues.length - 1}
                  onPress={() => moveValue(index, 1)}
                  size="sm"
                  type="button"
                  variant="tertiary"
                >
                  <AppIcon name="arrowDown" />
                  下移
                </Button>
                <Button
                  onPress={() =>
                    setPendingRemoval({
                      index,
                      kind: "stored",
                      name: index === 0 ? "主封面" : `封面 ${index + 1}`,
                    })
                  }
                  size="sm"
                  type="button"
                  variant="danger-soft"
                >
                  <AppIcon name="trash" />
                  移除
                </Button>
              </div>
            </div>
          ))}
          {localFiles.map((file, index) => (
            <div
              className="multi-media-asset-card"
              key={`${file.name}-${file.lastModified}-${index}`}
            >
              <img alt={`待上传${file.name}`} src={localPreviewUrls[index]} />
              <div className="multi-media-asset-card__meta">
                <span>待上传 {index + 1}</span>
                <small>{file.name}</small>
              </div>
              <div className="multi-media-asset-card__actions">
                <Button
                  onPress={() =>
                    setPendingRemoval({
                      index,
                      kind: "local",
                      name: `待上传封面 ${index + 1}`,
                    })
                  }
                  size="sm"
                  type="button"
                  variant="danger-soft"
                >
                  <AppIcon name="trash" />
                  移除
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <Modal.Backdrop isOpen={isPickerOpen} onOpenChange={setIsPickerOpen} variant="blur">
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog>
            <div className="admin-form-modal">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Icon>
                  <AppIcon name="images" />
                </Modal.Icon>
                <div>
                  <Modal.Heading>从媒体库添加封面</Modal.Heading>
                  <p className="admin-form-modal__description">
                    只显示「{folderLabel}」文件夹内的图片。
                  </p>
                </div>
              </Modal.Header>
              <Modal.Body>
                {notice ? <p className="media-asset-field__hint">{notice}</p> : null}
                <div className="media-picker-grid">
                  {items.map((item) => {
                    const isSelected = cleanValues.includes(item.accessUrl);

                    return (
                      <Card className="media-picker-card" key={item.id}>
                        <img
                          alt={item.fileName}
                          src={resolveApiAssetUrl(item.accessUrl) ?? item.accessUrl}
                        />
                        <strong>{item.fileName}</strong>
                        <Button
                          isDisabled={isSelected || itemCount >= maxItems}
                          onPress={() => {
                            appendValues([item.accessUrl]);
                            showOperationToast(`已添加媒体：${item.fileName}`, "success");
                          }}
                          size="sm"
                          type="button"
                        >
                          <AppIcon name="checkmarkCircle" />
                          {isSelected ? "已添加" : "添加"}
                        </Button>
                      </Card>
                    );
                  })}
                </div>
              </Modal.Body>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      {pendingRemoval ? (
        <AlertDialog>
          <AlertDialog.Backdrop
            isOpen
            onOpenChange={(isOpen) => {
              if (isOpen) return;
              setPendingRemoval(null);
            }}
          >
            <AlertDialog.Container placement="center" size="sm">
              <AlertDialog.Dialog>
                <AlertDialog.CloseTrigger />
                <AlertDialog.Header>
                  <AlertDialog.Icon status="danger" />
                  <AlertDialog.Heading>确认移除封面？</AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <p>将从站点信息中移除「{pendingRemoval.name}」，保存后前台首页不再使用它。</p>
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button slot="close" variant="tertiary">
                    取消
                  </Button>
                  <Button onPress={confirmPendingRemoval} slot="close" variant="danger-soft">
                    确认移除
                  </Button>
                </AlertDialog.Footer>
              </AlertDialog.Dialog>
            </AlertDialog.Container>
          </AlertDialog.Backdrop>
        </AlertDialog>
      ) : null}
    </div>
  );
}
