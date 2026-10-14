import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ChangeEvent,
  ComponentPropsWithRef,
  CSSProperties,
  FormEvent,
  MouseEvent,
  ReactNode,
  SVGProps,
} from "react";
import {
  Archive,
  AtSign,
  BookOpen,
  Bookmark,
  ChevronDown,
  Clock3,
  ExternalLink,
  FolderOpen,
  Home,
  KeyRound,
  LayoutDashboard,
  Library,
  LogOut,
  Mail,
  Map,
  MapPin,
  Menu,
  MessageSquareText,
  MonitorCheck,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  Tags,
  Upload,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";

import { AppShell } from "@astryxdesign/core/AppShell";
import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import {
  CommandPalette,
  CommandPaletteFooter,
  CommandPaletteInput,
} from "@astryxdesign/core/CommandPalette";
import { Dialog } from "@astryxdesign/core/Dialog";
import { Divider } from "@astryxdesign/core/Divider";
import { Heading } from "@astryxdesign/core/Heading";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Kbd } from "@astryxdesign/core/Kbd";
import { LinkProvider } from "@astryxdesign/core/Link";
import { MobileNav } from "@astryxdesign/core/MobileNav";
import { Popover } from "@astryxdesign/core/Popover";
import { SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { HStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Switch } from "@astryxdesign/core/Switch";
import { Theme } from "@astryxdesign/core/theme";
import type { ThemeMode } from "@astryxdesign/core/theme";
import type { SearchSource, SearchableItem } from "@astryxdesign/core/Typeahead";
import {
  TopNav,
  TopNavHeading,
  TopNavItem,
  TopNavMegaMenu,
  TopNavMegaMenuFeaturedCard,
  TopNavMegaMenuItem,
} from "@astryxdesign/core/TopNav";
import { useHotkeys, useMediaQuery } from "@astryxdesign/core/hooks";

import { changeAppLanguage, i18n, normalizeLanguage } from "../../../shared/i18n";
import type { AppLanguage } from "../../../shared/i18n";
import type {
  AdminSocialLink,
  ArticleCategory,
  ArticleContent,
  ArticleTag,
  AuthProvider,
  BlogAuthState,
  BlogEmailCodePurpose,
  BlogUser,
  PublicAuthProvider,
  PublicSiteSettings,
} from "../../../shared/admin-api";
import {
  changeBlogUserEmail,
  changeBlogUserPassword,
  createBlogOAuthStartUrl,
  getPublicArticleCategories,
  getPublicArticles,
  getPublicArticleTags,
  getBlogOAuthProviders,
  getBlogMe,
  getPublicSiteSettings,
  loginBlogUser,
  logoutBlogUser,
  registerBlogUser,
  requestBlogAccountEmailCode,
  requestBlogEmailCode,
  resetBlogPassword,
  updateBlogUserProfile,
  uploadBlogUserAvatar,
} from "../../../shared/admin-api";
import { neutralTheme } from "../../../shared/themes/neutral/neutral";
import { getAltchaSuccessMessage } from "../../../shared/altcha-feedback";
import type { AltchaFeedback } from "../../../shared/altcha-feedback";
import {
  formatDateInTimeZone,
  formatDateTimeInTimeZone,
  normalizeTimeZone,
} from "../../../shared/time-zone";
import { canEditLocalImageFile, LocalImageEditorDialog } from "../../../shared/local-image-editor";
import {
  getAltchaVerificationDialogCopy,
  useAltchaVerificationDialog,
} from "../../../shared/altcha-challenge";
import { FrontPageHero } from "./FrontPageHero";
import {
  getSafeLinkUrl,
  resolveContentAssetUrl as resolveApiAssetUrl,
} from "../../../shared/content-url";
import { createAuthSessionGuard } from "../../../shared/auth-session";
import { NavigationPage } from "./NavigationPage";
import { AboutAuthorPage, AboutSitePage } from "./SitePages";
import {
  ArchivesPage,
  ArticleDetailPage,
  ArticlesPage,
  CategoriesPage,
  CategoryArticlesPage,
  GuestbookPage,
  TagArticlesPage,
  TagsPage,
} from "./ArticlePages";

type NavItem = {
  copyKey: NavItemCopyKey;
  icon: ReactNode;
  path: string;
};

type NavGroup = {
  copyKey: NavGroupCopyKey;
  icon: ReactNode;
  items: readonly NavItem[];
};

type PageMeta = {
  description: string;
  eyebrow: string;
  title: string;
};

type SiteBrandContent = {
  coverUrls: string[];
  description: string;
  faviconUrl: string;
  logoUrl: string;
  name: string;
};

type SiteBrandContentParameters = {
  copy: FrontCopy;
  language: AppLanguage;
  settings?: PublicSiteSettings;
  themeMode: AppThemeMode;
};

type SiteAuthorContent = {
  avatarUrl: string;
  bio: string;
  blogUrl: string;
  name: string;
  socialLinks: AdminSocialLink[];
  tags: string[];
  username: string;
};

type SiteAuthorContentParameters = {
  copy: FrontCopy;
  language: AppLanguage;
  settings?: PublicSiteSettings;
};

type SiteFooterFilingLink = {
  key: string;
  number: string;
  url?: string;
};

type Article = {
  category: string;
  commentCount?: number;
  coverImageUrl?: string | null;
  date: string;
  isPinned?: boolean;
  path: string;
  readTime: string;
  readCount?: number;
  summary: string;
  title: string;
};

type HomeTaxonomyItem = {
  color?: string | null;
  count?: number;
  label: string;
  path: string;
};

type SearchCommandKind = "navigation" | "article" | "query";

type SearchCommandData = {
  description: string;
  group: string;
  icon: ReactNode;
  keywords: readonly string[];
  kind: SearchCommandKind;
  path?: string;
  query?: string;
};

type SearchCommandItem = SearchableItem<SearchCommandData> & {
  auxiliaryData: SearchCommandData;
};

type NavItemCopyKey =
  | "archives"
  | "articles"
  | "author"
  | "categories"
  | "guestbook"
  | "home"
  | "navigation"
  | "site"
  | "tags";

type NavGroupCopyKey = "article" | "site";

type FrontCopy = {
  auth: AuthCopy;
  articleDetailMeta: PageMeta;
  articleSections: {
    all: string;
    latest: string;
    latestEmpty: string;
    pinned: string;
    pinnedEmpty: string;
  };
  author: {
    bio: string;
    name: string;
    website: string;
  };
  brandDescription: string;
  fallbackPageMeta: PageMeta;
  footer: {
    runtime: (seconds: number) => string;
    tagline: string;
  };
  hero: {
    archiveAction: string;
    articlesAction: string;
    badge: string;
    slogan: string;
  };
  homeSidebarLabel: string;
  intro: {
    description: string;
    eyebrow: string;
    title: string;
  };
  megaMenuFeatured: Record<
    NavGroupCopyKey,
    {
      description: string;
      linkLabel: string;
      title: string;
    }
  >;
  mobile: {
    close: string;
    open: string;
  };
  navGroups: Record<NavGroupCopyKey, string>;
  navItems: Record<NavItemCopyKey, { description: string; label: string }>;
  navLabel: string;
  pageMeta: Record<string, PageMeta>;
  placeholder: {
    next: string;
    nextValue: string;
    status: string;
    statusValue: string;
  };
  search: {
    buttonLabel: string;
    emptyBootstrap: string;
    emptySearch: string;
    footerClose: string;
    footerNavigate: string;
    footerSelect: string;
    label: string;
    placeholder: string;
    queryGroup: string;
    queryPrefix: string;
  };
  taxonomy: {
    categoriesEmpty: string;
    categoriesTitle: string;
    tagsEmpty: string;
    tagsTitle: string;
  };
  theme: {
    dark: string;
    light: string;
  };
};

type AuthCopy = {
  account: {
    adminRole: string;
    openAdmin: string;
    entry: string;
    logoutCancel: string;
    logoutConfirm: string;
    logoutConfirmDescription: string;
    logoutConfirmTitle: string;
    logoutFailed: string;
    logout: string;
    profileLabel: string;
    userRole: string;
  };
  dialog: {
    codeValidFor: (minutes: number) => string;
    codeDevPrefix: string;
    codeSent: string;
    close: string;
    forgotDescription: string;
    forgotLink: string;
    forgotPrompt: string;
    forgotTitle: string;
    loginAction: string;
    loginDescription: string;
    loginFailed: (reason: string) => string;
    loginFailureFallback: string;
    loginPrompt: string;
    loginSuccess: string;
    loginTitle: string;
    oauthFailed: string;
    oauthSuccess: string;
    placeholderUnavailable: string;
    registerAction: string;
    registerDescription: string;
    registerFailed: (reason: string) => string;
    registerFailureFallback: string;
    registerPrompt: string;
    registerSuccess: string;
    registerTitle: string;
    resetFailed: (reason: string) => string;
    resetFailureFallback: string;
    resetSuccess: string;
    socialDivider: string;
    title: string;
  };
  fields: {
    code: string;
    confirmPassword: string;
    email: string;
    identifier: string;
    name: string;
    password: string;
    username: string;
  };
  modes: {
    forgot: string;
    login: string;
    register: string;
  };
  placeholders: {
    code: string;
    confirmPassword: string;
    email: string;
    identifier: string;
    name: string;
    password: string;
    username: string;
  };
  profile: {
    avatarChoose: string;
    avatarClear: string;
    avatarOnlyImage: string;
    avatarPending: (fileName: string) => string;
    avatarUrl: string;
    blogUrl: string;
    cancel: string;
    changeEmail: string;
    changeEmailFailed: (reason: string) => string;
    changeEmailFailureFallback: string;
    changeEmailSuccess: string;
    changePassword: string;
    changePasswordFailed: (reason: string) => string;
    changePasswordFailureFallback: string;
    changePasswordSuccess: string;
    changingEmail: string;
    changingPassword: string;
    commentNotifications: string;
    currentEmail: string;
    currentEmailCode: string;
    currentPasswordRequired: string;
    currentPassword: string;
    description: string;
    displayInfo: string;
    emailDescription: string;
    emailSecurityHint: string;
    emailTitle: string;
    emailUnchanged: string;
    joinedAt: string;
    lastLogin: string;
    loginDevice: string;
    loginInfo: string;
    loginInfoEmpty: string;
    loginIp: string;
    loginLocalNetwork: string;
    loginLocation: string;
    loginMethod: string;
    loginMethodApple: string;
    loginMethodGithub: string;
    loginMethodGoogle: string;
    loginMethodPassword: string;
    loginUnrecordedDevice: string;
    loginUnknownLocation: string;
    newEmail: string;
    newEmailCode: string;
    newPassword: string;
    notConnected: string;
    notificationsDescription: string;
    notificationsTitle: string;
    open: string;
    newPostNotifications: string;
    passwordCode: string;
    passwordDescription: string;
    passwordMethodCode: string;
    passwordMethodPassword: string;
    passwordSecurityHint: string;
    passwordTitle: string;
    publicBio: string;
    save: string;
    saveFailed: (reason: string) => string;
    saveFailureFallback: string;
    saved: string;
    saving: string;
    securityDescription: string;
    securityTitle: string;
    sendCurrentEmailCode: string;
    sendNewEmailCode: string;
    sendPasswordCode: string;
    statusPending: string;
    tagPlaceholder: string;
    tags: string;
    title: string;
    usernameRequired: string;
  };
  social: {
    apple: string;
    github: string;
    google: string;
  };
  submit: {
    forgot: string;
    login: string;
    register: string;
    retryIn: (seconds: number) => string;
    sendingCode: string;
    sendCode: string;
    working: string;
  };
  validation: {
    codeRequired: string;
    emailRequired: string;
    identifierRequired: string;
    passwordMismatch: string;
    passwordRequired: string;
    passwordTooShort: string;
    humanRequired: string;
    usernameRequired: string;
  };
};

const THEME_STORAGE_KEY = "leiblog-theme";
const EMAIL_CODE_COOLDOWN_SECONDS = 60;
const DEFAULT_EMAIL_CODE_VALID_MINUTES = 10;
const APP_THEME_MODES = ["light", "dark"] as const;
type AppThemeMode = Extract<ThemeMode, (typeof APP_THEME_MODES)[number]>;

const normalizeThemeMode = (mode?: string | null): AppThemeMode =>
  mode === "dark" ? "dark" : "light";

const getInitialThemeMode = (): AppThemeMode => {
  if (typeof window === "undefined") {
    return "light";
  }

  const savedMode = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedMode !== null) {
    return normalizeThemeMode(savedMode);
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const getInitialLanguage = (): AppLanguage =>
  normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);

const primaryNavItems: readonly NavItem[] = [
  {
    copyKey: "home",
    icon: <Home size={16} />,
    path: "/",
  },
  {
    copyKey: "navigation",
    icon: <Map size={16} />,
    path: "/navigation",
  },
] as const;

const articleNavItems: readonly NavItem[] = [
  {
    copyKey: "articles",
    icon: <BookOpen size={16} />,
    path: "/articles",
  },
  {
    copyKey: "categories",
    icon: <FolderOpen size={16} />,
    path: "/categories",
  },
  {
    copyKey: "tags",
    icon: <Tags size={16} />,
    path: "/tags",
  },
  {
    copyKey: "archives",
    icon: <Archive size={16} />,
    path: "/archives",
  },
] as const;

const siteNavItems: readonly NavItem[] = [
  {
    copyKey: "site",
    icon: <Library size={16} />,
    path: "/about-site",
  },
  {
    copyKey: "author",
    icon: <UserRound size={16} />,
    path: "/about-author",
  },
  {
    copyKey: "guestbook",
    icon: <MessageSquareText size={16} />,
    path: "/guestbook",
  },
] as const;

const navGroups: readonly NavGroup[] = [
  {
    copyKey: "article",
    icon: <BookOpen size={16} />,
    items: articleNavItems,
  },
  {
    copyKey: "site",
    icon: <Library size={16} />,
    items: siteNavItems,
  },
] as const;

const navGroupFeaturedLinks: Record<NavGroupCopyKey, string> = {
  article: "/articles",
  site: "/about-site",
};

const SEARCH_QUERY_COMMAND_PREFIX = "query:";

const zhPageMetaByPath: Record<string, PageMeta> = {
  "/": {
    description: "置顶内容、最新文章和站点入口集中在首页。",
    eyebrow: "主页",
    title: "LeiBlog",
  },
  "/navigation": {
    description: "集中展示后台维护的常用工具、服务和外部链接。",
    eyebrow: "导航页",
    title: "导航页",
  },
  "/articles": {
    description: "浏览所有公开文章和近期记录。",
    eyebrow: "文章索引",
    title: "全部文章",
  },
  "/categories": {
    description: "按内容主题浏览文章分类和分类下的文章。",
    eyebrow: "分类索引",
    title: "文章分类",
  },
  "/tags": {
    description: "按标签聚合主题与关联文章。",
    eyebrow: "标签索引",
    title: "全部标签",
  },
  "/archives": {
    description: "按发布时间回看所有公开文章。",
    eyebrow: "文章索引",
    title: "文章归档",
  },
  "/about-site": {
    description: "了解站点定位、内容结构、技术栈和维护信息。",
    eyebrow: "站点",
    title: "关于本站",
  },
  "/about-author": {
    description: "了解作者资料、技术兴趣和公开联系方式。",
    eyebrow: "站点",
    title: "关于作者",
  },
  "/guestbook": {
    description: "把问题、建议和想继续聊的话题留在这里。",
    eyebrow: "站点",
    title: "留言板",
  },
  "/profile": {
    description: "管理前台账号资料、邮箱通知和账号安全入口。",
    eyebrow: "账号",
    title: "个人中心",
  },
};

const enPageMetaByPath: Record<string, PageMeta> = {
  "/": {
    description: "Pinned writing, latest articles, and site entry points live on the home page.",
    eyebrow: "Home",
    title: "LeiBlog",
  },
  "/navigation": {
    description: "Browse useful tools, services, and external links managed in the console.",
    eyebrow: "Navigation",
    title: "Navigation",
  },
  "/articles": {
    description: "Browse all public articles and recent notes.",
    eyebrow: "Article Index",
    title: "All Articles",
  },
  "/categories": {
    description: "Browse article categories and the writing inside them.",
    eyebrow: "Category Index",
    title: "Article Categories",
  },
  "/tags": {
    description: "Collect topics and related articles by tag.",
    eyebrow: "Tag Index",
    title: "All Tags",
  },
  "/archives": {
    description: "Review public articles by publication time.",
    eyebrow: "Article Index",
    title: "Article Archives",
  },
  "/about-site": {
    description: "Site purpose, content structure, technology stack, and maintenance details.",
    eyebrow: "Site",
    title: "About Site",
  },
  "/about-author": {
    description: "Author profile, technical interests, and public contact links.",
    eyebrow: "Site",
    title: "About Author",
  },
  "/guestbook": {
    description: "Leave questions, suggestions, or topics you want to keep talking about.",
    eyebrow: "Site",
    title: "Guestbook",
  },
  "/profile": {
    description: "Manage public profile, email notifications, and account security entries.",
    eyebrow: "Account",
    title: "Profile",
  },
};

const homeCoverPath = "/uploads/media/2026/10/4f4cba20-d785-44e5-9fc1-70797d198d76.png";
const HOME_LATEST_ARTICLE_LIMIT = 6;
const HOME_PINNED_ARTICLE_LIMIT = 4;

const homeArticles: readonly Article[] = [
  {
    category: "工程手记",
    date: "2026/10/01",
    isPinned: true,
    path: "/articles/admin-settings-i18n",
    readTime: "6 分钟",
    summary: "记录后台设置页从资料保存到中英文内容共存的实现思路。",
    title: "把后台资料的中英文内容跑通",
  },
  {
    category: "产品记录",
    date: "2026/09/28",
    isPinned: true,
    path: "/articles/media-library-first-pass",
    readTime: "5 分钟",
    summary: "媒体库先完成上传、预览、列表和批量操作，再逐步接入更完整的资产流。",
    title: "媒体库的第一版应该先好用",
  },
  {
    category: "前台体验",
    date: "2026/09/22",
    path: "/articles/frontend-shell",
    readTime: "4 分钟",
    summary: "一个博客前台需要安静、可读，并且把导航和内容入口放在读者期待的位置。",
    title: "先让前台像一个真正的博客",
  },
  {
    category: "随笔",
    date: "2026/09/16",
    path: "/articles/small-useful-things",
    readTime: "3 分钟",
    summary: "做代码、做产品，也记录一些真正有用的小事。",
    title: "记录一些真正有用的小事",
  },
] as const;

const categories = [
  { count: 12, label: "工程手记", path: "/categories/engineering-notes" },
  { count: 8, label: "产品记录", path: "/categories/product-notes" },
  { count: 6, label: "前台体验", path: "/categories/frontend-experience" },
] as const;

const tags = [
  { color: "#7d114c", label: "作者", path: "/tags/author" },
  { color: "#1f6f78", label: "管理员", path: "/tags/admin" },
  { color: "#2563eb", label: "前端", path: "/tags/frontend" },
  { color: "#7c3aed", label: "媒体库", path: "/tags/media" },
  { color: "#dc2626", label: "翻译", path: "/tags/translation" },
] as const;

const enHomeArticles: readonly Article[] = [
  {
    category: "Engineering",
    date: "2026/10/01",
    isPinned: true,
    path: "/articles/admin-settings-i18n",
    readTime: "6 min",
    summary: "Notes on saving admin profiles and storing Chinese and English content together.",
    title: "Getting bilingual admin profiles working",
  },
  {
    category: "Product Notes",
    date: "2026/09/28",
    isPinned: true,
    path: "/articles/media-library-first-pass",
    readTime: "5 min",
    summary: "Start the media library with upload, preview, list, and batch operations.",
    title: "The first media library pass should feel useful",
  },
  {
    category: "Frontend",
    date: "2026/09/22",
    path: "/articles/frontend-shell",
    readTime: "4 min",
    summary:
      "A blog front end should be quiet, readable, and put navigation where readers expect it.",
    title: "Make the front end feel like a real blog first",
  },
  {
    category: "Notes",
    date: "2026/09/16",
    path: "/articles/small-useful-things",
    readTime: "3 min",
    summary: "Build software, shape products, and keep a record of small useful things.",
    title: "Writing down small useful things",
  },
] as const;

const homeArticlesByLanguage: Record<AppLanguage, readonly Article[]> = {
  "zh-CN": homeArticles,
  en: enHomeArticles,
};

const categoriesByLanguage: Record<AppLanguage, readonly HomeTaxonomyItem[]> = {
  "zh-CN": categories,
  en: [
    { count: 12, label: "Engineering", path: "/categories/engineering-notes" },
    { count: 8, label: "Product Notes", path: "/categories/product-notes" },
    { count: 6, label: "Frontend", path: "/categories/frontend-experience" },
  ],
};

const tagsByLanguage: Record<AppLanguage, readonly HomeTaxonomyItem[]> = {
  "zh-CN": tags,
  en: [
    { color: "#7d114c", label: "Author", path: "/tags/author" },
    { color: "#1f6f78", label: "Admin", path: "/tags/admin" },
    { color: "#2563eb", label: "Frontend", path: "/tags/frontend" },
    { color: "#7c3aed", label: "Media", path: "/tags/media" },
    { color: "#dc2626", label: "Translation", path: "/tags/translation" },
  ],
};

export const frontCopyByLanguage: Record<AppLanguage, FrontCopy> = {
  "zh-CN": {
    auth: {
      account: {
        adminRole: "管理员",
        openAdmin: "前往后台",
        entry: "登录",
        logoutCancel: "取消",
        logoutConfirm: "确认退出",
        logoutConfirmDescription: "退出后需要重新登录前台账号。",
        logoutConfirmTitle: "退出登录？",
        logoutFailed: "退出登录失败，请重试。",
        logout: "退出登录",
        profileLabel: "前台账号",
        userRole: "用户",
      },
      dialog: {
        codeValidFor: (minutes) => `验证码 ${minutes} 分钟内有效。`,
        codeDevPrefix: "开发验证码：",
        codeSent: "验证码已发送，请查看邮箱。",
        close: "关闭",
        forgotDescription: "输入邮箱并填写验证码，重新设置前台账号密码。",
        forgotLink: "找回密码",
        forgotPrompt: "忘记密码？",
        forgotTitle: "找回密码",
        loginAction: "登录",
        loginDescription: "使用用户名或邮箱加密码登录前台账号。",
        loginFailed: (reason) => `登录失败：${reason}`,
        loginFailureFallback: "请检查用户名、邮箱或密码后再试。",
        loginPrompt: "已有账号？",
        loginSuccess: "登录成功。",
        loginTitle: "欢迎回来",
        oauthFailed: "第三方登录失败，请稍后重试。",
        oauthSuccess: "第三方登录成功。",
        placeholderUnavailable: "该登录方式暂未接入。",
        registerAction: "注册",
        registerDescription: "注册前台普通用户账号，验证码会发送到邮箱。",
        registerFailed: (reason) => `注册失败：${reason}`,
        registerFailureFallback: "请检查注册信息和邮箱验证码后再试。",
        registerPrompt: "还没有账号？",
        registerSuccess: "注册成功，已自动登录。",
        registerTitle: "创建账号",
        resetFailed: (reason) => `重置密码失败：${reason}`,
        resetFailureFallback: "请检查邮箱、验证码和新密码后再试。",
        resetSuccess: "密码已重置，请使用新密码登录。",
        socialDivider: "或使用以下方式",
        title: "账号",
      },
      fields: {
        code: "邮箱验证码",
        confirmPassword: "确认密码",
        email: "邮箱",
        identifier: "用户名或邮箱",
        name: "显示名称",
        password: "密码",
        username: "用户名",
      },
      modes: {
        forgot: "找回",
        login: "登录",
        register: "注册",
      },
      placeholders: {
        code: "输入 6 位验证码",
        confirmPassword: "再次输入新密码",
        email: "name@example.com",
        identifier: "taolei 或 name@example.com",
        name: "可选",
        password: "至少 8 位",
        username: "例如 taolei",
      },
      profile: {
        avatarChoose: "本地选择",
        avatarClear: "清除头像",
        avatarOnlyImage: "请选择图片文件作为头像。",
        avatarPending: (fileName) => `待上传：${fileName}`,
        avatarUrl: "头像地址",
        blogUrl: "博客链接",
        cancel: "取消",
        changeEmail: "确认修改邮箱",
        changeEmailFailed: (reason) => `修改邮箱失败：${reason}`,
        changeEmailFailureFallback: "请检查旧邮箱验证码、新邮箱和新邮箱验证码后再试。",
        changeEmailSuccess: "邮箱已修改成功。",
        changePassword: "确认修改密码",
        changePasswordFailed: (reason) => `修改密码失败：${reason}`,
        changePasswordFailureFallback: "请检查验证方式和新密码后再试。",
        changePasswordSuccess: "密码已修改，请重新登录。",
        changingEmail: "修改中",
        changingPassword: "修改中",
        commentNotifications: "评论回复邮件通知",
        currentEmail: "当前邮箱",
        currentEmailCode: "旧邮箱验证码",
        currentPasswordRequired: "请输入旧密码。",
        currentPassword: "旧密码",
        description: "维护头像、昵称、简介、标签和前台偏好。",
        displayInfo: "公开资料",
        emailDescription: "需要同时验证旧邮箱和新邮箱，验证码 10 分钟内有效。",
        emailSecurityHint: "先向当前邮箱发送验证码，再向新邮箱发送验证码。",
        emailTitle: "修改邮箱",
        emailUnchanged: "新邮箱不能与当前邮箱一致。",
        joinedAt: "加入时间",
        lastLogin: "最近登录",
        loginDevice: "设备",
        loginInfo: "登录信息",
        loginInfoEmpty: "暂无记录",
        loginIp: "IP",
        loginLocalNetwork: "本地网络",
        loginLocation: "地点",
        loginMethod: "方式",
        loginMethodApple: "Apple",
        loginMethodGithub: "GitHub",
        loginMethodGoogle: "Google",
        loginMethodPassword: "密码",
        loginUnrecordedDevice: "未记录设备",
        loginUnknownLocation: "未查询到 IP 归属地",
        newEmail: "新邮箱",
        newEmailCode: "新邮箱验证码",
        newPassword: "新密码",
        notConnected: "暂未接入",
        notificationsDescription: "自己的评论收到回复或有新文章发布时，通过邮箱提醒我。",
        notificationsTitle: "邮件通知",
        open: "个人中心",
        newPostNotifications: "新文章邮件通知",
        passwordCode: "邮箱验证码",
        passwordDescription: "可以使用旧密码验证，也可以向当前邮箱发送验证码验证。",
        passwordMethodCode: "邮箱验证码",
        passwordMethodPassword: "旧密码",
        passwordSecurityHint: "密码修改成功后会退出当前会话，需要重新登录。",
        passwordTitle: "修改密码",
        publicBio: "个人描述",
        save: "保存资料",
        saveFailed: (reason) => `个人资料保存失败：${reason}`,
        saveFailureFallback: "请检查资料后再试。",
        saved: "个人资料已保存。",
        saving: "保存中",
        securityDescription: "修改邮箱和密码都需要完成安全验证。",
        securityTitle: "账号安全",
        sendCurrentEmailCode: "发送旧邮箱验证码",
        sendNewEmailCode: "发送新邮箱验证码",
        sendPasswordCode: "发送邮箱验证码",
        statusPending: "该功能即将接入。",
        tagPlaceholder: "React, 摄影, 写作",
        tags: "个人标签",
        title: "个人中心",
        usernameRequired: "请输入至少 2 位用户名。",
      },
      social: {
        apple: "Apple 登录",
        github: "GitHub 登录",
        google: "Google 登录",
      },
      submit: {
        forgot: "重置密码",
        login: "登录",
        register: "注册并登录",
        retryIn: (seconds) => `${seconds} 秒后重试`,
        sendingCode: "发送中",
        sendCode: "发送验证码",
        working: "处理中",
      },
      validation: {
        codeRequired: "请输入邮箱验证码。",
        emailRequired: "请输入邮箱。",
        identifierRequired: "请输入用户名或邮箱。",
        passwordMismatch: "两次输入的密码不一致。",
        passwordRequired: "请输入密码。",
        passwordTooShort: "密码至少需要 8 位。",
        humanRequired: "请先完成人机验证。",
        usernameRequired: "请输入用户名。",
      },
    },
    articleDetailMeta: {
      description: "文章详情页会在文章接口完成后接入真实内容。",
      eyebrow: "文章",
      title: "文章详情",
    },
    articleSections: {
      all: "全部文章",
      latest: "最新文章",
      latestEmpty: "暂无最新文章。",
      pinned: "置顶文章",
      pinnedEmpty: "暂无置顶文章。",
    },
    author: {
      bio: "",
      name: "站点作者",
      website: "个人主页",
    },
    brandDescription: "写代码、做产品，也记录一些真正有用的小事。",
    fallbackPageMeta: {
      description: "这个页面还没有接入内容，当前先保留路由位置。",
      eyebrow: "占位",
      title: "页面占位",
    },
    footer: {
      runtime: (seconds) => `本站已运行${seconds}秒`,
      tagline: "LeiBlog · 记录代码、产品和日常片段",
    },
    hero: {
      archiveAction: "查看归档",
      articlesAction: "浏览文章",
      badge: "LeiBlog 主页",
      slogan: "晚上的饭撒的饭撒的发送发，也把后台、媒体和前台慢慢整理成顺手的博客系统。",
    },
    homeSidebarLabel: "首页侧栏",
    intro: {
      description: "先保留旧博客的阅读结构：首屏封面、文章面板、作者信息、分类和标签入口。",
      eyebrow: "主页",
      title: "置顶内容和最新文章",
    },
    megaMenuFeatured: {
      article: {
        description: "从全部文章、分类、标签和时间归档进入不同阅读路径。",
        linkLabel: "浏览文章",
        title: "按你习惯的方式阅读",
      },
      site: {
        description: "了解站点定位、作者公开资料，也可以在留言板留下想法。",
        linkLabel: "关于本站",
        title: "关于 LeiBlog",
      },
    },
    mobile: {
      close: "关闭导航",
      open: "打开导航",
    },
    navGroups: {
      article: "文章",
      site: "站点",
    },
    navItems: {
      archives: {
        description: "按发布时间查看文章归档。",
        label: "归档",
      },
      articles: {
        description: "浏览所有公开文章。",
        label: "全部文章",
      },
      author: {
        description: "作者介绍、公开资料和联系方式。",
        label: "关于作者",
      },
      categories: {
        description: "按类别查看文章集合。",
        label: "类别",
      },
      guestbook: {
        description: "访客留言和简单交流。",
        label: "留言板",
      },
      home: {
        description: "回到首页，查看置顶内容和最新文章。",
        label: "主页",
      },
      navigation: {
        description: "整理常用站点、工具和外部入口。",
        label: "导航页",
      },
      site: {
        description: "站点定位、技术栈和维护信息。",
        label: "关于本站",
      },
      tags: {
        description: "按标签聚合碎片和主题。",
        label: "标签",
      },
    },
    navLabel: "前台导航",
    pageMeta: zhPageMetaByPath,
    placeholder: {
      next: "下一步",
      nextValue: "接入接口和真实内容",
      status: "当前状态",
      statusValue: "占位页面",
    },
    search: {
      buttonLabel: "打开搜索",
      emptyBootstrap: "输入关键词或选择一个入口。",
      emptySearch: "没有找到匹配内容。",
      footerClose: "关闭",
      footerNavigate: "导航",
      footerSelect: "选择",
      label: "搜索文章",
      placeholder: "搜索文章、类别或标签",
      queryGroup: "搜索",
      queryPrefix: "搜索：",
    },
    taxonomy: {
      categoriesEmpty: "暂无分类。",
      categoriesTitle: "文章类别",
      tagsEmpty: "暂无标签。",
      tagsTitle: "常用标签",
    },
    theme: {
      dark: "切换到深色主题",
      light: "切换到浅色主题",
    },
  },
  en: {
    auth: {
      account: {
        adminRole: "Admin",
        openAdmin: "Go to admin",
        entry: "Sign in",
        logoutCancel: "Cancel",
        logoutConfirm: "Sign out",
        logoutConfirmDescription: "You will need to sign in again to use your front account.",
        logoutConfirmTitle: "Sign out?",
        logoutFailed: "Sign out failed. Please try again.",
        logout: "Sign out",
        profileLabel: "Front account",
        userRole: "User",
      },
      dialog: {
        codeValidFor: (minutes) => `The code is valid for ${minutes} minutes.`,
        codeDevPrefix: "Dev code: ",
        codeSent: "Verification code sent. Check your inbox.",
        close: "Close",
        forgotDescription: "Enter your email and code to set a new password.",
        forgotLink: "Reset password",
        forgotPrompt: "Forgot password?",
        forgotTitle: "Reset password",
        loginAction: "Sign in",
        loginDescription: "Sign in with your username or email and password.",
        loginFailed: (reason) => `Sign in failed: ${reason}`,
        loginFailureFallback: "Check your username, email, or password and try again.",
        loginPrompt: "Already have an account?",
        loginSuccess: "Signed in successfully.",
        loginTitle: "Welcome back",
        oauthFailed: "Third-party sign-in failed. Please try again.",
        oauthSuccess: "Signed in with the third-party provider.",
        placeholderUnavailable: "This sign-in method is not connected yet.",
        registerAction: "Sign up",
        registerDescription: "Create a public user account. The code is sent to your email.",
        registerFailed: (reason) => `Sign up failed: ${reason}`,
        registerFailureFallback: "Check the account details and email code, then try again.",
        registerPrompt: "Don't have an account?",
        registerSuccess: "Account created. You are signed in.",
        registerTitle: "Create account",
        resetFailed: (reason) => `Password reset failed: ${reason}`,
        resetFailureFallback: "Check your email, code, and new password, then try again.",
        resetSuccess: "Password reset. Sign in with your new password.",
        socialDivider: "Or continue with",
        title: "Account",
      },
      fields: {
        code: "Email code",
        confirmPassword: "Confirm password",
        email: "Email",
        identifier: "Username or email",
        name: "Display name",
        password: "Password",
        username: "Username",
      },
      modes: {
        forgot: "Reset",
        login: "Sign in",
        register: "Sign up",
      },
      placeholders: {
        code: "Enter the 6-digit code",
        confirmPassword: "Enter the new password again",
        email: "name@example.com",
        identifier: "taolei or name@example.com",
        name: "Optional",
        password: "At least 8 characters",
        username: "For example taolei",
      },
      profile: {
        avatarChoose: "Choose local file",
        avatarClear: "Clear avatar",
        avatarOnlyImage: "Choose an image file for the avatar.",
        avatarPending: (fileName) => `Pending upload: ${fileName}`,
        avatarUrl: "Avatar URL",
        blogUrl: "Blog URL",
        cancel: "Cancel",
        changeEmail: "Change email",
        changeEmailFailed: (reason) => `Email change failed: ${reason}`,
        changeEmailFailureFallback:
          "Check the current email code, new email, and new email code, then try again.",
        changeEmailSuccess: "Email updated successfully.",
        changePassword: "Change password",
        changePasswordFailed: (reason) => `Password change failed: ${reason}`,
        changePasswordFailureFallback: "Check the verification method and new password.",
        changePasswordSuccess: "Password updated. Please sign in again.",
        changingEmail: "Changing",
        changingPassword: "Changing",
        commentNotifications: "Comment reply email notifications",
        currentEmail: "Current email",
        currentEmailCode: "Current email code",
        currentPasswordRequired: "Enter your current password.",
        currentPassword: "Current password",
        description: "Maintain your avatar, display name, bio, tags, and front preferences.",
        displayInfo: "Public profile",
        emailDescription:
          "Verify both the current email and the new email. Codes are valid for 10 minutes.",
        emailSecurityHint: "Send one code to your current email and one to the new email.",
        emailTitle: "Change email",
        emailUnchanged: "The new email must be different from the current email.",
        joinedAt: "Joined",
        lastLogin: "Latest login",
        loginDevice: "Device",
        loginInfo: "Login information",
        loginInfoEmpty: "No records",
        loginIp: "IP",
        loginLocalNetwork: "Local network",
        loginLocation: "Location",
        loginMethod: "Method",
        loginMethodApple: "Apple",
        loginMethodGithub: "GitHub",
        loginMethodGoogle: "Google",
        loginMethodPassword: "Password",
        loginUnrecordedDevice: "Device not recorded",
        loginUnknownLocation: "IP location unavailable",
        newEmail: "New email",
        newEmailCode: "New email code",
        newPassword: "New password",
        notConnected: "Not connected yet",
        notificationsDescription:
          "Email me when my comments receive replies or when new articles are published.",
        notificationsTitle: "Email notifications",
        open: "Profile",
        newPostNotifications: "New article email notifications",
        passwordCode: "Email code",
        passwordDescription:
          "Use your current password or verify with a code sent to the current email.",
        passwordMethodCode: "Email code",
        passwordMethodPassword: "Current password",
        passwordSecurityHint: "A successful password change signs out the current session.",
        passwordTitle: "Change password",
        publicBio: "Bio",
        save: "Save profile",
        saveFailed: (reason) => `Profile save failed: ${reason}`,
        saveFailureFallback: "Check the profile fields and try again.",
        saved: "Profile saved.",
        saving: "Saving",
        securityDescription: "Email and password changes require security verification.",
        securityTitle: "Account security",
        sendCurrentEmailCode: "Send current email code",
        sendNewEmailCode: "Send new email code",
        sendPasswordCode: "Send email code",
        statusPending: "This feature will be connected soon.",
        tagPlaceholder: "React, photography, writing",
        tags: "Tags",
        title: "Profile",
        usernameRequired: "Enter a username with at least 2 characters.",
      },
      social: {
        apple: "Sign in with Apple",
        github: "Sign in with GitHub",
        google: "Sign in with Google",
      },
      submit: {
        forgot: "Reset password",
        login: "Sign in",
        register: "Create account and sign in",
        retryIn: (seconds) => `Retry in ${seconds}s`,
        sendingCode: "Sending",
        sendCode: "Send code",
        working: "Working",
      },
      validation: {
        codeRequired: "Enter the email verification code.",
        emailRequired: "Enter your email.",
        identifierRequired: "Enter your username or email.",
        passwordMismatch: "The two passwords do not match.",
        passwordRequired: "Enter your password.",
        passwordTooShort: "Password must be at least 8 characters.",
        humanRequired: "Complete human verification first.",
        usernameRequired: "Enter a username.",
      },
    },
    articleDetailMeta: {
      description:
        "Article detail pages will connect to real content after the article API is ready.",
      eyebrow: "Articles",
      title: "Article Detail",
    },
    articleSections: {
      all: "All Articles",
      latest: "Latest Articles",
      latestEmpty: "No latest articles yet.",
      pinned: "Pinned Articles",
      pinnedEmpty: "No pinned articles yet.",
    },
    author: {
      bio: "",
      name: "Site author",
      website: "Website",
    },
    brandDescription: "Code, products, and small notes that are actually useful.",
    fallbackPageMeta: {
      description: "This page is not connected yet; the route is reserved for later content.",
      eyebrow: "Placeholder",
      title: "Page Placeholder",
    },
    footer: {
      runtime: (seconds) => `Running for ${seconds}s`,
      tagline: "LeiBlog · Code, product notes, and everyday fragments",
    },
    hero: {
      archiveAction: "View Archives",
      articlesAction: "Read Articles",
      badge: "LeiBlog Home",
      slogan:
        "A small blog system growing through the admin console, media library, and public front end.",
    },
    homeSidebarLabel: "Home sidebar",
    intro: {
      description:
        "The first pass keeps the old blog reading structure: cover, article panels, author, categories, and tags.",
      eyebrow: "Home",
      title: "Pinned and Latest Writing",
    },
    megaMenuFeatured: {
      article: {
        description: "Start from all posts, categories, tags, or the timeline archive.",
        linkLabel: "Read Articles",
        title: "Read in the shape you like",
      },
      site: {
        description: "Learn what this site is for, who writes it, and where to leave a note.",
        linkLabel: "About Site",
        title: "About LeiBlog",
      },
    },
    mobile: {
      close: "Close navigation",
      open: "Open navigation",
    },
    navGroups: {
      article: "Articles",
      site: "Site",
    },
    navItems: {
      archives: {
        description: "Browse articles by publication time.",
        label: "Archives",
      },
      articles: {
        description: "Browse every public article.",
        label: "All Articles",
      },
      author: {
        description: "Author profile, public details, and contact links.",
        label: "About Author",
      },
      categories: {
        description: "Browse article collections by category.",
        label: "Categories",
      },
      guestbook: {
        description: "Visitor messages and simple conversations.",
        label: "Guestbook",
      },
      home: {
        description: "Back to pinned content and latest writing.",
        label: "Home",
      },
      navigation: {
        description: "Useful sites, tools, and external entry points.",
        label: "Navigation",
      },
      site: {
        description: "Site positioning, stack, and maintenance details.",
        label: "About Site",
      },
      tags: {
        description: "Collect notes and themes by tag.",
        label: "Tags",
      },
    },
    navLabel: "Public navigation",
    pageMeta: enPageMetaByPath,
    placeholder: {
      next: "Next",
      nextValue: "Connect APIs and real content",
      status: "Status",
      statusValue: "Placeholder page",
    },
    search: {
      buttonLabel: "Open search",
      emptyBootstrap: "Type a keyword or choose an entry.",
      emptySearch: "No matching content found.",
      footerClose: "Close",
      footerNavigate: "Navigate",
      footerSelect: "Select",
      label: "Search articles",
      placeholder: "Search articles, categories, or tags",
      queryGroup: "Search",
      queryPrefix: "Search: ",
    },
    taxonomy: {
      categoriesEmpty: "No categories yet.",
      categoriesTitle: "Categories",
      tagsEmpty: "No tags yet.",
      tagsTitle: "Popular Tags",
    },
    theme: {
      dark: "Switch to dark theme",
      light: "Switch to light theme",
    },
  },
};

function getCurrentPath() {
  if (typeof window === "undefined") {
    return "/";
  }

  const normalizedPath = window.location.pathname.replace(/\/+$/u, "");
  return normalizedPath || "/";
}

function getCurrentSearch() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.search;
}

