import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CloudUpload,
  Crop,
  Images,
  Link,
  Trash2,
  X,
} from "lucide-react";

import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Dialog } from "@astryxdesign/core/Dialog";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";

import type { MediaAsset } from "../../../../shared/admin-api";
import { getMediaAssets, resolveAdminAssetUrl } from "../../../../shared/admin-api";
import type { LocalImageEditorKind } from "../../../../shared/local-image-editor";
import {
  canEditLocalImageFile,
  LocalImageEditorDialog,
} from "../../../../shared/local-image-editor";

type MediaFieldStatus = {
  message: string;
  type: "error" | "success" | "warning";
};

type MediaAssetPreviewVariant = "avatar" | "favicon" | "image";

const DEFAULT_IMAGE_ACCEPT = "image/jpeg,image/png,image/gif,image/webp,image/svg+xml,image/x-icon";

const HIDDEN_INPUT_STYLE: CSSProperties = {
  display: "none",
};

const PREVIEW_FRAME_BASE_STYLE: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  overflow: "hidden",
};

const PREVIEW_FRAME_STYLES: Record<MediaAssetPreviewVariant, CSSProperties> = {
  avatar: {
    ...PREVIEW_FRAME_BASE_STYLE,
    borderRadius: 999,
    width: 112,
  },
  favicon: {
    ...PREVIEW_FRAME_BASE_STYLE,
    width: 96,
  },
  image: {
    ...PREVIEW_FRAME_BASE_STYLE,
    width: "min(100%, 260px)",
  },
};

const IMAGE_PREVIEW_BASE_STYLE: CSSProperties = {
  aspectRatio: "16 / 9",
  background: "var(--color-background-muted)",
  display: "block",
  width: "100%",
};

const PREVIEW_IMAGE_STYLES: Record<MediaAssetPreviewVariant, CSSProperties> = {
  avatar: {
    ...IMAGE_PREVIEW_BASE_STYLE,
    aspectRatio: "1 / 1",
    objectFit: "cover",
  },
  favicon: {
    ...IMAGE_PREVIEW_BASE_STYLE,
    aspectRatio: "1 / 1",
    objectFit: "contain",
    padding: 12,
  },
  image: {
    ...IMAGE_PREVIEW_BASE_STYLE,
    objectFit: "contain",
  },
};

const PICKER_DIALOG_CONTENT_STYLE: CSSProperties = {
  maxHeight: "calc(90dvh - 128px)",
  minHeight: 220,
  overflow: "auto",
};

const PICKER_DIALOG_HEADER_STYLE: CSSProperties = {
  minWidth: 0,
};

const MEDIA_CARD_IMAGE_STYLE: CSSProperties = {
  aspectRatio: "16 / 9",
  borderRadius: 6,
  display: "block",
  objectFit: "cover",
  width: "100%",
};

const URL_TEXT_STYLE: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const normalizeAssetValues = (values: readonly string[]) => {
  const uniqueValues = new Set<string>();

  values.forEach((value) => {
    const trimmedValue = value.trim();
    if (trimmedValue.length > 0) {
      uniqueValues.add(trimmedValue);
    }
  });

  return [...uniqueValues];
};

type LocalPreviewParameters = {
  file?: File;
};

