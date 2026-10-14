import "@mdxeditor/editor/style.css";

import type { ChangeEvent, FormEvent } from "react";
import { getSafeLinkUrl } from "../../../../shared/content-url";
import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { UploadProgressList } from "../../../../shared/upload-progress";
import type { UploadProgress } from "../../../../shared/upload-request";
import {
  Copy,
  ExternalLink,
  FileImage,
  ImagePlus,
  Images,
  Link2,
  Pencil,
  Save,
  Unlink,
  X,
} from "lucide-react";

import { Button } from "@astryxdesign/core/Button";
import { Dialog } from "@astryxdesign/core/Dialog";
import { Heading } from "@astryxdesign/core/Heading";
import { IconButton } from "@astryxdesign/core/IconButton";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import type {
  ImageUploadHandler,
  MDXEditorMethods,
  SaveImageParameters,
  Translation,
} from "@mdxeditor/editor";
import { useCellValues, usePublisher } from "@mdxeditor/gurx";
import { useTranslation } from "react-i18next";
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  cancelLinkEdit$,
  CodeToggle,
  CreateLink,
  DiffSourceToggleWrapper,
  InsertCodeBlock,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  MDXEditor,
  Separator,
  UndoRedo,
  allowSetImageDimensions$,
  closeImageDialog$,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  frontmatterPlugin,
  headingsPlugin,
  imageAutocompleteSuggestions$,
  imageDialogState$,
  imagePlugin,
  imageUploadHandler$,
  jsxPlugin,
  linkDialogPlugin,
  linkDialogState$,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  removeLink$,
  saveImage$,
  switchFromPreviewToLinkEdit$,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  updateLink$,
} from "@mdxeditor/editor";

import type { MediaAsset } from "../../../../shared/admin-api";
import { resolveAdminAssetUrl } from "../../../../shared/admin-api";
import { normalizeLanguage } from "../../../../shared/i18n";
import { MediaPickerDialog } from "./media-asset-field";
import { MAX_ARTICLE_IMAGE_DIMENSION, readImageDimension } from "../../../../shared/article-image";
import { mdxJsxComponentDescriptors } from "./mdx-whitelist";