function getRoutePathname(path: string) {
  if (typeof window === "undefined") {
    return path.split("?")[0] || "/";
  }

  return new URL(path, window.location.origin).pathname.replace(/\/+$/u, "") || "/";
}

function getRouteSearch(path: string) {
  if (typeof window === "undefined") {
    return path.includes("?") ? `?${path.split("?").slice(1).join("?")}` : "";
  }

  return new URL(path, window.location.origin).search;
}

function getRouteSlug(path: string, prefix: string) {
  return decodeURIComponent(path.slice(prefix.length).replace(/^\/+/u, ""));
}

function getCurrentReturnTo() {
  if (typeof window === "undefined") {
    return "/";
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

const OAUTH_QUERY_KEYS = ["oauth_provider", "oauth_reason", "oauth_status"] as const;

function clearOAuthQueryParameters() {
  if (typeof window === "undefined") {
    return "";
  }

  const url = new URL(window.location.href);
  OAUTH_QUERY_KEYS.forEach((key) => {
    url.searchParams.delete(key);
  });
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(null, "", nextUrl);

  return url.search;
}

const FAVICON_LINK_SELECTOR = 'link[data-lei-blog-favicon="public-site-settings"]';

const getNonEmptyText = (value?: string) => {
  const trimmedValue = value?.trim();
  return trimmedValue && trimmedValue.length > 0 ? trimmedValue : undefined;
};

const getCleanStringList = (values?: readonly string[]) => {
  return Array.from(
    new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0)),
  );
};

