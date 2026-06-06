import { AlertDialog, Avatar, Button, Drawer, Dropdown, Label, SearchField } from "@heroui/react";
import type { FocusEvent, FormEvent } from "react";
import type { AppIconName } from "../../shared/icons/AppIcon";
import type {
  PublicSiteConfig,
  PublicSiteFiling,
  PublicSiteInfo,
} from "../../shared/site/site-info";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { getAdminApiBaseUrl, resolveApiAssetUrl } from "../../shared/api/api-base-url";
import { AppIcon } from "../../shared/icons/AppIcon";
import {
  applyFavicon,
  fetchPublicSiteConfig,
  fetchPublicSiteFiling,
  fetchPublicSiteInfo,
  getPreferredSiteLogo,
} from "../../shared/site/site-info";
import { ThemeSwitcher } from "../../shared/theme/ThemeSwitcher";
import { useTheme } from "../../shared/theme/ThemeProviderLite";
import { showOperationToast } from "../../shared/toast/operation-toast";
import { BlogFooter } from "./BlogFooter";
import { InteractiveCursor } from "./InteractiveCursor";

const primaryNavItems = [{ to: "/", label: "主页", icon: "home" }] as const;

const articleNavItems = [
  { to: "/articles", label: "全部文章", icon: "reader" },
  { to: "/categories", label: "类别", icon: "albums" },
  { to: "/tags", label: "标签", icon: "pricetags" },
  { to: "/archives", label: "归档", icon: "archive" },
] as const;

const siteNavItems = [
  { to: "/about-site", label: "关于本站", icon: "library" },
  { to: "/about-author", label: "关于作者", icon: "personCircle" },
  { to: "/guestbook", label: "留言板", icon: "chatbubbles" },
] as const;

const BLOG_SESSION_KEY = "leiblog:blog-session";
const BLOG_SESSION_CHANGE_EVENT = "leiblog:blog-session-change";
const AUTH_API_BASE_URL = getAdminApiBaseUrl();

type BlogNavItem = {
  readonly icon: AppIconName;
  readonly label: string;
  readonly to: string;
};

type BlogNavSession = {
  token: string;
  user: BlogNavUser;
};

type BlogNavUser = {
  avatarUrl: string | null;
  email: string | null;
  name: string | null;
  role: "admin" | "demo" | "user";
  username: string;
};

type BlogAccountMenuItem = {
  readonly icon: AppIconName;
  readonly id:
    | "admin"
    | "center"
    | "email"
    | "login"
    | "logout"
    | "password"
    | "profile"
    | "register";
  readonly label: string;
  readonly variant?: "danger";
};

export function getBlogAccountMenuItems(
  role: BlogNavUser["role"] | null | undefined,
): BlogAccountMenuItem[] {
  if (!role) {
    return [
      { icon: "logIn", id: "login", label: "登录" },
      { icon: "personAdd", id: "register", label: "注册账号" },
    ];
  }

  const items: BlogAccountMenuItem[] = [
    { icon: "personCircle", id: "center", label: "个人中心" },
    { icon: "create", id: "profile", label: "资料" },
    { icon: "mail", id: "email", label: "修改邮箱" },
    { icon: "lockClosed", id: "password", label: "修改密码" },
    { icon: "logOut", id: "logout", label: "退出登录", variant: "danger" },
  ];

  if (role !== "admin") {
    return items;
  }

  return [items[0], { icon: "desktop", id: "admin", label: "管理后台" }, ...items.slice(1)];
}

type BlogNavLinkProps = {
  icon: AppIconName;
  label: string;
  onNavigate?: () => void;
  to: string;
};

function BlogNavLink({ icon, label, onNavigate, to }: BlogNavLinkProps) {
  return (
    <NavLink
      className={({ isActive }) => (isActive ? "top-nav__link is-active" : "top-nav__link")}
      onClick={onNavigate}
      to={to}
    >
      <AppIcon name={icon} />
      <span>{label}</span>
    </NavLink>
  );
}