const MDX_EDITOR_CHINESE_TRANSLATIONS: Record<string, string> = {
  "codeBlock.inlineLanguage": "语言",
  "codeBlock.language": "代码块语言",
  "codeBlock.selectLanguage": "选择代码块语言",
  "codeblock.delete": "删除代码块",
  "createLink.cancelTooltip": "取消修改",
  "createLink.saveTooltip": "设置链接",
  "createLink.text": "链接文字",
  "createLink.textTooltip": "链接显示的文字",
  "createLink.title": "链接标题",
  "createLink.titleTooltip": "鼠标悬停时显示的链接标题",
  "createLink.url": "链接",
  "createLink.urlPlaceholder": "选择或粘贴链接",
  "dialog.close": "关闭弹窗",
  "dialogControls.cancel": "取消",
  "dialogControls.save": "保存",
  "frontmatterEditor.addEntry": "添加字段",
  "frontmatterEditor.key": "键",
  "frontmatterEditor.title": "编辑 Frontmatter",
  "frontmatterEditor.value": "值",
  "imageEditor.deleteImage": "删除图片",
  "imageEditor.editImage": "编辑图片",
  "linkPreview.copied": "已复制",
  "linkPreview.copyToClipboard": "复制到剪贴板",
  "linkPreview.edit": "编辑链接",
  "linkPreview.remove": "移除链接",
  "table.alignCenter": "居中",
  "table.alignLeft": "左对齐",
  "table.alignRight": "右对齐",
  "table.columnMenu": "列菜单",
  "table.deleteColumn": "删除此列",
  "table.deleteRow": "删除此行",
  "table.deleteTable": "删除表格",
  "table.insertColumnLeft": "在左侧插入列",
  "table.insertColumnRight": "在右侧插入列",
  "table.insertRowAbove": "在上方插入行",
  "table.insertRowBelow": "在下方插入行",
  "table.rowMenu": "行菜单",
  "table.textAlignment": "文本对齐",
  "toolbar.blockTypeSelect.placeholder": "块类型",
  "toolbar.blockTypeSelect.selectBlockTypeTooltip": "选择块类型",
  "toolbar.blockTypes.heading": "标题 {{level}}",
  "toolbar.blockTypes.paragraph": "段落",
  "toolbar.blockTypes.quote": "引用",
  "toolbar.bold": "加粗",
  "toolbar.bulletedList": "无序列表",
  "toolbar.checkList": "任务列表",
  "toolbar.codeBlock": "插入代码块",
  "toolbar.diffMode": "差异模式",
  "toolbar.editFrontmatter": "编辑 Frontmatter",
  "toolbar.highlight": "高亮",
  "toolbar.image": "插入图片",
  "toolbar.inlineCode": "行内代码",
  "toolbar.insertFrontmatter": "插入 Frontmatter",
  "toolbar.italic": "斜体",
  "toolbar.link": "创建链接",
  "toolbar.numberedList": "有序列表",
  "toolbar.redo": "重做 {{shortcut}}",
  "toolbar.removeBold": "取消加粗",
  "toolbar.removeHighlight": "取消高亮",
  "toolbar.removeInlineCode": "取消行内代码",
  "toolbar.removeItalic": "取消斜体",
  "toolbar.removeUnderline": "取消下划线",
  "toolbar.richText": "富文本",
  "toolbar.source": "源码模式",
  "toolbar.table": "插入表格",
  "toolbar.thematicBreak": "插入分割线",
  "toolbar.toggleGroup": "切换组",
  "toolbar.underline": "下划线",
  "toolbar.undo": "撤销 {{shortcut}}",
  "uploadImage.addViaUrlInstructions": "或通过链接添加图片：",
  "uploadImage.addViaUrlInstructionsNoUpload": "通过链接添加图片：",
  "uploadImage.alt": "替代文本：",
  "uploadImage.autoCompletePlaceholder": "选择或粘贴图片地址",
  "uploadImage.dialogTitle": "上传图片",
  "uploadImage.height": "高度：",
  "uploadImage.title": "标题：",
  "uploadImage.uploadInstructions": "从本机上传图片：",
  "uploadImage.width": "宽度：",
};

const mdxEditorChineseTranslation: Translation = (key, defaultValue, interpolations = {}) => {
  let value = MDX_EDITOR_CHINESE_TRANSLATIONS[key] ?? defaultValue;

  for (const [name, interpolationValue] of Object.entries(interpolations)) {
    value = value.replaceAll(`{{${name}}}`, String(interpolationValue));
  }

  return value;
};

type MdxImageDialogCopy = {
  addViaUrl: string;
  alt: string;
  cancel: string;
  chooseFile: string;
  chooseFromLibrary: string;
  clearFile: string;
  close: string;
  description: string;
  editDescription: string;
  editTitle: string;
  fileEmpty: string;
  height: string;
  localDescription: string;
  localTitle: string;
  preview: string;
  previewEmpty: string;
  save: string;
  srcPlaceholder: string;
  title: string;
  uploadTitle: string;
  width: string;
};

const MDX_IMAGE_DIALOG_COPY: Record<"en" | "zh-CN", MdxImageDialogCopy> = {
  en: {
    addViaUrl: "Image URL",
    alt: "Alt text",
    cancel: "Cancel",
    chooseFile: "Choose image",
    chooseFromLibrary: "Choose from media library",
    clearFile: "Clear selected image",
    close: "Close",
    description: "Upload a local image or paste a URL, then add metadata for better reading.",
    editDescription: "Update the image URL and metadata shown in the article.",
    editTitle: "Edit image",
    fileEmpty: "No local image selected",
    height: "Height",
    localDescription: "The selected image is uploaded when you save.",
    localTitle: "Local upload",
    preview: "Preview",
    previewEmpty: "Preview appears after choosing a file or entering a URL.",
    save: "Save",
    srcPlaceholder: "https://example.com/image.png",
    title: "Title",
    uploadTitle: "Insert image",
    width: "Width",
  },
  "zh-CN": {
    addViaUrl: "图片链接",
    alt: "替代文本",
    cancel: "取消",
    chooseFile: "选择图片",
    chooseFromLibrary: "从媒体库选择",
    clearFile: "清除已选图片",
    close: "关闭",
    description: "可以上传本机图片，也可以粘贴图片链接，并补充用于阅读体验的描述信息。",
    editDescription: "更新正文里这张图片的链接和描述信息。",
    editTitle: "编辑图片",
    fileEmpty: "还没有选择本机图片",
    height: "高度",
    localDescription: "保存时会自动上传已选择的图片。",
    localTitle: "本地上传",
    preview: "预览",
    previewEmpty: "选择文件或填写链接后会显示预览。",
    save: "保存",
    srcPlaceholder: "https://example.com/image.png",
    title: "标题",
    uploadTitle: "插入图片",
    width: "宽度",
  },
};