const getSiteUptimeSeconds = (foundedAt?: string, now = Date.now()) => {
  const foundedAtValue = getNonEmptyText(foundedAt);
  if (foundedAtValue === undefined) {
    return 0;
  }

  const foundedAtTime = new Date(foundedAtValue).getTime();
  if (!Number.isFinite(foundedAtTime)) {
    return 0;
  }

  return Math.max(0, Math.floor((now - foundedAtTime) / 1000));
};

const getSiteFooterFilingLinks = (settings?: PublicSiteSettings): SiteFooterFilingLink[] => {
  const icpLinks = (settings?.filings.icpRecords ?? [])
    .map((record, index) => {
      const number = record.number.trim();

      return {
        key: `icp-${index}-${number}`,
        number,
        url: getNonEmptyText(record.url),
      };
    })
    .filter((record) => record.number.length > 0);
  const policeNumber = getNonEmptyText(settings?.filings.policeRecordNumber);

  if (policeNumber === undefined) {
    return icpLinks;
  }

  return [
    ...icpLinks,
    {
      key: `police-${policeNumber}`,
      number: policeNumber,
      url: getNonEmptyText(settings?.filings.policeRecordUrl),
    },
  ];
};

const readHomeArticleContent = (article: ArticleContent, language: AppLanguage) =>
  language === "en" ? article.localizations.en : article.localizations.zhCN;

const readHomeRelationName = (
  relation: { localizations: { en: { name: string }; zhCN: { name: string } } },
  language: AppLanguage,
) => (language === "en" ? relation.localizations.en.name : relation.localizations.zhCN.name);

const readHomeTaxonomyName = (taxonomy: ArticleCategory | ArticleTag, language: AppLanguage) =>
  language === "en" ? taxonomy.localizations.en.name : taxonomy.localizations.zhCN.name;

