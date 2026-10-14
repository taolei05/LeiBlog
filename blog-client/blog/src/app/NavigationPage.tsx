import { useEffect, useRef, useState } from "react";
import { LoadingStatus } from "../../../shared/loading-status";
import { ExternalLink, FolderOpen, Globe2, List, Map, SearchX } from "lucide-react";

import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { useMediaQuery } from "@astryxdesign/core/hooks";

import { getPublicNavigation } from "../../../shared/admin-api";
import type { AppLanguage } from "../../../shared/i18n";
import type { PublicNavigationGroup, PublicNavigationItem } from "../../../shared/admin-api";
import { FrontPageHero } from "./FrontPageHero";
import { getSafeLinkUrl, resolveContentAssetUrl } from "../../../shared/content-url";

type NavigationPageProps = {
  coverUrls: readonly string[];
  fallbackCoverUrl: string;
  language: AppLanguage;
};

type NavigationCopy = {
  directory: string;
  empty: string;
  eyebrow: string;
  heroDescription: string;
  loading: string;
  loadFailed: string;
  open: string;
  title: string;
};

type NavigationDirectoryProps = {
  activeGroupId: string;
  groups: readonly PublicNavigationGroup[];
  language: AppLanguage;
};

type NavigationMobileDirectoryProps = NavigationDirectoryProps & {
  copy: NavigationCopy;
  isOpen: boolean;
  onSelect: (groupId: string) => void;
  onToggle: () => void;
};

type NavigationSiteCardProps = {
  item: PublicNavigationItem;
  openLabel: string;
};

const navigationCopyByLanguage: Record<AppLanguage, NavigationCopy> = {
  "zh-CN": {
    directory: "目录",
    empty: "暂无导航网站，请在后台导航页管理里添加。",
    eyebrow: "站点导航",
    heroDescription: "整理常用工具、服务与值得长期收藏的网站。",
    loading: "导航页加载中...",
    loadFailed: "导航页加载失败，请稍后重试。",
    open: "打开网站",
    title: "导航页",
  },
  en: {
    directory: "Directory",
    empty: "No navigation links yet. Add them from the admin navigation manager.",
    eyebrow: "Site Navigation",
    heroDescription: "Useful tools, services, and long-lived websites worth keeping nearby.",
    loading: "Loading navigation...",
    loadFailed: "Navigation failed to load. Please try again later.",
    open: "Open website",
    title: "Navigation",
  },
};

const sectionId = (group: PublicNavigationGroup) => `navigation-group-${group.id}`;
const sectionIdFromGroupId = (groupId: string) => `navigation-group-${groupId}`;
const readNavigationGroupName = (group: PublicNavigationGroup, language: AppLanguage) =>
  language === "en" && group.nameEn !== null ? group.nameEn : group.name;

const scrollDirectoryLinkIntoView = (container: HTMLElement | null) => {
  if (container === null) {
    return;
  }

  const activeLink = container.querySelector<HTMLAnchorElement>("[aria-current='true']");
  activeLink?.scrollIntoView({ block: "nearest", inline: "nearest" });
};

function NavigationDirectory({ activeGroupId, groups, language }: NavigationDirectoryProps) {
  return (
    <div className="navigation-directory__links">
      {groups.map((group) => (
        <a
          aria-current={activeGroupId === group.id ? "true" : undefined}
          href={`#${sectionId(group)}`}
          key={group.id}
        >
          <FolderOpen size={15} />
          <span>{readNavigationGroupName(group, language)}</span>
          <small>{group.items.length}</small>
        </a>
      ))}
    </div>
  );
}

function NavigationMobileDirectory({
  activeGroupId,
  copy,
  groups,
  isOpen,
  language,
  onSelect,
  onToggle,
}: NavigationMobileDirectoryProps) {
  return (
    <span className="navigation-mobile-directory">
      <button
        aria-expanded={isOpen}
        aria-label={copy.directory}
        className="article-detail-breadcrumbs__toc-button navigation-mobile-directory__button"
        onClick={onToggle}
        type="button"
      >
        <List aria-hidden="true" size={18} />
      </button>
      {isOpen ? (
        <span
          aria-label={copy.directory}
          className="article-detail-mobile-toc navigation-mobile-directory__popover"
          role="dialog"
        >
          <strong>{copy.directory}</strong>
          <span className="article-detail-mobile-toc__links navigation-mobile-directory__links">
            {groups.map((group) => (
              <button
                aria-current={activeGroupId === group.id ? "true" : undefined}
                key={group.id}
                onClick={() => {
                  onSelect(group.id);
                }}
                type="button"
              >
                {readNavigationGroupName(group, language)}
              </button>
            ))}
          </span>
        </span>
      ) : null}
    </span>
  );
}

function NavigationSiteCard({ item, openLabel }: NavigationSiteCardProps) {
  const iconUrl = item.iconUrl === null ? "" : resolveContentAssetUrl(item.iconUrl);

  return (
    <a
      className="navigation-site-card"
      href={getSafeLinkUrl(item.url)}
      rel="noreferrer"
      target="_blank"
    >
      <span className="navigation-site-card__icon">
        {iconUrl.length > 0 ? (
          <img alt="" src={iconUrl} />
        ) : (
          <span>{item.name.slice(0, 1).toUpperCase()}</span>
        )}
      </span>
      <span className="navigation-site-card__content">
        <strong>{item.name}</strong>
        <small>{item.note ?? item.url}</small>
      </span>
      <span className="navigation-site-card__action" aria-label={openLabel}>
        <ExternalLink size={16} />
      </span>
    </a>
  );
}

