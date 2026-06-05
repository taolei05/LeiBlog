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

type RandomCoverAssignmentParams<TItem> = {
  coverUrls: string[];
  getKey: (item: TItem) => string;
  items: TItem[];
  random?: () => number;
};

export function getHeroCoverUrls(siteInfo: PublicSiteInfo | null) {
  return [...new Set((siteInfo?.homeCoverUrls ?? []).map((url) => url.trim()).filter(Boolean))];
}

function getRandomIndex(length: number, random: () => number) {
  return Math.min(Math.floor(random() * length), length - 1);
}

function shuffleCoverUrls(coverUrls: string[], random: () => number) {
  const shuffledCoverUrls = [...coverUrls];

  for (let index = shuffledCoverUrls.length - 1; index > 0; index -= 1) {
    const swapIndex = getRandomIndex(index + 1, random);
    const currentCoverUrl = shuffledCoverUrls[index];
    const swapCoverUrl = shuffledCoverUrls[swapIndex];

    if (currentCoverUrl === undefined || swapCoverUrl === undefined) continue;

    shuffledCoverUrls[index] = swapCoverUrl;
    shuffledCoverUrls[swapIndex] = currentCoverUrl;
  }

  return shuffledCoverUrls;
}

export function createRandomCoverAssignments<TItem>({
  coverUrls,
  getKey,
  items,
  random = Math.random,
}: RandomCoverAssignmentParams<TItem>): Record<string, string> {
  const cleanCoverUrls = [...new Set(coverUrls.map((url) => url.trim()).filter(Boolean))];

  if (cleanCoverUrls.length === 0) return {};

  const shuffledCoverUrls = shuffleCoverUrls(cleanCoverUrls, random);

  const assignments: Record<string, string> = {};

  items.forEach((item, index) => {
    const coverUrl = shuffledCoverUrls[index % shuffledCoverUrls.length];
    if (coverUrl === undefined) return;

    assignments[getKey(item)] = coverUrl;
  });

  return assignments;
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