const getMdxImageDialogCopy = (language: string): MdxImageDialogCopy => {
  return normalizeLanguage(language) === "zh-CN"
    ? MDX_IMAGE_DIALOG_COPY["zh-CN"]
    : MDX_IMAGE_DIALOG_COPY.en;
};

const parseDimensionValue = (value: string): number | undefined => {
  return readImageDimension(value);
};

type MdxEditorImageDialogProps = {
  mediaLibraryFolderSlug?: string;
  mediaLibraryToken?: string;
  uploads?: readonly UploadProgress[];
};

const MdxImageDialogContext = createContext<MdxEditorImageDialogProps>({});

const MdxEditorImageDialog = () => {
  const {
    mediaLibraryFolderSlug,
    mediaLibraryToken,
    uploads = [],
  } = useContext(MdxImageDialogContext);
  const [
    imageAutocompleteSuggestions,
    imageDialogState,
    imageUploadHandler,
    allowSetImageDimensions,
  ] = useCellValues(
    imageAutocompleteSuggestions$,
    imageDialogState$,
    imageUploadHandler$,
    allowSetImageDimensions$,
  );
  const saveImage = usePublisher(saveImage$);
  const closeImageDialog = usePublisher(closeImageDialog$);
  const { i18n } = useTranslation();
  const copy = getMdxImageDialogCopy(i18n.resolvedLanguage ?? i18n.language);
  const fileInputId = useId();
  const sourceInputId = useId();
  const suggestionListId = useId();
  const altInputId = useId();
  const titleInputId = useId();
  const widthInputId = useId();
  const heightInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileList, setFileList] = useState<FileList>();
  const [filePreviewUrl, setFilePreviewUrl] = useState<string>();
  const [src, setSrc] = useState("");
  const [altText, setAltText] = useState("");
  const [title, setTitle] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const trimmedSrc = src.trim();
  const selectedFile = fileList?.item(0);
  const previewSource =
    filePreviewUrl ?? (trimmedSrc.length > 0 ? resolveAdminAssetUrl(trimmedSrc) : "");
  const hasUpload = imageUploadHandler !== null;
  const canUseMediaLibrary =
    mediaLibraryFolderSlug !== undefined && mediaLibraryToken !== undefined;
  const hasImageSource =
    selectedFile !== null && selectedFile !== undefined ? true : trimmedSrc.length > 0;
  const dialogTitle = imageDialogState.type === "editing" ? copy.editTitle : copy.uploadTitle;
  const dialogDescription =
    imageDialogState.type === "editing" ? copy.editDescription : copy.description;

  const resetImageForm = () => {
    setFileList(undefined);
    setSrc("");
    setAltText("");
    setTitle("");
    setWidth("");
    setHeight("");

    if (fileInputRef.current !== null) {
      fileInputRef.current.value = "";
    }
  };

  const closeDialog = () => {
    closeImageDialog();
    setIsMediaPickerOpen(false);
    resetImageForm();
  };

  useEffect(() => {
    if (imageDialogState.type === "editing") {
      setFileList(undefined);
      setSrc(imageDialogState.initialValues.src ?? "");
      setAltText(imageDialogState.initialValues.altText ?? "");
      setTitle(imageDialogState.initialValues.title ?? "");
      setWidth(
        imageDialogState.initialValues.width === undefined
          ? ""
          : String(imageDialogState.initialValues.width),
      );
      setHeight(
        imageDialogState.initialValues.height === undefined
          ? ""
          : String(imageDialogState.initialValues.height),
      );

      if (fileInputRef.current !== null) {
        fileInputRef.current.value = "";
      }

      return;
    }

    if (imageDialogState.type === "new") {
      resetImageForm();
    }
  }, [imageDialogState]);

  useEffect(() => {
    if (selectedFile === null || selectedFile === undefined) {
      setFilePreviewUrl(undefined);
      return undefined;
    }

    const nextPreviewUrl = URL.createObjectURL(selectedFile);
    setFilePreviewUrl(nextPreviewUrl);

    return () => {
      URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [selectedFile]);

  if (imageDialogState.type === "inactive") {
    return null;
  }

  const updateSelectedFile = (event: ChangeEvent<HTMLInputElement>) => {
    setFileList(event.currentTarget.files ?? undefined);
  };

  const clearSelectedFile = () => {
    setFileList(undefined);

    if (fileInputRef.current !== null) {
      fileInputRef.current.value = "";
    }
  };

  const selectMediaAsset = (asset: MediaAsset) => {
    clearSelectedFile();
    setSrc(asset.accessUrl);
    setIsMediaPickerOpen(false);
  };

  const submitImage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!hasImageSource) {
      return;
    }

    const imageValues: SaveImageParameters = {
      altText,
      title,
    };

    if (selectedFile !== null && selectedFile !== undefined && fileList !== undefined) {
      imageValues.file = fileList;
    } else {
      imageValues.src = trimmedSrc;
    }

    if (allowSetImageDimensions) {
      imageValues.width = parseDimensionValue(width);
      imageValues.height = parseDimensionValue(height);
    }

    saveImage(imageValues);
    resetImageForm();
  };

  return (
    <>
      <Dialog
        aria-label={dialogTitle}
        className="mdx-image-dialog-shell"
        isOpen
        maxHeight="calc(100dvh - 32px)"
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            closeDialog();
          }
        }}
        padding={0}
        purpose="form"
        variant="standard"
        width={520}
      >
        <form className="mdx-image-dialog" onSubmit={submitImage}>
          <HStack className="mdx-image-dialog__header" gap={3} hAlign="between" vAlign="start">
            <VStack className="mdx-image-dialog__title" gap={1}>
              <Heading level={2}>{dialogTitle}</Heading>
              <Text type="supporting" color="secondary">
                {dialogDescription}
              </Text>
            </VStack>
            <IconButton
              icon={<X size={16} />}
              label={copy.close}
              onClick={closeDialog}
              type="button"
              variant="ghost"
            />
          </HStack>

          <VStack className="mdx-image-dialog__body" gap={4}>
            <UploadProgressList
              language={normalizeLanguage(i18n.resolvedLanguage ?? i18n.language)}
              uploads={uploads}
            />
            {hasUpload && (
              <div className="mdx-image-dialog__upload-panel">
                <div className="mdx-image-dialog__upload-copy">
                  <HStack gap={2} vAlign="center">
                    <FileImage size={16} />
                    <Text weight="bold">{copy.localTitle}</Text>
                  </HStack>
                  <Text type="supporting" color="secondary">
                    {copy.localDescription}
                  </Text>
                </div>
                <div className="mdx-image-dialog__file-row">
                  <input
                    ref={fileInputRef}
                    accept="image/*"
                    aria-label={copy.chooseFile}
                    className="mdx-image-dialog__file-input"
                    id={fileInputId}
                    onChange={updateSelectedFile}
                    type="file"
                  />
                  <Button
                    icon={<ImagePlus size={16} />}
                    label={copy.chooseFile}
                    onClick={() => fileInputRef.current?.click()}
                    size="sm"
                    type="button"
                    variant="secondary"
                  />
                  {canUseMediaLibrary && (
                    <Button
                      icon={<Images size={16} />}
                      label={copy.chooseFromLibrary}
                      onClick={() => setIsMediaPickerOpen(true)}
                      size="sm"
                      type="button"
                      variant="secondary"
                    />
                  )}
                  <span className="mdx-image-dialog__file-name">
                    {selectedFile?.name ?? copy.fileEmpty}
                  </span>
                  {selectedFile !== null && selectedFile !== undefined && (
                    <IconButton
                      icon={<X size={14} />}
                      label={copy.clearFile}
                      onClick={clearSelectedFile}
                      size="sm"
                      type="button"
                      variant="ghost"
                    />
                  )}
                </div>
              </div>
            )}

            <div className="mdx-image-dialog__grid">
              <label
                className="mdx-image-dialog__field mdx-image-dialog__field--wide"
                htmlFor={sourceInputId}
              >
                <span>
                  <Link2 size={15} />
                  {copy.addViaUrl}
                </span>
                <input
                  autoComplete="off"
                  className="mdx-image-dialog__input"
                  id={sourceInputId}
                  inputMode="url"
                  list={imageAutocompleteSuggestions.length > 0 ? suggestionListId : undefined}
                  onChange={(event) => setSrc(event.currentTarget.value)}
                  placeholder={copy.srcPlaceholder}
                  type="text"
                  value={src}
                />
              </label>
              {imageAutocompleteSuggestions.length > 0 && (
                <datalist id={suggestionListId}>
                  {imageAutocompleteSuggestions.map((suggestion) => (
                    <option key={suggestion} value={suggestion} />
                  ))}
                </datalist>
              )}

              <label className="mdx-image-dialog__field" htmlFor={altInputId}>
                <span>{copy.alt}</span>
                <input
                  className="mdx-image-dialog__input"
                  id={altInputId}
                  onChange={(event) => setAltText(event.currentTarget.value)}
                  type="text"
                  value={altText}
                />
              </label>

              <label className="mdx-image-dialog__field" htmlFor={titleInputId}>
                <span>{copy.title}</span>
                <input
                  className="mdx-image-dialog__input"
                  id={titleInputId}
                  onChange={(event) => setTitle(event.currentTarget.value)}
                  type="text"
                  value={title}
                />
              </label>

              {allowSetImageDimensions && (
                <>
                  <label
                    className="mdx-image-dialog__field mdx-image-dialog__field--dimension"
                    htmlFor={widthInputId}
                  >
                    <span>{copy.width}</span>
                    <input
                      className="mdx-image-dialog__input"
                      id={widthInputId}
                      min={1}
                      max={MAX_ARTICLE_IMAGE_DIMENSION}
                      step={1}
                      onChange={(event) => setWidth(event.currentTarget.value)}
                      type="number"
                      value={width}
                    />
                  </label>

                  <label
                    className="mdx-image-dialog__field mdx-image-dialog__field--dimension"
                    htmlFor={heightInputId}
                  >
                    <span>{copy.height}</span>
                    <input
                      className="mdx-image-dialog__input"
                      id={heightInputId}
                      min={1}
                      max={MAX_ARTICLE_IMAGE_DIMENSION}
                      step={1}
                      onChange={(event) => setHeight(event.currentTarget.value)}
                      type="number"
                      value={height}
                    />
                  </label>
                </>
              )}
            </div>

            <div className="mdx-image-dialog__preview">
              <Text weight="bold">{copy.preview}</Text>
              {previewSource.length > 0 ? (
                <img alt={altText || title || copy.preview} src={previewSource} />
              ) : (
                <Text type="supporting" color="secondary">
                  {copy.previewEmpty}
                </Text>
              )}
            </div>
          </VStack>

          <HStack className="mdx-image-dialog__footer" gap={2} hAlign="end" wrap="wrap">
            <Button label={copy.cancel} onClick={closeDialog} type="button" variant="ghost" />
            <Button
              icon={<Save size={16} />}
              isDisabled={!hasImageSource}
              label={copy.save}
              type="submit"
              variant="primary"
            />
          </HStack>
        </form>
      </Dialog>
      {canUseMediaLibrary && (
        <MediaPickerDialog
          folderSlug={mediaLibraryFolderSlug}
          isMulti={false}
          isOpen={isMediaPickerOpen}
          onClose={() => setIsMediaPickerOpen(false)}
          onSelect={selectMediaAsset}
          selectedValues={trimmedSrc.length > 0 ? [trimmedSrc] : []}
          token={mediaLibraryToken}
        />
      )}
    </>
  );
};

