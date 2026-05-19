import {
  AlertDialog,
  Avatar,
  Breadcrumbs,
  Button,
  Chip,
  Dropdown,
  Label,
  Tooltip,
} from "@heroui/react";
import type { AdminRole } from "../../shared/routing/adminGuards";
import type { PublicSiteInfo } from "../../shared/site/site-info";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { adminFetch } from "../../features/admin/shared/admin-api";
import { resolveApiAssetUrl } from "../../shared/api/api-base-url";
import { AppIcon } from "../../shared/icons";
import { signOutAdminSession, useAdminSession } from "../../shared/routing/adminGuards";
import {
  applyFavicon,
  fetchPublicSiteInfo,
  getPreferredSiteLogo,
} from "../../shared/site/site-info";
import { ThemeSwitcher } from "../../shared/theme/ThemeSwitcher";
import { useTheme } from "../../shared/theme/ThemeProviderLite";
import { showErrorToast, showSuccessToast } from "../../shared/toast/operation-toast";
import type { AdminRouteMeta } from "./adminNavigation";
import { adminNavigationGroups, getAdminRouteMeta, getAdminSectionIcon } from "./adminNavigation";
import { ClosableTabs } from "./ClosableTabs";

type CurrentAdminProfile = {
  avatarUrl: string | null;
  name: string | null;
  role: AdminRole;
  username: string;
};

type PendingAccountAction = "front" | "logout";

type AdminSideNavItemProps = {
  isSidebarCollapsed: boolean;
  item: AdminRouteMeta;
  onNavigate: () => void;
};