const useLocalPreview = ({ file }: LocalPreviewParameters) => {
  const [previewUrl, setPreviewUrl] = useState<string>();

  useEffect(() => {
    if (file === undefined) {
      setPreviewUrl(undefined);
      return undefined;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return previewUrl;
};

type MediaPickerPanelProps = {
  folderSlug: string;
  isMulti: boolean;
  maxItems?: number;
  onSelect: (asset: MediaAsset) => void;
  selectedValues: readonly string[];
  token: string;
};

const MediaPickerPanel = ({
  folderSlug,
  isMulti,
  maxItems,
  onSelect,
  selectedValues,
  token,
}: MediaPickerPanelProps) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    let isMounted = true;

    const loadAssets = async () => {
      setIsLoading(true);
      setErrorMessage(undefined);

      try {
        const result = await getMediaAssets({
          fileType: "image",
          folderSlug,
          page: 1,
          pageSize: 60,
          query: "",
          token,
        });

        if (isMounted) {
          setItems(result.media);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error ? error.message : t("admin.mediaAssetField.loadFailed"),
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadAssets();

    return () => {
      isMounted = false;
    };
  }, [folderSlug, t, token]);

  if (isLoading) {
    return (
      <HStack gap={2} vAlign="center">
        <Spinner size="sm" />
        <Text type="supporting" color="secondary">
          {t("admin.mediaAssetField.loading")}
        </Text>
      </HStack>
    );
  }

  if (errorMessage !== undefined) {
    return <Text type="supporting">{errorMessage}</Text>;
  }

  if (items.length === 0) {
    return (
      <Text type="supporting" color="secondary">
        {t("admin.mediaAssetField.empty")}
      </Text>
    );
  }

  const selectedSet = new Set(selectedValues);

  return (
    <Grid columns={{ minWidth: 160, max: 4 }} gap={3}>
      {items.map((item) => {
        const isSelected = selectedSet.has(item.accessUrl);
        const isFull = maxItems !== undefined && selectedValues.length >= maxItems && !isSelected;

        return (
          <Card key={item.id} variant="muted" padding={3}>
            <VStack gap={2}>
              <img
                alt={item.fileName}
                src={resolveAdminAssetUrl(item.accessUrl)}
                style={MEDIA_CARD_IMAGE_STYLE}
              />
              <Text type="label" style={URL_TEXT_STYLE}>
                {item.fileName}
              </Text>
              <Button
                icon={<CheckCircle2 size={16} />}
                isDisabled={isSelected || isFull}
                label={
                  isSelected
                    ? t("admin.mediaAssetField.selected")
                    : isMulti
                      ? t("admin.mediaAssetField.addAsset")
                      : t("admin.mediaAssetField.useAsset")
                }
                onClick={() => onSelect(item)}
                variant="secondary"
                width="100%"
              />
            </VStack>
          </Card>
        );
      })}
    </Grid>
  );
};

type MediaPickerDialogProps = {
  folderSlug: string;
  isMulti: boolean;
  isOpen: boolean;
  maxItems?: number;
  onClose: () => void;
  onSelect: (asset: MediaAsset) => void;
  selectedValues: readonly string[];
  token: string;
};

export const MediaPickerDialog = ({
  folderSlug,
  isMulti,
  isOpen,
  maxItems,
  onClose,
  onSelect,
  selectedValues,
  token,
}: MediaPickerDialogProps) => {
  const { t } = useTranslation();
  const title = t("admin.mediaAssetField.libraryTitle");

  return (
    <Dialog
      aria-label={title}
      isOpen={isOpen}
      maxHeight="90dvh"
      onOpenChange={(nextIsOpen) => {
        if (!nextIsOpen) {
          onClose();
        }
      }}
      padding={4}
      variant="standard"
      width={900}
    >
      <VStack gap={4}>
        <HStack gap={3} hAlign="between" vAlign="start">
          <VStack gap={1} style={PICKER_DIALOG_HEADER_STYLE}>
            <Heading level={2}>{title}</Heading>
            <Text type="supporting" color="secondary">
              {t("admin.mediaAssetField.libraryDescription")}
            </Text>
          </VStack>
          <Button
            icon={<X size={16} />}
            label={t("actions.close")}
            onClick={onClose}
            variant="ghost"
          />
        </HStack>
        <div style={PICKER_DIALOG_CONTENT_STYLE}>
          <MediaPickerPanel
            folderSlug={folderSlug}
            isMulti={isMulti}
            maxItems={maxItems}
            onSelect={onSelect}
            selectedValues={selectedValues}
            token={token}
          />
        </div>
      </VStack>
    </Dialog>
  );
};

type MediaAssetFieldProps = {
  accept?: string;
  allowMediaLibrary?: boolean;
  canRemoveValue?: boolean;
  folderSlug: string;
  isDisabled?: boolean;
  label: string;
  localFile?: File;
  localImageEditorKind?: LocalImageEditorKind;
  onChange: (value: string) => void;
  onLocalFileChange: (file?: File) => void;
  placeholder?: string;
  previewVariant?: MediaAssetPreviewVariant;
  status?: MediaFieldStatus;
  token?: string;
  value: string;
};

export const MediaAssetField = ({
  accept = DEFAULT_IMAGE_ACCEPT,
  allowMediaLibrary = true,
  canRemoveValue = true,
  folderSlug,
  isDisabled = false,
  label,
  localFile,
  localImageEditorKind,
  onChange,
  onLocalFileChange,
  placeholder,
  previewVariant = "image",
  status,
  token,
  value,
}: MediaAssetFieldProps) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [editingFile, setEditingFile] = useState<File>();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const localPreviewUrl = useLocalPreview({ file: localFile });
  const trimmedValue = value.trim();
  const previewUrl =
    localPreviewUrl ?? (trimmedValue.length > 0 ? resolveAdminAssetUrl(trimmedValue) : undefined);
  const canUseMediaLibrary =
    allowMediaLibrary && token !== undefined && token.trim().length > 0 && !isDisabled;

  const handleLocalFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file === undefined) {
      return;
    }

    if (localImageEditorKind !== undefined && canEditLocalImageFile(file)) {
      setEditingFile(file);
      return;
    }

    onLocalFileChange(file);
    onChange("");
  };

  return (
    <VStack gap={2}>
      <TextInput
        label={label}
        value={value}
        onChange={(nextValue) => {
          onChange(nextValue);
          if (localFile !== undefined) {
            onLocalFileChange(undefined);
          }
        }}
        placeholder={placeholder}
        status={status}
      />
      <input
        ref={inputRef}
        accept={accept}
        onChange={(event) => {
          handleLocalFiles(event.target.files);
          event.target.value = "";
        }}
        style={HIDDEN_INPUT_STYLE}
        type="file"
      />
      <HStack gap={2} wrap="wrap">
        {canUseMediaLibrary && (
          <Button
            icon={<Images size={16} />}
            isDisabled={isDisabled}
            label={t("admin.mediaAssetField.chooseFromLibrary")}
            onClick={() => setIsPickerOpen(true)}
            variant="secondary"
          />
        )}
        <Button
          icon={<CloudUpload size={16} />}
          isDisabled={isDisabled}
          label={t("admin.mediaAssetField.chooseLocal")}
          onClick={() => inputRef.current?.click()}
          variant="secondary"
        />
        {localFile !== undefined && (
          <Button
            icon={<X size={16} />}
            isDisabled={isDisabled}
            label={t("admin.mediaAssetField.clearLocal")}
            onClick={() => {
              setEditingFile(undefined);
              onLocalFileChange(undefined);
            }}
            variant="ghost"
          />
        )}
        {localFile !== undefined &&
          localImageEditorKind !== undefined &&
          canEditLocalImageFile(localFile) && (
            <Button
              icon={<Crop size={16} />}
              isDisabled={isDisabled}
              label={t("admin.mediaAssetField.editLocal")}
              onClick={() => setEditingFile(localFile)}
              variant="ghost"
            />
          )}
        {canRemoveValue && trimmedValue.length > 0 && (
          <Button
            icon={<Trash2 size={16} />}
            isDisabled={isDisabled}
            label={t("admin.mediaAssetField.clearValue")}
            onClick={() => onChange("")}
            variant="ghost"
          />
        )}
      </HStack>
      <Text type="supporting" color="secondary">
        {localFile !== undefined
          ? t("admin.mediaAssetField.pendingUpload", { name: localFile.name })
          : canUseMediaLibrary
            ? t("admin.mediaAssetField.storedHint")
            : t("admin.mediaAssetField.localOnlyHint")}
      </Text>
      {previewUrl !== undefined && (
        <div style={PREVIEW_FRAME_STYLES[previewVariant]}>
          <img
            alt={t("admin.mediaAssetField.previewAlt", { label })}
            src={previewUrl}
            style={PREVIEW_IMAGE_STYLES[previewVariant]}
          />
        </div>
      )}
      {canUseMediaLibrary && (
        <MediaPickerDialog
          folderSlug={folderSlug}
          isMulti={false}
          isOpen={isPickerOpen}
          onClose={() => setIsPickerOpen(false)}
          onSelect={(asset) => {
            onChange(asset.accessUrl);
            onLocalFileChange(undefined);
            setIsPickerOpen(false);
          }}
          selectedValues={trimmedValue.length > 0 ? [trimmedValue] : []}
          token={token}
        />
      )}
      {localImageEditorKind !== undefined && (
        <LocalImageEditorDialog
          file={editingFile}
          isOpen={editingFile !== undefined}
          kind={localImageEditorKind}
          onApply={(file) => {
            onLocalFileChange(file);
            onChange("");
            setEditingFile(undefined);
          }}
          onCancel={() => setEditingFile(undefined)}
        />
      )}
    </VStack>
  );
};

