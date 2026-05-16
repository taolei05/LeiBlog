import { Avatar, Breadcrumbs, Button, Chip, SearchField } from "@heroui/react";
import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { AppIcon } from "../../shared/icons";
import { signOutAdminSession, useAdminSession } from "../../shared/routing/adminGuards";
import { ThemeSwitcher } from "../../shared/theme/ThemeSwitcher";
import { adminNavigationGroups, getAdminRouteMeta } from "./adminNavigation";
import { ClosableTabs } from "./ClosableTabs";

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = useAdminSession();
  const currentRoute = getAdminRouteMeta(location.pathname);
  const [isNavOpen, setIsNavOpen] = useState(false);

  return (
    <div className="admin-shell">
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
      <aside className={isNavOpen ? "admin-shell__sidebar is-open" : "admin-shell__sidebar"}>
        <div className="admin-shell__sidebar-header">
          <NavLink aria-label="LeiBlog 首页" className="brand-link" to="/">
            <span aria-hidden="true" className="brand-mark">
              L
            </span>
            <span>LeiBlog</span>
          </NavLink>
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
                  <NavLink
                    className={({ isActive }) =>
                      isActive ? "side-nav__link is-active" : "side-nav__link"
                    }
                    end={item.path === "/admin"}
                    key={item.path}
                    onClick={() => setIsNavOpen(false)}
                    to={item.path}
                  >
                    <AppIcon name={item.icon} />
                    <span>{item.label}</span>
                  </NavLink>
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
              <h1>LeiBlog 控制台</h1>
            </div>
          </div>
          <div className="admin-shell__topbar-actions">
            <SearchField aria-label="搜索后台" className="admin-search admin-search--topbar">
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="搜索文章、用户、媒体" />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <ThemeSwitcher />
            <div className="admin-user">
              <Avatar size="sm">
                <Avatar.Fallback>{session.displayName.slice(0, 1)}</Avatar.Fallback>
              </Avatar>
              <div className="admin-user__copy">
                <strong>{session.displayName}</strong>
                <span>{session.role === "demo" ? "只读演示" : "管理员"}</span>
              </div>
              {session.isReadOnly ? (
                <Chip color="warning" size="sm" variant="soft">
                  <Chip.Label>只读</Chip.Label>
                </Chip>
              ) : null}
            </div>
            <Button
              onPress={() => {
                signOutAdminSession();
                void navigate("/admin/login", { replace: true });
              }}
              variant="tertiary"
            >
              <AppIcon name="logOut" />
              退出
            </Button>
            <NavLink className="text-link" to="/">
              <AppIcon name="home" />
              返回前台
            </NavLink>
          </div>
        </header>
        <div className="admin-shell__subbar">
          <Breadcrumbs aria-label="后台面包屑" className="admin-breadcrumbs">
            <Breadcrumbs.Item href="/admin">
              <AppIcon name="home" />
              管理后台
            </Breadcrumbs.Item>
            <Breadcrumbs.Item href={currentRoute.path}>
              <AppIcon name={currentRoute.icon} />
              {currentRoute.section}
            </Breadcrumbs.Item>
            <Breadcrumbs.Item href={currentRoute.path}>{currentRoute.label}</Breadcrumbs.Item>
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
