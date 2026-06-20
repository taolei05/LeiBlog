import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import SVG from "react-inlinesvg";

import { extractSvgDocument, shouldInlineSvgAssetUrl } from "./svg";

type SvgAssetProps = {
  alt: string;
  className?: string;
  fallback?: ReactNode;
  fallbackSrc?: string;
  isSvg?: boolean;
  src: string;
  title?: string;
};

export function SvgAsset({
  alt,
  className,
  fallback = null,
  fallbackSrc,
  isSvg,
  src,
  title,
}: SvgAssetProps) {
  const [activeSrc, setActiveSrc] = useState(src);
  const [hasFailed, setHasFailed] = useState(false);
  const shouldInlineSvg = isSvg ?? shouldInlineSvgAssetUrl(activeSrc);

  useEffect(() => {
    setActiveSrc(src);
    setHasFailed(false);
  }, [fallbackSrc, src]);

  function handleError() {
    if (fallbackSrc && activeSrc !== fallbackSrc) {
      setActiveSrc(fallbackSrc);
      return;
    }

    setHasFailed(true);
  }

  if (hasFailed) return fallback;

  if (shouldInlineSvg) {
    return (
      <SVG
        aria-hidden={alt ? undefined : true}
        aria-label={alt || undefined}
        cacheRequests
        className={className}
        loader={fallback}
        onError={handleError}
        preProcessor={extractSvgDocument}
        role={alt ? "img" : undefined}
        src={activeSrc}
        title={title}
      />
    );
  }

  return (
    <img alt={alt} className={className} onError={handleError} src={activeSrc} title={title} />
  );
}