function AdminSideNavItem({ isSidebarCollapsed, item, onNavigate }: AdminSideNavItemProps) {
  return (
    <Tooltip delay={0} isDisabled={!isSidebarCollapsed}>
      <Tooltip.Trigger className="side-nav__tooltip-trigger">
        <NavLink
          aria-label={isSidebarCollapsed ? item.label : undefined}
          className={({ isActive }) => (isActive ? "side-nav__link is-active" : "side-nav__link")}
          end={item.path === "/admin"}
          onClick={onNavigate}
          to={item.path}
        >
          <AppIcon name={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      </Tooltip.Trigger>
      <Tooltip.Content showArrow className="admin-sidebar-tooltip" offset={12} placement="right">
        <Tooltip.Arrow />
        <p>{item.label}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = useAdminSession();
  const { resolvedTheme } = useTheme();
  const currentRoute = getAdminRouteMeta(location.pathname);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [siteInfo, setSiteInfo] = useState<PublicSiteInfo>();
  const [currentProfile, setCurrentProfile] = useState<CurrentAdminProfile>();
  const [brokenAvatarUrl, setBrokenAvatarUrl] = useState<string>();
  const [pendingAccountAction, setPendingAccountAction] = useState<PendingAccountAction>();
  const shellClassName = isSidebarCollapsed
    ? "admin-shell admin-shell--sidebar-collapsed"
    : "admin-shell";
  const sidebarClassName = isNavOpen ? "admin-shell__sidebar is-open" : "admin-shell__sidebar";
  const siteName = siteInfo?.siteName ?? "LeiBlog";
  const siteLogoUrl = getPreferredSiteLogo(siteInfo, resolvedTheme);
  const currentDisplayName =
    currentProfile?.name || currentProfile?.username || session.displayName || "管理员";
  const currentRole = currentProfile?.role ?? session.role;
  const currentAvatarUrl =
    resolveApiAssetUrl(currentProfile?.avatarUrl) ?? resolveApiAssetUrl(session.avatarUrl);
  const visibleAvatarUrl =
    currentAvatarUrl && currentAvatarUrl !== brokenAvatarUrl ? currentAvatarUrl : undefined;
  const fallbackInitial = currentDisplayName.slice(0, 1).toUpperCase() || "管";
  const pendingAccountActionMeta =
    pendingAccountAction === "logout"
      ? {
          body: "退出后需要重新登录才能进入后台管理。",
          confirmLabel: "确认退出",
          heading: "确认退出登录？",
          status: "danger" as const,
        }
      : {
          body: "将离开后台管理并返回博客前台。",
          confirmLabel: "返回前台",
          heading: "确认返回前台？",
          status: "accent" as const,
        };

  useEffect(() => {
    let isActive = true;

    async function loadSiteInfo() {
      try {
        const nextSiteInfo = await fetchPublicSiteInfo();
        if (!isActive) return;
        setSiteInfo(nextSiteInfo);
      } catch {
        if (!isActive) return;
        setSiteInfo(undefined);
      }
    }

    void loadSiteInfo();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    applyFavicon(siteInfo?.faviconUrl);
  }, [siteInfo?.faviconUrl]);

  useEffect(() => {
    setBrokenAvatarUrl(undefined);
  }, [currentAvatarUrl]);

  useEffect(() => {
    if (!session.isAuthenticated) {
      setCurrentProfile(undefined);
      return;
    }

    let isActive = true;

    async function loadCurrentProfile() {
      try {
        const response = await adminFetch<{ user: CurrentAdminProfile }>("/me/");
        if (!isActive) return;
        setCurrentProfile(response.user);
      } catch {
        if (!session.userId) {
          if (!isActive) return;
          setCurrentProfile(undefined);
          return;
        }

        try {
          const response = await adminFetch<{ user: CurrentAdminProfile }>(
            `/admin/users/${session.userId}`,
          );
          if (!isActive) return;
          setCurrentProfile(response.user);
        } catch {
          if (!isActive) return;
          setCurrentProfile(undefined);
        }
      }
    }

    void loadCurrentProfile();

    return () => {
      isActive = false;
    };
  }, [session.isAuthenticated, session.userId]);

  function handleSignOut() {
    try {
      signOutAdminSession();
      showSuccessToast("退出登录成功");
      void navigate("/admin/login", { replace: true });
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "退出登录失败");
    }
  }

  function handleAccountAction(key: string) {
    if (key === "front") {
      setPendingAccountAction("front");
      return;
    }

    if (key === "logout") {
      setPendingAccountAction("logout");
    }
  }

  function confirmAccountAction() {
    const action = pendingAccountAction;
    setPendingAccountAction(undefined);

    if (action === "front") {
      showSuccessToast("正在返回前台");
      void navigate("/");
      return;
    }

    if (action === "logout") {
      handleSignOut();
    }
  }

  return (
    <div className={shellClassName}>
      <a className="skip-link" href="#admin-content">
        跳到后台内容
      </a>
      {isNavOpen ? (
        <button
          aria-label="关闭后台导航遮罩"
          className="admin-shell__scrim"
          onClick={() => setIsNavOpen(false)}
          type="button"
        />
      ) : null}
      <aside className={sidebarClassName}>
        <div className="admin-shell__sidebar-header">
          <NavLink aria-label={`${siteName} 首页`} className="brand-link" to="/">
            {siteLogoUrl ? (
              <img alt="" className="brand-mark brand-mark--image" src={siteLogoUrl} />
            ) : (
              <span aria-hidden="true" className="brand-mark">
                {siteName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span>{siteName}</span>
          </NavLink>
          <Tooltip delay={0}>
            <Button
              aria-label={isSidebarCollapsed ? "展开后台侧边栏" : "收起后台侧边栏"}
              className="admin-shell__sidebar-collapse"
              isIconOnly
              onPress={() => setIsSidebarCollapsed((value) => !value)}
              size="sm"
              variant="tertiary"
            >
              <AppIcon name={isSidebarCollapsed ? "chevronForward" : "chevronBack"} />
            </Button>
            <Tooltip.Content
              showArrow
              className="admin-sidebar-tooltip"
              offset={12}
              placement="right"
            >
              <Tooltip.Arrow />
              <p>{isSidebarCollapsed ? "展开侧栏" : "折叠侧栏"}</p>
            </Tooltip.Content>
          </Tooltip>
          <Button
            aria-label="关闭后台导航"
            className="admin-shell__sidebar-close"
            isIconOnly
            onPress={() => setIsNavOpen(false)}
            size="sm"
            variant="tertiary"
          >
            <AppIcon name="close" />
          </Button>
        </div>
        <nav aria-label="后台导航" className="side-nav">
          {adminNavigationGroups.map((group) => (
            <section className="side-nav__group" key={group.label}>
              <p className="side-nav__label">{group.label}</p>
              <div className="side-nav__items">
                {group.items.map((item) => (
                  <AdminSideNavItem
                    isSidebarCollapsed={isSidebarCollapsed}
                    item={item}
                    key={item.path}
                    onNavigate={() => setIsNavOpen(false)}
                  />
                ))}
              </div>
            </section>
          ))}
        </nav>
      </aside>
      <div className="admin-shell__workspace">
        <header className="admin-shell__topbar">
          <div className="admin-shell__titlebar">
            <Button
              aria-label="打开后台导航"
              className="admin-shell__menu-button"
              isIconOnly
              onPress={() => setIsNavOpen(true)}
              size="sm"
              variant="tertiary"
            >
              <AppIcon name="menu" />
            </Button>
            <div>
              <p className="eyebrow">管理后台</p>
              <h1>{siteName} 控制台</h1>
            </div>
          </div>
          <div className="admin-shell__topbar-actions">
            <ThemeSwitcher />
            <div className="admin-account-dropdown">
              <Dropdown>
                <Button className="admin-user admin-user-button" variant="tertiary">
                  <Avatar size="sm">
                    {visibleAvatarUrl ? (
                      <Avatar.Image
                        alt={currentDisplayName}
                        key={visibleAvatarUrl}
                        onError={() => setBrokenAvatarUrl(visibleAvatarUrl)}
                        src={visibleAvatarUrl}
                      />
                    ) : null}
                    <Avatar.Fallback>{fallbackInitial}</Avatar.Fallback>
                  </Avatar>
                  <div className="admin-user__copy">
                    <strong>{currentDisplayName}</strong>
                    <span>{currentRole === "demo" ? "只读演示" : "管理员"}</span>
                  </div>
                  {session.isReadOnly ? (
                    <Chip color="warning" size="sm" variant="soft">
                      <Chip.Label>只读</Chip.Label>
                    </Chip>
                  ) : null}
                  <AppIcon name="chevronForward" size={14} />
                </Button>
                <Dropdown.Popover className="admin-account-menu">
                  <Dropdown.Menu onAction={(key) => handleAccountAction(String(key))}>
                    <Dropdown.Item id="front" textValue="返回前台">
                      <AppIcon name="home" />
                      <Label>返回前台</Label>
                    </Dropdown.Item>
                    <Dropdown.Item id="logout" textValue="退出登录" variant="danger">
                      <AppIcon name="logOut" />
                      <Label>退出登录</Label>
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </div>
          </div>
        </header>
        <AlertDialog>
          <Button aria-hidden="true" className="visually-hidden" type="button" variant="tertiary">
            打开账号操作确认
          </Button>
          <AlertDialog.Backdrop
            isOpen={pendingAccountAction !== undefined}
            onOpenChange={(isOpen) => {
              if (isOpen) return;
              setPendingAccountAction(undefined);
            }}
            variant="blur"
          >
            <AlertDialog.Container placement="center" size="sm">
              <AlertDialog.Dialog>
                <AlertDialog.CloseTrigger />
                <AlertDialog.Header>
                  <AlertDialog.Icon status={pendingAccountActionMeta.status} />
                  <AlertDialog.Heading>{pendingAccountActionMeta.heading}</AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <p>{pendingAccountActionMeta.body}</p>
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button slot="close" variant="tertiary">
                    取消
                  </Button>
                  <Button
                    onPress={confirmAccountAction}
                    slot="close"
                    variant={pendingAccountAction === "logout" ? "danger" : "primary"}
                  >
                    {pendingAccountActionMeta.confirmLabel}
                  </Button>
                </AlertDialog.Footer>
              </AlertDialog.Dialog>
            </AlertDialog.Container>
          </AlertDialog.Backdrop>
        </AlertDialog>
        <div className="admin-shell__subbar">
          <Breadcrumbs aria-label="后台面包屑" className="admin-breadcrumbs">
            <Breadcrumbs.Item href="/admin">
              <AppIcon name="home" />
              管理后台
            </Breadcrumbs.Item>
            <Breadcrumbs.Item href={currentRoute.path}>
              <AppIcon name={getAdminSectionIcon(currentRoute.section)} />
              {currentRoute.section}
            </Breadcrumbs.Item>
            <Breadcrumbs.Item href={currentRoute.path}>
              <AppIcon name={currentRoute.icon} />
              {currentRoute.label}
            </Breadcrumbs.Item>
          </Breadcrumbs>
          <ClosableTabs />
        </div>
        <main className="admin-shell__main" id="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
