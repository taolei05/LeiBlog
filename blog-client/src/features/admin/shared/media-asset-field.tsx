import {
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
  folderSlug: string;
  icon?: AppIconName;
  label: string;
  localFile: File | null;
  onChange: (value: string) => void;
  onLocalFileChange: (file: File | null) => void;
  placeholder?: string;
  value: string;
};

export function MediaAssetField({
  accept = "image/jpeg,image/png,image/gif,image/webp,image/svg+xml",
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
