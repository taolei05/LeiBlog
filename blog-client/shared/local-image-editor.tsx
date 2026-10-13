import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Image as ImageIcon, RotateCcw, UserCircle, X } from "lucide-react";

import { Button } from "@astryxdesign/core/Button";
import { Dialog } from "@astryxdesign/core/Dialog";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";

import type { CropPosition, CropSize } from "./local-image-editor-math";
import {
  clampNumber,
  constrainCropPosition,
  getContainedSize,
  getMinimumScale,
  getWheelScale,
  readRangeNumber,
} from "./local-image-editor-math";
import "./local-image-editor.css";

export type LocalImageEditorKind = "article-cover" | "avatar";

type LocalImageEditorConfig = {
  aspectRatio: number;
  defaultScale: number;
  maxScale: number;
  outputHeight: number;
  outputWidth: number;
  suffix: string;
};

type DragState = {
  originX: number;
  originY: number;
  pointerId: number;
  startX: number;
  startY: number;
};

type GetLocalImageEditorKindParameters = {
  file: File;
  folderSlug: string;
};

const EDITOR_CONFIG: Record<LocalImageEditorKind, LocalImageEditorConfig> = {
  "article-cover": {
    aspectRatio: 16 / 9,
    defaultScale: 1,
    maxScale: 4,
    outputHeight: 900,
    outputWidth: 1600,
    suffix: "cover",
  },
  avatar: {
    aspectRatio: 1,
    defaultScale: 1.2,
    maxScale: 4,
    outputHeight: 512,
    outputWidth: 512,
    suffix: "avatar",
  },
};

const INITIAL_POSITION: CropPosition = { x: 0, y: 0 };
const EMPTY_SIZE: CropSize = { height: 0, width: 0 };
const RANGE_STEP = 0.01;
const ROTATION_STEP = 1;
const WHEEL_ZOOM_SENSITIVITY = 0.003;
const JPEG_BACKGROUND = "#ffffff";
const LOADING_IMAGE_STYLE: CSSProperties = {
  height: 1,
  left: 0,
  opacity: 0,
  top: 0,
  width: 1,
};

export const canEditLocalImageFile = (file: File) => {
  const lowerName = file.name.toLocaleLowerCase();

  return (
    file.type.startsWith("image/") &&
    file.type !== "image/svg+xml" &&
    file.type !== "image/x-icon" &&
    !lowerName.endsWith(".svg") &&
    !lowerName.endsWith(".ico")
  );
};

export const getLocalImageEditorKind = ({
  file,
  folderSlug,
}: GetLocalImageEditorKindParameters): LocalImageEditorKind | undefined => {
  if (!canEditLocalImageFile(file)) {
    return undefined;
  }

  if (folderSlug === "avatars") {
    return "avatar";
  }

  if (folderSlug === "article-covers") {
    return "article-cover";
  }

  return undefined;
};

const getCanvasMimeType = (file: File, kind: LocalImageEditorKind) => {
  if (kind === "avatar") {
    return "image/png";
  }

  if (file.type === "image/jpeg" || file.type === "image/webp") {
    return file.type;
  }

  return "image/png";
};

const getFileExtension = (mimeType: string) => {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  return "png";
};

const createEditedFileName = ({
  file,
  mimeType,
  suffix,
}: {
  file: File;
  mimeType: string;
  suffix: string;
}) => {
  const dotIndex = file.name.lastIndexOf(".");
  const stem = dotIndex > 0 ? file.name.slice(0, dotIndex) : file.name;

  return `${stem}-${suffix}.${getFileExtension(mimeType)}`;
};

const canvasToBlob = (canvas: HTMLCanvasElement, mimeType: string) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) {
          reject(new Error("image-crop-failed"));
          return;
        }

        resolve(blob);
      },
      mimeType,
      0.92,
    );
  });

