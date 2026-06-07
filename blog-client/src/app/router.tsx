import type { ReactNode } from "react";
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AdminLayout } from "./admin/AdminLayout";
import { BlogLayout } from "./blog/BlogLayout";
import { NotFoundPage } from "./errors/404";
import { ServerErrorPage } from "./errors/500";
import {
  ArticlesPage,
  CategoryArticlesPage,
  ContributorArticlesPage,
  TagArticlesPage,
} from "../features/admin/content/ArticlesPage";
import { CategoriesPage } from "../features/admin/content/CategoriesPage";
import { CommentsPage } from "../features/admin/content/CommentsPage";
import { ContributorsPage } from "../features/admin/content/ContributorsPage";
import { MediaPage } from "../features/admin/content/MediaPage";
import { TagsPage } from "../features/admin/content/TagsPage";
import { AdminLoginPage } from "../features/admin/auth/AdminLoginPage";
import { AdminDashboardPage } from "../features/admin/dashboard/AdminDashboardPage";
import { SetupPage } from "../features/admin/setup/SetupPage";
import { ProfilePage } from "../features/admin/system/ProfilePage";
import { SiteSettingsPage } from "../features/admin/system/SiteSettingsPage";
import { ThemeSettingsPage } from "../features/admin/system/ThemeSettingsPage";
import { UsersPage } from "../features/admin/system/UsersPage";
import {
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  UserProfilePage,
  UserThemePage,
} from "../features/blog/auth/AuthPages";
import { BlogArticleDetailPage } from "../features/blog/articles/ArticleDetailPage";
import { BlogArticlesPage } from "../features/blog/articles/ArticlesPage";
import {
  ArchivesPage,
  ArticleListPage,
  CategoriesPage as BlogCategoriesPage,
  TagsPage as BlogTagsPage,
} from "../features/blog/articles/CollectionPages";
import { BlogHomePage } from "../features/blog/home/HomePage";
import { AboutAuthorPage, AboutSitePage, GuestbookPage } from "../features/blog/site/SitePages";
import { RequireAdminAccess, RequireSetupComplete } from "../shared/routing/adminGuards";

type PrismGlobal = typeof globalThis & {
  Prism?: unknown;
};

async function loadArticleEditPage() {
  const prismModule = await import("prismjs");
  (globalThis as PrismGlobal).Prism = prismModule.default;

  const articleEditPageModule = await import("../features/admin/content/ArticleEditPage");
  return { default: articleEditPageModule.ArticleEditPage };
}

const ArticleEditPage = lazy(loadArticleEditPage);

function RouteLoading() {
  return (
    <div aria-live="polite" role="status">
      页面加载中...
    </div>
  );
}

function lazyRoute(element: ReactNode) {
  return <Suspense fallback={<RouteLoading />}>{element}</Suspense>;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<BlogLayout />}>
          <Route index element={<BlogHomePage />} />
          <Route path="articles" element={<BlogArticlesPage />} />
          <Route path="articles/:slug" element={<BlogArticleDetailPage />} />
          <Route path="categories" element={<BlogCategoriesPage />} />
          <Route path="categories/:slug" element={<BlogCategoriesPage />} />
          <Route path="tags" element={<BlogTagsPage />} />
          <Route path="tags/:slug" element={<BlogTagsPage />} />
          <Route path="archives" element={<ArchivesPage />} />
          <Route path="list" element={<ArticleListPage />} />
          <Route path="about-site" element={<AboutSitePage />} />
          <Route path="about-author" element={<AboutAuthorPage />} />
          <Route path="guestbook" element={<GuestbookPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="profile" element={<UserProfilePage />} />
          <Route path="profile/theme" element={<UserThemePage />} />
        </Route>
        <Route path="admin/setup" element={<SetupPage />} />
        <Route
          element={
            <RequireSetupComplete>
              <AdminLoginPage />
            </RequireSetupComplete>
          }
          path="admin/login"
        />
        <Route
          element={
            <RequireAdminAccess>
              <AdminLayout />
            </RequireAdminAccess>
          }
        >
          <Route path="admin" element={<AdminDashboardPage />} />
          <Route path="admin/content/articles" element={<ArticlesPage />} />
          <Route path="admin/content/articles/new" element={lazyRoute(<ArticleEditPage />)} />
          <Route path="admin/content/articles/:id/edit" element={lazyRoute(<ArticleEditPage />)} />
          <Route path="admin/content/categories" element={<CategoriesPage />} />
          <Route path="admin/content/categories/:id/articles" element={<CategoryArticlesPage />} />
          <Route path="admin/content/tags" element={<TagsPage />} />
          <Route path="admin/content/tags/:id/articles" element={<TagArticlesPage />} />
          <Route path="admin/content/comments" element={<CommentsPage />} />
          <Route path="admin/content/contributors" element={<ContributorsPage />} />
          <Route
            path="admin/content/contributors/:id/articles"
            element={<ContributorArticlesPage />}
          />
          <Route path="admin/content/media" element={<MediaPage />} />
          <Route path="admin/system/users" element={<UsersPage />} />
          <Route path="admin/system/profile" element={<ProfilePage />} />
          <Route path="admin/system/settings" element={<ThemeSettingsPage />} />
          <Route path="admin/system/site" element={<SiteSettingsPage />} />
        </Route>
        <Route path="500" element={<ServerErrorPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
