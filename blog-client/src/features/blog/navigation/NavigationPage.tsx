import { useEffect, useState } from "react";
import { Popover, Tooltip } from "@heroui/react";

import { AppIcon } from "../../../shared/icons";
import type { NavigationGroup, NavigationItem } from "./navigation-api";
import { fetchPublicNavigation } from "./navigation-api";

type NavigationPageProps = {
  initialGroups?: NavigationGroup[];
};

function sectionId(group: NavigationGroup) {
  return `navigation-group-${group.id}`;
}

type NavigationDirectoryLinksProps = {
  activeGroupId: string;
  groups: NavigationGroup[];
  onNavigate?: () => void;
};

function NavigationDirectoryLinks({
  activeGroupId,
  groups,
  onNavigate,
}: NavigationDirectoryLinksProps) {
  return groups.map((group) => {
    const isActive = group.id === activeGroupId;

    return (
      <a
        aria-current={isActive ? "true" : undefined}
        className={
          isActive
            ? "navigation-page__directory-link navigation-page__directory-link--active"
            : "navigation-page__directory-link"
        }
        href={`#${sectionId(group)}`}
        key={group.id}
        onClick={() => onNavigate?.()}
      >
        {group.name}
      </a>
    );
  });
}

type NavigationMobileDirectoryProps = {
  activeGroupId: string;
  groups: NavigationGroup[];
};