const getCropSize = ({ kind, stageSize }: { kind: LocalImageEditorKind; stageSize: CropSize }) => {
  if (stageSize.width <= 0 || stageSize.height <= 0) {
    return EMPTY_SIZE;
  }

  if (kind === "avatar") {
    const availableSize = Math.max(144, Math.min(stageSize.width, stageSize.height) - 48);
    const size = Math.min(320, availableSize);

    return { height: size, width: size };
  }

  const aspectRatio = EDITOR_CONFIG[kind].aspectRatio;
  const availableWidth = Math.max(180, stageSize.width - 48);
  const availableHeight = Math.max(120, stageSize.height - 48);
  const width = Math.min(availableWidth, availableHeight * aspectRatio);

  return {
    height: width / aspectRatio,
    width,
  };
};

type LocalImageEditorDialogProps = {
  file?: File;
  isOpen: boolean;
  kind: LocalImageEditorKind;
  onApply: (file: File) => void;
  onCancel: () => void;
};

export const LocalImageEditorDialog = ({
  file,
  isOpen,
  kind,
  onApply,
  onCancel,
}: LocalImageEditorDialogProps) => {
  const { t } = useTranslation();
  const config = EDITOR_CONFIG[kind];
  const imageRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [imageUrl, setImageUrl] = useState<string>();
  const [imageSize, setImageSize] = useState<CropSize>();
  const [stageSize, setStageSize] = useState<CropSize>(EMPTY_SIZE);
  const [position, setPosition] = useState<CropPosition>(INITIAL_POSITION);
  const [scale, setScale] = useState(config.defaultScale);
  const [rotation, setRotation] = useState(0);
  const [dragState, setDragState] = useState<DragState>();
  const [message, setMessage] = useState<string>();
  const [isApplying, setIsApplying] = useState(false);
  const title = t(`imageEditor.${kind === "avatar" ? "avatarTitle" : "coverTitle"}`);
  const cropSize = useMemo(() => getCropSize({ kind, stageSize }), [kind, stageSize]);
  const imageDisplaySize = useMemo(
    () =>
      imageSize === undefined
        ? undefined
        : getContainedSize({ source: imageSize, target: stageSize }),
    [imageSize, stageSize],
  );
  const minimumScale = getMinimumScale({ cropSize, imageDisplaySize, rotation });
  const maximumScale = Math.max(config.maxScale, minimumScale + 1);
  const isVisible = isOpen && file !== undefined;

  useEffect(() => {
    if (file === undefined) {
      setImageUrl(undefined);
      return undefined;
    }

    const objectUrl = URL.createObjectURL(file);
    setImageUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  useEffect(() => {
    setImageSize(undefined);
    setPosition(INITIAL_POSITION);
    setScale(config.defaultScale);
    setRotation(0);
    setMessage(undefined);
    setIsApplying(false);
  }, [config.defaultScale, file, kind]);

  useEffect(() => {
    if (!isVisible) {
      return undefined;
    }

    const stageElement = stageRef.current;
    if (stageElement === null) {
      return undefined;
    }

    const updateStageSize = () => {
      setStageSize({
        height: stageElement.clientHeight,
        width: stageElement.clientWidth,
      });
    };

    updateStageSize();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateStageSize);
      return () => {
        window.removeEventListener("resize", updateStageSize);
      };
    }

    const resizeObserver = new ResizeObserver(updateStageSize);
    resizeObserver.observe(stageElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isVisible]);

  useEffect(() => {
    setScale((currentScale) => Math.max(currentScale, minimumScale, config.defaultScale));
  }, [config.defaultScale, minimumScale]);

  const imageStyle: CSSProperties | undefined =
    imageDisplaySize === undefined
      ? undefined
      : {
          height: imageDisplaySize.height,
          left: (stageSize.width - imageDisplaySize.width) / 2,
          top: (stageSize.height - imageDisplaySize.height) / 2,
          transform: `translate3d(${position.x}px, ${position.y}px, 0) rotate(${rotation}deg) scale(${scale})`,
          width: imageDisplaySize.width,
        };
  const isEditorReady = imageUrl !== undefined && imageStyle !== undefined;

  const cropStyle: CSSProperties = {
    height: cropSize.height,
    width: cropSize.width,
  };

  const constrainEditorPosition = (
    nextPosition: CropPosition,
    nextScale = scale,
    nextRotation = rotation,
  ) =>
    constrainCropPosition({
      cropSize,
      imageDisplaySize,
      position: nextPosition,
      rotation: nextRotation,
      scale: nextScale,
    });

  useEffect(() => {
    if (!isEditorReady) {
      return;
    }

    setPosition((currentPosition) => {
      const nextPosition = constrainEditorPosition(currentPosition);
      return nextPosition.x === currentPosition.x && nextPosition.y === currentPosition.y
        ? currentPosition
        : nextPosition;
    });
  }, [cropSize, imageDisplaySize, isEditorReady, rotation, scale]);

  const updateScale = (value: string) => {
    const nextScale = clampNumber({
      max: maximumScale,
      min: minimumScale,
      value: readRangeNumber(value, scale),
    });

    setScale(nextScale);
    setPosition((currentPosition) => constrainEditorPosition(currentPosition, nextScale, rotation));
  };

  const updateRotation = (value: string) => {
    const nextRotation = clampNumber({ max: 360, min: 0, value: readRangeNumber(value, rotation) });

    setRotation(nextRotation);
    setPosition((currentPosition) => constrainEditorPosition(currentPosition, scale, nextRotation));
  };

  const resetEditor = () => {
    setPosition(INITIAL_POSITION);
    setScale(Math.max(config.defaultScale, minimumScale));
    setRotation(0);
    setMessage(undefined);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isEditorReady) {
      return;
    }

    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      originX: position.x,
      originY: position.y,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    });
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragState === undefined || dragState.pointerId !== event.pointerId) {
      return;
    }

    setPosition(
      constrainEditorPosition({
        x: dragState.originX + event.clientX - dragState.startX,
        y: dragState.originY + event.clientY - dragState.startY,
      }),
    );
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragState === undefined || dragState.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setDragState(undefined);
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!isEditorReady) {
      return;
    }

    event.preventDefault();
    const nextScale = getWheelScale({
      currentScale: scale,
      deltaY: event.deltaY,
      maxScale: maximumScale,
      minScale: minimumScale,
      sensitivity: WHEEL_ZOOM_SENSITIVITY,
    });

    setScale(nextScale);
    setPosition((currentPosition) => constrainEditorPosition(currentPosition, nextScale, rotation));
  };

  const createEditedFile = async () => {
    const image = imageRef.current;
    if (
      file === undefined ||
      image === null ||
      imageDisplaySize === undefined ||
      cropSize.width <= 0 ||
      cropSize.height <= 0
    ) {
      throw new Error(t("imageEditor.cropFailed"));
    }

    const mimeType = getCanvasMimeType(file, kind);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error(t("imageEditor.unsupported"));
    }

    canvas.width = config.outputWidth;
    canvas.height = config.outputHeight;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    if (mimeType === "image/jpeg") {
      context.fillStyle = JPEG_BACKGROUND;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    context.translate(canvas.width / 2, canvas.height / 2);
    context.scale(canvas.width / cropSize.width, canvas.height / cropSize.height);
    context.translate(position.x, position.y);
    context.rotate((rotation * Math.PI) / 180);
    context.scale(scale, scale);
    context.drawImage(
      image,
      -imageDisplaySize.width / 2,
      -imageDisplaySize.height / 2,
      imageDisplaySize.width,
      imageDisplaySize.height,
    );

    const blob = await canvasToBlob(canvas, mimeType);

    return new File([blob], createEditedFileName({ file, mimeType, suffix: config.suffix }), {
      lastModified: Date.now(),
      type: mimeType,
    });
  };

  const applyEditedImage = async () => {
    setMessage(undefined);
    setIsApplying(true);

    try {
      const editedFile = await createEditedFile();
      onApply(editedFile);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("imageEditor.cropFailed"));
    } finally {
      setIsApplying(false);
    }
  };

  const applyOriginalImage = () => {
    if (file === undefined) {
      return;
    }

    onApply(file);
  };

  return (
    <Dialog
      aria-label={title}
      isOpen={isVisible}
      maxHeight="90dvh"
      onOpenChange={(nextIsOpen) => {
        if (!nextIsOpen) {
          onCancel();
        }
      }}
      padding={4}
      variant="standard"
      width={760}
    >
      <VStack gap={4} className="local-image-editor">
        <HStack gap={3} hAlign="between" vAlign="start">
          <HStack gap={3} className="local-image-editor__header" vAlign="start">
            {kind === "avatar" ? <UserCircle size={18} /> : <ImageIcon size={18} />}
            <VStack gap={1}>
              <Heading level={2}>{title}</Heading>
              <Text type="supporting" color="secondary">
                {t(`imageEditor.${kind === "avatar" ? "avatarDescription" : "coverDescription"}`)}
              </Text>
            </VStack>
          </HStack>
          <Button
            icon={<X size={16} />}
            label={t("actions.close")}
            onClick={onCancel}
            variant="ghost"
          />
        </HStack>

        <div
          aria-busy={!isEditorReady}
          className={`local-image-editor__stage local-image-editor__stage--${kind} ${
            isEditorReady ? "is-ready" : "is-loading"
          }`}
          onPointerCancel={handlePointerEnd}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onWheel={handleWheel}
          ref={stageRef}
          role="presentation"
        >
          {imageUrl !== undefined ? (
            <img
              alt=""
              className="local-image-editor__image"
              draggable={false}
              onError={() => setMessage(t("imageEditor.loadFailed"))}
              onLoad={(event) => {
                setImageSize({
                  height: event.currentTarget.naturalHeight,
                  width: event.currentTarget.naturalWidth,
                });
              }}
              ref={imageRef}
              src={imageUrl}
              style={imageStyle ?? LOADING_IMAGE_STYLE}
            />
          ) : null}
          {!isEditorReady ? (
            <div className="local-image-editor__empty">
              <Text color="secondary" type="supporting">
                {t("imageEditor.loading")}
              </Text>
            </div>
          ) : null}
          <div className="local-image-editor__overlay">
            <div
              className={`local-image-editor__crop local-image-editor__crop--${kind}`}
              style={cropStyle}
            />
          </div>
        </div>
        <Text as="p" className="local-image-editor__hint" color="secondary" type="supporting">
          {t("imageEditor.dragHint")}
        </Text>

        <div className="local-image-editor__controls">
          <label className="local-image-editor__control">
            <span className="local-image-editor__control-heading">
              <span>{t("imageEditor.zoom")}</span>
              <span>{scale.toFixed(2)}</span>
            </span>
            <input
              aria-label={t("imageEditor.zoom")}
              className="local-image-editor__range"
              disabled={!isEditorReady}
              max={maximumScale}
              min={minimumScale}
              onChange={(event) => updateScale(event.currentTarget.value)}
              step={RANGE_STEP}
              type="range"
              value={scale}
            />
          </label>
          <label className="local-image-editor__control">
            <span className="local-image-editor__control-heading">
              <span>{t("imageEditor.rotation")}</span>
              <span>{Math.round(rotation)}</span>
            </span>
            <input
              aria-label={t("imageEditor.rotation")}
              className="local-image-editor__range"
              disabled={!isEditorReady}
              max={360}
              min={0}
              onChange={(event) => updateRotation(event.currentTarget.value)}
              step={ROTATION_STEP}
              type="range"
              value={rotation}
            />
          </label>
        </div>

        {message === undefined ? null : (
          <Text as="p" className="local-image-editor__message" type="supporting">
            {message}
          </Text>
        )}

        <HStack className="local-image-editor__actions" gap={2} hAlign="end" wrap="wrap">
          <Button
            isDisabled={isApplying}
            label={t("actions.cancel")}
            onClick={onCancel}
            variant="secondary"
          />
          <Button
            icon={<RotateCcw size={16} />}
            isDisabled={isApplying || !isEditorReady}
            label={t("imageEditor.reset")}
            onClick={resetEditor}
            variant="ghost"
          />
          <Button
            isDisabled={isApplying}
            label={t("imageEditor.original")}
            onClick={applyOriginalImage}
            variant="secondary"
          />
          <Button
            icon={<CheckCircle2 size={16} />}
            isDisabled={!isEditorReady}
            isLoading={isApplying}
            label={isApplying ? t("imageEditor.applying") : t("imageEditor.apply")}
            onClick={() => {
              void applyEditedImage();
            }}
            variant="primary"
          />
        </HStack>
      </VStack>
    </Dialog>
  );
};
