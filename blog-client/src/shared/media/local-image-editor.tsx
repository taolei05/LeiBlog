import { Button, Label, Modal, Slider } from "@heroui/react";
import type { SyntheticEvent } from "react";
import { useEffect, useRef, useState } from "react";
import AvatarEditor, { useAvatarEditor } from "react-avatar-editor";
import type { Crop, PixelCrop } from "react-image-crop";
import ReactCrop, { centerCrop, convertToPixelCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

import { AppIcon } from "../icons";

export type LocalImageEditorKind = "article-cover" | "avatar";

type LocalImageEditorDialogProps = {
  file: File | null;
  isOpen: boolean;
  kind: LocalImageEditorKind;
  onApply: (file: File) => void;
  onCancel: () => void;
};

const coverAspect = 16 / 9;
const maxCoverWidth = 1600;
const desktopAvatarEditorSize = 320;
const mobileAvatarEditorSize = 240;

function centerCoverCrop(mediaWidth: number, mediaHeight: number) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: 92,
      },
      coverAspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  );
}

function readSliderNumber(value: number | number[], fallback: number) {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }

  return value;
}

function getCanvasMimeType(file: File) {
  if (file.type === "image/jpeg" || file.type === "image/webp") {
    return file.type;
  }

  return "image/png";
}

function getFileExtension(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";

  return "png";
}

function getEditedFileName(file: File, mimeType: string, suffix: string) {
  const dotIndex = file.name.lastIndexOf(".");
  const stem = dotIndex > 0 ? file.name.slice(0, dotIndex) : file.name;

  return `${stem}-${suffix}.${getFileExtension(mimeType)}`;
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("图片处理失败，请重新选择图片"));
          return;
        }

        resolve(blob);
      },
      mimeType,
      0.92,
    );
  });
}

function createFileFromBlob(file: File, blob: Blob, suffix: string) {
  const mimeType = blob.type || getCanvasMimeType(file);

  return new File([blob], getEditedFileName(file, mimeType, suffix), {
    lastModified: Date.now(),
    type: mimeType,
  });
}

function getAvatarEditorSize() {
  if (typeof window === "undefined") {
    return desktopAvatarEditorSize;
  }

  if (window.innerWidth > 640) {
    return desktopAvatarEditorSize;
  }

  const availableWidth = window.innerWidth - 128;
  const availableHeight = window.innerHeight - 520;

  return Math.round(
    Math.max(216, Math.min(mobileAvatarEditorSize, availableWidth, availableHeight)),
  );
}

function getAvatarEditorBorder(size: number) {
  return Math.max(20, Math.round(size * 0.1));
}