const readHomeArticleExcerpt = ({
  article,
  language,
}: {
  article: ArticleContent;
  language: AppLanguage;
}) => {
  const content = readHomeArticleContent(article, language);
  const source = content.summary || article.summary || content.contentMdx;

  return source
    .replace(/[#*_`>\-[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const readHomeArticleReadingTime = ({
  article,
  language,
}: {
  article: ArticleContent;
  language: AppLanguage;
}) => {
  const content = readHomeArticleContent(article, language);
  const plainText = content.contentMdx.replace(/[#*_`>\-[\]()]/g, " ").trim();
  const readingUnits =
    language === "en"
      ? plainText.split(/\s+/).filter(Boolean).length
      : plainText.replace(/\s+/g, "").length;
  const minutes = Math.max(1, Math.ceil(readingUnits / (language === "en" ? 220 : 500)));

  return language === "en" ? `${minutes} min` : `${minutes} 分钟`;
};

const toHomeArticle = ({
  article,
  language,
  timeZone,
}: {
  article: ArticleContent;
  language: AppLanguage;
  timeZone: string;
}): Article => {
  const content = readHomeArticleContent(article, language);
  const category = article.categories[0];
  const date =
    formatDateInTimeZone({
      language,
      timeZone,
      value: article.publishedAt ?? article.createdAt,
    }) ?? "";

  return {
    category: category === undefined ? "" : readHomeRelationName(category, language),
    commentCount: article.commentCount,
    coverImageUrl: article.coverImageUrl,
    date,
    isPinned: article.isPinned,
    path: `/articles/${article.slug}`,
    readCount: article.readCount,
    readTime: readHomeArticleReadingTime({ article, language }),
    summary: readHomeArticleExcerpt({ article, language }),
    title: content.title,
  };
};

const toHomeCategoryItem = ({
  category,
  language,
}: {
  category: ArticleCategory;
  language: AppLanguage;
}): HomeTaxonomyItem => ({
  count: category.articleCount,
  label: readHomeTaxonomyName(category, language),
  path: `/categories/${category.slug}`,
});

const toHomeTagItem = ({
  language,
  tag,
}: {
  language: AppLanguage;
  tag: ArticleTag;
}): HomeTaxonomyItem => ({
  color: tag.color,
  count: tag.articleCount,
  label: readHomeTaxonomyName(tag, language),
  path: `/tags/${tag.slug}`,
});

const getSiteBrandContent = ({
  copy,
  language,
  settings,
  themeMode,
}: SiteBrandContentParameters): SiteBrandContent => {
  const primaryContent =
    language === "en" ? settings?.siteLocalizations.en : settings?.siteLocalizations.zhCN;
  const fallbackContent =
    language === "en" ? settings?.siteLocalizations.zhCN : settings?.siteLocalizations.en;
  const lightLogoUrl = getNonEmptyText(settings?.site.lightLogoUrl) ?? "";
  const darkLogoUrl = getNonEmptyText(settings?.site.darkLogoUrl) ?? "";

  return {
    coverUrls: getCleanStringList(settings?.site.coverUrls),
    name:
      getNonEmptyText(primaryContent?.siteName) ??
      getNonEmptyText(fallbackContent?.siteName) ??
      getNonEmptyText(settings?.site.siteName) ??
      "LeiBlog",
    description:
      getNonEmptyText(primaryContent?.siteDescription) ??
      getNonEmptyText(fallbackContent?.siteDescription) ??
      getNonEmptyText(settings?.site.siteDescription) ??
      copy.brandDescription,
    logoUrl: themeMode === "dark" ? darkLogoUrl || lightLogoUrl : lightLogoUrl || darkLogoUrl,
    faviconUrl: getNonEmptyText(settings?.site.faviconUrl) ?? "",
  };
};

const getSiteAuthorContent = ({
  copy,
  language,
  settings,
}: SiteAuthorContentParameters): SiteAuthorContent => {
  const author = settings?.author;
  const primaryContent =
    language === "en" ? author?.profileLocalizations.en : author?.profileLocalizations.zhCN;
  const fallbackContent =
    language === "en" ? author?.profileLocalizations.zhCN : author?.profileLocalizations.en;
  const primaryTags = getCleanStringList(primaryContent?.tags);
  const fallbackTags = getCleanStringList(fallbackContent?.tags);
  const socialLinks = (author?.socialLinks ?? [])
    .map((link) => ({
      label: link.label.trim(),
      url: link.url.trim(),
    }))
    .filter((link) => link.label.length > 0 && link.url.length > 0);

  return {
    avatarUrl: getNonEmptyText(author?.avatarUrl) ?? "",
    bio:
      getNonEmptyText(primaryContent?.bio) ??
      getNonEmptyText(fallbackContent?.bio) ??
      copy.author.bio,
    blogUrl: getNonEmptyText(author?.blogUrl) ?? "",
    name:
      getNonEmptyText(primaryContent?.name) ??
      getNonEmptyText(fallbackContent?.name) ??
      getNonEmptyText(author?.username) ??
      copy.author.name,
    socialLinks,
    tags: primaryTags.length > 0 ? primaryTags : fallbackTags,
    username: getNonEmptyText(author?.username) ?? "",
  };
};

const updateDocumentFavicon = (href: string) => {
  if (typeof document === "undefined") {
    return;
  }

  const currentLink = document.querySelector<HTMLLinkElement>(FAVICON_LINK_SELECTOR);
  const trimmedHref = href.trim();
  if (trimmedHref.length === 0) {
    currentLink?.remove();
    return;
  }

  const faviconLink = currentLink ?? document.createElement("link");
  faviconLink.rel = "icon";
  faviconLink.href = resolveApiAssetUrl(trimmedHref);
  faviconLink.dataset.leiBlogFavicon = "public-site-settings";

  if (currentLink === null) {
    document.head.appendChild(faviconLink);
  }
};

function getPageMeta(path: string, copy: FrontCopy): PageMeta {
  if (path.startsWith("/articles/")) {
    return copy.articleDetailMeta;
  }

  return copy.pageMeta[path] ?? copy.fallbackPageMeta;
}

function getPageHeroIcon(path: string) {
  if (path.startsWith("/articles")) {
    return BookOpen;
  }

  if (path === "/categories") {
    return FolderOpen;
  }

  if (path === "/tags") {
    return Tags;
  }

  if (path === "/archives") {
    return Archive;
  }

  if (path === "/navigation") {
    return Map;
  }

  if (path === "/about-site") {
    return Library;
  }

  if (path === "/about-author") {
    return UserRound;
  }

  if (path === "/guestbook") {
    return MessageSquareText;
  }

  return BookOpen;
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function isActivePath(currentPath: string, path: string) {
  if (path === "/") {
    return currentPath === "/";
  }

  return currentPath === path || currentPath.startsWith(`${path}/`);
}

type BlogRouterLinkProps = ComponentPropsWithRef<"a"> & {
  to?: string;
};

export function isInternalRoute(path: string) {
  return path.startsWith("/") && !path.startsWith("//") && !/^\/admin(?:\/|[?#]|$)/.test(path);
}

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase();
}

function doesSearchCommandMatch(item: SearchCommandItem, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length === 0) {
    return true;
  }

  const searchText = [item.label, item.auxiliaryData.description, ...item.auxiliaryData.keywords]
    .join(" ")
    .toLocaleLowerCase();

  return searchText.includes(normalizedQuery);
}

type BuildSearchCommandItemParameters = {
  description: string;
  group: string;
  icon: ReactNode;
  id: string;
  keywords?: readonly string[];
  kind: SearchCommandKind;
  label: string;
  path?: string;
  query?: string;
};

function buildSearchCommandItem({
  description,
  group,
  icon,
  id,
  keywords = [],
  kind,
  label,
  path,
  query,
}: BuildSearchCommandItemParameters): SearchCommandItem {
  return {
    id,
    label,
    auxiliaryData: {
      description,
      group,
      icon,
      keywords,
      kind,
      path,
      query,
    },
  };
}

function buildSearchCommandItems(copy: FrontCopy, language: AppLanguage): SearchCommandItem[] {
  const navigationCommands = [
    ...primaryNavItems.map((item) => {
      const itemCopy = copy.navItems[item.copyKey];
      return buildSearchCommandItem({
        description: itemCopy.description,
        group: copy.navLabel,
        icon: item.icon,
        id: `nav:${item.path}`,
        keywords: [item.path],
        kind: "navigation",
        label: itemCopy.label,
        path: item.path,
      });
    }),
    ...navGroups.flatMap((group) =>
      group.items.map((item) => {
        const itemCopy = copy.navItems[item.copyKey];
        return buildSearchCommandItem({
          description: itemCopy.description,
          group: copy.navGroups[group.copyKey],
          icon: item.icon,
          id: `nav:${item.path}`,
          keywords: [item.path],
          kind: "navigation",
          label: itemCopy.label,
          path: item.path,
        });
      }),
    ),
  ];

  const articleCommands = homeArticlesByLanguage[language].map((article) =>
    buildSearchCommandItem({
      description: article.summary,
      group: copy.articleSections.all,
      icon: <BookOpen size={16} />,
      id: `article:${article.path}`,
      keywords: [article.category, article.date, article.readTime, article.path],
      kind: "article",
      label: article.title,
      path: article.path,
    }),
  );

  const categoryCommands = categoriesByLanguage[language].map((category) =>
    buildSearchCommandItem({
      description: copy.navItems.categories.description,
      group: copy.taxonomy.categoriesTitle,
      icon: <FolderOpen size={16} />,
      id: `category:${category.path}`,
      keywords: [copy.navItems.categories.label, category.label],
      kind: "navigation",
      label: category.label,
      path: category.path,
    }),
  );

  const tagCommands = tagsByLanguage[language].map((tag) =>
    buildSearchCommandItem({
      description: copy.navItems.tags.description,
      group: copy.taxonomy.tagsTitle,
      icon: <Tags size={16} />,
      id: `tag:${tag.path}`,
      keywords: [copy.navItems.tags.label, tag.label],
      kind: "navigation",
      label: tag.label,
      path: tag.path,
    }),
  );

  return [...navigationCommands, ...articleCommands, ...categoryCommands, ...tagCommands];
}

function getSearchQueryFromCommandValue(value: string) {
  if (!value.startsWith(SEARCH_QUERY_COMMAND_PREFIX)) {
    return undefined;
  }

  const query = value.slice(SEARCH_QUERY_COMMAND_PREFIX.length).trim();
  return query.length > 0 ? query : undefined;
}

type SiteSearchCommandProps = {
  copy: FrontCopy;
  language: AppLanguage;
  onNavigate: (path: string) => void;
  onSearch: (query: string) => void;
};

type SiteSearchCommandFooterProps = {
  copy: FrontCopy;
};

function SiteSearchCommandFooter({ copy }: SiteSearchCommandFooterProps) {
  return (
    <CommandPaletteFooter className="site-command-footer">
      <span className="site-command-footer__hint">
        <Kbd keys="up" />
        <Kbd keys="down" />
        {copy.search.footerNavigate}
      </span>
      <span className="site-command-footer__hint">
        <Kbd keys="enter" />
        {copy.search.footerSelect}
      </span>
      <span className="site-command-footer__hint">
        <Kbd keys="escape" />
        {copy.search.footerClose}
      </span>
    </CommandPaletteFooter>
  );
}

function SiteSearchCommand({ copy, language, onNavigate, onSearch }: SiteSearchCommandProps) {
  const [isOpen, setIsOpen] = useState(false);
  const commands = useMemo(() => buildSearchCommandItems(copy, language), [copy, language]);
  const searchSource = useMemo<SearchSource<SearchCommandItem>>(
    () => ({
      bootstrap() {
        return commands;
      },
      search(query) {
        const trimmedQuery = query.trim();
        const matchingCommands = commands.filter((item) => doesSearchCommandMatch(item, query));

        if (trimmedQuery.length === 0) {
          return matchingCommands;
        }

        return [
          buildSearchCommandItem({
            description: copy.search.placeholder,
            group: copy.search.queryGroup,
            icon: <Search size={16} />,
            id: `${SEARCH_QUERY_COMMAND_PREFIX}${trimmedQuery}`,
            keywords: [trimmedQuery],
            kind: "query",
            label: `${copy.search.queryPrefix}${trimmedQuery}`,
            query: trimmedQuery,
          }),
          ...matchingCommands,
        ];
      },
    }),
    [commands, copy.search.placeholder, copy.search.queryGroup, copy.search.queryPrefix],
  );

  useHotkeys([
    {
      allowInInputs: true,
      keys: "mod+k",
      onPress: () => {
        setIsOpen(true);
      },
    },
  ]);

  function handleCommandSelect(value: string) {
    const query = getSearchQueryFromCommandValue(value);
    if (query !== undefined) {
      onSearch(query);
      return;
    }

    const selectedCommand = commands.find((item) => item.id === value);
    if (selectedCommand === undefined) {
      return;
    }

    const commandData = selectedCommand.auxiliaryData;
    if (commandData.kind === "query" && commandData.query !== undefined) {
      onSearch(commandData.query);
      return;
    }

    if (commandData.path !== undefined) {
      onNavigate(commandData.path);
    }
  }

  return (
    <div className="site-search-command">
      <IconButton
        className="site-search-trigger"
        icon={<Search size={16} />}
        label={copy.search.buttonLabel}
        onClick={() => {
          setIsOpen(true);
        }}
        size="sm"
        tooltip={copy.search.buttonLabel}
        variant="ghost"
      />
      <CommandPalette
        className="site-command-palette"
        emptyBootstrapText={copy.search.emptyBootstrap}
        emptySearchText={copy.search.emptySearch}
        footer={<SiteSearchCommandFooter copy={copy} />}
        input={
          <CommandPaletteInput
            endContent={<Kbd keys="mod+k" />}
            label={copy.search.label}
            placeholder={copy.search.placeholder}
          />
        }
        isOpen={isOpen}
        label={copy.search.label}
        maxHeight="min(72dvh, 520px)"
        onOpenChange={setIsOpen}
        onValueChange={handleCommandSelect}
        renderItem={(item, isSelected) => {
          const commandData = item.auxiliaryData;

          return (
            <div className={isSelected ? "site-command-item is-selected" : "site-command-item"}>
              <span className="site-command-item__icon">{commandData.icon}</span>
              <span className="site-command-item__content">
                <span className="site-command-item__label">{item.label}</span>
                <span className="site-command-item__description">{commandData.description}</span>
              </span>
            </div>
          );
        }}
        searchSource={searchSource}
        width="min(640px, calc(100vw - 24px))"
      />
    </div>
  );
}

type HeaderLanguageToggleProps = {
  language: AppLanguage;
  onLanguageChange: (language: AppLanguage) => void;
};

function HeaderLanguageToggle({ language, onLanguageChange }: HeaderLanguageToggleProps) {
  const nextLanguage = language === "zh-CN" ? "en" : "zh-CN";
  const buttonText = nextLanguage === "zh-CN" ? "CN" : "EN";
  const label = language === "zh-CN" ? "切换到英文" : "Switch to Chinese";

  return (
    <IconButton
      className="site-language-button"
      icon={<span className="site-language-button__text">{buttonText}</span>}
      label={label}
      onClick={() => onLanguageChange(nextLanguage)}
      size="sm"
      tooltip={label}
      variant="ghost"
    />
  );
}

const AppleIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg aria-hidden="true" fill="currentColor" height={16} viewBox="0 0 24 24" width={16} {...props}>
    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
  </svg>
);

const GoogleIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg aria-hidden="true" fill="currentColor" height={16} viewBox="0 0 24 24" width={16} {...props}>
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      fill="#4285f4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34a853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22z"
      fill="#fbbc05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#ea4335"
    />
  </svg>
);

const GitHubIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg aria-hidden="true" fill="currentColor" height={16} viewBox="0 0 24 24" width={16} {...props}>
    <path d="M12 2C6.48 2 2 6.58 2 12.24c0 4.52 2.86 8.35 6.84 9.7.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.38-3.37-1.38-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.93.86.09-.66.35-1.12.63-1.38-2.22-.26-4.55-1.14-4.55-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 5.9c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.59.69.49A10.14 10.14 0 0 0 22 12.24C22 6.58 17.52 2 12 2z" />
  </svg>
);

type AuthMode = "forgot" | "login" | "register";

type AuthDialogEmailCodePurpose = Extract<BlogEmailCodePurpose, "password_reset" | "register">;

type ProfilePanelMode = "email" | "password" | "profile";

type AuthStatus = {
  tone: "error" | "info" | "success";
  text: string;
};

type AuthNotice = AuthStatus & {
  id: number;
};

type AuthDialogProps = {
  copy: FrontCopy;
  isOpen: boolean;
  language: AppLanguage;
  onAuthenticated: (state: BlogAuthState) => void;
  onNotice: (status: AuthStatus) => void;
  onOpenChange: (isOpen: boolean) => void;
};

type AuthNoticeBannerProps = {
  notice: AuthNotice;
  onDismiss: () => void;
  closeLabel: string;
};

type SiteAccountBlockProps = {
  authState: BlogAuthState | null;
  copy: FrontCopy;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  onOpenAuth: () => void;
};

const BLOG_AUTH_STORAGE_KEY = "leiblog-blog-auth";

const writeStoredBlogAuthState = (state: BlogAuthState) => {
  try {
    window.localStorage.setItem(BLOG_AUTH_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Session state remains usable when browser storage is unavailable.
  }
};

const clearStoredBlogAuthState = () => {
  try {
    window.localStorage.removeItem(BLOG_AUTH_STORAGE_KEY);
  } catch {
    // The server cookie is authoritative for authentication.
  }
};

const getBlogUserDisplayName = (user: BlogUser) => user.name?.trim() || user.username;

const getBlogUserInitial = (user: BlogUser) =>
  getBlogUserDisplayName(user).trim().slice(0, 1).toUpperCase() || "U";

const parseProfileTags = (value: string) =>
  Array.from(
    new Set(
      value
        .split(/[，,]/u)
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    ),
  ).slice(0, 12);

const formatProfileDateTime = ({
  language,
  timeZone,
  value,
}: {
  language: AppLanguage;
  timeZone: string;
  value?: string | null;
}) => {
  return formatDateTimeInTimeZone({
    language,
    timeZone,
    value: value ?? null,
  });
};

const formatProfileDate = ({
  language,
  timeZone,
  value,
}: {
  language: AppLanguage;
  timeZone: string;
  value?: string | null;
}) =>
  formatDateInTimeZone({
    language,
    timeZone,
    value,
  });

const getProfileLoginMethodLabel = ({
  method,
  profileCopy,
}: {
  method?: BlogUser["lastLoginMethod"];
  profileCopy: AuthCopy["profile"];
}) => {
  switch (method) {
    case "apple":
      return profileCopy.loginMethodApple;
    case "github":
      return profileCopy.loginMethodGithub;
    case "google":
      return profileCopy.loginMethodGoogle;
    case "password":
      return profileCopy.loginMethodPassword;
    default:
      return undefined;
  }
};

const isPrivateLoginIp = (ip?: string | null) => {
  if (ip === undefined || ip === null) {
    return false;
  }

  const [first = 0, second = 0] = ip.split(".").map(Number);
  return (
    ip === "::1" ||
    ip.startsWith("fc") ||
    ip.startsWith("fd") ||
    ip.startsWith("fe80") ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
};

type GetProfileLoginLocationLabelParameters = {
  ip?: string | null;
  location?: string | null;
  profileCopy: AuthCopy["profile"];
};

const getProfileLoginLocationLabel = ({
  ip,
  location,
  profileCopy,
}: GetProfileLoginLocationLabelParameters) => {
  if (location !== undefined && location !== null && location.trim().length > 0) {
    return location.trim();
  }

  if (isPrivateLoginIp(ip)) {
    return profileCopy.loginLocalNetwork;
  }

  return profileCopy.loginUnknownLocation;
};

type GetProfileLoginDeviceLabelParameters = {
  device?: string | null;
  profileCopy: AuthCopy["profile"];
};

const getProfileLoginDeviceLabel = ({
  device,
  profileCopy,
}: GetProfileLoginDeviceLabelParameters) => device ?? profileCopy.loginUnrecordedDevice;

const isAuthMode = (value: string): value is AuthMode =>
  value === "forgot" || value === "login" || value === "register";

const readProfilePanelMode = (value: string | null): ProfilePanelMode | null => {
  if (value === "email" || value === "password" || value === "profile") {
    return value;
  }

  return null;
};

const readAuthErrorReason = (error: unknown, fallback: string) => {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();
  return message.length > 0 ? message : fallback;
};

function AuthNoticeBanner({ closeLabel, notice, onDismiss }: AuthNoticeBannerProps) {
  return (
    <div className="front-feedback-banner">
      <Banner
        container="card"
        dismissLabel={closeLabel}
        elevation="med"
        isDismissable
        onDismiss={onDismiss}
        status={notice.tone}
        title={notice.text}
      />
    </div>
  );
}

type AccountProfileFormState = {
  avatarUrl: string;
  bio: string;
  blogUrl: string;
  commentEmailNotifications: boolean;
  name: string;
  newPostEmailNotifications: boolean;
  tags: string;
  username: string;
};

const createAccountProfileFormState = (user: BlogUser): AccountProfileFormState => ({
  avatarUrl: user.avatarUrl ?? "",
  bio: user.bio ?? "",
  blogUrl: user.blogUrl ?? "",
  commentEmailNotifications: user.commentEmailNotifications ?? false,
  name: user.name ?? "",
  newPostEmailNotifications: user.newPostEmailNotifications ?? false,
  tags: (user.tags ?? []).join(", "),
  username: user.username,
});

type AccountSecurityCodePurpose = Extract<
  BlogEmailCodePurpose,
  "email_change_current" | "email_change_new" | "password_change"
>;

type AccountPasswordVerificationMode = "email_code" | "password";

type AccountEmailChangeFormState = {
  currentEmailCode: string;
  newEmail: string;
  newEmailCode: string;
};

type AccountPasswordChangeFormState = {
  confirmPassword: string;
  currentPassword: string;
  emailCode: string;
  newPassword: string;
};

const createAccountEmailChangeFormState = (): AccountEmailChangeFormState => ({
  currentEmailCode: "",
  newEmail: "",
  newEmailCode: "",
});

const createAccountPasswordChangeFormState = (): AccountPasswordChangeFormState => ({
  confirmPassword: "",
  currentPassword: "",
  emailCode: "",
  newPassword: "",
});

const createSecurityCodeState = (value: number): Record<AccountSecurityCodePurpose, number> => ({
  email_change_current: value,
  email_change_new: value,
  password_change: value,
});

type AccountProfilePageProps = {
  copy: FrontCopy;
  language: AppLanguage;
  onNotice: (status: AuthStatus) => void;
  onOpenAuth: () => void;
  onPasswordChanged: () => void;
  onProfileUpdated: (user: BlogUser) => void;
  panelMode: ProfilePanelMode | null;
  timeZone: string;
  user: BlogUser | null;
};

function AccountProfilePage({
  copy,
  language,
  onNotice,
  onOpenAuth,
  onPasswordChanged,
  onProfileUpdated,
  panelMode,
  timeZone,
  user,
}: AccountProfilePageProps) {
  const profileCopy = copy.auth.profile;

  if (user === null) {
    return (
      <main className="page-shell profile-page profile-page--guest">
        <Card className="profile-login-card" padding={6}>
          <Badge label={copy.auth.account.profileLabel} variant="neutral" />
          <Heading level={1}>{profileCopy.title}</Heading>
          <Text as="p" color="secondary">
            {profileCopy.description}
          </Text>
          <Button
            icon={<UserRound size={16} />}
            label={copy.auth.dialog.loginAction}
            onClick={onOpenAuth}
            size="lg"
            variant="primary"
          />
        </Card>
      </main>
    );
  }

  return (
    <AccountProfileEditor
      copy={copy}
      language={language}
      onNotice={onNotice}
      onPasswordChanged={onPasswordChanged}
      onProfileUpdated={onProfileUpdated}
      panelMode={panelMode}
      timeZone={timeZone}
      user={user}
    />
  );
}

type AccountProfileEditorProps = {
  copy: FrontCopy;
  language: AppLanguage;
  onNotice: (status: AuthStatus) => void;
  onPasswordChanged: () => void;
  onProfileUpdated: (user: BlogUser) => void;
  panelMode: ProfilePanelMode | null;
  timeZone: string;
  user: BlogUser;
};

function AccountProfileEditor({
  copy,
  language,
  onNotice,
  onPasswordChanged,
  onProfileUpdated,
  panelMode,
  timeZone,
  user,
}: AccountProfileEditorProps) {
  const profileCopy = copy.auth.profile;
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [profileForm, setProfileForm] = useState<AccountProfileFormState>(() =>
    createAccountProfileFormState(user),
  );
  const [avatarFile, setAvatarFile] = useState<File | undefined>(undefined);
  const [avatarEditorFile, setAvatarEditorFile] = useState<File | undefined>(undefined);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | undefined>(undefined);
  const [emailForm, setEmailForm] = useState<AccountEmailChangeFormState>(() =>
    createAccountEmailChangeFormState(),
  );
  const [passwordForm, setPasswordForm] = useState<AccountPasswordChangeFormState>(() =>
    createAccountPasswordChangeFormState(),
  );
  const [passwordMode, setPasswordMode] = useState<AccountPasswordVerificationMode>("password");
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [securityCodeClock, setSecurityCodeClock] = useState(() => Date.now());
  const [securityCodePurposeLoading, setSecurityCodePurposeLoading] =
    useState<AccountSecurityCodePurpose | null>(null);
  const securityCodePendingRef = useRef(false);
  const [securityCodeCooldownEndsAt, setSecurityCodeCooldownEndsAt] = useState<
    Record<AccountSecurityCodePurpose, number>
  >(() => createSecurityCodeState(0));
  const [securityCodeValidMinutes, setSecurityCodeValidMinutes] = useState<
    Record<AccountSecurityCodePurpose, number>
  >(() => createSecurityCodeState(DEFAULT_EMAIL_CODE_VALID_MINUTES));
  const { dialog: securityAltchaDialog, runWithAltcha: runSecurityWithAltcha } =
    useAltchaVerificationDialog({
      copy: getAltchaVerificationDialogCopy(language),
      language,
      onFeedback: ({ status, title }) => onNotice({ tone: status, text: title }),
      scopeKey: `${user.id}:${panelMode ?? ""}`,
    });
  const hasActiveSecurityCodeCooldown = Object.values(securityCodeCooldownEndsAt).some(
    (cooldownEndsAt) => cooldownEndsAt > securityCodeClock,
  );
  const previewName =
    profileForm.name.trim() || profileForm.username.trim() || getBlogUserDisplayName(user);
  const joinedAt = formatProfileDate({
    language,
    timeZone,
    value: user.createdAt,
  });
  const tagValues = parseProfileTags(profileForm.tags);
  const latestLoginAt =
    formatProfileDateTime({
      language,
      timeZone: user.lastLoginTimeZone ?? timeZone,
      value: user.lastLoginAt,
    }) || profileCopy.loginInfoEmpty;
  const latestLoginIp = user.lastLoginIp ?? profileCopy.loginInfoEmpty;
  const latestLoginLocation = getProfileLoginLocationLabel({
    ip: user.lastLoginIp,
    location: user.lastLoginLocation,
    profileCopy,
  });
  const latestLoginDevice = getProfileLoginDeviceLabel({
    device: user.lastLoginDevice,
    profileCopy,
  });
  const latestLoginMethod =
    getProfileLoginMethodLabel({ method: user.lastLoginMethod, profileCopy }) ??
    profileCopy.loginInfoEmpty;
  const savedAvatarUrl = profileForm.avatarUrl.trim();
  const previewAvatarUrl =
    avatarPreviewUrl ?? (savedAvatarUrl.length > 0 ? resolveApiAssetUrl(savedAvatarUrl) : "");

  useEffect(() => {
    setProfileForm(createAccountProfileFormState(user));
    setAvatarFile(undefined);
    setAvatarEditorFile(undefined);
    setAvatarPreviewUrl(undefined);
    if (avatarInputRef.current !== null) {
      avatarInputRef.current.value = "";
    }
    setEmailForm(createAccountEmailChangeFormState());
    setPasswordForm(createAccountPasswordChangeFormState());
    setPasswordMode("password");
    setSecurityCodeCooldownEndsAt(createSecurityCodeState(0));
    setSecurityCodeValidMinutes(createSecurityCodeState(DEFAULT_EMAIL_CODE_VALID_MINUTES));
    setSecurityCodePurposeLoading(null);
  }, [
    user.avatarUrl,
    user.bio,
    user.blogUrl,
    user.commentEmailNotifications,
    user.name,
    user.newPostEmailNotifications,
    user.tags,
    user.email,
    user.username,
  ]);

  useEffect(() => {
    if (avatarFile === undefined) {
      setAvatarPreviewUrl(undefined);
      return;
    }

    const objectUrl = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [avatarFile]);

  useEffect(() => {
    if (!hasActiveSecurityCodeCooldown) {
      return;
    }

    const timer = window.setInterval(() => {
      setSecurityCodeClock(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [hasActiveSecurityCodeCooldown]);

  useEffect(() => {
    if (panelMode === null) {
      return;
    }

    window.requestAnimationFrame(() => {
      document
        .getElementById(`profile-section-${panelMode}`)
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }, [panelMode]);

  async function handleSubmit() {
    if (profileForm.username.trim().length < 2) {
      onNotice({ tone: "error", text: profileCopy.usernameRequired });
      return;
    }

    setIsSaving(true);
    try {
      const targetProfileForm =
        avatarFile === undefined
          ? profileForm
          : {
              ...profileForm,
              avatarUrl: (
                await uploadBlogUserAvatar({
                  file: avatarFile,
                  fileName: avatarFile.name,
                })
              ).accessUrl,
            };
      const updatedUser = await updateBlogUserProfile({
        ...targetProfileForm,
        notificationEmailLocale: language,
        tags: parseProfileTags(targetProfileForm.tags),
      });
      onProfileUpdated(updatedUser);
      onNotice({ tone: "success", text: profileCopy.saved });
    } catch (error) {
      onNotice({
        tone: "error",
        text: profileCopy.saveFailed(readAuthErrorReason(error, profileCopy.saveFailureFallback)),
      });
    } finally {
      setIsSaving(false);
    }
  }

  function handleAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.currentTarget.files?.[0];
    if (selectedFile === undefined) {
      return;
    }

    if (!selectedFile.type.startsWith("image/")) {
      onNotice({ tone: "error", text: profileCopy.avatarOnlyImage });
      event.currentTarget.value = "";
      return;
    }

    if (canEditLocalImageFile(selectedFile)) {
      setAvatarEditorFile(selectedFile);
    } else {
      setAvatarFile(selectedFile);
      setProfileForm((current) => ({ ...current, avatarUrl: "" }));
    }

    event.currentTarget.value = "";
  }

  function clearAvatar() {
    setAvatarFile(undefined);
    setAvatarEditorFile(undefined);
    setAvatarPreviewUrl(undefined);
    setProfileForm((current) => ({ ...current, avatarUrl: "" }));
    if (avatarInputRef.current !== null) {
      avatarInputRef.current.value = "";
    }
  }

  function readSecurityCodeCooldownSeconds(purpose: AccountSecurityCodePurpose) {
    return Math.max(0, Math.ceil((securityCodeCooldownEndsAt[purpose] - securityCodeClock) / 1000));
  }

  function readSecurityCodeButtonLabel(purpose: AccountSecurityCodePurpose, fallback: string) {
    const cooldownSeconds = readSecurityCodeCooldownSeconds(purpose);
    if (securityCodePurposeLoading === purpose) {
      return copy.auth.submit.sendingCode;
    }

    if (cooldownSeconds > 0) {
      return copy.auth.submit.retryIn(cooldownSeconds);
    }

    return fallback;
  }

  async function requestAccountSecurityCode(purpose: AccountSecurityCodePurpose) {
    if (securityCodePendingRef.current || readSecurityCodeCooldownSeconds(purpose) > 0) {
      return;
    }

    if (purpose === "email_change_new" && emailForm.newEmail.trim().length === 0) {
      onNotice({ tone: "error", text: copy.auth.validation.emailRequired });
      return;
    }

    if (
      purpose === "email_change_new" &&
      emailForm.newEmail.trim().toLocaleLowerCase() === user.email.trim().toLocaleLowerCase()
    ) {
      onNotice({ tone: "error", text: profileCopy.emailUnchanged });
      return;
    }

    securityCodePendingRef.current = true;
    setSecurityCodePurposeLoading(purpose);
    try {
      const action = await runSecurityWithAltcha({
        runAction: (altcha) =>
          requestBlogAccountEmailCode(
            purpose === "email_change_new"
              ? { altcha, email: emailForm.newEmail, locale: language, purpose }
              : { altcha, locale: language, purpose },
          ),
        successMessage: (result) =>
          `${getAltchaSuccessMessage(language, result.sent ? "email-code" : "email-code-request")} ${
            result.devCode === undefined
              ? ""
              : `${copy.auth.dialog.codeDevPrefix}${result.devCode} `
          }${copy.auth.dialog.codeValidFor(result.validMinutes)}`,
      });
      if (action.status === "cancelled") {
        return;
      }
      const result = action.value;
      const now = Date.now();
      const validMinutes =
        Number.isFinite(result.validMinutes) && result.validMinutes > 0
          ? result.validMinutes
          : DEFAULT_EMAIL_CODE_VALID_MINUTES;
      setSecurityCodeClock(now);
      setSecurityCodeCooldownEndsAt((current) => ({
        ...current,
        [purpose]: now + EMAIL_CODE_COOLDOWN_SECONDS * 1000,
      }));
      setSecurityCodeValidMinutes((current) => ({
        ...current,
        [purpose]: validMinutes,
      }));

      if (result.devCode !== undefined) {
        if (purpose === "email_change_current") {
          setEmailForm((current) => ({ ...current, currentEmailCode: result.devCode ?? "" }));
        } else if (purpose === "email_change_new") {
          setEmailForm((current) => ({ ...current, newEmailCode: result.devCode ?? "" }));
        } else {
          setPasswordForm((current) => ({ ...current, emailCode: result.devCode ?? "" }));
        }
      }
    } catch (error) {
      onNotice({
        tone: "error",
        text: readAuthErrorReason(error, copy.auth.validation.codeRequired),
      });
    } finally {
      securityCodePendingRef.current = false;
      setSecurityCodePurposeLoading(null);
    }
  }

  async function handleEmailChangeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (emailForm.newEmail.trim().length === 0) {
      onNotice({ tone: "error", text: copy.auth.validation.emailRequired });
      return;
    }

    if (emailForm.newEmail.trim().toLocaleLowerCase() === user.email.trim().toLocaleLowerCase()) {
      onNotice({ tone: "error", text: profileCopy.emailUnchanged });
      return;
    }

    if (
      emailForm.currentEmailCode.trim().length === 0 ||
      emailForm.newEmailCode.trim().length === 0
    ) {
      onNotice({ tone: "error", text: copy.auth.validation.codeRequired });
      return;
    }

    setIsChangingEmail(true);
    try {
      const updatedUser = await changeBlogUserEmail({
        currentEmailCode: emailForm.currentEmailCode,
        newEmail: emailForm.newEmail,
        newEmailCode: emailForm.newEmailCode,
      });
      setEmailForm(createAccountEmailChangeFormState());
      onProfileUpdated(updatedUser);
      onNotice({ tone: "success", text: profileCopy.changeEmailSuccess });
    } catch (error) {
      onNotice({
        tone: "error",
        text: profileCopy.changeEmailFailed(
          readAuthErrorReason(error, profileCopy.changeEmailFailureFallback),
        ),
      });
    } finally {
      setIsChangingEmail(false);
    }
  }

  async function handlePasswordChangeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (passwordMode === "password" && passwordForm.currentPassword.length === 0) {
      onNotice({ tone: "error", text: profileCopy.currentPasswordRequired });
      return;
    }

    if (passwordMode === "email_code" && passwordForm.emailCode.trim().length === 0) {
      onNotice({ tone: "error", text: copy.auth.validation.codeRequired });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      onNotice({ tone: "error", text: copy.auth.validation.passwordTooShort });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      onNotice({ tone: "error", text: copy.auth.validation.passwordMismatch });
      return;
    }

    setIsChangingPassword(true);
    try {
      await changeBlogUserPassword(
        passwordMode === "password"
          ? {
              currentPassword: passwordForm.currentPassword,
              method: "password",
              newPassword: passwordForm.newPassword,
            }
          : {
              emailCode: passwordForm.emailCode,
              method: "email_code",
              newPassword: passwordForm.newPassword,
            },
      );
      setPasswordForm(createAccountPasswordChangeFormState());
      onNotice({ tone: "success", text: profileCopy.changePasswordSuccess });
      onPasswordChanged();
    } catch (error) {
      onNotice({
        tone: "error",
        text: profileCopy.changePasswordFailed(
          readAuthErrorReason(error, profileCopy.changePasswordFailureFallback),
        ),
      });
    } finally {
      setIsChangingPassword(false);
    }
  }

  return (
    <>
      {securityAltchaDialog}
      <main className="page-shell profile-page">
        <div className="profile-page__header">
          <Badge label={copy.auth.account.profileLabel} variant="neutral" />
          <Heading level={1}>{profileCopy.title}</Heading>
          <Text as="p" color="secondary">
            {profileCopy.description}
          </Text>
        </div>
        <div className="profile-center">
          <aside className="profile-center__side">
            <span className="profile-center__avatar">
              {previewAvatarUrl.length > 0 ? (
                <img alt={previewName} src={previewAvatarUrl} />
              ) : (
                previewName.trim().slice(0, 1).toUpperCase() || "U"
              )}
            </span>
            <div className="profile-center__identity">
              <strong>{previewName}</strong>
              <span>{user.email}</span>
              <Badge
                label={
                  user.role === "admin" ? copy.auth.account.adminRole : copy.auth.account.userRole
                }
                variant="neutral"
              />
            </div>
            <dl className="profile-center__meta">
              <div>
                <dt>{profileCopy.currentEmail}</dt>
                <dd>{user.email}</dd>
              </div>
              {joinedAt === undefined ? null : (
                <div>
                  <dt>{profileCopy.joinedAt}</dt>
                  <dd>{joinedAt}</dd>
                </div>
              )}
            </dl>
            {tagValues.length === 0 ? null : (
              <div className="profile-center__tags">
                {tagValues.map((tag) => (
                  <Badge key={tag} label={tag} variant="neutral" />
                ))}
              </div>
            )}
            <div className="profile-center__login">
              <strong>{profileCopy.loginInfo}</strong>
              <dl>
                <div>
                  <dt>
                    <Clock3 size={14} />
                    {profileCopy.lastLogin}
                  </dt>
                  <dd>{latestLoginAt}</dd>
                </div>
                <div>
                  <dt>
                    <AtSign size={14} />
                    {profileCopy.loginIp}
                  </dt>
                  <dd>{latestLoginIp}</dd>
                </div>
                <div>
                  <dt>
                    <MapPin size={14} />
                    {profileCopy.loginLocation}
                  </dt>
                  <dd>{latestLoginLocation}</dd>
                </div>
                <div>
                  <dt>
                    <MonitorCheck size={14} />
                    {profileCopy.loginDevice}
                  </dt>
                  <dd>{latestLoginDevice}</dd>
                </div>
                <div>
                  <dt>
                    <KeyRound size={14} />
                    {profileCopy.loginMethod}
                  </dt>
                  <dd>{latestLoginMethod}</dd>
                </div>
              </dl>
            </div>
          </aside>

          <div className="profile-center__main">
            <section
              className="profile-section profile-section--public"
              id="profile-section-profile"
            >
              <div className="profile-section__heading">
                <UserRound size={17} />
                <div>
                  <strong>{profileCopy.displayInfo}</strong>
                </div>
              </div>
              <div className="profile-section__grid">
                <TextInput
                  autoComplete="username"
                  label={copy.auth.fields.username}
                  onChange={(value) => {
                    setProfileForm((current) => ({ ...current, username: value }));
                  }}
                  placeholder={copy.auth.placeholders.username}
                  size="lg"
                  value={profileForm.username}
                />
                <TextInput
                  autoComplete="name"
                  label={copy.auth.fields.name}
                  onChange={(value) => {
                    setProfileForm((current) => ({ ...current, name: value }));
                  }}
                  placeholder={copy.auth.placeholders.name}
                  size="lg"
                  value={profileForm.name}
                />
              </div>
              <div className="profile-section__grid profile-section__grid--media">
                <div className="profile-avatar-upload">
                  <span className="profile-avatar-upload__preview">
                    {previewAvatarUrl.length > 0 ? (
                      <img alt={previewName} src={previewAvatarUrl} />
                    ) : (
                      previewName.trim().slice(0, 1).toUpperCase() || "U"
                    )}
                  </span>
                  <div className="profile-avatar-upload__body">
                    <TextInput
                      label={profileCopy.avatarUrl}
                      onChange={(value) => {
                        setAvatarFile(undefined);
                        setAvatarPreviewUrl(undefined);
                        if (avatarInputRef.current !== null) {
                          avatarInputRef.current.value = "";
                        }
                        setProfileForm((current) => ({ ...current, avatarUrl: value }));
                      }}
                      placeholder="/uploads/media/..."
                      size="lg"
                      value={profileForm.avatarUrl}
                    />
                    <div className="profile-avatar-upload__actions">
                      <Button
                        icon={<Upload size={16} />}
                        isDisabled={isSaving}
                        label={profileCopy.avatarChoose}
                        onClick={() => {
                          avatarInputRef.current?.click();
                        }}
                        size="sm"
                        type="button"
                        variant="secondary"
                      />
                      <Button
                        icon={<X size={16} />}
                        isDisabled={isSaving}
                        label={profileCopy.avatarClear}
                        onClick={clearAvatar}
                        size="sm"
                        type="button"
                        variant="ghost"
                      />
                      <input
                        ref={avatarInputRef}
                        accept="image/*"
                        aria-label={profileCopy.avatarChoose}
                        className="profile-avatar-upload__input"
                        onChange={handleAvatarFileChange}
                        type="file"
                      />
                    </div>
                    {avatarFile === undefined ? null : (
                      <p className="profile-avatar-upload__pending">
                        {profileCopy.avatarPending(avatarFile.name)}
                      </p>
                    )}
                  </div>
                </div>
                <TextInput
                  label={profileCopy.blogUrl}
                  onChange={(value) => {
                    setProfileForm((current) => ({ ...current, blogUrl: value }));
                  }}
                  placeholder="https://example.com"
                  size="lg"
                  value={profileForm.blogUrl}
                />
              </div>
              <TextInput
                label={profileCopy.tags}
                onChange={(value) => {
                  setProfileForm((current) => ({ ...current, tags: value }));
                }}
                placeholder={profileCopy.tagPlaceholder}
                size="lg"
                value={profileForm.tags}
              />
              <TextArea
                label={profileCopy.publicBio}
                onChange={(value) => {
                  setProfileForm((current) => ({ ...current, bio: value }));
                }}
                placeholder={profileCopy.description}
                rows={4}
                value={profileForm.bio}
              />
            </section>

            <section className="profile-section" id="profile-section-preferences">
              <div className="profile-section__heading">
                <ShieldCheck size={17} />
                <div>
                  <strong>{profileCopy.notificationsTitle}</strong>
                  <span>{profileCopy.notificationsDescription}</span>
                </div>
              </div>
              <div className="profile-switch-list">
                <Switch
                  label={profileCopy.commentNotifications}
                  labelPosition="start"
                  labelSpacing="spread"
                  onChange={(value) => {
                    setProfileForm((current) => ({
                      ...current,
                      commentEmailNotifications: value,
                    }));
                  }}
                  value={profileForm.commentEmailNotifications}
                />
                <Switch
                  label={profileCopy.newPostNotifications}
                  labelPosition="start"
                  labelSpacing="spread"
                  onChange={(value) => {
                    setProfileForm((current) => ({
                      ...current,
                      newPostEmailNotifications: value,
                    }));
                  }}
                  value={profileForm.newPostEmailNotifications}
                />
              </div>
            </section>

            <section className="profile-section">
              <div className="profile-section__heading">
                <KeyRound size={17} />
                <div>
                  <strong>{profileCopy.securityTitle}</strong>
                  <span>{profileCopy.securityDescription}</span>
                </div>
              </div>
              <div className="profile-security-grid">
                <form
                  className="profile-security-card profile-security-card--form"
                  id="profile-section-email"
                  onSubmit={handleEmailChangeSubmit}
                >
                  <div className="profile-security-card__title">
                    <Mail size={17} />
                    <div>
                      <strong>{profileCopy.emailTitle}</strong>
                      <span>{profileCopy.emailDescription}</span>
                    </div>
                  </div>
                  <TextInput
                    isDisabled
                    label={profileCopy.currentEmail}
                    onChange={() => undefined}
                    size="lg"
                    value={user.email}
                  />
                  <div className="profile-security-code-row">
                    <TextInput
                      autoComplete="one-time-code"
                      label={profileCopy.currentEmailCode}
                      onChange={(value) => {
                        setEmailForm((current) => ({ ...current, currentEmailCode: value }));
                      }}
                      placeholder={copy.auth.placeholders.code}
                      size="lg"
                      value={emailForm.currentEmailCode}
                    />
                    <Button
                      isDisabled={
                        securityCodePurposeLoading !== null ||
                        readSecurityCodeCooldownSeconds("email_change_current") > 0
                      }
                      isLoading={securityCodePurposeLoading === "email_change_current"}
                      label={readSecurityCodeButtonLabel(
                        "email_change_current",
                        profileCopy.sendCurrentEmailCode,
                      )}
                      onClick={() => {
                        void requestAccountSecurityCode("email_change_current");
                      }}
                      size="lg"
                      type="button"
                      variant="secondary"
                    />
                  </div>
                  <div className="profile-security-code-row">
                    <TextInput
                      autoComplete="email"
                      label={profileCopy.newEmail}
                      onChange={(value) => {
                        setEmailForm((current) => ({ ...current, newEmail: value }));
                      }}
                      placeholder={copy.auth.placeholders.email}
                      size="lg"
                      type="email"
                      value={emailForm.newEmail}
                    />
                    <Button
                      isDisabled={
                        securityCodePurposeLoading !== null ||
                        readSecurityCodeCooldownSeconds("email_change_new") > 0 ||
                        emailForm.newEmail.trim().length === 0
                      }
                      isLoading={securityCodePurposeLoading === "email_change_new"}
                      label={readSecurityCodeButtonLabel(
                        "email_change_new",
                        profileCopy.sendNewEmailCode,
                      )}
                      onClick={() => {
                        void requestAccountSecurityCode("email_change_new");
                      }}
                      size="lg"
                      type="button"
                      variant="secondary"
                    />
                  </div>
                  <TextInput
                    autoComplete="one-time-code"
                    label={profileCopy.newEmailCode}
                    onChange={(value) => {
                      setEmailForm((current) => ({ ...current, newEmailCode: value }));
                    }}
                    placeholder={copy.auth.placeholders.code}
                    size="lg"
                    value={emailForm.newEmailCode}
                  />
                  <p className="profile-security-card__hint">
                    {profileCopy.emailSecurityHint}{" "}
                    {copy.auth.dialog.codeValidFor(
                      Math.max(
                        securityCodeValidMinutes.email_change_current,
                        securityCodeValidMinutes.email_change_new,
                      ),
                    )}
                  </p>
                  <Button
                    icon={<Mail size={15} />}
                    isLoading={isChangingEmail}
                    label={isChangingEmail ? profileCopy.changingEmail : profileCopy.changeEmail}
                    size="lg"
                    type="submit"
                    variant="primary"
                    width="100%"
                  />
                </form>
                <form
                  className="profile-security-card profile-security-card--form"
                  id="profile-section-password"
                  onSubmit={handlePasswordChangeSubmit}
                >
                  <div className="profile-security-card__title">
                    <KeyRound size={17} />
                    <div>
                      <strong>{profileCopy.passwordTitle}</strong>
                      <span>{profileCopy.passwordDescription}</span>
                    </div>
                  </div>
                  <div className="profile-security-mode-toggle" role="group">
                    <button
                      aria-pressed={passwordMode === "password"}
                      className={passwordMode === "password" ? "is-selected" : undefined}
                      onClick={() => {
                        setPasswordMode("password");
                      }}
                      type="button"
                    >
                      {profileCopy.passwordMethodPassword}
                    </button>
                    <button
                      aria-pressed={passwordMode === "email_code"}
                      className={passwordMode === "email_code" ? "is-selected" : undefined}
                      onClick={() => {
                        setPasswordMode("email_code");
                      }}
                      type="button"
                    >
                      {profileCopy.passwordMethodCode}
                    </button>
                  </div>
                  {passwordMode === "password" ? (
                    <TextInput
                      autoComplete="current-password"
                      label={profileCopy.currentPassword}
                      onChange={(value) => {
                        setPasswordForm((current) => ({ ...current, currentPassword: value }));
                      }}
                      placeholder={copy.auth.placeholders.password}
                      size="lg"
                      type="password"
                      value={passwordForm.currentPassword}
                    />
                  ) : (
                    <div className="profile-security-code-row">
                      <TextInput
                        autoComplete="one-time-code"
                        label={profileCopy.passwordCode}
                        onChange={(value) => {
                          setPasswordForm((current) => ({ ...current, emailCode: value }));
                        }}
                        placeholder={copy.auth.placeholders.code}
                        size="lg"
                        value={passwordForm.emailCode}
                      />
                      <Button
                        isDisabled={
                          securityCodePurposeLoading !== null ||
                          readSecurityCodeCooldownSeconds("password_change") > 0
                        }
                        isLoading={securityCodePurposeLoading === "password_change"}
                        label={readSecurityCodeButtonLabel(
                          "password_change",
                          profileCopy.sendPasswordCode,
                        )}
                        onClick={() => {
                          void requestAccountSecurityCode("password_change");
                        }}
                        size="lg"
                        type="button"
                        variant="secondary"
                      />
                    </div>
                  )}
                  <TextInput
                    autoComplete="new-password"
                    label={profileCopy.newPassword}
                    onChange={(value) => {
                      setPasswordForm((current) => ({ ...current, newPassword: value }));
                    }}
                    placeholder={copy.auth.placeholders.password}
                    size="lg"
                    type="password"
                    value={passwordForm.newPassword}
                  />
                  <TextInput
                    autoComplete="new-password"
                    label={copy.auth.fields.confirmPassword}
                    onChange={(value) => {
                      setPasswordForm((current) => ({ ...current, confirmPassword: value }));
                    }}
                    placeholder={copy.auth.placeholders.confirmPassword}
                    size="lg"
                    type="password"
                    value={passwordForm.confirmPassword}
                  />
                  <p className="profile-security-card__hint">{profileCopy.passwordSecurityHint}</p>
                  <Button
                    icon={<KeyRound size={15} />}
                    isLoading={isChangingPassword}
                    label={
                      isChangingPassword ? profileCopy.changingPassword : profileCopy.changePassword
                    }
                    size="lg"
                    type="submit"
                    variant="primary"
                    width="100%"
                  />
                </form>
              </div>
            </section>

            <div className="profile-center__actions">
              <Button
                label={profileCopy.cancel}
                onClick={() => {
                  setProfileForm(createAccountProfileFormState(user));
                }}
                size="md"
                type="button"
                variant="secondary"
              />
              <Button
                icon={<UserRound size={15} />}
                isLoading={isSaving}
                label={isSaving ? profileCopy.saving : profileCopy.save}
                onClick={() => {
                  void handleSubmit();
                }}
                size="md"
                type="button"
                variant="primary"
              />
            </div>
          </div>
        </div>
      </main>
      <LocalImageEditorDialog
        file={avatarEditorFile}
        isOpen={avatarEditorFile !== undefined}
        kind="avatar"
        onApply={(file) => {
          setAvatarFile(file);
          setAvatarEditorFile(undefined);
          setProfileForm((current) => ({ ...current, avatarUrl: "" }));
        }}
        onCancel={() => setAvatarEditorFile(undefined)}
      />
    </>
  );
}

export function SiteAccountBlock({
  authState,
  copy,
  onNavigate,
  onLogout,
  onOpenAuth,
}: SiteAccountBlockProps) {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  if (authState === null) {
    return (
      <button
        aria-label={copy.auth.account.entry}
        className="site-account-card site-account-card--guest"
        onClick={onOpenAuth}
        type="button"
      >
        <span className="site-account-avatar site-account-avatar--guest">
          <UserRound size={15} />
        </span>
        <span className="site-account-card__text">
          <span>{copy.auth.account.entry}</span>
        </span>
      </button>
    );
  }

  const user = authState.user;
  const displayName = getBlogUserDisplayName(user);
  const avatarUrl =
    user.avatarUrl !== undefined && user.avatarUrl.trim().length > 0
      ? resolveApiAssetUrl(user.avatarUrl)
      : "";
  const confirmLogout = () => {
    setIsLogoutConfirmOpen(false);
    onLogout();
  };
  const accountMenuContent = (
    <div className="site-account-menu">
      <div className="site-account-menu__identity">
        <span className="site-account-avatar">
          {avatarUrl.length > 0 ? (
            <img alt={displayName} src={avatarUrl} />
          ) : (
            getBlogUserInitial(user)
          )}
        </span>
        <span className="site-account-menu__text">
          <strong>{displayName}</strong>
          <small>{user.email}</small>
        </span>
      </div>
      <Divider />
      <div className="site-account-menu__actions">
        <Button
          icon={<UserRound size={16} />}
          label={copy.auth.profile.open}
          onClick={() => {
            setIsAccountMenuOpen(false);
            onNavigate("/profile");
          }}
          size="md"
          variant="secondary"
          width="100%"
        />
        {user.role === "admin" ? (
          <Button
            href="/admin/"
            icon={<LayoutDashboard size={16} />}
            label={copy.auth.account.openAdmin}
            onClick={() => setIsAccountMenuOpen(false)}
            size="md"
            variant="ghost"
            width="100%"
          />
        ) : null}
        <Button
          icon={<LogOut size={16} />}
          label={copy.auth.account.logout}
          onClick={() => {
            setIsAccountMenuOpen(false);
            setIsLogoutConfirmOpen(true);
          }}
          size="md"
          variant="ghost"
          width="100%"
        />
      </div>
    </div>
  );

  return (
    <div aria-label={copy.auth.account.profileLabel} className="site-account-control">
      <Popover
        alignment="end"
        content={accountMenuContent}
        isOpen={isAccountMenuOpen}
        label={displayName}
        onOpenChange={setIsAccountMenuOpen}
        placement="below"
        width={280}
      >
        <button
          aria-label={copy.auth.account.profileLabel}
          className="site-account-card site-account-card--user"
          type="button"
        >
          <span className="site-account-avatar">
            {avatarUrl.length > 0 ? (
              <img alt={displayName} src={avatarUrl} />
            ) : (
              getBlogUserInitial(user)
            )}
          </span>
          <span className="site-account-card__text">
            <span>{displayName}</span>
            <small>{user.email}</small>
          </span>
          <ChevronDown className="site-account-card__chevron" size={14} />
        </button>
      </Popover>
      <Dialog
        aria-label={copy.auth.account.logoutConfirmTitle}
        isOpen={isLogoutConfirmOpen}
        onOpenChange={setIsLogoutConfirmOpen}
        padding={0}
        width="min(360px, calc(100vw - 24px))"
      >
        <div className="site-account-logout-dialog">
          <button
            aria-label={copy.auth.dialog.close}
            className="auth-dialog__close"
            onClick={() => {
              setIsLogoutConfirmOpen(false);
            }}
            type="button"
          >
            <X size={18} />
          </button>
          <div className="site-account-logout-dialog__body">
            <Heading level={2}>{copy.auth.account.logoutConfirmTitle}</Heading>
            <Text color="secondary" type="supporting">
              {copy.auth.account.logoutConfirmDescription}
            </Text>
          </div>
          <div className="site-account-logout-dialog__actions">
            <Button
              label={copy.auth.account.logoutCancel}
              onClick={() => {
                setIsLogoutConfirmOpen(false);
              }}
              size="md"
              variant="secondary"
            />
            <Button
              icon={<LogOut size={15} />}
              label={copy.auth.account.logoutConfirm}
              onClick={confirmLogout}
              size="md"
              variant="primary"
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function AuthDialog({
  copy,
  isOpen,
  language,
  onAuthenticated,
  onNotice,
  onOpenChange,
}: AuthDialogProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const actionPendingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOauthProvidersLoading, setIsOauthProvidersLoading] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<PublicAuthProvider[]>([]);
  const [codePurposeLoading, setCodePurposeLoading] = useState<AuthDialogEmailCodePurpose | null>(
    null,
  );
  const [codeClock, setCodeClock] = useState(() => Date.now());
  const [codeCooldownEndsAt, setCodeCooldownEndsAt] = useState<
    Record<AuthDialogEmailCodePurpose, number>
  >({
    password_reset: 0,
    register: 0,
  });
  const [codeValidMinutes, setCodeValidMinutes] = useState<
    Record<AuthDialogEmailCodePurpose, number>
  >({
    password_reset: DEFAULT_EMAIL_CODE_VALID_MINUTES,
    register: DEFAULT_EMAIL_CODE_VALID_MINUTES,
  });
  const [loginForm, setLoginForm] = useState({
    identifier: "",
    password: "",
  });
  const [registerForm, setRegisterForm] = useState({
    email: "",
    emailCode: "",
    name: "",
    password: "",
    username: "",
  });
  const [forgotForm, setForgotForm] = useState({
    confirmPassword: "",
    email: "",
    emailCode: "",
    password: "",
  });
  const authCopy = copy.auth;
  const {
    dialog: authAltchaDialog,
    cancelAltcha,
    runWithAltcha,
  } = useAltchaVerificationDialog({
    copy: getAltchaVerificationDialogCopy(language),
    language,
    onFeedback: ({ status, title }) => onNotice({ tone: status, text: title }),
    scopeKey: `${isOpen}:${mode}`,
  });
  const hasActiveCodeCooldown =
    codeCooldownEndsAt.register > codeClock || codeCooldownEndsAt.password_reset > codeClock;

  useEffect(() => {
    if (!isOpen || mode !== "login") {
      return;
    }

    let isMounted = true;

    const loadOAuthProviders = async () => {
      setIsOauthProvidersLoading(true);
      try {
        const providers = await getBlogOAuthProviders();
        if (isMounted) {
          setOauthProviders(providers);
        }
      } catch {
        if (isMounted) {
          setOauthProviders([]);
        }
      } finally {
        if (isMounted) {
          setIsOauthProvidersLoading(false);
        }
      }
    };

    void loadOAuthProviders();

    return () => {
      isMounted = false;
    };
  }, [isOpen, mode]);

  useEffect(() => {
    if (!hasActiveCodeCooldown) {
      return;
    }

    const timer = window.setInterval(() => {
      setCodeClock(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [hasActiveCodeCooldown]);

  function changeMode(nextMode: string) {
    if (!isAuthMode(nextMode)) {
      return;
    }

    setMode(nextMode);
    cancelAltcha();
  }

  function readModeDescription() {
    if (mode === "register") {
      return authCopy.dialog.registerDescription;
    }

    if (mode === "forgot") {
      return authCopy.dialog.forgotDescription;
    }

    return authCopy.dialog.loginDescription;
  }

  function readModeTitle() {
    if (mode === "register") {
      return authCopy.dialog.registerTitle;
    }

    if (mode === "forgot") {
      return authCopy.dialog.forgotTitle;
    }

    return authCopy.dialog.loginTitle;
  }

  function showPlaceholderStatus() {
    onNotice({ tone: "info", text: authCopy.dialog.placeholderUnavailable });
  }

  function isOAuthProviderAvailable(provider: AuthProvider) {
    return oauthProviders.some((item) => item.provider === provider);
  }

  function startOAuthLogin(provider: AuthProvider) {
    if (isOauthProvidersLoading || actionPendingRef.current) {
      return;
    }

    if (!isOAuthProviderAvailable(provider)) {
      showPlaceholderStatus();
      return;
    }

    window.location.assign(
      createBlogOAuthStartUrl({
        provider,
        returnTo: getCurrentReturnTo(),
      }),
    );
  }

  function readCodeCooldownSeconds(purpose: AuthDialogEmailCodePurpose) {
    return Math.max(0, Math.ceil((codeCooldownEndsAt[purpose] - codeClock) / 1000));
  }

  function readCodeValidityText(purpose: AuthDialogEmailCodePurpose) {
    return authCopy.dialog.codeValidFor(codeValidMinutes[purpose]);
  }

  function readCodeButtonLabel(purpose: AuthDialogEmailCodePurpose) {
    const cooldownSeconds = readCodeCooldownSeconds(purpose);
    if (codePurposeLoading === purpose) {
      return authCopy.submit.sendingCode;
    }

    if (cooldownSeconds > 0) {
      return authCopy.submit.retryIn(cooldownSeconds);
    }

    return authCopy.submit.sendCode;
  }

  async function requestCode(purpose: AuthDialogEmailCodePurpose) {
    if (actionPendingRef.current || readCodeCooldownSeconds(purpose) > 0) {
      return;
    }

    const email = purpose === "register" ? registerForm.email : forgotForm.email;
    if (email.trim().length === 0) {
      onNotice({ tone: "error", text: authCopy.validation.emailRequired });
      return;
    }

    actionPendingRef.current = true;
    setCodePurposeLoading(purpose);
    try {
      const action = await runWithAltcha({
        runAction: (altcha) => requestBlogEmailCode({ altcha, email, locale: language, purpose }),
        successMessage: (result) =>
          `${getAltchaSuccessMessage(
            language,
            purpose === "password_reset" || !result.sent ? "email-code-request" : "email-code",
          )} ${
            result.devCode === undefined ? "" : `${authCopy.dialog.codeDevPrefix}${result.devCode} `
          }${authCopy.dialog.codeValidFor(result.validMinutes)}`,
      });
      if (action.status === "cancelled") {
        return;
      }
      const result = action.value;
      const validMinutes =
        Number.isFinite(result.validMinutes) && result.validMinutes > 0
          ? result.validMinutes
          : DEFAULT_EMAIL_CODE_VALID_MINUTES;
      setCodeClock(Date.now());
      setCodeCooldownEndsAt((current) => ({
        ...current,
        [purpose]: Date.now() + EMAIL_CODE_COOLDOWN_SECONDS * 1000,
      }));
      setCodeValidMinutes((current) => ({
        ...current,
        [purpose]: validMinutes,
      }));
    } catch (error) {
      onNotice({
        tone: "error",
        text: error instanceof Error ? error.message : authCopy.validation.codeRequired,
      });
    } finally {
      actionPendingRef.current = false;
      setCodePurposeLoading(null);
    }
  }

  async function submitLogin() {
    if (actionPendingRef.current) {
      return;
    }
    if (loginForm.identifier.trim().length === 0) {
      onNotice({ tone: "error", text: authCopy.validation.identifierRequired });
      return;
    }

    if (loginForm.password.length === 0) {
      onNotice({ tone: "error", text: authCopy.validation.passwordRequired });
      return;
    }

    actionPendingRef.current = true;
    setIsSubmitting(true);
    try {
      const action = await runWithAltcha({
        runAction: (altcha) => loginBlogUser({ ...loginForm, altcha }),
        successMessage: getAltchaSuccessMessage(language, "login"),
      });
      if (action.status === "cancelled") {
        return;
      }
      onAuthenticated(action.value);
      onOpenChange(false);
    } catch (error) {
      onNotice({
        tone: "error",
        text: authCopy.dialog.loginFailed(
          readAuthErrorReason(error, authCopy.dialog.loginFailureFallback),
        ),
      });
    } finally {
      actionPendingRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function submitRegister() {
    if (actionPendingRef.current) {
      return;
    }
    if (registerForm.username.trim().length === 0) {
      onNotice({ tone: "error", text: authCopy.validation.usernameRequired });
      return;
    }

    if (registerForm.email.trim().length === 0) {
      onNotice({ tone: "error", text: authCopy.validation.emailRequired });
      return;
    }

    if (registerForm.emailCode.trim().length === 0) {
      onNotice({ tone: "error", text: authCopy.validation.codeRequired });
      return;
    }

    if (registerForm.password.length < 8) {
      onNotice({ tone: "error", text: authCopy.validation.passwordTooShort });
      return;
    }

    actionPendingRef.current = true;
    setIsSubmitting(true);
    try {
      const action = await runWithAltcha({
        runAction: (altcha) => registerBlogUser({ ...registerForm, altcha }),
        successMessage: getAltchaSuccessMessage(language, "register"),
      });
      if (action.status === "cancelled") {
        return;
      }
      onAuthenticated(action.value);
      onOpenChange(false);
    } catch (error) {
      onNotice({
        tone: "error",
        text: authCopy.dialog.registerFailed(
          readAuthErrorReason(error, authCopy.dialog.registerFailureFallback),
        ),
      });
    } finally {
      actionPendingRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function submitForgotPassword() {
    if (actionPendingRef.current) {
      return;
    }
    if (forgotForm.email.trim().length === 0) {
      onNotice({ tone: "error", text: authCopy.validation.emailRequired });
      return;
    }

    if (forgotForm.emailCode.trim().length === 0) {
      onNotice({ tone: "error", text: authCopy.validation.codeRequired });
      return;
    }

    if (forgotForm.password.length < 8) {
      onNotice({ tone: "error", text: authCopy.validation.passwordTooShort });
      return;
    }

    if (forgotForm.password !== forgotForm.confirmPassword) {
      onNotice({ tone: "error", text: authCopy.validation.passwordMismatch });
      return;
    }

    actionPendingRef.current = true;
    setIsSubmitting(true);
    try {
      const action = await runWithAltcha({
        runAction: (altcha) =>
          resetBlogPassword({
            altcha,
            email: forgotForm.email,
            emailCode: forgotForm.emailCode,
            password: forgotForm.password,
          }),
        successMessage: getAltchaSuccessMessage(language, "password-reset"),
      });
      if (action.status === "cancelled") {
        return;
      }
      setForgotForm({ confirmPassword: "", email: "", emailCode: "", password: "" });
      setLoginForm((current) => ({ ...current, identifier: forgotForm.email }));
      setMode("login");
    } catch (error) {
      onNotice({
        tone: "error",
        text: authCopy.dialog.resetFailed(
          readAuthErrorReason(error, authCopy.dialog.resetFailureFallback),
        ),
      });
    } finally {
      actionPendingRef.current = false;
      setIsSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "register") {
      void submitRegister();
      return;
    }

    if (mode === "forgot") {
      void submitForgotPassword();
      return;
    }

    void submitLogin();
  }

  const submitLabel =
    mode === "register"
      ? authCopy.submit.register
      : mode === "forgot"
        ? authCopy.submit.forgot
        : authCopy.submit.login;
  const submitIcon =
    mode === "register" ? (
      <UserPlus size={16} />
    ) : mode === "forgot" ? (
      <KeyRound size={16} />
    ) : (
      <UserRound size={16} />
    );
  const footerPrompt =
    mode === "login" ? authCopy.dialog.registerPrompt : authCopy.dialog.loginPrompt;
  const footerAction =
    mode === "login" ? authCopy.dialog.registerAction : authCopy.dialog.loginAction;
  const footerMode: AuthMode = mode === "login" ? "register" : "login";

  return (
    <>
      <Dialog
        aria-label={readModeTitle()}
        isOpen={isOpen}
        maxHeight="min(92dvh, 760px)"
        onOpenChange={(open) => {
          if (!open) {
            cancelAltcha();
          }
          onOpenChange(open);
        }}
        padding={0}
        width="min(400px, calc(100vw - 24px))"
      >
        <div className="auth-dialog">
          <button
            aria-label={authCopy.dialog.close}
            className="auth-dialog__close"
            onClick={() => {
              cancelAltcha();
              onOpenChange(false);
            }}
            type="button"
          >
            <X size={18} />
          </button>
          <form className="auth-card" onSubmit={handleSubmit}>
            <div className="auth-card__heading">
              <Heading level={2}>{readModeTitle()}</Heading>
              <Text color="secondary" type="supporting">
                {readModeDescription()}
              </Text>
            </div>

            {mode === "login" ? (
              <div className="auth-card__fields">
                <TextInput
                  autoComplete="username"
                  label={authCopy.fields.identifier}
                  onChange={(value) => {
                    setLoginForm((current) => ({ ...current, identifier: value }));
                  }}
                  placeholder={authCopy.placeholders.identifier}
                  size="lg"
                  value={loginForm.identifier}
                />
                <TextInput
                  autoComplete="current-password"
                  label={authCopy.fields.password}
                  onChange={(value) => {
                    setLoginForm((current) => ({ ...current, password: value }));
                  }}
                  placeholder={authCopy.placeholders.password}
                  size="lg"
                  type="password"
                  value={loginForm.password}
                />
                <p className="auth-card__inline-switch">
                  {authCopy.dialog.forgotPrompt}
                  <button
                    onClick={() => {
                      changeMode("forgot");
                    }}
                    type="button"
                  >
                    {authCopy.dialog.forgotLink}
                  </button>
                </p>
              </div>
            ) : null}

            {mode === "register" ? (
              <div className="auth-card__fields">
                <TextInput
                  autoComplete="username"
                  label={authCopy.fields.username}
                  onChange={(value) => {
                    setRegisterForm((current) => ({ ...current, username: value }));
                  }}
                  placeholder={authCopy.placeholders.username}
                  size="lg"
                  value={registerForm.username}
                />
                <TextInput
                  autoComplete="name"
                  label={authCopy.fields.name}
                  onChange={(value) => {
                    setRegisterForm((current) => ({ ...current, name: value }));
                  }}
                  placeholder={authCopy.placeholders.name}
                  size="lg"
                  value={registerForm.name}
                />
                <div className="auth-code-row">
                  <TextInput
                    autoComplete="email"
                    label={authCopy.fields.email}
                    onChange={(value) => {
                      setRegisterForm((current) => ({ ...current, email: value }));
                    }}
                    placeholder={authCopy.placeholders.email}
                    size="lg"
                    type="email"
                    value={registerForm.email}
                  />
                  <Button
                    isDisabled={
                      codePurposeLoading !== null || readCodeCooldownSeconds("register") > 0
                    }
                    isLoading={codePurposeLoading === "register"}
                    label={readCodeButtonLabel("register")}
                    onClick={() => {
                      void requestCode("register");
                    }}
                    size="lg"
                    variant="secondary"
                  />
                  <p className="auth-code-row__hint">{readCodeValidityText("register")}</p>
                </div>
                <TextInput
                  autoComplete="one-time-code"
                  label={authCopy.fields.code}
                  onChange={(value) => {
                    setRegisterForm((current) => ({ ...current, emailCode: value }));
                  }}
                  placeholder={authCopy.placeholders.code}
                  size="lg"
                  value={registerForm.emailCode}
                />
                <TextInput
                  autoComplete="new-password"
                  label={authCopy.fields.password}
                  onChange={(value) => {
                    setRegisterForm((current) => ({ ...current, password: value }));
                  }}
                  placeholder={authCopy.placeholders.password}
                  size="lg"
                  type="password"
                  value={registerForm.password}
                />
              </div>
            ) : null}

            {mode === "forgot" ? (
              <div className="auth-card__fields">
                <div className="auth-code-row">
                  <TextInput
                    autoComplete="email"
                    label={authCopy.fields.email}
                    onChange={(value) => {
                      setForgotForm((current) => ({ ...current, email: value }));
                    }}
                    placeholder={authCopy.placeholders.email}
                    size="lg"
                    type="email"
                    value={forgotForm.email}
                  />
                  <Button
                    isDisabled={
                      codePurposeLoading !== null || readCodeCooldownSeconds("password_reset") > 0
                    }
                    isLoading={codePurposeLoading === "password_reset"}
                    label={readCodeButtonLabel("password_reset")}
                    onClick={() => {
                      void requestCode("password_reset");
                    }}
                    size="lg"
                    variant="secondary"
                  />
                  <p className="auth-code-row__hint">{readCodeValidityText("password_reset")}</p>
                </div>
                <TextInput
                  autoComplete="one-time-code"
                  label={authCopy.fields.code}
                  onChange={(value) => {
                    setForgotForm((current) => ({ ...current, emailCode: value }));
                  }}
                  placeholder={authCopy.placeholders.code}
                  size="lg"
                  value={forgotForm.emailCode}
                />
                <TextInput
                  autoComplete="new-password"
                  label={authCopy.fields.password}
                  onChange={(value) => {
                    setForgotForm((current) => ({ ...current, password: value }));
                  }}
                  placeholder={authCopy.placeholders.password}
                  size="lg"
                  type="password"
                  value={forgotForm.password}
                />
                <TextInput
                  autoComplete="new-password"
                  label={authCopy.fields.confirmPassword}
                  onChange={(value) => {
                    setForgotForm((current) => ({ ...current, confirmPassword: value }));
                  }}
                  placeholder={authCopy.placeholders.confirmPassword}
                  size="lg"
                  type="password"
                  value={forgotForm.confirmPassword}
                />
              </div>
            ) : null}

            <Button
              icon={submitIcon}
              isLoading={isSubmitting}
              label={isSubmitting ? authCopy.submit.working : submitLabel}
              size="lg"
              type="submit"
              variant="primary"
              width="100%"
            />

            {mode === "login" ? (
              <>
                <Divider label={authCopy.dialog.socialDivider} />

                <div className="auth-social-buttons">
                  <Button
                    icon={<AppleIcon />}
                    label={authCopy.social.apple}
                    onClick={showPlaceholderStatus}
                    size="lg"
                    variant="secondary"
                    width="100%"
                  />
                  <Button
                    icon={<GoogleIcon />}
                    isLoading={isOauthProvidersLoading}
                    label={authCopy.social.google}
                    onClick={() => {
                      startOAuthLogin("google");
                    }}
                    size="lg"
                    variant="secondary"
                    width="100%"
                  />
                  <Button
                    icon={<GitHubIcon />}
                    isLoading={isOauthProvidersLoading}
                    label={authCopy.social.github}
                    onClick={() => {
                      startOAuthLogin("github");
                    }}
                    size="lg"
                    variant="secondary"
                    width="100%"
                  />
                </div>
              </>
            ) : null}

            <p className="auth-card__switch">
              {footerPrompt}
              <button
                onClick={() => {
                  changeMode(footerMode);
                }}
                type="button"
              >
                {footerAction}
              </button>
            </p>

            <p className="auth-card__security">
              <ShieldCheck size={15} />
              {readModeDescription()}
            </p>
          </form>
        </div>
      </Dialog>
      {authAltchaDialog}
    </>
  );
}

type TopNavigationItemsProps = {
  copy: FrontCopy;
  currentPath: string;
};

function TopNavigationItems({ copy, currentPath }: TopNavigationItemsProps) {
  return (
    <>
      {primaryNavItems.map((item) => {
        const itemCopy = copy.navItems[item.copyKey];

        return (
          <TopNavItem
            href={item.path}
            icon={item.icon}
            isSelected={isActivePath(currentPath, item.path)}
            key={item.path}
            label={itemCopy.label}
          />
        );
      })}
      {navGroups.map((group) => {
        const isActive = group.items.some((item) => isActivePath(currentPath, item.path));
        const featured = copy.megaMenuFeatured[group.copyKey];

        return (
          <div className="front-nav-mega-shell" key={group.copyKey}>
            <span aria-hidden="true" className="front-nav-mega-shell__icon">
              {group.icon}
            </span>
            <TopNavMegaMenu
              className={isActive ? "front-nav-mega is-active" : "front-nav-mega"}
              featured={
                <TopNavMegaMenuFeaturedCard
                  description={featured.description}
                  linkHref={navGroupFeaturedLinks[group.copyKey]}
                  linkLabel={featured.linkLabel}
                  title={featured.title}
                />
              }
              items={
                <>
                  {group.items.map((item) => {
                    const itemCopy = copy.navItems[item.copyKey];

                    return (
                      <TopNavMegaMenuItem
                        description={itemCopy.description}
                        href={item.path}
                        icon={item.icon}
                        key={item.path}
                        title={itemCopy.label}
                      />
                    );
                  })}
                </>
              }
              label={copy.navGroups[group.copyKey]}
            />
          </div>
        );
      })}
    </>
  );
}

type MobileNavigationItemsProps = {
  copy: FrontCopy;
  currentPath: string;
  onItemClick: () => void;
};

function MobileNavigationItems({ copy, currentPath, onItemClick }: MobileNavigationItemsProps) {
  return (
    <>
      <SideNavSection isHeaderHidden title={copy.navLabel}>
        {primaryNavItems.map((item) => {
          const itemCopy = copy.navItems[item.copyKey];

          return (
            <SideNavItem
              href={item.path}
              icon={item.icon}
              isSelected={isActivePath(currentPath, item.path)}
              key={item.path}
              label={itemCopy.label}
              onClick={onItemClick}
            />
          );
        })}
      </SideNavSection>
      {navGroups.map((group) => (
        <SideNavSection key={group.copyKey} title={copy.navGroups[group.copyKey]}>
          {group.items.map((item) => {
            const itemCopy = copy.navItems[item.copyKey];

            return (
              <SideNavItem
                href={item.path}
                icon={item.icon}
                isSelected={isActivePath(currentPath, item.path)}
                key={item.path}
                label={itemCopy.label}
                onClick={onItemClick}
              />
            );
          })}
        </SideNavSection>
      ))}
    </>
  );
}

type SiteHeaderProps = {
  authState: BlogAuthState | null;
  copy: FrontCopy;
  currentPath: string;
  language: AppLanguage;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  onOpenAuth: () => void;
  onLanguageChange: (language: AppLanguage) => void;
  onSearch: (query: string) => void;
  onToggleThemeMode: () => void;
  siteBrand: SiteBrandContent;
  themeMode: AppThemeMode;
};

function SiteHeader({
  authState,
  copy,
  currentPath,
  language,
  onLanguageChange,
  onLogout,
  onOpenAuth,
  onNavigate,
  onSearch,
  onToggleThemeMode,
  siteBrand,
  themeMode,
}: SiteHeaderProps) {
  const isCompactNav = useMediaQuery("(max-width: 767px)");
  const isNarrow = useMediaQuery("(max-width: 640px)");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const isDarkTheme = themeMode === "dark";
  const resolvedLogoUrl = siteBrand.logoUrl.length > 0 ? resolveApiAssetUrl(siteBrand.logoUrl) : "";
  const fallbackLogoText = siteBrand.name.trim().slice(0, 1) || "L";
  const BlogRouterLink = useMemo(() => {
    function BlogRouterLinkComponent({ href, onClick, ref, to, ...props }: BlogRouterLinkProps) {
      const targetHref = href ?? to ?? "#";

      return (
        <a
          {...props}
          href={targetHref}
          ref={ref}
          onClick={(event) => {
            onClick?.(event);

            if (event.defaultPrevented || isModifiedClick(event) || !isInternalRoute(targetHref)) {
              return;
            }

            event.preventDefault();
            onNavigate(targetHref);
          }}
        />
      );
    }

    BlogRouterLinkComponent.displayName = "BlogRouterLink";
    return BlogRouterLinkComponent;
  }, [onNavigate]);

  useEffect(() => {
    if (!isCompactNav && isMobileNavOpen) {
      setIsMobileNavOpen(false);
    }
  }, [isCompactNav, isMobileNavOpen]);

  function closeMobileNav() {
    setIsMobileNavOpen(false);
  }

  return (
    <LinkProvider component={BlogRouterLink}>
      <TopNav
        centerContent={
          isCompactNav ? null : <TopNavigationItems copy={copy} currentPath={currentPath} />
        }
        className="front-top-nav"
        endContent={
          <HStack
            className="site-header__actions"
            gap={isNarrow ? 1 : 2}
            hAlign="end"
            vAlign="center"
            wrap="nowrap"
          >
            <SiteSearchCommand
              copy={copy}
              language={language}
              onNavigate={onNavigate}
              onSearch={onSearch}
            />

            <SiteAccountBlock
              authState={authState}
              copy={copy}
              onLogout={onLogout}
              onNavigate={onNavigate}
              onOpenAuth={onOpenAuth}
            />

            <HeaderLanguageToggle language={language} onLanguageChange={onLanguageChange} />

            <IconButton
              icon={isDarkTheme ? <Sun size={16} /> : <Moon size={16} />}
              label={isDarkTheme ? copy.theme.light : copy.theme.dark}
              onClick={onToggleThemeMode}
              size="sm"
              tooltip={isDarkTheme ? copy.theme.light : copy.theme.dark}
              variant="ghost"
            />

            {isCompactNav ? (
              <IconButton
                className="site-mobile-nav-trigger"
                icon={<Menu size={18} />}
                label={copy.mobile.open}
                onClick={() => {
                  setIsMobileNavOpen(true);
                }}
                size="sm"
                tooltip={copy.mobile.open}
                variant="ghost"
              />
            ) : null}
          </HStack>
        }
        heading={
          <TopNavHeading
            heading={isNarrow ? undefined : siteBrand.name}
            headingHref="/"
            logo={
              resolvedLogoUrl.length > 0 ? (
                <img alt={siteBrand.name} className="site-brand__logo" src={resolvedLogoUrl} />
              ) : (
                <span aria-hidden="true" className="site-brand__mark">
                  {fallbackLogoText}
                </span>
              )
            }
            logoLabel={siteBrand.name}
          />
        }
        label={copy.navLabel}
      />
      {isCompactNav ? (
        <MobileNav
          className="site-mobile-nav"
          header={siteBrand.name}
          isOpen={isMobileNavOpen}
          label={copy.navLabel}
          onOpenChange={setIsMobileNavOpen}
          side="end"
        >
          <MobileNavigationItems
            copy={copy}
            currentPath={currentPath}
            onItemClick={closeMobileNav}
          />
        </MobileNav>
      ) : null}
    </LinkProvider>
  );
}

type HomePageProps = {
  copy: FrontCopy;
  language: AppLanguage;
  onNavigate: (path: string) => void;
  siteAuthor: SiteAuthorContent;
  siteBrand: SiteBrandContent;
  timeZone: string;
};

type HeroCoverCarouselProps = {
  activeIndex: number;
  coverUrls: readonly string[];
};

function HeroCoverCarousel({ activeIndex, coverUrls }: HeroCoverCarouselProps) {
  if (coverUrls.length === 0) {
    return null;
  }

  const boundedActiveIndex = Math.min(Math.max(activeIndex, 0), coverUrls.length - 1);

  return (
    <div aria-hidden="true" className="home-hero-showcase__carousel">
      {coverUrls.map((coverUrl, index) => (
        <img
          alt=""
          className={
            index === boundedActiveIndex
              ? "home-hero-showcase__slide home-hero-showcase__slide--active"
              : "home-hero-showcase__slide"
          }
          key={`${coverUrl}-${index}`}
          loading={index === 0 ? "eager" : "lazy"}
          src={resolveApiAssetUrl(coverUrl)}
        />
      ))}
    </div>
  );
}

function HomeHeroWaves() {
  return (
    <svg
      aria-hidden="true"
      className="home-hero-waves"
      focusable="false"
      preserveAspectRatio="none"
      viewBox="0 24 150 28"
    >
      <defs>
        <path
          d="M-160 44c30 0 58-18 88-18s58 18 88 18 58-18 88-18 58 18 88 18v44h-352z"
          id="home-hero-wave-path"
        />
      </defs>
      <g className="home-hero-waves__parallax">
        <use
          className="home-hero-waves__layer home-hero-waves__layer--one"
          href="#home-hero-wave-path"
          x="48"
          y="0"
        />
        <use
          className="home-hero-waves__layer home-hero-waves__layer--two"
          href="#home-hero-wave-path"
          x="48"
          y="3"
        />
        <use
          className="home-hero-waves__layer home-hero-waves__layer--three"
          href="#home-hero-wave-path"
          x="48"
          y="5"
        />
        <use
          className="home-hero-waves__layer home-hero-waves__layer--four"
          href="#home-hero-wave-path"
          x="48"
          y="7"
        />
      </g>
    </svg>
  );
}

type HomeTextTypeProps = {
  text: string;
};

function HomeTextType({ text }: HomeTextTypeProps) {
  const [displayText, setDisplayText] = useState("");

  useEffect(() => {
    let currentIndex = 0;
    let isDeleting = false;
    let timeoutId = 0;
    setDisplayText("");

    function tick() {
      const nextDelay = isDeleting ? 78 : 132;

      if (!isDeleting && currentIndex < text.length) {
        currentIndex += 1;
        setDisplayText(text.slice(0, currentIndex));
        timeoutId = window.setTimeout(tick, nextDelay);
        return;
      }

      if (!isDeleting && currentIndex >= text.length) {
        isDeleting = true;
        timeoutId = window.setTimeout(tick, 1800);
        return;
      }

      if (isDeleting && currentIndex > 0) {
        currentIndex -= 1;
        setDisplayText(text.slice(0, currentIndex));
        timeoutId = window.setTimeout(tick, nextDelay);
        return;
      }

      isDeleting = false;
      timeoutId = window.setTimeout(tick, 720);
    }

    timeoutId = window.setTimeout(tick, 480);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [text]);

  return (
    <p aria-label={text} className="home-hero-type">
      <span>{displayText}</span>
      <span aria-hidden="true" className="home-hero-type__cursor" />
    </p>
  );
}

function useHomeHeroCarousel(coverUrls: readonly string[], intervalMs = 6500) {
  const [activeCoverIndex, setActiveCoverIndex] = useState(0);

  useEffect(() => {
    setActiveCoverIndex(0);
  }, [coverUrls]);

  useEffect(() => {
    if (coverUrls.length <= 1) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveCoverIndex((index) => (index + 1) % coverUrls.length);
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [coverUrls.length, intervalMs]);

  return { activeCoverIndex, setActiveCoverIndex };
}

function HomePage({ copy, language, onNavigate, siteAuthor, siteBrand, timeZone }: HomePageProps) {
  const [articleLoadState, setArticleLoadState] = useState<"error" | "idle" | "loading">("loading");
  const [categoryLoadState, setCategoryLoadState] = useState<"error" | "idle" | "loading">(
    "loading",
  );
  const [remoteArticles, setRemoteArticles] = useState<ArticleContent[]>([]);
  const [remoteCategories, setRemoteCategories] = useState<ArticleCategory[]>([]);
  const [remoteTags, setRemoteTags] = useState<ArticleTag[]>([]);
  const [tagLoadState, setTagLoadState] = useState<"error" | "idle" | "loading">("loading");
  const heroCoverUrls = useMemo(() => {
    const configuredCoverUrls = getCleanStringList(siteBrand.coverUrls);
    return configuredCoverUrls.length > 0 ? configuredCoverUrls : [homeCoverPath];
  }, [siteBrand.coverUrls]);
  const { activeCoverIndex, setActiveCoverIndex } = useHomeHeroCarousel(heroCoverUrls);
  const heroLogoUrl = getNonEmptyText(siteBrand.logoUrl) ?? "";
  const resolvedHeroLogoUrl = heroLogoUrl.length > 0 ? resolveApiAssetUrl(heroLogoUrl) : "";
  const heroFallbackLogoText = siteBrand.name.trim().slice(0, 1).toUpperCase() || "L";
  const fallbackArticles = homeArticlesByLanguage[language];
  const remoteHomeArticles = useMemo(
    () => remoteArticles.map((article) => toHomeArticle({ article, language, timeZone })),
    [language, remoteArticles, timeZone],
  );
  const articles =
    articleLoadState === "idle"
      ? remoteHomeArticles
      : remoteHomeArticles.length > 0
        ? remoteHomeArticles
        : fallbackArticles;
  const pinnedArticles = useMemo(
    () => articles.filter((article) => article.isPinned).slice(0, HOME_PINNED_ARTICLE_LIMIT),
    [articles],
  );
  const latestArticles = useMemo(() => {
    const latestSource = articles.filter((article) => !article.isPinned);
    const source = latestSource.length > 0 ? latestSource : articles;

    return source.slice(0, HOME_LATEST_ARTICLE_LIMIT);
  }, [articles]);
  const categoryItems = useMemo(
    () =>
      categoryLoadState === "idle"
        ? remoteCategories.map((category) => toHomeCategoryItem({ category, language }))
        : categoriesByLanguage[language],
    [categoryLoadState, language, remoteCategories],
  );
  const tagItems = useMemo(
    () =>
      tagLoadState === "idle"
        ? remoteTags.map((tag) => toHomeTagItem({ language, tag }))
        : tagsByLanguage[language],
    [language, remoteTags, tagLoadState],
  );

  useEffect(() => {
    let isActive = true;

    async function loadHomeContent() {
      const [articleResult, categoryResult, tagResult] = await Promise.allSettled([
        getPublicArticles({
          page: 1,
          pageSize: 24,
          query: "",
          sortBy: "publishedAt",
          sortOrder: "desc",
        }),
        getPublicArticleCategories(),
        getPublicArticleTags(),
      ]);

      if (!isActive) {
        return;
      }

      if (articleResult.status === "fulfilled") {
        setRemoteArticles(articleResult.value.items);
        setArticleLoadState("idle");
      } else {
        setRemoteArticles([]);
        setArticleLoadState("error");
      }

      if (categoryResult.status === "fulfilled") {
        setRemoteCategories(categoryResult.value.items);
        setCategoryLoadState("idle");
      } else {
        setRemoteCategories([]);
        setCategoryLoadState("error");
      }

      if (tagResult.status === "fulfilled") {
        setRemoteTags(tagResult.value.items);
        setTagLoadState("idle");
      } else {
        setRemoteTags([]);
        setTagLoadState("error");
      }
    }

    void loadHomeContent();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <main className="page-shell page-shell--home">
      <section aria-label="主页首屏" className="home-hero-showcase">
        <HeroCoverCarousel activeIndex={activeCoverIndex} coverUrls={heroCoverUrls} />
        <div className="home-hero-showcase__shade" />
        <div className="home-hero-showcase__content">
          <div className="home-hero-showcase__brand-mark">
            {resolvedHeroLogoUrl.length > 0 ? (
              <img alt={siteBrand.name} src={resolvedHeroLogoUrl} />
            ) : (
              <span aria-hidden="true">{heroFallbackLogoText}</span>
            )}
          </div>
          <Heading
            className="home-hero-showcase__title"
            level={1}
            type="display-2"
            textWrap="balance"
          >
            {siteBrand.name}
          </Heading>
          <HomeTextType text={siteBrand.description} />
          <div className="home-hero-showcase__actions">
            <a
              className="home-hero-showcase__action home-hero-showcase__action--primary"
              href="/articles"
              onClick={(event) => {
                if (isModifiedClick(event)) {
                  return;
                }

                event.preventDefault();
                onNavigate("/articles");
              }}
            >
              <BookOpen size={18} />
              {copy.hero.articlesAction}
            </a>
            <a
              className="home-hero-showcase__action"
              href="/archives"
              onClick={(event) => {
                if (isModifiedClick(event)) {
                  return;
                }

                event.preventDefault();
                onNavigate("/archives");
              }}
            >
              <Archive size={18} />
              {copy.hero.archiveAction}
            </a>
          </div>
          {heroCoverUrls.length > 1 ? (
            <div aria-label="主页封面轮播" className="home-hero-showcase__dots">
              {heroCoverUrls.map((coverUrl, index) => (
                <button
                  aria-current={index === activeCoverIndex ? "true" : undefined}
                  aria-label={`切换到第 ${index + 1} 张主页封面`}
                  key={`${coverUrl}-dot`}
                  type="button"
                  onClick={() => {
                    setActiveCoverIndex(index);
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
        <HomeHeroWaves />
      </section>

      <div className="home-page__content">
        <section className="front-page-intro">
          <div>
            <Text color="secondary" type="supporting">
              {copy.intro.eyebrow}
            </Text>
            <Heading level={2}>{copy.intro.title}</Heading>
          </div>
          <Text as="p" color="secondary">
            {copy.intro.description}
          </Text>
        </section>

        <div className="home-content-grid">
          <div className="home-main-column">
            <ArticleSection
              articles={pinnedArticles}
              emptyText={copy.articleSections.pinnedEmpty}
              fallbackCoverUrls={heroCoverUrls}
              icon={<Bookmark size={18} />}
              onNavigate={onNavigate}
              section="pinned"
              title={copy.articleSections.pinned}
              viewAllLabel={copy.articleSections.all}
            />
            <ArticleSection
              articles={latestArticles}
              emptyText={copy.articleSections.latestEmpty}
              fallbackCoverUrls={heroCoverUrls}
              icon={<BookOpen size={18} />}
              onNavigate={onNavigate}
              section="latest"
              title={copy.articleSections.latest}
              viewAllLabel={copy.articleSections.all}
            />
          </div>

          <aside aria-label={copy.homeSidebarLabel} className="home-sidebar">
            <AuthorPanel copy={copy} siteAuthor={siteAuthor} />
            <TaxonomyPanel
              emptyText={copy.taxonomy.categoriesEmpty}
              icon={<FolderOpen size={18} />}
              items={categoryItems}
              onNavigate={onNavigate}
              title={copy.taxonomy.categoriesTitle}
            />
            <TaxonomyPanel
              emptyText={copy.taxonomy.tagsEmpty}
              icon={<Tags size={18} />}
              items={tagItems}
              onNavigate={onNavigate}
              title={copy.taxonomy.tagsTitle}
              variant="tag"
            />
          </aside>
        </div>
      </div>
    </main>
  );
}

type ArticleSectionProps = {
  articles: readonly Article[];
  emptyText: string;
  fallbackCoverUrls: readonly string[];
  icon: ReactNode;
  onNavigate: (path: string) => void;
  section: "latest" | "pinned";
  title: string;
  viewAllLabel: string;
};

const readFallbackCoverUrl = ({
  coverUrls,
  index,
}: {
  coverUrls: readonly string[];
  index: number;
}) => {
  if (coverUrls.length === 0) {
    return undefined;
  }

  return coverUrls[index % coverUrls.length];
};

const getHomeArticleRowClassName = ({
  hasCover,
  isFallbackCover,
  index,
}: {
  hasCover: boolean;
  isFallbackCover: boolean;
  index: number;
}) => {
  const classNames = ["home-article-row"];

  if (index % 2 === 1) {
    classNames.push("home-article-row--reverse");
  }

  if (!hasCover) {
    classNames.push("home-article-row--no-cover");
  }

  if (isFallbackCover) {
    classNames.push("home-article-row--fallback-cover");
  }

  return classNames.join(" ");
};

function ArticleSection({
  articles,
  emptyText,
  fallbackCoverUrls,
  icon,
  onNavigate,
  section,
  title,
  viewAllLabel,
}: ArticleSectionProps) {
  return (
    <Card className={`home-doc-panel home-doc-panel--${section}`} padding={0}>
      <div className="home-doc-panel__heading">
        <span>
          {icon}
          {title}
        </span>
        <a
          href="/articles"
          onClick={(event) => {
            if (isModifiedClick(event)) {
              return;
            }

            event.preventDefault();
            onNavigate("/articles");
          }}
        >
          {viewAllLabel}
        </a>
      </div>
      {articles.length > 0 ? (
        <div className="home-doc-list">
          {articles.map((article, index) => {
            const explicitCoverUrl = getNonEmptyText(article.coverImageUrl ?? undefined);
            const fallbackCoverUrl =
              explicitCoverUrl === undefined
                ? readFallbackCoverUrl({ coverUrls: fallbackCoverUrls, index })
                : undefined;
            const coverUrl = explicitCoverUrl ?? fallbackCoverUrl;
            const hasCover = coverUrl !== undefined;

            return (
              <a
                className={getHomeArticleRowClassName({
                  hasCover,
                  index,
                  isFallbackCover: fallbackCoverUrl !== undefined,
                })}
                href={article.path}
                key={article.path}
                onClick={(event) => {
                  if (isModifiedClick(event)) {
                    return;
                  }

                  event.preventDefault();
                  onNavigate(article.path);
                }}
              >
                {coverUrl !== undefined ? (
                  <span className="home-article-row__media">
                    <img
                      alt={explicitCoverUrl === undefined ? "" : article.title}
                      loading={index === 0 ? "eager" : "lazy"}
                      src={resolveApiAssetUrl(coverUrl)}
                    />
                  </span>
                ) : null}
                <span className="home-article-row__body">
                  <span className="home-article-row__meta">
                    {article.category.length > 0 ? (
                      <span className="home-article-row__meta-item">
                        <FolderOpen aria-hidden="true" size={13} />
                        {article.category}
                      </span>
                    ) : null}
                    <span className="home-article-row__meta-item">
                      <Clock3 aria-hidden="true" size={13} />
                      {article.date}
                    </span>
                  </span>
                  <span className="home-article-row__title">{article.title}</span>
                  <span className="home-article-row__excerpt">{article.summary}</span>
                  <span className="home-article-row__footer">
                    <span className="home-article-row__stats">
                      <span>
                        <BookOpen aria-hidden="true" size={13} />
                        {article.readCount ?? 0}
                      </span>
                      <span>
                        <MessageSquareText aria-hidden="true" size={13} />
                        {article.commentCount ?? 0}
                      </span>
                    </span>
                    <span className="home-article-row__read">
                      {article.readTime}
                      <ExternalLink aria-hidden="true" size={13} />
                    </span>
                  </span>
                </span>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="home-empty-state">
          <Text color="secondary">{emptyText}</Text>
        </div>
      )}
    </Card>
  );
}

type AuthorPanelProps = {
  copy: FrontCopy;
  siteAuthor: SiteAuthorContent;
};

function AuthorPanel({ copy, siteAuthor }: AuthorPanelProps) {
  const authorName = getNonEmptyText(siteAuthor.name) ?? copy.author.name;
  const authorDescription = getNonEmptyText(siteAuthor.bio) ?? copy.author.bio;
  const avatarUrl = getNonEmptyText(siteAuthor.avatarUrl);
  const resolvedAvatarUrl = avatarUrl === undefined ? "" : resolveApiAssetUrl(avatarUrl);
  const blogUrl = getSafeLinkUrl(siteAuthor.blogUrl);
  const fallbackText = authorName.trim().slice(0, 1).toUpperCase() || "L";
  const hasAuthorLinks = blogUrl !== undefined || siteAuthor.socialLinks.length > 0;

  return (
    <Card className="home-side-card home-author-card" padding={0}>
      <div className="home-author-card__avatar">
        {resolvedAvatarUrl.length > 0 ? (
          <img alt={authorName} src={resolvedAvatarUrl} />
        ) : (
          <span>{fallbackText}</span>
        )}
      </div>
      <div className="home-author-card__body">
        <Heading level={3}>{authorName}</Heading>
        {authorDescription.length > 0 ? (
          <Text as="p" color="secondary">
            {authorDescription}
          </Text>
        ) : null}
        {siteAuthor.username.length > 0 ? (
          <Text as="p" className="home-author-card__username" color="secondary">
            @{siteAuthor.username}
          </Text>
        ) : null}
      </div>
      {siteAuthor.tags.length > 0 ? (
        <div className="home-author-card__tags">
          {siteAuthor.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
      {hasAuthorLinks ? (
        <div className="home-author-card__links">
          {blogUrl === undefined ? null : (
            <a href={blogUrl} rel="noreferrer" target="_blank">
              <ExternalLink aria-hidden="true" size={16} />
              {copy.author.website}
            </a>
          )}
          {siteAuthor.socialLinks.map((link) => (
            <a
              href={getSafeLinkUrl(link.url)}
              key={`${link.label}-${link.url}`}
              rel="noreferrer"
              target="_blank"
            >
              {link.url.startsWith("mailto:") ? (
                <Mail aria-hidden="true" size={16} />
              ) : (
                <ExternalLink aria-hidden="true" size={16} />
              )}
              {link.label}
            </a>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

type TaxonomyPanelProps = {
  emptyText: string;
  icon: ReactNode;
  items: readonly HomeTaxonomyItem[];
  onNavigate: (path: string) => void;
  title: string;
  variant?: "category" | "tag";
};

function TaxonomyPanel({
  emptyText,
  icon,
  items,
  onNavigate,
  title,
  variant = "category",
}: TaxonomyPanelProps) {
  return (
    <Card className="home-side-card" padding={0}>
      <div className="home-side-card__heading">
        {icon}
        <Heading level={3}>{title}</Heading>
      </div>
      {items.length > 0 ? (
        variant === "tag" ? (
          <div className="home-tag-cloud">
            {items.map((item) => (
              <a
                href={item.path}
                key={item.path}
                style={
                  item.color === undefined || item.color === null
                    ? undefined
                    : ({ "--home-taxonomy-color": item.color } as CSSProperties)
                }
                onClick={(event) => {
                  if (isModifiedClick(event)) {
                    return;
                  }

                  event.preventDefault();
                  onNavigate(item.path);
                }}
              >
                #{item.label}
                {item.count === undefined ? null : <span>{item.count}</span>}
              </a>
            ))}
          </div>
        ) : (
          <div className="home-side-list">
            {items.map((item) => (
              <a
                href={item.path}
                key={item.path}
                onClick={(event) => {
                  if (isModifiedClick(event)) {
                    return;
                  }

                  event.preventDefault();
                  onNavigate(item.path);
                }}
              >
                <span>
                  <FolderOpen aria-hidden="true" size={16} />
                  {item.label}
                </span>
                {item.count === undefined ? null : <strong>{item.count}</strong>}
              </a>
            ))}
          </div>
        )
      ) : (
        <p className="home-side-empty">{emptyText}</p>
      )}
    </Card>
  );
}

type PlaceholderPageProps = {
  coverUrls: readonly string[];
  copy: FrontCopy;
  fallbackCoverUrl: string;
  meta: PageMeta;
  path: string;
};

function PlaceholderPage({ coverUrls, copy, fallbackCoverUrl, meta, path }: PlaceholderPageProps) {
  const HeroIcon = getPageHeroIcon(path);

  return (
    <main className="page-shell page-shell--with-front-hero placeholder-page">
      <FrontPageHero
        coverUrls={coverUrls}
        description={meta.description}
        eyebrow={meta.eyebrow}
        fallbackCoverUrl={fallbackCoverUrl}
        icon={HeroIcon}
        title={meta.title}
      />
      <Card className="placeholder-card" padding={6}>
        <Badge label={copy.placeholder.statusValue} variant="neutral" />
        <Heading level={2}>{meta.title}</Heading>
        <Text as="p" color="secondary">
          {meta.description}
        </Text>
        <div className="placeholder-grid">
          <div>
            <strong>{copy.placeholder.status}</strong>
            <span>{copy.placeholder.statusValue}</span>
          </div>
          <div>
            <strong>{copy.placeholder.next}</strong>
            <span>{copy.placeholder.nextValue}</span>
          </div>
        </div>
      </Card>
    </main>
  );
}

type SiteFooterProps = {
  copy: FrontCopy;
  onNavigate: (path: string) => void;
  settings?: PublicSiteSettings;
};

function SiteFooter({ copy, onNavigate, settings }: SiteFooterProps) {
  const [currentTime, setCurrentTime] = useState(Date.now);
  const footerItems = [...primaryNavItems, ...articleNavItems, ...siteNavItems];
  const copyright = getNonEmptyText(settings?.basics.copyright);
  const foundedAt = getNonEmptyText(settings?.site.foundedAt);
  const filingLinks = getSiteFooterFilingLinks(settings);
  const uptimeSeconds = getSiteUptimeSeconds(foundedAt, currentTime);

  useEffect(() => {
    if (foundedAt === undefined) {
      return;
    }

    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [foundedAt]);

  return (
    <footer className="site-footer">
      <p className="site-footer__meta">
        <span>{copyright ?? copy.footer.tagline}</span>
        {foundedAt === undefined ? null : <span>{copy.footer.runtime(uptimeSeconds)}</span>}
      </p>
      {filingLinks.length > 0 ? (
        <p className="site-footer__filings">
          {filingLinks.map((link, index) => (
            <span className="site-footer__filing-item" key={link.key}>
              {index > 0 ? (
                <span aria-hidden="true" className="site-footer__filing-separator">
                  |
                </span>
              ) : null}
              {link.url === undefined ? (
                <span>{link.number}</span>
              ) : (
                <a href={getSafeLinkUrl(link.url)} rel="noreferrer" target="_blank">
                  {link.number}
                </a>
              )}
            </span>
          ))}
        </p>
      ) : null}
      <div className="site-footer__links">
        {footerItems.map((item) => (
          <a
            href={item.path}
            key={item.path}
            onClick={(event) => {
              if (isModifiedClick(event)) {
                return;
              }

              event.preventDefault();
              onNavigate(item.path);
            }}
          >
            {copy.navItems[item.copyKey].label}
          </a>
        ))}
      </div>
    </footer>
  );
}

export function App() {
  const [currentPath, setCurrentPath] = useState(getCurrentPath);
  const [currentSearch, setCurrentSearch] = useState(getCurrentSearch);
  const [language, setLanguage] = useState<AppLanguage>(getInitialLanguage);
  const [siteSettings, setSiteSettings] = useState<PublicSiteSettings>();
  const [themeMode, setThemeMode] = useState<AppThemeMode>(getInitialThemeMode);
  const [authState, setAuthState] = useState<BlogAuthState | null>(null);
  const [authSessionGuard] = useState(createAuthSessionGuard);
  const logoutPendingRef = useRef(false);
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false);
  const [authNotice, setAuthNotice] = useState<AuthNotice | null>(null);
  const copy = frontCopyByLanguage[language];
  const pageMeta = getPageMeta(currentPath, copy);
  const profilePanelMode = readProfilePanelMode(new URLSearchParams(currentSearch).get("panel"));
  const siteBrand = useMemo(
    () => getSiteBrandContent({ copy, language, settings: siteSettings, themeMode }),
    [copy, language, siteSettings, themeMode],
  );
  const siteAuthor = useMemo(
    () => getSiteAuthorContent({ copy, language, settings: siteSettings }),
    [copy, language, siteSettings],
  );
  const siteTimeZone = normalizeTimeZone(siteSettings?.site.timeZone);
  const commentsEnabled = siteSettings?.basics.commentsEnabled === true;

  useEffect(() => {
    const handleLanguageChanged = (nextLanguage: string) => {
      setLanguage(normalizeLanguage(nextLanguage));
    };

    i18n.on("languageChanged", handleLanguageChanged);

    return () => {
      i18n.off("languageChanged", handleLanguageChanged);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let requestVersion = 0;

    const loadSiteSettings = async () => {
      const version = ++requestVersion;
      try {
        const settings = await getPublicSiteSettings();
        if (isMounted && version === requestVersion) {
          setSiteSettings(settings);
        }
      } catch {
        if (isMounted && version === requestVersion) {
          setSiteSettings(undefined);
        }
      }
    };
    const refreshSiteSettings = () => {
      if (document.visibilityState === "visible") {
        void loadSiteSettings();
      }
    };

    void loadSiteSettings();
    window.addEventListener("focus", refreshSiteSettings);
    document.addEventListener("visibilitychange", refreshSiteSettings);

    return () => {
      isMounted = false;
      window.removeEventListener("focus", refreshSiteSettings);
      document.removeEventListener("visibilitychange", refreshSiteSettings);
    };
  }, [currentPath]);

  useEffect(() => {
    let isMounted = true;
    const isCurrentSession = authSessionGuard.capture();

    const refreshStoredUser = async () => {
      try {
        const user = await getBlogMe();
        if (isMounted && isCurrentSession()) {
          const nextState = { user };
          setAuthState(nextState);
          writeStoredBlogAuthState(nextState);
        }
      } catch {
        if (isMounted && isCurrentSession()) {
          setAuthState(null);
          clearStoredBlogAuthState();
        }
      }
    };

    void refreshStoredUser();

    return () => {
      isMounted = false;
    };
  }, [authSessionGuard]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const oauthStatus = searchParams.get("oauth_status");
    if (oauthStatus === null) {
      return;
    }

    setAuthNotice({
      id: Date.now(),
      text:
        oauthStatus === "success" ? copy.auth.dialog.oauthSuccess : copy.auth.dialog.oauthFailed,
      tone: oauthStatus === "success" ? "success" : "error",
    });
    const nextSearch = clearOAuthQueryParameters();
    setCurrentPath(getCurrentPath());
    setCurrentSearch(nextSearch);
  }, [copy.auth.dialog.oauthFailed, copy.auth.dialog.oauthSuccess]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    document.title = currentPath === "/" ? siteBrand.name : `${pageMeta.title} | ${siteBrand.name}`;
  }, [currentPath, pageMeta.title, siteBrand.name]);

  useEffect(() => {
    updateDocumentFavicon(siteBrand.faviconUrl);
  }, [siteBrand.faviconUrl]);

  useEffect(() => {
    if (authNotice === null) {
      return;
    }

    const timer = window.setTimeout(() => {
      setAuthNotice(null);
    }, 4200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [authNotice]);

  useEffect(() => {
    function handlePopState() {
      setCurrentPath(getCurrentPath());
      setCurrentSearch(getCurrentSearch());
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  function navigateTo(path: string) {
    const targetUrl = path || "/";
    const targetPath = getRoutePathname(targetUrl);
    const targetSearch = getRouteSearch(targetUrl);
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (targetUrl !== currentUrl) {
      window.history.pushState(null, "", targetUrl);
      setCurrentPath(targetPath);
      setCurrentSearch(targetSearch);
      window.scrollTo({ top: 0 });
    }
  }

  function handleSearch(query: string) {
    const trimmedQuery = query.trim();
    const nextUrl = trimmedQuery ? `/articles?q=${encodeURIComponent(trimmedQuery)}` : "/articles";

    window.history.pushState(null, "", nextUrl);
    setCurrentPath("/articles");
    setCurrentSearch(getRouteSearch(nextUrl));
    window.scrollTo({ top: 0 });
  }

  function handleLanguageChange(nextLanguage: AppLanguage) {
    setLanguage(nextLanguage);
    changeAppLanguage(nextLanguage);
  }

  function toggleThemeMode() {
    setThemeMode((currentMode) => {
      const nextMode = currentMode === "dark" ? "light" : "dark";
      window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
      return nextMode;
    });
  }

  function handleAuthenticated(nextAuthState: BlogAuthState) {
    authSessionGuard.invalidate();
    setAuthState(nextAuthState);
    writeStoredBlogAuthState(nextAuthState);
  }

  function handleProfileUpdated(user: BlogUser) {
    authSessionGuard.invalidate();
    const nextAuthState = { user };
    setAuthState(nextAuthState);
    writeStoredBlogAuthState(nextAuthState);
  }

  function handlePasswordChanged() {
    authSessionGuard.invalidate();
    setAuthState(null);
    clearStoredBlogAuthState();
  }

  function showAuthNotice(status: AuthStatus) {
    setAuthNotice({ ...status, id: Date.now() });
  }

  const showVerificationFeedback = ({ status, title }: AltchaFeedback) => {
    showAuthNotice({ tone: status, text: title });
  };

  function openAuthDialog() {
    if (logoutPendingRef.current) {
      return;
    }
    setIsAuthDialogOpen(true);
  }

  async function handleLogout() {
    if (logoutPendingRef.current) {
      return;
    }
    logoutPendingRef.current = true;
    authSessionGuard.invalidate();
    try {
      await logoutBlogUser();
      setAuthState(null);
      clearStoredBlogAuthState();
    } catch (error) {
      showAuthNotice({
        tone: "error",
        text: error instanceof Error ? error.message : copy.auth.account.logoutFailed,
      });
    } finally {
      logoutPendingRef.current = false;
    }
  }

  return (
    <Theme theme={neutralTheme} mode={themeMode}>
      <div className="blog-site">
        <AppShell
          contentPadding={0}
          height="auto"
          mobileNav={{ breakpoint: "md" }}
          topNav={
            <SiteHeader
              authState={authState}
              copy={copy}
              currentPath={currentPath}
              language={language}
              onLanguageChange={handleLanguageChange}
              onLogout={handleLogout}
              onOpenAuth={openAuthDialog}
              onNavigate={navigateTo}
              onSearch={handleSearch}
              onToggleThemeMode={toggleThemeMode}
              siteBrand={siteBrand}
              themeMode={themeMode}
            />
          }
          variant="surface"
        >
          {currentPath === "/" ? (
            <HomePage
              copy={copy}
              language={language}
              onNavigate={navigateTo}
              siteAuthor={siteAuthor}
              siteBrand={siteBrand}
              timeZone={siteTimeZone}
            />
          ) : currentPath === "/navigation" ? (
            <NavigationPage
              coverUrls={siteBrand.coverUrls}
              fallbackCoverUrl={homeCoverPath}
              language={language}
            />
          ) : currentPath === "/articles" ? (
            <ArticlesPage
              coverUrls={siteBrand.coverUrls}
              fallbackCoverUrl={homeCoverPath}
              language={language}
              onNavigate={navigateTo}
              search={currentSearch}
              timeZone={siteTimeZone}
            />
          ) : currentPath.startsWith("/articles/") ? (
            <ArticleDetailPage
              authUser={authState?.user ?? null}
              commentsEnabled={commentsEnabled}
              coverUrls={siteBrand.coverUrls}
              fallbackCoverUrl={homeCoverPath}
              language={language}
              onFeedback={showVerificationFeedback}
              onOpenAuth={openAuthDialog}
              onNavigate={navigateTo}
              search={currentSearch}
              slug={getRouteSlug(currentPath, "/articles")}
              timeZone={siteTimeZone}
            />
          ) : currentPath === "/categories" ? (
            <CategoriesPage
              coverUrls={siteBrand.coverUrls}
              fallbackCoverUrl={homeCoverPath}
              language={language}
              onNavigate={navigateTo}
              search={currentSearch}
              timeZone={siteTimeZone}
            />
          ) : currentPath.startsWith("/categories/") ? (
            <CategoryArticlesPage
              coverUrls={siteBrand.coverUrls}
              fallbackCoverUrl={homeCoverPath}
              language={language}
              onNavigate={navigateTo}
              search={currentSearch}
              slug={getRouteSlug(currentPath, "/categories")}
              timeZone={siteTimeZone}
            />
          ) : currentPath === "/tags" ? (
            <TagsPage
              coverUrls={siteBrand.coverUrls}
              fallbackCoverUrl={homeCoverPath}
              language={language}
              onNavigate={navigateTo}
              search={currentSearch}
              timeZone={siteTimeZone}
            />
          ) : currentPath.startsWith("/tags/") ? (
            <TagArticlesPage
              coverUrls={siteBrand.coverUrls}
              fallbackCoverUrl={homeCoverPath}
              language={language}
              onNavigate={navigateTo}
              search={currentSearch}
              slug={getRouteSlug(currentPath, "/tags")}
              timeZone={siteTimeZone}
            />
          ) : currentPath === "/archives" ? (
            <ArchivesPage
              coverUrls={siteBrand.coverUrls}
              fallbackCoverUrl={homeCoverPath}
              language={language}
              onNavigate={navigateTo}
              search={currentSearch}
              timeZone={siteTimeZone}
            />
          ) : currentPath === "/about-site" ? (
            <AboutSitePage
              coverUrls={siteBrand.coverUrls}
              fallbackCoverUrl={homeCoverPath}
              language={language}
              onNavigate={navigateTo}
              siteAuthor={siteAuthor}
              siteBrand={siteBrand}
              siteSettings={siteSettings}
              timeZone={siteTimeZone}
            />
          ) : currentPath === "/about-author" ? (
            <AboutAuthorPage
              coverUrls={siteBrand.coverUrls}
              fallbackCoverUrl={homeCoverPath}
              language={language}
              onNavigate={navigateTo}
              siteAuthor={siteAuthor}
              siteBrand={siteBrand}
              siteSettings={siteSettings}
              timeZone={siteTimeZone}
            />
          ) : currentPath === "/guestbook" ? (
            <GuestbookPage
              authUser={authState?.user ?? null}
              commentsEnabled={commentsEnabled}
              coverUrls={siteBrand.coverUrls}
              fallbackCoverUrl={homeCoverPath}
              language={language}
              onFeedback={showVerificationFeedback}
              onOpenAuth={openAuthDialog}
              timeZone={siteTimeZone}
            />
          ) : currentPath === "/profile" ? (
            <AccountProfilePage
              copy={copy}
              language={language}
              onNotice={showAuthNotice}
              onOpenAuth={openAuthDialog}
              onPasswordChanged={handlePasswordChanged}
              onProfileUpdated={handleProfileUpdated}
              panelMode={profilePanelMode}
              timeZone={siteTimeZone}
              user={authState?.user ?? null}
            />
          ) : (
            <PlaceholderPage
              coverUrls={siteBrand.coverUrls}
              copy={copy}
              fallbackCoverUrl={homeCoverPath}
              meta={pageMeta}
              path={currentPath}
            />
          )}
          <SiteFooter copy={copy} onNavigate={navigateTo} settings={siteSettings} />
        </AppShell>
        {authNotice === null ? null : (
          <AuthNoticeBanner
            closeLabel={copy.auth.dialog.close}
            key={authNotice.id}
            notice={authNotice}
            onDismiss={() => {
              setAuthNotice(null);
            }}
          />
        )}
        <AuthDialog
          copy={copy}
          isOpen={isAuthDialogOpen}
          language={language}
          onAuthenticated={handleAuthenticated}
          onNotice={showAuthNotice}
          onOpenChange={setIsAuthDialogOpen}
        />
      </div>
    </Theme>
  );
}
