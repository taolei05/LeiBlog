import { ScrollShadow, Tag, TagGroup } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { AppIcon } from "../../shared/icons";
import type { AdminRouteMeta } from "./adminNavigation";
import { dashboardRoute, getAdminRouteMeta } from "./adminNavigation";

function uniqueTabs(tabs: AdminRouteMeta[]) {
  return tabs.filter((tab, index) => tabs.findIndex((item) => item.path === tab.path) === index);
}

function arrangeTabs(tabs: AdminRouteMeta[], currentRoute: AdminRouteMeta) {
  const uniqueItems = uniqueTabs([dashboardRoute, currentRoute, ...tabs]);
  const otherTabs = uniqueItems.filter(
    (tab) => tab.path !== dashboardRoute.path && tab.path !== currentRoute.path,
  );

  if (currentRoute.path === dashboardRoute.path) {
    return [dashboardRoute, ...otherTabs];
  }

  return [dashboardRoute, currentRoute, ...otherTabs];
}

export function ClosableTabs() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentRoute = getAdminRouteMeta(location.pathname);
  const [tabs, setTabs] = useState<AdminRouteMeta[]>(() => arrangeTabs([], currentRoute));
  const selectedKeys = useMemo(() => new Set([currentRoute.path]), [currentRoute.path]);

  useEffect(() => {
    setTabs((currentTabs) => arrangeTabs(currentTabs, currentRoute));
  }, [
    currentRoute.description,
    currentRoute.icon,
    currentRoute.label,
    currentRoute.path,
    currentRoute.section,
  ]);

  function closeTab(path: string) {
    const nextTabs = tabs.filter((tab) => tab.path !== path || tab.path === dashboardRoute.path);
    const safeNextTabs = nextTabs.length > 0 ? nextTabs : [dashboardRoute];

    setTabs(safeNextTabs);

    if (location.pathname === path) {
      const fallbackTab =
        safeNextTabs.find((tab) => tab.path !== dashboardRoute.path) ?? dashboardRoute;

      void navigate(fallbackTab.path);
    }
  }

  return (
    <ScrollShadow hideScrollBar className="admin-tabs-scroll" orientation="horizontal" size={32}>
      <TagGroup
        aria-label="已打开的后台标签页"
        className="admin-tabs"
        onRemove={(keys) => {
          const [path] = [...keys].map(String);
          if (path) closeTab(path);
        }}
        onSelectionChange={(keys) => {
          if (keys === "all") return;

          const [path] = [...keys].map(String);
          if (path && path !== location.pathname) {
            void navigate(path);
          }
        }}
        selectedKeys={selectedKeys}
        selectionMode="single"
        size="lg"
        variant="surface"
      >
        <TagGroup.List className="admin-tabs__list" items={tabs}>
          {(tab) => (
            <Tag className="admin-tabs__tab" id={tab.path} key={tab.path} textValue={tab.label}>
              {(renderProps) => (
                <>
                  <AppIcon name={tab.icon} />
                  <span>{tab.label}</span>
                  {tab.path !== dashboardRoute.path && renderProps.allowsRemoving ? (
                    <Tag.RemoveButton
                      aria-label={`关闭${tab.label}标签`}
                      className="admin-tabs__close"
                    >
                      <AppIcon name="close" size={18} />
                    </Tag.RemoveButton>
                  ) : null}
                </>
              )}
            </Tag>
          )}
        </TagGroup.List>
      </TagGroup>
    </ScrollShadow>
  );
}