type MdxLinkDialogCopy = {
  cancel: string;
  close: string;
  copied: string;
  copy: string;
  createDescription: string;
  createTitle: string;
  edit: string;
  editDescription: string;
  editTitle: string;
  open: string;
  preview: string;
  remove: string;
  save: string;
  text: string;
  textPlaceholder: string;
  title: string;
  titlePlaceholder: string;
  url: string;
  urlPlaceholder: string;
};

const MDX_LINK_DIALOG_COPY: Record<"en" | "zh-CN", MdxLinkDialogCopy> = {
  en: {
    cancel: "Cancel",
    close: "Close",
    copied: "Copied",
    copy: "Copy link",
    createDescription: "Paste a URL, then add optional text and hover title for the article.",
    createTitle: "Insert link",
    edit: "Edit",
    editDescription: "Update the URL, display text, or title for this link.",
    editTitle: "Edit link",
    open: "Open link",
    preview: "Preview",
    remove: "Remove link",
    save: "Save link",
    text: "Link text",
    textPlaceholder: "Text shown in the article",
    title: "Link title",
    titlePlaceholder: "Optional hover title",
    url: "URL",
    urlPlaceholder: "https://example.com",
  },
  "zh-CN": {
    cancel: "取消",
    close: "关闭",
    copied: "已复制",
    copy: "复制链接",
    createDescription: "粘贴链接地址，并按需补充正文里显示的文字和悬停标题。",
    createTitle: "插入链接",
    edit: "编辑",
    editDescription: "更新这个链接的地址、显示文字或悬停标题。",
    editTitle: "编辑链接",
    open: "打开链接",
    preview: "预览",
    remove: "移除链接",
    save: "保存链接",
    text: "链接文字",
    textPlaceholder: "正文里显示的文字",
    title: "链接标题",
    titlePlaceholder: "鼠标悬停时显示，可选",
    url: "链接地址",
    urlPlaceholder: "https://example.com",
  },
};

