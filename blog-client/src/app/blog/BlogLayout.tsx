import { Button, SearchField } from "@heroui/react";
import type { FormEvent } from "react";
import type { AppIconName } from "../../shared/icons/AppIcon";
import type { PublicSiteInfo } from "../../shared/site/site-info";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { AppIcon } from "../../shared/icons/AppIcon";
import {
  applyFavicon,
  fetchPublicSiteInfo,
  getPreferredSiteLogo,
} from "../../shared/site/site-info";
import { ThemeSwitcher } from "../../shared/theme/ThemeSwitcher";
import { useTheme } from "../../shared/theme/ThemeProviderLite";
import { InteractiveCursor } from "./InteractiveCursor";

const primaryNavItems = [
  { to: "/", label: "主页", icon: "home" },
  { to: "/profile", label: "个人", icon: "personCircle" },
  { to: "/login", label: "登录", icon: "logIn" },
] as const;

const articleNavItems = [
  { to: "/articles", label: "全部文章", icon: "reader" },
  { to: "/categories", label: "类别", icon: "albums" },
  { to: "/tags", label: "标签", icon: "pricetags" },
  { to: "/archives", label: "归档", icon: "archive" },
  { to: "/list", label: "列表", icon: "list" },
] as const;

const siteNavItems = [
  { to: "/about-site", label: "关于本站", icon: "library" },
  { to: "/about-author", label: "关于作者", icon: "personCircle" },
  { to: "/guestbook", label: "留言板", icon: "chatbubbles" },
] as const;

type BlogNavLinkProps = {
  icon: AppIconName;
  label: string;
  to: string;
};

function BlogNavLink({ icon, label, to }: BlogNavLinkProps) {
  return (
    <NavLink
      className={({ isActive }) => (isActive ? "top-nav__link is-active" : "top-nav__link")}
      to={to}
    >
      <AppIcon name={icon} />
      <span>{label}</span>
    </NavLink>
  );
}

type BlogMenuProps = {
  icon: "reader" | "library";
  items: typeof articleNavItems | typeof siteNavItems;
  label: string;
};

function BlogMenu({ icon, items, label }: BlogMenuProps) {
  return (
    <details className="blog-nav-menu">
      <summary>
        <AppIcon name={icon} />
        <span>{label}</span>
        <AppIcon name="chevronForward" size={14} />
      </summary>
      <div className="blog-nav-menu__panel">
        {items.map((item) => (
          <BlogNavLink icon={item.icon} key={item.to} label={item.label} to={item.to} />
        ))}
      </div>
    </details>
  );
}

export function BlogLayout() {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [siteInfo, setSiteInfo] = useState<PublicSiteInfo>();
  const siteName = siteInfo?.siteName ?? "LeiBlog";
  const siteLogoUrl = getPreferredSiteLogo(siteInfo, resolvedTheme);

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
        <Button
          aria-label="打开前台菜单"
          className="blog-shell__menu-button"
          isIconOnly
          onPress={() => setIsMenuOpen((open) => !open)}
          variant="tertiary"
        >
          <AppIcon name={isMenuOpen ? "close" : "menu"} />
        </Button>
        <div className={isMenuOpen ? "blog-shell__actions is-open" : "blog-shell__actions"}>
          <form className="blog-search" onSubmit={submitSearch}>
            <SearchField
              aria-label="搜索文章"
              fullWidth
              onChange={setSearchQuery}
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
          <nav aria-label="前台主导航" className="top-nav">
            {primaryNavItems.map((item) => (
              <BlogNavLink icon={item.icon} key={item.to} label={item.label} to={item.to} />
            ))}
            <BlogMenu icon="reader" items={articleNavItems} label="文章" />
            <BlogMenu icon="library" items={siteNavItems} label="站点" />
          </nav>
          <ThemeSwitcher />
        </div>
      </header>
      <main className="blog-shell__main" id="main-content">
        <Outlet />
      </main>
    </div>
  );
}
