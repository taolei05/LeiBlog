import { useEffect, useMemo, useState } from "react";

import type { PublicSiteInfo } from "../../../shared/site/site-info";

type HeroCoverCarouselProps = {
  activeIndex: number;
  activeSlideClassName: string;
  className: string;
  coverUrls: string[];
  slideClassName: string;
};

type PageHeroCoverCarouselProps = {
  siteInfo: PublicSiteInfo | null;
};

export function getHeroCoverUrls(siteInfo: PublicSiteInfo | null) {
  const coverUrls = [
    ...new Set((siteInfo?.homeCoverUrls ?? []).map((url) => url.trim()).filter(Boolean)),
  ];

  if (coverUrls.length > 0) return coverUrls;

  const legacyCoverUrl = siteInfo?.homeCoverUrl?.trim();
  return legacyCoverUrl ? [legacyCoverUrl] : [];
}

export function useHeroCoverCarousel(siteInfo: PublicSiteInfo | null, intervalMs = 6500) {
  const coverUrls = useMemo(() => getHeroCoverUrls(siteInfo), [siteInfo]);
  const [activeCoverIndex, setActiveCoverIndex] = useState(0);

  useEffect(() => {
    setActiveCoverIndex(0);
  }, [coverUrls]);

  useEffect(() => {
    if (coverUrls.length <= 1) return undefined;

    const timer = window.setInterval(() => {
      setActiveCoverIndex((index) => (index + 1) % coverUrls.length);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [coverUrls.length, intervalMs]);

  return {
    activeCoverIndex,
    coverUrls,
    setActiveCoverIndex,
  };
}

export function HeroCoverCarousel({
  activeIndex,
  activeSlideClassName,
  className,
  coverUrls,
  slideClassName,
}: HeroCoverCarouselProps) {
  if (coverUrls.length === 0) return null;

  const safeActiveIndex = Math.min(Math.max(activeIndex, 0), coverUrls.length - 1);

  return (
    <div aria-hidden className={className}>
      {coverUrls.map((coverUrl, index) => (
        <img
          alt=""
          className={`${slideClassName}${index === safeActiveIndex ? ` ${activeSlideClassName}` : ""}`}
          key={`${coverUrl}-${index}`}
          src={coverUrl}
        />
      ))}
    </div>
  );
}

export function PageHeroCoverCarousel({ siteInfo }: PageHeroCoverCarouselProps) {
  const { activeCoverIndex, coverUrls } = useHeroCoverCarousel(siteInfo);

  return (
    <HeroCoverCarousel
      activeIndex={activeCoverIndex}
      activeSlideClassName="articles-index-hero__cover-slide--active"
      className="articles-index-hero__carousel"
      coverUrls={coverUrls}
      slideClassName="articles-index-hero__cover-slide"
    />
  );
}
