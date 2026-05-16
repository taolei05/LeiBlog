import { Tabs } from "@heroui/react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { AppIcon } from "../../shared/icons";
import { dashboardRoute, getAdminRouteMeta, type AdminRouteMeta } from "./adminNavigation";

function uniqueTabs(tabs: AdminRouteMeta[]) {
  return tabs.filter((tab, index) => tabs.findIndex((item) => item.path === tab.path) === index);
}

export function ClosableTabs() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentRoute = getAdminRouteMeta(location.pathname);
  const [tabs, setTabs] = useState<AdminRouteMeta[]>(() =>
    uniqueTabs([dashboardRoute, currentRoute]),
  );

  useEffect(() => {
    setTabs((currentTabs) => uniqueTabs([...currentTabs, currentRoute]));
  }, [currentRoute]);

  function closeTab(path: string) {
    const nextTabs = tabs.filter((tab) => tab.path !== path);
    const safeNextTabs = nextTabs.length > 0 ? nextTabs : [dashboardRoute];
    const closedIndex = tabs.findIndex((tab) => tab.path === path);

    setTabs(safeNextTabs);

    if (location.pathname === path) {
      const fallbackTab = safeNextTabs[Math.max(0, closedIndex - 1)] ?? dashboardRoute;

      void navigate(fallbackTab.path);
    }
  }

  return (
    <Tabs
      className="admin-tabs"
      onSelectionChange={(key) => void navigate(String(key))}
      selectedKey={currentRoute.path}
      variant="secondary"
    >
      <Tabs.List aria-label="已打开的后台标签页" className="admin-tabs__list">
        {tabs.map((tab) => (
          <Tabs.Tab className="admin-tabs__tab" id={tab.path} key={tab.path}>
            <AppIcon name={tab.icon} />
            <span>{tab.label}</span>
            {tab.path !== dashboardRoute.path ? (
              <button
                aria-label={`关闭${tab.label}标签`}
                className="admin-tabs__close"
                onClick={(event) => {
                  event.stopPropagation();
                  closeTab(tab.path);
                }}
                onMouseDown={(event) => event.stopPropagation()}
                type="button"
              >
                <AppIcon name="close" size={14} />
              </button>
            ) : null}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs>
  );
}