const getMdxLinkDialogCopy = (language: string): MdxLinkDialogCopy => {
  return normalizeLanguage(language) === "zh-CN"
    ? MDX_LINK_DIALOG_COPY["zh-CN"]
    : MDX_LINK_DIALOG_COPY.en;
};

const MdxEditorLinkDialog = () => {
  const [linkDialogState] = useCellValues(linkDialogState$);
  const updateLink = usePublisher(updateLink$);
  const cancelLinkEdit = usePublisher(cancelLinkEdit$);
  const switchFromPreviewToLinkEdit = usePublisher(switchFromPreviewToLinkEdit$);
  const removeLink = usePublisher(removeLink$);
  const { i18n } = useTranslation();
  const copy = getMdxLinkDialogCopy(i18n.resolvedLanguage ?? i18n.language);
  const urlInputId = useId();
  const textInputId = useId();
  const titleInputId = useId();
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const trimmedUrl = linkUrl.trim();
  const isEditingLink = linkDialogState.type === "edit" && linkDialogState.initialUrl.length > 0;
  const dialogTitle = isEditingLink ? copy.editTitle : copy.createTitle;
  const dialogDescription = isEditingLink ? copy.editDescription : copy.createDescription;

  useEffect(() => {
    if (linkDialogState.type !== "edit") {
      return;
    }

    setLinkUrl(linkDialogState.url);
    setLinkText(linkDialogState.text);
    setLinkTitle(linkDialogState.title);
  }, [linkDialogState]);

  useEffect(() => {
    setIsCopied(false);
  }, [linkDialogState]);

  if (linkDialogState.type === "inactive") {
    return <></>;
  }

  const closeDialog = () => {
    if (linkDialogState.type === "edit") {
      cancelLinkEdit();
    }
  };

  const submitLink = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (linkDialogState.type !== "edit" || getSafeLinkUrl(trimmedUrl) === undefined) {
      return;
    }

    updateLink({
      text: linkDialogState.withAnchorText ? linkText.trim() : undefined,
      title: linkTitle.trim(),
      url: trimmedUrl,
    });
  };

  if (linkDialogState.type === "preview") {
    const previewStyle = {
      left: linkDialogState.rectangle.left,
      top: linkDialogState.rectangle.top + linkDialogState.rectangle.height + 8,
    };

    return (
      <div className="mdx-link-preview-popover" style={previewStyle}>
        <a
          className="mdx-link-preview-popover__link"
          href={getSafeLinkUrl(linkDialogState.url)}
          rel="noreferrer"
          target="_blank"
          title={linkDialogState.title || linkDialogState.url}
        >
          <span>{linkDialogState.url}</span>
          <ExternalLink size={14} />
        </a>
        <HStack gap={1} vAlign="center">
          <IconButton
            icon={<Pencil size={14} />}
            label={copy.edit}
            onClick={() => switchFromPreviewToLinkEdit()}
            size="sm"
            type="button"
            variant="ghost"
          />
          <IconButton
            icon={<Copy size={14} />}
            label={isCopied ? copy.copied : copy.copy}
            onClick={() => {
              void navigator.clipboard.writeText(linkDialogState.url).then(() => {
                setIsCopied(true);
              });
            }}
            size="sm"
            type="button"
            variant="ghost"
          />
          <IconButton
            icon={<Unlink size={14} />}
            label={copy.remove}
            onClick={() => removeLink()}
            size="sm"
            type="button"
            variant="ghost"
          />
        </HStack>
      </div>
    );
  }

  return (
    <Dialog
      aria-label={dialogTitle}
      className="mdx-link-dialog-shell"
      isOpen
      maxHeight="calc(100dvh - 32px)"
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          closeDialog();
        }
      }}
      padding={0}
      purpose="form"
      variant="standard"
      width={460}
    >
      <form className="mdx-link-dialog" onSubmit={submitLink}>
        <HStack className="mdx-link-dialog__header" gap={3} hAlign="between" vAlign="start">
          <VStack className="mdx-link-dialog__title" gap={1}>
            <HStack gap={2} vAlign="center">
              <Link2 size={18} />
              <Heading level={2}>{dialogTitle}</Heading>
            </HStack>
            <Text type="supporting" color="secondary">
              {dialogDescription}
            </Text>
          </VStack>
          <IconButton
            icon={<X size={16} />}
            label={copy.close}
            onClick={closeDialog}
            type="button"
            variant="ghost"
          />
        </HStack>

        <VStack className="mdx-link-dialog__body" gap={4}>
          <div className="mdx-link-dialog__grid">
            <label
              className="mdx-link-dialog__field mdx-link-dialog__field--wide"
              htmlFor={urlInputId}
            >
              <span>{copy.url}</span>
              <input
                autoComplete="off"
                autoFocus
                className="mdx-link-dialog__input"
                id={urlInputId}
                inputMode="url"
                onChange={(event) => setLinkUrl(event.currentTarget.value)}
                placeholder={copy.urlPlaceholder}
                type="text"
                value={linkUrl}
              />
            </label>

            {linkDialogState.withAnchorText && (
              <label className="mdx-link-dialog__field" htmlFor={textInputId}>
                <span>{copy.text}</span>
                <input
                  className="mdx-link-dialog__input"
                  id={textInputId}
                  onChange={(event) => setLinkText(event.currentTarget.value)}
                  placeholder={copy.textPlaceholder}
                  type="text"
                  value={linkText}
                />
              </label>
            )}

            <label
              className={
                linkDialogState.withAnchorText
                  ? "mdx-link-dialog__field"
                  : "mdx-link-dialog__field mdx-link-dialog__field--wide"
              }
              htmlFor={titleInputId}
            >
              <span>{copy.title}</span>
              <input
                className="mdx-link-dialog__input"
                id={titleInputId}
                onChange={(event) => setLinkTitle(event.currentTarget.value)}
                placeholder={copy.titlePlaceholder}
                type="text"
                value={linkTitle}
              />
            </label>
          </div>

          <div className="mdx-link-dialog__preview">
            <Text weight="bold">{copy.preview}</Text>
            {trimmedUrl.length > 0 ? (
              <a href={getSafeLinkUrl(trimmedUrl)} rel="noreferrer" target="_blank">
                <span>{linkText.trim() || linkTitle.trim() || trimmedUrl}</span>
                <ExternalLink size={14} />
              </a>
            ) : (
              <Text type="supporting" color="secondary">
                {copy.urlPlaceholder}
              </Text>
            )}
          </div>
        </VStack>

        <HStack className="mdx-link-dialog__footer" gap={2} hAlign="end" wrap="wrap">
          <Button label={copy.cancel} onClick={closeDialog} type="button" variant="ghost" />
          <Button
            icon={<Save size={16} />}
            isDisabled={getSafeLinkUrl(trimmedUrl) === undefined}
            label={copy.save}
            type="submit"
            variant="primary"
          />
        </HStack>
      </form>
    </Dialog>
  );
};

