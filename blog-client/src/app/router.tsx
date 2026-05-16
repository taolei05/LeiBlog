import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AdminLayout } from "./admin/AdminLayout";
import { BlogLayout } from "./blog/BlogLayout";
import { NotFoundPage } from "./errors/404";
import { ServerErrorPage } from "./errors/500";
import { ArticlesPage } from "../features/admin/content/ArticlesPage";
import { CategoriesPage } from "../features/admin/content/CategoriesPage";
import { CommentsPage } from "../features/admin/content/CommentsPage";
import { MediaPage } from "../features/admin/content/MediaPage";
import { TagsPage } from "../features/admin/content/TagsPage";
import { AdminLoginPage } from "../features/admin/auth/AdminLoginPage";
import { AdminDashboardPage } from "../features/admin/dashboard/AdminDashboardPage";
import { SetupPage } from "../features/admin/setup/SetupPage";
import { ProfilePage } from "../features/admin/system/ProfilePage";
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

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<BlogLayout />}>
          <Route index element={<BlogHomePage />} />
          <Route path="articles" element={<BlogArticlesPage />} />
          <Route path="articles/:slug" element={<BlogArticleDetailPage />} />
          <Route path="categories" element={<BlogCategoriesPage />} />
          <Route path="tags" element={<BlogTagsPage />} />
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
          <Route path="admin/content/categories" element={<CategoriesPage />} />
          <Route path="admin/content/tags" element={<TagsPage />} />
          <Route path="admin/content/comments" element={<CommentsPage />} />
          <Route path="admin/content/media" element={<MediaPage />} />
          <Route path="admin/system/users" element={<UsersPage />} />
          <Route path="admin/system/profile" element={<ProfilePage />} />
          <Route path="admin/system/settings" element={<ThemeSettingsPage />} />
        </Route>
        <Route path="500" element={<ServerErrorPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