function NavigationMobileDirectory({ activeGroupId, groups }: NavigationMobileDirectoryProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <button
        aria-label="打开导航目录"
        className="button button--icon-only button--sm button--secondary navigation-page__mobile-directory-button"
        type="button"
      >
        <AppIcon name="list" />
      </button>
      <Popover.Content
        className="navigation-page__mobile-directory-popover"
        offset={8}
        placement="bottom end"
      >
        <Popover.Dialog>
          <div className="navigation-page__mobile-directory-panel">
            <p>本页目录</p>
            <nav aria-label="移动端导航页目录" className="navigation-page__mobile-directory-nav">
              <NavigationDirectoryLinks
                activeGroupId={activeGroupId}
                groups={groups}
                onNavigate={() => setIsOpen(false)}
              />
            </nav>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

type NavigationSiteCardProps = {
  item: NavigationItem;
};

function NavigationSiteIcon({ iconUrl }: { iconUrl: string | null }) {
  const [hasIconError, setHasIconError] = useState(false);

  useEffect(() => {
    setHasIconError(false);
  }, [iconUrl]);

  if (!iconUrl || hasIconError) return <AppIcon name="link" />;

  return (
    <img
      alt=""
      decoding="async"
      loading="lazy"
      onError={() => setHasIconError(true)}
      referrerPolicy="no-referrer"
      src={iconUrl}
    />
  );
}

function NavigationSiteCard({ item }: NavigationSiteCardProps) {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const cardContent = (
    <>
      <span className="navigation-page__icon">
        <NavigationSiteIcon iconUrl={item.iconUrl} />
      </span>
      <span className="navigation-page__card-copy">
        <strong>{item.name}</strong>
        {item.note ? <small>{item.note}</small> : null}
      </span>
      <AppIcon className="navigation-page__open-icon" name="open" size={16} />
    </>
  );

  if (!item.note) {
    return (
      <a
        className="navigation-page__card"
        href={item.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        {cardContent}
      </a>
    );
  }

  return (
    <Tooltip closeDelay={0} delay={0} isOpen={isTooltipOpen} onOpenChange={setIsTooltipOpen}>
      <Tooltip.Trigger<"a">
        className="navigation-page__card"
        href={item.url}
        onBlur={() => {
          setIsTooltipOpen(false);
        }}
        onFocus={() => {
          setIsTooltipOpen(true);
        }}
        onPointerEnter={(event) => {
          if (event.pointerType !== "touch") setIsTooltipOpen(true);
        }}
        onPointerLeave={(event) => {
          if (event.currentTarget !== document.activeElement) setIsTooltipOpen(false);
        }}
        render={({ role: _role, ...triggerProps }) => <a {...triggerProps} />}
        rel="noopener noreferrer"
        target="_blank"
      >
        {cardContent}
      </Tooltip.Trigger>
      <Tooltip.Content
        className="navigation-page__note-tooltip"
        offset={12}
        placement="top"
        showArrow
      >
        <Tooltip.Arrow />
        <p>{item.note}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}

export function NavigationPage({ initialGroups }: NavigationPageProps) {
  const [groups, setGroups] = useState<NavigationGroup[]>(initialGroups ?? []);
  const [activeGroupId, setActiveGroupId] = useState(initialGroups?.[0]?.id ?? "");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(initialGroups === undefined);

  useEffect(() => {
    if (initialGroups !== undefined) return;

    let isActive = true;
    fetchPublicNavigation()
      .then((nextGroups) => {
        if (isActive) setGroups(nextGroups);
      })
      .catch((nextError: unknown) => {
        if (isActive) setError(nextError instanceof Error ? nextError.message : "导航页加载失败");
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [initialGroups]);

  useEffect(() => {
    if (groups.length === 0) {
      setActiveGroupId("");
      return;
    }

    setActiveGroupId((current) =>
      groups.some((group) => group.id === current) ? current : groups[0]!.id,
    );
  }, [groups]);

  useEffect(() => {
    if (groups.length === 0 || typeof window === "undefined") return undefined;

    let animationFrameId = 0;

    function updateActiveGroup() {
      const markerY = Math.min(window.innerHeight * 0.35, 240);
      let nextActiveGroupId = groups[0]?.id ?? "";

      for (const group of groups) {
        const section = document.getElementById(sectionId(group));
        if (!section) continue;

        const rect = section.getBoundingClientRect();
        if (rect.top <= markerY) {
          nextActiveGroupId = group.id;
        } else {
          break;
        }
      }

      setActiveGroupId(nextActiveGroupId);
    }

    function scheduleActiveGroupUpdate() {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(updateActiveGroup);
    }

    scheduleActiveGroupUpdate();
    window.addEventListener("scroll", scheduleActiveGroupUpdate, { passive: true });
    window.addEventListener("resize", scheduleActiveGroupUpdate);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("scroll", scheduleActiveGroupUpdate);
      window.removeEventListener("resize", scheduleActiveGroupUpdate);
    };
  }, [groups]);

  return (
    <section className="navigation-page page-stack">
      <header className="navigation-page__hero">
        <div className="navigation-page__hero-top">
          <p className="eyebrow">站点导航</p>
          {groups.length > 0 ? (
            <span className="navigation-page__mobile-directory">
              <NavigationMobileDirectory activeGroupId={activeGroupId} groups={groups} />
            </span>
          ) : null}
        </div>
        <h1>导航页</h1>
        <p>整理常用工具、服务与值得长期收藏的网站。</p>
      </header>

      {isLoading ? (
        <p className="navigation-page__state" role="status">
          导航页加载中...
        </p>
      ) : null}
      {error ? (
        <p className="navigation-page__state navigation-page__state--error" role="alert">
          {error}
        </p>
      ) : null}
      {!isLoading && !error && groups.length === 0 ? (
        <p className="navigation-page__state">暂无导航网站</p>
      ) : null}

      {groups.length > 0 ? (
        <div className="navigation-page__layout">
          <div className="navigation-page__groups">
            {groups.map((group) => (
              <section className="navigation-page__group" id={sectionId(group)} key={group.id}>
                <h2>{group.name}</h2>
                <div className="navigation-page__grid">
                  {group.items.map((item) => (
                    <NavigationSiteCard item={item} key={item.id} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <nav aria-label="导航页目录" className="navigation-page__directory">
            <strong>目录</strong>
            <NavigationDirectoryLinks activeGroupId={activeGroupId} groups={groups} />
          </nav>
        </div>
      ) : null}
    </section>
  );
}