const MdxEditorToolbar = () => (
  <DiffSourceToggleWrapper options={["rich-text", "source", "diff"]}>
    <UndoRedo />
    <Separator />
    <BlockTypeSelect />
    <BoldItalicUnderlineToggles />
    <CodeToggle />
    <Separator />
    <CreateLink />
    <InsertImage />
    <InsertTable />
    <InsertThematicBreak />
    <Separator />
    <ListsToggle />
    <InsertCodeBlock />
  </DiffSourceToggleWrapper>
);

type MdxEditorFieldProps = {
  uploads?: readonly UploadProgress[];
  "aria-label"?: string;
  className?: string;
  imageUploadHandler: ImageUploadHandler;
  mediaLibraryFolderSlug?: string;
  mediaLibraryToken?: string;
  onChange?: (markdown: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  value: string;
};

export function MdxEditorField({
  uploads,
  "aria-label": ariaLabel,
  className,
  imageUploadHandler,
  mediaLibraryFolderSlug,
  mediaLibraryToken,
  onChange,
  placeholder,
  readOnly = false,
  value,
}: MdxEditorFieldProps) {
  const { i18n, t } = useTranslation();
  const language = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  const editorRef = useRef<MDXEditorMethods>(null);
  const lastAppliedValueRef = useRef(value);
  const fieldClassName = ["mdx-editor-field", readOnly ? "is-read-only" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  const translation = language === "zh-CN" ? mdxEditorChineseTranslation : undefined;
  const resolvedAriaLabel = ariaLabel ?? t("admin.contentManagement.editor.defaultMdxAria");
  const resolvedPlaceholder = placeholder ?? t("admin.contentManagement.placeholders.writeMdx");

  useEffect(() => {
    if (value === lastAppliedValueRef.current) {
      return;
    }

    editorRef.current?.setMarkdown(value);
    lastAppliedValueRef.current = value;
  }, [value]);

  return (
    <MdxImageDialogContext.Provider value={{ mediaLibraryFolderSlug, mediaLibraryToken, uploads }}>
      <div
        aria-disabled={readOnly}
        aria-label={resolvedAriaLabel}
        className={fieldClassName}
        role="group"
      >
        <MDXEditor
          className="mdx-editor-field__editor"
          contentEditableClassName="mdx-editor-field__content"
          key={language}
          markdown={value}
          onChange={(markdown) => {
            lastAppliedValueRef.current = markdown;
            onChange?.(markdown);
          }}
          placeholder={resolvedPlaceholder}
          plugins={[
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            thematicBreakPlugin(),
            linkPlugin(),
            linkDialogPlugin({
              LinkDialog: MdxEditorLinkDialog,
              showLinkTitleField: true,
            }),
            imagePlugin({
              disableImageResize: false,
              allowSetImageDimensions: true,
              ImageDialog: MdxEditorImageDialog,
              imageUploadHandler,
            }),
            tablePlugin(),
            frontmatterPlugin(),
            codeBlockPlugin({ defaultCodeBlockLanguage: "ts" }),
            codeMirrorPlugin({
              autoLoadLanguageSupport: false,
              codeBlockLanguages: {
                bash: "Shell",
                css: "CSS",
                html: "HTML",
                js: "JavaScript",
                json: "JSON",
                mdx: "MDX",
                ts: "TypeScript",
                tsx: "TSX",
                typescript: "TypeScript",
              },
            }),
            jsxPlugin({
              allowFragment: false,
              jsxComponentDescriptors: mdxJsxComponentDescriptors,
            }),
            diffSourcePlugin({ diffMarkdown: value, viewMode: "rich-text" }),
            markdownShortcutPlugin(),
            toolbarPlugin({
              toolbarClassName: "mdx-editor-field__toolbar",
              toolbarContents: MdxEditorToolbar,
            }),
          ]}
          readOnly={readOnly}
          ref={editorRef}
          suppressHtmlProcessing
          translation={translation}
        />
      </div>
    </MdxImageDialogContext.Provider>
  );
}