export function LocalImageEditorDialog({
  file,
  isOpen,
  kind,
  onApply,
  onCancel,
}: LocalImageEditorDialogProps) {
  const avatarEditor = useAvatarEditor();
  const coverImageRef = useRef<HTMLImageElement | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [coverCrop, setCoverCrop] = useState<Crop>();
  const [completedCoverCrop, setCompletedCoverCrop] = useState<PixelCrop | null>(null);
  const [avatarScale, setAvatarScale] = useState(1.2);
  const [avatarRotate, setAvatarRotate] = useState(0);
  const [avatarEditorSize, setAvatarEditorSize] = useState(getAvatarEditorSize);
  const [message, setMessage] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (!file) {
      setImageUrl("");
      return undefined;
    }

    const nextImageUrl = URL.createObjectURL(file);
    setImageUrl(nextImageUrl);

    return () => URL.revokeObjectURL(nextImageUrl);
  }, [file]);

  useEffect(() => {
    setCoverCrop(undefined);
    setCompletedCoverCrop(null);
    setAvatarScale(1.2);
    setAvatarRotate(0);
    setMessage("");
  }, [file, kind]);

  useEffect(() => {
    function updateAvatarEditorSize() {
      setAvatarEditorSize(getAvatarEditorSize());
    }

    updateAvatarEditorSize();
    window.addEventListener("resize", updateAvatarEditorSize);

    return () => window.removeEventListener("resize", updateAvatarEditorSize);
  }, []);

  function handleCoverImageLoad(event: SyntheticEvent<HTMLImageElement>) {
    const image = event.currentTarget;
    const nextCrop = centerCoverCrop(image.width, image.height);

    setCoverCrop(nextCrop);
    setCompletedCoverCrop(convertToPixelCrop(nextCrop, image.width, image.height));
  }

  async function createCoverFile() {
    if (!file) return null;

    const image = coverImageRef.current;
    const crop = completedCoverCrop;
    if (!image || !crop || crop.width <= 0 || crop.height <= 0) {
      setMessage("请先选择封面裁剪区域");
      return null;
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const sourceX = crop.x * scaleX;
    const sourceY = crop.y * scaleY;
    const sourceWidth = crop.width * scaleX;
    const sourceHeight = crop.height * scaleY;
    const outputWidth = Math.max(1, Math.round(Math.min(maxCoverWidth, sourceWidth)));
    const outputHeight = Math.max(1, Math.round(outputWidth / coverAspect));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      setMessage("浏览器不支持图片裁剪");
      return null;
    }

    canvas.width = outputWidth;
    canvas.height = outputHeight;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      outputWidth,
      outputHeight,
    );

    const blob = await canvasToBlob(canvas, getCanvasMimeType(file));

    return createFileFromBlob(file, blob, "cover");
  }

  async function createAvatarFile() {
    if (!file) return null;

    const canvas = avatarEditor.getImageScaledToCanvas();
    if (!canvas) {
      setMessage("头像编辑器尚未准备好，请稍后再试");
      return null;
    }

    const blob = await canvasToBlob(canvas, "image/png");

    return createFileFromBlob(file, blob, "avatar");
  }

  async function applyEditedImage() {
    setMessage("");
    setIsApplying(true);

    try {
      const nextFile = kind === "avatar" ? await createAvatarFile() : await createCoverFile();
      if (!nextFile) return;

      onApply(nextFile);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "图片处理失败");
    } finally {
      setIsApplying(false);
    }
  }

  function applyOriginalImage() {
    if (!file) {
      return;
    }

    onApply(file);
  }

  const title = kind === "avatar" ? "编辑头像" : "编辑文章封面";
  const description =
    kind === "avatar"
      ? "本地头像上传前可以缩放、拖拽和旋转，确认后再上传到头像文件夹。"
      : "本地封面上传前会按 16:9 裁剪，确认后再上传到文章封面文件夹。";
  const avatarEditorBorder = getAvatarEditorBorder(avatarEditorSize);

  return (
    <Modal.Backdrop
      isOpen={isOpen && file !== null}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
      variant="blur"
    >
      <Modal.Container placement="center" scroll="inside" size="lg">
        <Modal.Dialog className="local-image-editor-dialog">
          <div className="admin-form-modal local-image-editor">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon>
                <AppIcon name={kind === "avatar" ? "personCircle" : "image"} />
              </Modal.Icon>
              <div>
                <Modal.Heading>{title}</Modal.Heading>
                <p className="admin-form-modal__description">{description}</p>
              </div>
            </Modal.Header>
            <Modal.Body className="local-image-editor__body">
              {kind === "avatar" ? (
                <div className="local-image-editor__avatar-stage">
                  {file ? (
                    <AvatarEditor
                      border={avatarEditorBorder}
                      borderColor={[236, 72, 153, 0.42]}
                      borderRadius={avatarEditorSize / 2}
                      color={[9, 9, 11, 0.52]}
                      disableCanvasRotation={false}
                      height={avatarEditorSize}
                      image={file}
                      ref={avatarEditor.ref}
                      rotate={avatarRotate}
                      scale={avatarScale}
                      showGrid
                      width={avatarEditorSize}
                    />
                  ) : null}
                </div>
              ) : (
                <div className="local-image-editor__cover-stage">
                  {imageUrl ? (
                    <ReactCrop
                      aspect={coverAspect}
                      crop={coverCrop}
                      keepSelection
                      onChange={(_, percentCrop) => setCoverCrop(percentCrop)}
                      onComplete={(nextCrop) => setCompletedCoverCrop(nextCrop)}
                      ruleOfThirds
                    >
                      <img
                        alt="裁剪文章封面"
                        onLoad={handleCoverImageLoad}
                        ref={coverImageRef}
                        src={imageUrl}
                      />
                    </ReactCrop>
                  ) : null}
                </div>
              )}
              {kind === "avatar" ? (
                <div className="local-image-editor__controls">
                  <Slider
                    aria-label="头像缩放"
                    maxValue={3}
                    minValue={1}
                    onChange={(value) => setAvatarScale(readSliderNumber(value, avatarScale))}
                    step={0.05}
                    value={avatarScale}
                  >
                    <Label>缩放</Label>
                    <Slider.Output />
                    <Slider.Track>
                      <Slider.Fill />
                      <Slider.Thumb />
                    </Slider.Track>
                  </Slider>
                  <Slider
                    aria-label="头像旋转"
                    maxValue={360}
                    minValue={0}
                    onChange={(value) => setAvatarRotate(readSliderNumber(value, avatarRotate))}
                    step={1}
                    value={avatarRotate}
                  >
                    <Label>旋转</Label>
                    <Slider.Output />
                    <Slider.Track>
                      <Slider.Fill />
                      <Slider.Thumb />
                    </Slider.Track>
                  </Slider>
                </div>
              ) : null}
              {message ? <p className="front-form-note">{message}</p> : null}
            </Modal.Body>
            <Modal.Footer>
              <Button isDisabled={isApplying} onPress={onCancel} type="button" variant="tertiary">
                取消
              </Button>
              <Button
                isDisabled={isApplying}
                onPress={applyOriginalImage}
                type="button"
                variant="tertiary"
              >
                原图
              </Button>
              <Button isDisabled={isApplying} onPress={() => void applyEditedImage()} type="button">
                <AppIcon name="checkmarkCircle" />
                完成编辑
              </Button>
            </Modal.Footer>
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