export function NavigationPage({ coverUrls, fallbackCoverUrl, language }: NavigationPageProps) {
  const isMobileDirectory = useMediaQuery("(max-width: 860px)");
  const directoryRef = useRef<HTMLElement | null>(null);
  const [groups, setGroups] = useState<PublicNavigationGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState("");
  const [error, setError] = useState("");
  const [isMobileDirectoryOpen, setIsMobileDirectoryOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const copy = navigationCopyByLanguage[language];

  useEffect(() => {
    let isMounted = true;

    const loadNavigation = async () => {
      try {
        const nextGroups = await getPublicNavigation();
        if (isMounted) {
          setGroups(nextGroups.filter((group) => group.items.length > 0));
          setError("");
        }
      } catch {
        if (isMounted) {
          setError(copy.loadFailed);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadNavigation();

    return () => {
      isMounted = false;
    };
  }, [copy.loadFailed]);

  useEffect(() => {
    if (groups.length === 0) {
      setActiveGroupId("");
      setIsMobileDirectoryOpen(false);
      return;
    }

    setActiveGroupId((current) => {
      if (groups.some((group) => group.id === current)) {
        return current;
      }

      return groups[0]?.id ?? "";
    });
  }, [groups]);

  useEffect(() => {
    if (!isMobileDirectory) {
      setIsMobileDirectoryOpen(false);
    }
  }, [isMobileDirectory]);

  useEffect(() => {
    if (groups.length === 0 || typeof window === "undefined") {
      return undefined;
    }

    let animationFrameId = 0;

    const updateActiveGroup = () => {
      const markerY = Math.min(window.innerHeight * 0.35, 240);
      let nextActiveGroupId = groups[0]?.id ?? "";

      for (const group of groups) {
        const section = document.getElementById(sectionId(group));
        if (section === null) {
          continue;
        }

        const rect = section.getBoundingClientRect();
        if (rect.top <= markerY) {
          nextActiveGroupId = group.id;
        } else {
          break;
        }
      }

      setActiveGroupId(nextActiveGroupId);
    };

    const scheduleActiveGroupUpdate = () => {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(updateActiveGroup);
    };

    scheduleActiveGroupUpdate();
    window.addEventListener("scroll", scheduleActiveGroupUpdate, { passive: true });
    window.addEventListener("resize", scheduleActiveGroupUpdate);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("scroll", scheduleActiveGroupUpdate);
      window.removeEventListener("resize", scheduleActiveGroupUpdate);
    };
  }, [groups]);

  useEffect(() => {
    if (activeGroupId.length === 0 || typeof window === "undefined") {
      return undefined;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      scrollDirectoryLinkIntoView(directoryRef.current);
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [activeGroupId]);

  const handleMobileDirectorySelect = (groupId: string) => {
    document.getElementById(sectionIdFromGroupId(groupId))?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setActiveGroupId(groupId);
    setIsMobileDirectoryOpen(false);
  };

  return (
    <main className="page-shell page-shell--with-front-hero navigation-page">
      <FrontPageHero
        coverUrls={coverUrls}
        description={copy.heroDescription}
        eyebrow={copy.eyebrow}
        fallbackCoverUrl={fallbackCoverUrl}
        icon={Map}
        title={copy.title}
      />

      <section className="navigation-summary" aria-label={copy.eyebrow}>
        <div className="navigation-hero__stats">
          <span>
            <Map size={17} />
            {groups.length}
          </span>
          <span>
            <Globe2 size={17} />
            {groups.reduce((total, group) => total + group.items.length, 0)}
          </span>
        </div>
        {groups.length > 0 && isMobileDirectory ? (
          <NavigationMobileDirectory
            activeGroupId={activeGroupId}
            copy={copy}
            groups={groups}
            isOpen={isMobileDirectoryOpen}
            language={language}
            onSelect={handleMobileDirectorySelect}
            onToggle={() => {
              setIsMobileDirectoryOpen((currentValue) => !currentValue);
            }}
          />
        ) : null}
      </section>

      {isLoading ? (
        <Card className="navigation-state" padding={5}>
          <LoadingStatus label={copy.loading} />
        </Card>
      ) : null}

      {!isLoading && error.length > 0 ? (
        <div className="front-feedback-banner">
          <Banner container="card" status="error" title={error} />
        </div>
      ) : null}

      {!isLoading && error.length === 0 && groups.length === 0 ? (
        <Card className="navigation-state" padding={5}>
          <SearchX size={22} />
          <Text type="body" color="secondary">
            {copy.empty}
          </Text>
        </Card>
      ) : null}

      {groups.length > 0 ? (
        <div className="navigation-layout">
          <div className="navigation-groups">
            {groups.map((group) => (
              <section className="navigation-group" id={sectionId(group)} key={group.id}>
                <div className="navigation-group__heading">
                  <Heading level={2}>{readNavigationGroupName(group, language)}</Heading>
                  <Badge label={`${group.items.length}`} variant="neutral" />
                </div>
                <div className="navigation-grid">
                  {group.items.map((item) => (
                    <NavigationSiteCard item={item} key={item.id} openLabel={copy.open} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {isMobileDirectory ? null : (
            <nav aria-label={copy.directory} className="navigation-directory" ref={directoryRef}>
              <strong>{copy.directory}</strong>
              <NavigationDirectory
                activeGroupId={activeGroupId}
                groups={groups}
                language={language}
              />
            </nav>
          )}
        </div>
      ) : null}
    </main>
  );
}