type MultiMediaAssetFieldProps = {
  accept?: string;
  allowMediaLibrary?: boolean;
  folderSlug: string;
  isDisabled?: boolean;
  label: string;
  localFiles: readonly File[];
  maxItems?: number;
  onChange: (values: string[]) => void;
  onLocalFilesChange: (files: File[]) => void;
  placeholder?: string;
  status?: MediaFieldStatus;
  token?: string;
  values: readonly string[];
};

export const MultiMediaAssetField = ({
  accept = DEFAULT_IMAGE_ACCEPT,
  allowMediaLibrary = true,
  folderSlug,
  isDisabled = false,
  label,
  localFiles,
  maxItems = 12,
  onChange,
  onLocalFilesChange,
  placeholder,
  status,
  token,
  values,
}: MultiMediaAssetFieldProps) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draftUrl, setDraftUrl] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [localPreviewUrls, setLocalPreviewUrls] = useState<string[]>([]);
  const cleanValues = useMemo(() => normalizeAssetValues(values), [values]);
  const itemCount = cleanValues.length + localFiles.length;
  const canUseMediaLibrary =
    allowMediaLibrary && token !== undefined && token.trim().length > 0 && !isDisabled;

  useEffect(() => {
    const nextPreviewUrls = localFiles.map((file) => URL.createObjectURL(file));
    setLocalPreviewUrls(nextPreviewUrls);

    return () => {
      nextPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [localFiles]);

  const appendValues = (nextValues: readonly string[]) => {
    const availableStoredSlots = Math.max(0, maxItems - localFiles.length);
    onChange(normalizeAssetValues([...cleanValues, ...nextValues]).slice(0, availableStoredSlots));
  };

  const addDraftUrl = () => {
    const nextUrl = draftUrl.trim();
    if (nextUrl.length === 0) {
      return;
    }

    appendValues([nextUrl]);
    setDraftUrl("");
  };

  const moveValue = ({ direction, index }: { direction: -1 | 1; index: number }) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= cleanValues.length) {
      return;
    }

    const nextValues = [...cleanValues];
    const [currentValue] = nextValues.splice(index, 1);
    if (currentValue === undefined) {
      return;
    }

    nextValues.splice(nextIndex, 0, currentValue);
    onChange(nextValues);
  };

  const handleLocalFiles = (files: FileList | null) => {
    const availableSlots = Math.max(0, maxItems - itemCount);
    const nextFiles = Array.from(files ?? []).slice(0, availableSlots);
    if (nextFiles.length === 0) {
      return;
    }

    onLocalFilesChange([...localFiles, ...nextFiles]);
  };

  return (
    <VStack gap={2}>
      <TextInput
        label={label}
        value={draftUrl}
        onChange={setDraftUrl}
        placeholder={placeholder}
        status={status}
      />
      <input
        ref={inputRef}
        accept={accept}
        multiple
        onChange={(event) => {
          handleLocalFiles(event.target.files);
          event.target.value = "";
        }}
        style={HIDDEN_INPUT_STYLE}
        type="file"
      />
      <HStack gap={2} wrap="wrap">
        <Button
          icon={<Link size={16} />}
          isDisabled={isDisabled || draftUrl.trim().length === 0 || itemCount >= maxItems}
          label={t("admin.mediaAssetField.addLink")}
          onClick={addDraftUrl}
          variant="secondary"
        />
        {canUseMediaLibrary && (
          <Button
            icon={<Images size={16} />}
            isDisabled={isDisabled || itemCount >= maxItems}
            label={t("admin.mediaAssetField.chooseFromLibrary")}
            onClick={() => setIsPickerOpen(true)}
            variant="secondary"
          />
        )}
        <Button
          icon={<CloudUpload size={16} />}
          isDisabled={isDisabled || itemCount >= maxItems}
          label={t("admin.mediaAssetField.chooseLocal")}
          onClick={() => inputRef.current?.click()}
          variant="secondary"
        />
      </HStack>
      <Text type="supporting" color="secondary">
        {t("admin.mediaAssetField.countSummary", { count: itemCount, max: maxItems })}
      </Text>
      {canUseMediaLibrary && (
        <MediaPickerDialog
          folderSlug={folderSlug}
          isMulti
          isOpen={isPickerOpen}
          maxItems={Math.max(0, maxItems - localFiles.length)}
          onClose={() => setIsPickerOpen(false)}
          onSelect={(asset) => appendValues([asset.accessUrl])}
          selectedValues={cleanValues}
          token={token}
        />
      )}
      {itemCount > 0 && (
        <Grid columns={{ minWidth: 180, max: 3 }} gap={3}>
          {cleanValues.map((assetUrl, index) => (
            <Card key={`${assetUrl}-${index}`} variant="muted" padding={3}>
              <VStack gap={2}>
                <img
                  alt={t("admin.mediaAssetField.coverPreviewAlt", { index: index + 1 })}
                  src={resolveAdminAssetUrl(assetUrl)}
                  style={MEDIA_CARD_IMAGE_STYLE}
                />
                <HStack gap={2} vAlign="center">
                  <Badge
                    label={
                      index === 0
                        ? t("admin.mediaAssetField.primaryCover")
                        : t("admin.mediaAssetField.coverLabel", { index: index + 1 })
                    }
                    variant="neutral"
                  />
                </HStack>
                <Text type="supporting" color="secondary" style={URL_TEXT_STYLE}>
                  {assetUrl}
                </Text>
                <HStack gap={2} wrap="wrap">
                  <Button
                    icon={<ArrowUp size={16} />}
                    isDisabled={isDisabled || index === 0}
                    label={t("admin.mediaAssetField.moveUp")}
                    onClick={() => moveValue({ direction: -1, index })}
                    variant="ghost"
                  />
                  <Button
                    icon={<ArrowDown size={16} />}
                    isDisabled={isDisabled || index === cleanValues.length - 1}
                    label={t("admin.mediaAssetField.moveDown")}
                    onClick={() => moveValue({ direction: 1, index })}
                    variant="ghost"
                  />
                  <Button
                    icon={<Trash2 size={16} />}
                    isDisabled={isDisabled}
                    label={t("admin.mediaAssetField.remove")}
                    onClick={() =>
                      onChange(cleanValues.filter((_value, valueIndex) => valueIndex !== index))
                    }
                    variant="ghost"
                  />
                </HStack>
              </VStack>
            </Card>
          ))}
          {localFiles.map((file, index) => (
            <Card key={`${file.name}-${file.lastModified}-${index}`} variant="muted" padding={3}>
              <VStack gap={2}>
                <img alt={file.name} src={localPreviewUrls[index]} style={MEDIA_CARD_IMAGE_STYLE} />
                <Badge
                  label={t("admin.mediaAssetField.localCoverLabel", { index: index + 1 })}
                  variant="neutral"
                />
                <Text type="supporting" color="secondary" style={URL_TEXT_STYLE}>
                  {file.name}
                </Text>
                <Button
                  icon={<Trash2 size={16} />}
                  isDisabled={isDisabled}
                  label={t("admin.mediaAssetField.remove")}
                  onClick={() =>
                    onLocalFilesChange(localFiles.filter((_file, fileIndex) => fileIndex !== index))
                  }
                  variant="ghost"
                />
              </VStack>
            </Card>
          ))}
        </Grid>
      )}
    </VStack>
  );
};