type BlogSearchFormProps = {
  onSearchChange: (query: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  searchQuery: string;
};

function BlogSearchForm({ onSearchChange, onSubmit, searchQuery }: BlogSearchFormProps) {
  return (
    <form className="blog-search" onSubmit={onSubmit}>
      <SearchField
        aria-label="搜索文章"
        fullWidth
        onChange={onSearchChange}
        value={searchQuery}
        variant="secondary"
      >
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder="搜索文章、标签、分类" />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
    </form>
  );
}

type BlogMenuProps = {
  icon: "reader" | "library";
  items: readonly BlogNavItem[];
  label: string;
  onNavigate: () => void;
  variant?: "desktop" | "drawer";
};

function BlogMenu({ icon, items, label, onNavigate, variant = "desktop" }: BlogMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDesktopMenu = variant === "desktop";

  function clearCloseTimer() {
    if (!closeTimerRef.current) return;
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }

  function closeMenu() {
    clearCloseTimer();
    setIsOpen(false);
  }

  function openMenu() {
    clearCloseTimer();
    setIsOpen(true);
  }

  function scheduleCloseMenu() {
    if (!isDesktopMenu) {
      closeMenu();
      return;
    }

    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
      closeTimerRef.current = null;
    }, 500);
  }

  function handleNavigate() {
    closeMenu();
    onNavigate();
  }

  function handleBlur(event: FocusEvent<HTMLElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    closeMenu();
  }

  useEffect(() => {
    return () => {
      if (!closeTimerRef.current) return;
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    };
  }, []);

  return (
    <details
      className={`blog-nav-menu blog-nav-menu--${variant}`}
      onBlur={handleBlur}
      onMouseEnter={() => {
        if (isDesktopMenu) openMenu();
      }}
      onMouseLeave={() => {
        if (isDesktopMenu) scheduleCloseMenu();
      }}
      open={isOpen}
    >
      <summary
        onClick={(event) => {
          event.preventDefault();
          clearCloseTimer();
          setIsOpen((open) => !open);
        }}
      >
        <AppIcon name={icon} />
        <span>{label}</span>
        <AppIcon name="chevronForward" size={14} />
      </summary>
      <div className="blog-nav-menu__panel">
        {items.map((item) => (
          <BlogNavLink
            icon={item.icon}
            key={item.to}
            label={item.label}
            onNavigate={handleNavigate}
            to={item.to}
          />
        ))}
      </div>
    </details>
  );
}

type BlogNavigationProps = {
  onNavigate: () => void;
  variant?: "desktop" | "drawer";
};

