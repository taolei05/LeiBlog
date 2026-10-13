export type CropPosition = {
  x: number;
  y: number;
};

export type CropSize = {
  height: number;
  width: number;
};

type ClampNumberParameters = {
  max: number;
  min: number;
  value: number;
};

export const clampNumber = ({ max, min, value }: ClampNumberParameters) =>
  Math.min(max, Math.max(min, value));

export const readRangeNumber = (value: string, fallback: number) => {
  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

type GetContainedSizeParameters = {
  source: CropSize;
  target: CropSize;
};

export const getContainedSize = ({
  source,
  target,
}: GetContainedSizeParameters): CropSize | undefined => {
  if (source.width <= 0 || source.height <= 0 || target.width <= 0 || target.height <= 0) {
    return undefined;
  }

  const ratio = Math.min(target.width / source.width, target.height / source.height);

  return {
    height: source.height * ratio,
    width: source.width * ratio,
  };
};

type GetRotatedSizeParameters = {
  rotation: number;
  size: CropSize;
};

export const getRotatedSize = ({ rotation, size }: GetRotatedSizeParameters): CropSize => {
  const radians = (rotation * Math.PI) / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));

  return {
    height: size.width * sine + size.height * cosine,
    width: size.width * cosine + size.height * sine,
  };
};

type GetMinimumScaleParameters = {
  cropSize: CropSize;
  imageDisplaySize?: CropSize;
  rotation: number;
};

export const getMinimumScale = ({
  cropSize,
  imageDisplaySize,
  rotation,
}: GetMinimumScaleParameters) => {
  if (imageDisplaySize === undefined) {
    return 1;
  }

  if (
    cropSize.width <= 0 ||
    cropSize.height <= 0 ||
    imageDisplaySize.width <= 0 ||
    imageDisplaySize.height <= 0
  ) {
    return 1;
  }

  const rotatedSize = getRotatedSize({ rotation, size: imageDisplaySize });

  return Math.max(1, cropSize.width / rotatedSize.width, cropSize.height / rotatedSize.height);
};

type ConstrainCropPositionParameters = {
  cropSize: CropSize;
  imageDisplaySize?: CropSize;
  position: CropPosition;
  rotation: number;
  scale: number;
};

export const constrainCropPosition = ({
  cropSize,
  imageDisplaySize,
  position,
  rotation,
  scale,
}: ConstrainCropPositionParameters): CropPosition => {
  if (imageDisplaySize === undefined) {
    return position;
  }

  if (
    cropSize.width <= 0 ||
    cropSize.height <= 0 ||
    imageDisplaySize.width <= 0 ||
    imageDisplaySize.height <= 0
  ) {
    return position;
  }

  const rotatedSize = getRotatedSize({
    rotation,
    size: {
      height: imageDisplaySize.height * scale,
      width: imageDisplaySize.width * scale,
    },
  });
  const maximumX = Math.max(0, (rotatedSize.width - cropSize.width) / 2);
  const maximumY = Math.max(0, (rotatedSize.height - cropSize.height) / 2);

  return {
    x: clampNumber({ max: maximumX, min: -maximumX, value: position.x }),
    y: clampNumber({ max: maximumY, min: -maximumY, value: position.y }),
  };
};

type GetWheelScaleParameters = {
  currentScale: number;
  deltaY: number;
  maxScale: number;
  minScale: number;
  sensitivity: number;
};

export const getWheelScale = ({
  currentScale,
  deltaY,
  maxScale,
  minScale,
  sensitivity,
}: GetWheelScaleParameters) =>
  clampNumber({
    max: maxScale,
    min: minScale,
    value: currentScale - deltaY * sensitivity,
  });
