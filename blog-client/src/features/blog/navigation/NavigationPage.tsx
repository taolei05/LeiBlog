import { useEffect, useState } from "react";

import { AppIcon } from "../../../shared/icons";
import { fetchPublicNavigation, type NavigationGroup } from "./navigation-api";

type NavigationPageProps = {
  initialGroups?: NavigationGroup[];
};

function sectionId(group: NavigationGroup) {
  return `navigation-group-${group.id}`;
}

export function NavigationPage({ initialGroups }: NavigationPageProps) {
  const [groups, setGroups] = useState<NavigationGroup[]>(initialGroups ?? []);
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

  return (
    <section className="navigation-page page-stack">
      <header className="navigation-page__hero">
        <p className="eyebrow">站点导航</p>
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
                    <a
                      className="navigation-page__card"
                      href={item.url}
                      key={item.id}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <span className="navigation-page__icon">
                        {item.iconUrl ? <img alt="" src={item.iconUrl} /> : <AppIcon name="link" />}
                      </span>
                      <span className="navigation-page__card-copy">
                        <strong>{item.name}</strong>
                        {item.note ? <small>{item.note}</small> : null}
                      </span>
                      <AppIcon className="navigation-page__open-icon" name="open" size={16} />
                    </a>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <nav aria-label="导航页目录" className="navigation-page__directory">
            <strong>目录</strong>
            {groups.map((group) => (
              <a href={`#${sectionId(group)}`} key={group.id}>
                {group.name}
              </a>
            ))}
          </nav>
        </div>
      ) : null}
    </section>
  );
}