function BlogNavigation({ onNavigate, variant = "desktop" }: BlogNavigationProps) {
  return (
    <nav aria-label="前台主导航" className={`top-nav top-nav--${variant}`}>
      {primaryNavItems.map((item) => (
        <BlogNavLink
          icon={item.icon}
          key={item.to}
          label={item.label}
          onNavigate={onNavigate}
          to={item.to}
        />
      ))}
      <BlogMenu
        icon="reader"
        items={articleNavItems}
        label="文章"
        onNavigate={onNavigate}
        variant={variant}
      />
      <BlogMenu
        icon="library"
        items={siteNavItems}
        label="站点"
        onNavigate={onNavigate}
        variant={variant}
      />
    </nav>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readNullableString(value: unknown) {
  const stringValue = readString(value).trim();
  return stringValue ? stringValue : null;
}

function readBlogNavUser(value: unknown): BlogNavUser | null {
  if (!isRecord(value)) return null;

  const user = value.user;
  if (!isRecord(user)) return null;

  const username = readString(user.username);
  if (!username) return null;

  const role = user.role === "admin" || user.role === "demo" ? user.role : "user";

  return {
    avatarUrl: readNullableString(user.avatarUrl),
    email: readNullableString(user.email),
    name: readNullableString(user.name),
    role,
    username,
  };
}

function readCurrentBlogNavSession() {
  if (typeof window === "undefined") return null;

  try {
    const storedValue = window.localStorage.getItem(BLOG_SESSION_KEY);
    if (!storedValue) return null;

    const session = JSON.parse(storedValue) as unknown;
    if (!isRecord(session)) return null;

    const token = readString(session.token);
    const user = readBlogNavUser(session);

    if (!token || !user) return null;

    return { token, user };
  } catch {
    return null;
  }
}

type BlogAccountDropdownProps = {
  onSessionClear: () => void;
  session: BlogNavSession | null;
};

function clearBlogSession() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(BLOG_SESSION_KEY);
  window.dispatchEvent(new Event(BLOG_SESSION_CHANGE_EVENT));
}

async function logoutBlogSession(token: string) {
  const response = await fetch(`${AUTH_API_BASE_URL}/auth/logout`, {
    headers: { Authorization: `Bearer ${token}` },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`);
  }
}

function BlogAccountDropdown({ onSessionClear, session }: BlogAccountDropdownProps) {
  const navigate = useNavigate();
  const [brokenAvatarUrl, setBrokenAvatarUrl] = useState<string>();
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const user = session?.user ?? null;
  const displayName = user?.name || user?.username || "游客";
  const roleLabel = user
    ? user.role === "admin"
      ? "管理员"
      : user.role === "demo"
        ? "演示账号"
        : "普通用户"
    : "登录或注册";
  const avatarUrl = resolveApiAssetUrl(user?.avatarUrl);
  const visibleAvatarUrl = avatarUrl && avatarUrl !== brokenAvatarUrl ? avatarUrl : undefined;
  const fallbackInitial = user ? displayName.slice(0, 1).toUpperCase() || "访" : "游";

  useEffect(() => {
    setBrokenAvatarUrl(undefined);
  }, [avatarUrl]);

  function handleAccountAction(key: string) {
    if (key === "login") {
      void navigate("/login");
      return;
    }

    if (key === "register") {
      void navigate("/register");
      return;
    }

    if (key === "admin") {
      void navigate("/admin");
      return;
    }

    if (key === "profile" || key === "email" || key === "password") {
      void navigate(`/profile?panel=${key}`);
      return;
    }

    if (key === "logout") {
      setIsLogoutConfirmOpen(true);
      return;
    }

    if (key === "center") {
      void navigate("/profile");
    }
  }

  async function confirmLogout() {
    if (!session) return;

    setIsLoggingOut(true);

    try {
      await logoutBlogSession(session.token);
      showOperationToast("退出登录成功");
    } catch (error) {
      showOperationToast(
        error instanceof Error ? `退出登录失败：${error.message}` : "退出登录失败",
      );
    } finally {
      clearBlogSession();
      onSessionClear();
      setIsLoggingOut(false);
      setIsLogoutConfirmOpen(false);
      void navigate("/profile");
    }
  }

  return (
    <div className="blog-account-dropdown">
      <Dropdown>
        <Button className="admin-user admin-user-button blog-account-button" variant="tertiary">
          <Avatar size="sm">
            {visibleAvatarUrl ? (
              <Avatar.Image
                alt={displayName}
                key={visibleAvatarUrl}
                onError={() => setBrokenAvatarUrl(visibleAvatarUrl)}
                src={visibleAvatarUrl}
              />
            ) : null}
            <Avatar.Fallback>{fallbackInitial}</Avatar.Fallback>
          </Avatar>
          <div className="admin-user__copy blog-account-button__copy">
            <strong>{displayName}</strong>
            <span>{roleLabel}</span>
          </div>
          <AppIcon name="chevronForward" size={14} />
        </Button>
        <Dropdown.Popover className="admin-account-menu blog-account-menu">
          <Dropdown.Menu onAction={(key) => handleAccountAction(String(key))}>
            {getBlogAccountMenuItems(user?.role).map((item) => (
              <Dropdown.Item
                id={item.id}
                key={item.id}
                textValue={item.label}
                variant={item.variant}
              >
                <AppIcon name={item.icon} />
                <Label>{item.label}</Label>
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      <AlertDialog>
        <AlertDialog.Backdrop
          isOpen={isLogoutConfirmOpen}
          onOpenChange={(isOpen) => {
            if (isOpen) return;
            setIsLogoutConfirmOpen(false);
          }}
          variant="blur"
        >
          <AlertDialog.Container placement="center" size="sm">
            <AlertDialog.Dialog>
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>确认退出登录？</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>退出后需要重新登录才能维护前台个人资料和参与互动。</p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="tertiary">
                  取消
                </Button>
                <Button
                  isDisabled={isLoggingOut}
                  onPress={confirmLogout}
                  slot="close"
                  variant="danger"
                >
                  确认退出
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </div>
  );
}

type BlogMobileDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onSearchChange: (query: string) => void;
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSessionClear: () => void;
  searchQuery: string;
  session: BlogNavSession | null;
  siteLogoUrl?: string;
  siteName: string;
};

function BlogMobileDrawer({
  isOpen,
  onClose,
  onSearchChange,
  onSearchSubmit,
  onSessionClear,
  searchQuery,
  session,
  siteLogoUrl,
  siteName,
}: BlogMobileDrawerProps) {
  return (
    <Drawer.Backdrop
      isOpen={isOpen}
      onOpenChange={(nextIsOpen) => {
        if (!nextIsOpen) onClose();
      }}
    >
      <Drawer.Content className="blog-mobile-nav-drawer__content" placement="right">
        <Drawer.Dialog aria-label="前台导航菜单" className="blog-mobile-nav-drawer__dialog">
          <Drawer.CloseTrigger />
          <Drawer.Header className="blog-mobile-nav-drawer__header">
            <NavLink
              aria-label={`${siteName} 首页`}
              className="brand-link blog-brand"
              onClick={onClose}
              to="/"
            >
              {siteLogoUrl ? (
                <img alt="" className="blog-brand__image" src={siteLogoUrl} />
              ) : (
                <span aria-hidden="true" className="brand-mark">
                  {siteName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span>{siteName}</span>
            </NavLink>
            <div className="blog-mobile-nav-drawer__controls">
              <BlogAccountDropdown onSessionClear={onSessionClear} session={session} />
            </div>
          </Drawer.Header>
          <Drawer.Body className="blog-mobile-nav-drawer__body">
            <BlogSearchForm
              onSearchChange={onSearchChange}
              onSubmit={onSearchSubmit}
              searchQuery={searchQuery}
            />
            <BlogNavigation onNavigate={onClose} variant="drawer" />
          </Drawer.Body>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}

export function BlogLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [siteConfig, setSiteConfig] = useState<PublicSiteConfig | null>(null);
  const [siteFiling, setSiteFiling] = useState<PublicSiteFiling | null>(null);
  const [siteInfo, setSiteInfo] = useState<PublicSiteInfo>();
  const [navSession, setNavSession] = useState<BlogNavSession | null>(() =>
    readCurrentBlogNavSession(),
  );
  const siteName = siteInfo?.siteName ?? "LeiBlog";
  const siteLogoUrl = getPreferredSiteLogo(siteInfo, resolvedTheme);

  useEffect(() => {
    setSearchQuery(new URLSearchParams(location.search).get("q") ?? "");
  }, [location.search]);

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
    let isActive = true;

    async function loadFooterData() {
      const [configResult, filingResult] = await Promise.allSettled([
        fetchPublicSiteConfig(),
        fetchPublicSiteFiling(),
      ]);

      if (!isActive) return;

      setSiteConfig(configResult.status === "fulfilled" ? configResult.value : null);
      setSiteFiling(filingResult.status === "fulfilled" ? filingResult.value : null);
    }

    void loadFooterData();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    applyFavicon(siteInfo?.faviconUrl);
  }, [siteInfo?.faviconUrl]);

  useEffect(() => {
    function syncNavUser() {
      setNavSession(readCurrentBlogNavSession());
    }

    window.addEventListener(BLOG_SESSION_CHANGE_EVENT, syncNavUser);
    window.addEventListener("storage", syncNavUser);
    window.addEventListener("focus", syncNavUser);

    return () => {
      window.removeEventListener(BLOG_SESSION_CHANGE_EVENT, syncNavUser);
      window.removeEventListener("storage", syncNavUser);
      window.removeEventListener("focus", syncNavUser);
    };
  }, []);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();

    void navigate(query ? `/articles?q=${encodeURIComponent(query)}` : "/articles");
    setIsMenuOpen(false);
  }

  return (
    <div className="blog-shell">
      <InteractiveCursor />
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <header className="blog-shell__header">
        <NavLink aria-label={`${siteName} 首页`} className="brand-link blog-brand" to="/">
          {siteLogoUrl ? (
            <img alt="" className="blog-brand__image" src={siteLogoUrl} />
          ) : (
            <span aria-hidden="true" className="brand-mark">
              {siteName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span>{siteName}</span>
        </NavLink>
        <div className="blog-shell__header-controls">
          <ThemeSwitcher />
          <BlogAccountDropdown onSessionClear={() => setNavSession(null)} session={navSession} />
          <Button
            aria-label="打开前台菜单"
            className="blog-shell__menu-button"
            isIconOnly
            onPress={() => setIsMenuOpen((open) => !open)}
            variant="tertiary"
          >
            <AppIcon name={isMenuOpen ? "close" : "menu"} />
          </Button>
        </div>
        <div className="blog-shell__actions">
          <BlogSearchForm
            onSearchChange={setSearchQuery}
            onSubmit={submitSearch}
            searchQuery={searchQuery}
          />
          <BlogNavigation onNavigate={() => setIsMenuOpen(false)} />
        </div>
      </header>
      <BlogMobileDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onSearchChange={setSearchQuery}
        onSearchSubmit={submitSearch}
        onSessionClear={() => setNavSession(null)}
        searchQuery={searchQuery}
        session={navSession}
        siteLogoUrl={siteLogoUrl}
        siteName={siteName}
      />
      <main className="blog-shell__main" id="main-content">
        <Outlet />
      </main>
      <BlogFooter siteConfig={siteConfig} siteFiling={siteFiling} siteInfo={siteInfo} />
    </div>
  );
}
