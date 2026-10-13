import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";

import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";

type FrontPageHeroProps = {
  coverUrls: readonly string[];
  description: string;
  eyebrow: string;
  fallbackCoverUrl: string;
  icon: LucideIcon;
  title: string;
};

type UseFrontPageHeroCarouselParameters = {
  coverUrls: readonly string[];
  intervalMs?: number;
};

type GetHeroCoverUrlsParameters = {
  coverUrls: readonly string[];
  fallbackCoverUrl: string;
};

const resolveFrontPageHeroAssetUrl = (path: string) => {
  if (!path.startsWith("/") || typeof window === "undefined") {
    return path;
  }

  const url = new URL(path, window.location.origin);
  if (url.port === "5173" || url.port === "5174") {
    url.port = "3000";
  }

  return url.toString();
};

const getHeroCoverUrls = ({ coverUrls, fallbackCoverUrl }: GetHeroCoverUrlsParameters) => {
  const normalizedUrls = coverUrls
    .map((url) => url.trim())
    .filter((url) => url.length > 0)
    .map((url) => resolveFrontPageHeroAssetUrl(url));
  const fallbackUrl = fallbackCoverUrl.trim();

  if (fallbackUrl.length > 0) {
    normalizedUrls.push(resolveFrontPageHeroAssetUrl(fallbackUrl));
  }

  return Array.from(new Set(normalizedUrls));
};

const useFrontPageHeroCarousel = ({
  coverUrls,
  intervalMs = 6500,
}: UseFrontPageHeroCarouselParameters) => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [coverUrls]);

  useEffect(() => {
    if (coverUrls.length <= 1) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % coverUrls.length);
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [coverUrls.length, intervalMs]);

  return activeIndex;
};

function FrontPageHeroWaves() {
  return (
    <svg
      aria-hidden="true"
      className="front-page-hero-waves"
      preserveAspectRatio="none"
      viewBox="0 24 150 28"
    >
      <defs>
        <path
          d="M-160 44c30 0 58-18 88-18s58 18 88 18 58-18 88-18 58 18 88 18v44h-352z"
          id="front-page-hero-wave"
        />
      </defs>
      <g className="front-page-hero-waves__parallax">
        <use
          className="front-page-hero-waves__layer front-page-hero-waves__layer--one"
          href="#front-page-hero-wave"
          x="48"
          y="0"
        />
        <use
          className="front-page-hero-waves__layer front-page-hero-waves__layer--two"
          href="#front-page-hero-wave"
          x="48"
          y="3"
        />
        <use
          className="front-page-hero-waves__layer front-page-hero-waves__layer--three"
          href="#front-page-hero-wave"
          x="48"
          y="5"
        />
        <use
          className="front-page-hero-waves__layer front-page-hero-waves__layer--four"
          href="#front-page-hero-wave"
          x="48"
          y="7"
        />
      </g>
    </svg>
  );
}

export function FrontPageHero({
  coverUrls,
  description,
  eyebrow,
  fallbackCoverUrl,
  icon,
  title,
}: FrontPageHeroProps) {
  const heroCoverUrls = useMemo(
    () => getHeroCoverUrls({ coverUrls, fallbackCoverUrl }),
    [coverUrls, fallbackCoverUrl],
  );
  const activeIndex = useFrontPageHeroCarousel({ coverUrls: heroCoverUrls });
  const Icon = icon;

  return (
    <header className="front-page-hero">
      <div aria-hidden="true" className="front-page-hero__carousel">
        {heroCoverUrls.map((coverUrl, index) => (
          <img
            alt=""
            className={
              index === activeIndex
                ? "front-page-hero__cover-slide front-page-hero__cover-slide--active"
                : "front-page-hero__cover-slide"
            }
            key={coverUrl}
            src={coverUrl}
          />
        ))}
      </div>
      <div aria-hidden="true" className="front-page-hero__shade" />
      <div className="front-page-hero__content">
        <Text as="p" className="front-page-hero__eyebrow">
          {eyebrow}
        </Text>
        <Heading className="front-page-hero__title" level={1}>
          <Icon aria-hidden="true" strokeWidth={1.8} />
          {title}
        </Heading>
        <Text as="p" className="front-page-hero__description">
          {description}
        </Text>
      </div>
      <FrontPageHeroWaves />
    </header>
  );
}
