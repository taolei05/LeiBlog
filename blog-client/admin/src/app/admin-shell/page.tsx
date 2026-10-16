import { lazy, useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Archive,
  Bell,
  BookOpen,
  Boxes,
  Brush,
  ChartNoAxesCombined,
  FileText,
  FolderTree,
  Home,
  Image,
  KeyRound,
  LogOut,
  MessageSquareText,
  Moon,
  Navigation,
  Settings,
  ShieldCheck,
  Sun,
  Tags,
  UserCog,
  Users,
} from "lucide-react";

import { AppShell } from "@astryxdesign/core/AppShell";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Badge } from "@astryxdesign/core/Badge";
import { BreadcrumbItem, Breadcrumbs } from "@astryxdesign/core/Breadcrumbs";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { Grid } from "@astryxdesign/core/Grid";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Layout, LayoutContent, LayoutHeader } from "@astryxdesign/core/Layout";
import { Popover } from "@astryxdesign/core/Popover";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { SideNav, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TopNav, TopNavHeading } from "@astryxdesign/core/TopNav";
import { useMediaQuery } from "@astryxdesign/core/hooks";
import type { ThemeMode } from "@astryxdesign/core/theme";

import { AdminAsyncContent } from "../components/admin-async-content";
import type { AdminUser, SiteSettings } from "../../../../shared/admin-api";
import { getSiteSettings, resolveAdminAssetUrl } from "../../../../shared/admin-api";
import { APP_LANGUAGES, changeAppLanguage, normalizeLanguage } from "../../../../shared/i18n";
import { normalizeTimeZone } from "../../../../shared/time-zone";

const AdminSettingsPage = lazy(async () => ({
  default: (await import("../admin-settings/page")).AdminSettingsPage,
}));
const BackupPage = lazy(async () => ({ default: (await import("../backup/page")).BackupPage }));
const SubscriptionsPage = lazy(async () => ({
  default: (await import("../subscriptions/page")).SubscriptionsPage,
}));
const ContentManagementPage = lazy(async () => ({
  default: (await import("../content-management/page")).ContentManagementPage,
}));
const AdminDashboardPage = lazy(async () => ({
  default: (await import("../dashboard/page")).AdminDashboardPage,
}));
const LoginMethodsPage = lazy(async () => ({
  default: (await import("../login-methods/page")).LoginMethodsPage,
}));
const MediaLibraryPage = lazy(async () => ({
  default: (await import("../media-library/page")).MediaLibraryPage,
}));
const NavigationManagementPage = lazy(async () => ({
  default: (await import("../navigation/page")).NavigationManagementPage,
}));
const SiteSettingsPage = lazy(async () => ({
  default: (await import("../site-settings/page")).SiteSettingsPage,
}));
const UsersManagementPage = lazy(async () => ({
  default: (await import("../table-filter/page")).UsersManagementPage,
}));

type AdminPageId =
  | "dashboard"
  | "posts"
  | "categories"
  | "tags"
  | "comments"
  | "contributors"
  | "navigation"
  | "media"
  | "subscriptions"
  | "users"
  | "admin-settings"
  | "theme-settings"
  | "site-settings"
  | "login-methods"
  | "backups";

type AdminNavItem = {
  id: AdminPageId;
  labelKey: string;
  descriptionKey: string;
  icon: ReactNode;
};

type AdminNavSection = {
  labelKey: string;
  descriptionKey: string;
  icon: ReactNode;
  items: AdminNavItem[];
};

type AdminConfirmationAction = "open-blog" | "logout";

type AdminShellPageProps = {
  authToken: string;
  user: AdminUser;
  themeMode: Extract<ThemeMode, "light" | "dark">;
  onToggleThemeMode: () => void;
  onUserUpdated: (user: AdminUser) => void;
  onLogout: () => Promise<void>;
  onOpenBlog: () => void;
};

const pageStyle: CSSProperties = {
  minHeight: "100vh",
};

const headerStyle: CSSProperties = {
  minHeight: 64,
};

const headerTitleStyle: CSSProperties = {
  minWidth: 0,
};

const pageHeaderStyle: CSSProperties = {
  minWidth: 0,
};

const topNavAccountTextStyle: CSSProperties = {
  maxWidth: 180,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const accountPopoverStyle: CSSProperties = {
  minWidth: 0,
};

const topNavLogoImageStyle: CSSProperties = {
  display: "block",
  maxHeight: 28,
  maxWidth: 112,
  objectFit: "contain",
};

const FAVICON_LINK_SELECTOR = 'link[data-lei-blog-favicon="site-settings"]';

const updateDocumentFavicon = (href: string) => {
  if (typeof document === "undefined") {
    return;
  }

  const trimmedHref = href.trim();
  const currentLink = document.querySelector<HTMLLinkElement>(FAVICON_LINK_SELECTOR);

  if (trimmedHref.length === 0) {
    currentLink?.remove();
    return;
  }

  const faviconLink = currentLink ?? document.createElement("link");
  faviconLink.rel = "icon";
  faviconLink.href = trimmedHref;
  faviconLink.dataset.leiBlogFavicon = "site-settings";

  if (currentLink === null) {
    document.head.appendChild(faviconLink);
  }
};

const DASHBOARD_NAV_ITEM: AdminNavItem = {
  id: "dashboard",
  labelKey: "admin.pages.dashboard",
  descriptionKey: "admin.pageDescriptions.dashboard",
  icon: <ChartNoAxesCombined size={16} />,
};

const MAIN_NAV_SECTION: AdminNavSection = {
  labelKey: "admin.nav.main",
  descriptionKey: "admin.navDescriptions.main",
  icon: <ChartNoAxesCombined size={14} />,
  items: [DASHBOARD_NAV_ITEM],
};

const adminNavSections: AdminNavSection[] = [
  MAIN_NAV_SECTION,
  {
    labelKey: "admin.nav.content",
    descriptionKey: "admin.navDescriptions.content",
    icon: <FileText size={14} />,
    items: [
      {
        id: "posts",
        labelKey: "admin.pages.posts",
        descriptionKey: "admin.pageDescriptions.posts",
        icon: <FileText size={16} />,
      },
      {
        id: "categories",
        labelKey: "admin.pages.categories",
        descriptionKey: "admin.pageDescriptions.categories",
        icon: <FolderTree size={16} />,
      },
      {
        id: "tags",
        labelKey: "admin.pages.tags",
        descriptionKey: "admin.pageDescriptions.tags",
        icon: <Tags size={16} />,
      },
      {
        id: "comments",
        labelKey: "admin.pages.comments",
        descriptionKey: "admin.pageDescriptions.comments",
        icon: <MessageSquareText size={16} />,
      },
      {
        id: "users",
        labelKey: "admin.pages.users",
        descriptionKey: "admin.pageDescriptions.users",
        icon: <UserCog size={16} />,
      },
      {
        id: "contributors",
        labelKey: "admin.pages.contributors",
        descriptionKey: "admin.pageDescriptions.contributors",
        icon: <Users size={16} />,
      },
      {
        id: "navigation",
        labelKey: "admin.pages.navigation",
        descriptionKey: "admin.pageDescriptions.navigation",
        icon: <Navigation size={16} />,
      },
      {
        id: "media",
        labelKey: "admin.pages.media",
        descriptionKey: "admin.pageDescriptions.media",
        icon: <Image size={16} />,
      },
      {
        id: "subscriptions",
        labelKey: "admin.pages.subscriptions",
        descriptionKey: "admin.pageDescriptions.subscriptions",
        icon: <Bell size={16} />,
      },
    ],
  },
  {
    labelKey: "admin.nav.system",
    descriptionKey: "admin.navDescriptions.system",
    icon: <Settings size={14} />,
    items: [
      {
        id: "admin-settings",
        labelKey: "admin.pages.adminSettings",
        descriptionKey: "admin.pageDescriptions.adminSettings",
        icon: <ShieldCheck size={16} />,
      },
      {
        id: "theme-settings",
        labelKey: "admin.pages.themeSettings",
        descriptionKey: "admin.pageDescriptions.themeSettings",
        icon: <Brush size={16} />,
      },
      {
        id: "site-settings",
        labelKey: "admin.pages.siteSettings",
        descriptionKey: "admin.pageDescriptions.siteSettings",
        icon: <Settings size={16} />,
      },
      {
        id: "login-methods",
        labelKey: "admin.pages.loginMethods",
        descriptionKey: "admin.pageDescriptions.loginMethods",
        icon: <KeyRound size={16} />,
      },
      {
        id: "backups",
        labelKey: "admin.pages.backups",
        descriptionKey: "admin.pageDescriptions.backups",
        icon: <Archive size={16} />,
      },
    ],
  },
];

type PlaceholderPageProps = {
  title: string;
  description: string;
  sectionTitle: string;
  isNarrow: boolean;
};

const PlaceholderPage = ({ title, description, sectionTitle, isNarrow }: PlaceholderPageProps) => {
  const { t } = useTranslation();

  return (
    <VStack gap={4}>
      <Card padding={isNarrow ? 5 : 8} minHeight={isNarrow ? 180 : 220}>
        <VStack gap={3}>
          <HStack gap={2} wrap="wrap">
            <Badge label={t("admin.placeholder.badge")} />
            <Badge label={sectionTitle} variant="neutral" />
          </HStack>
          <Heading level={2}>{title}</Heading>
          <Text type="body" color="secondary">
            {description}
          </Text>
        </VStack>
      </Card>

      <Grid columns={{ minWidth: isNarrow ? 180 : 220, max: 3 }} gap={isNarrow ? 3 : 4}>
        <Card padding={isNarrow ? 4 : 5}>
          <VStack gap={2}>
            <Badge label={t("admin.placeholder.groupLabel")} variant="neutral" />
            <Heading level={3}>{sectionTitle}</Heading>
            <Text type="supporting" color="secondary">
              {t("admin.placeholder.groupDescription")}
            </Text>
          </VStack>
        </Card>
        <Card padding={isNarrow ? 4 : 5}>
          <VStack gap={2}>
            <Badge label={t("admin.placeholder.stateLabel")} variant="success" />
            <Heading level={3}>{t("admin.placeholder.dev")}</Heading>
            <Text type="supporting" color="secondary">
              {t("admin.placeholder.description")}
            </Text>
          </VStack>
        </Card>
        <Card padding={isNarrow ? 4 : 5}>
          <VStack gap={2}>
            <Badge label={t("admin.placeholder.nextLabel")} variant="neutral" />
            <Heading level={3}>{t("admin.placeholder.nextTitle")}</Heading>
            <Text type="supporting" color="secondary">
              {t("admin.placeholder.nextDescription")}
            </Text>
          </VStack>
        </Card>
      </Grid>
    </VStack>
  );
};

const getActiveAdminPage = (activePageId: AdminPageId) => {
  for (const section of adminNavSections) {
    const item = section.items.find((candidate) => candidate.id === activePageId);
    if (item !== undefined) {
      return { section, item };
    }
  }

  return { section: MAIN_NAV_SECTION, item: DASHBOARD_NAV_ITEM };
};

export function AdminShellPage({
  authToken,
  user,
  themeMode,
  onToggleThemeMode,
  onUserUpdated,
  onLogout,
  onOpenBlog,
}: AdminShellPageProps) {
  const { t, i18n } = useTranslation();
  const isNarrow = useMediaQuery("(max-width: 640px)");
  const [activePageId, setActivePageId] = useState<AdminPageId>(() =>
    typeof window !== "undefined" && window.location.hash === "#subscriptions"
      ? "subscriptions"
      : "dashboard",
  );
  const [confirmationAction, setConfirmationAction] = useState<AdminConfirmationAction>();
  const [isAccountPopoverOpen, setIsAccountPopoverOpen] = useState(false);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>();
  const language = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  const isDarkTheme = themeMode === "dark";
  const activePage = getActiveAdminPage(activePageId);
  const activeTitle = t(activePage.item.labelKey);
  const activeDescription = t(activePage.item.descriptionKey);
  const activeSectionTitle = t(activePage.section.labelKey);
  const isActivePagePlaceholder =
    activePageId !== "dashboard" &&
    activePageId !== "admin-settings" &&
    activePageId !== "backups" &&
    activePageId !== "categories" &&
    activePageId !== "comments" &&
    activePageId !== "contributors" &&
    activePageId !== "login-methods" &&
    activePageId !== "media" &&
    activePageId !== "subscriptions" &&
    activePageId !== "navigation" &&
    activePageId !== "posts" &&
    activePageId !== "site-settings" &&
    activePageId !== "tags" &&
    activePageId !== "users";
  const displayName = user.name ?? user.username;
  const lightLogoUrl = siteSettings?.site.lightLogoUrl.trim() ?? "";
  const darkLogoUrl = siteSettings?.site.darkLogoUrl.trim() ?? "";
  const siteTimeZone = normalizeTimeZone(siteSettings?.site.timeZone);
  const activeLogoUrl = isDarkTheme ? darkLogoUrl || lightLogoUrl : lightLogoUrl || darkLogoUrl;
  const accountAvatarUrl =
    user.avatarUrl === undefined ? undefined : resolveAdminAssetUrl(user.avatarUrl);
  const brandLogo =
    activeLogoUrl.length > 0 ? (
      <img
        alt={t("admin.product")}
        src={resolveAdminAssetUrl(activeLogoUrl)}
        style={topNavLogoImageStyle}
      />
    ) : (
      <BookOpen size={20} />
    );
  const confirmationCopy =
    confirmationAction === "open-blog"
      ? {
          title: t("admin.confirm.openBlog.title"),
          description: t("admin.confirm.openBlog.description"),
          actionLabel: t("admin.confirm.openBlog.action"),
        }
      : confirmationAction === "logout"
        ? {
            title: t("admin.confirm.logout.title"),
            description: t("admin.confirm.logout.description"),
            actionLabel: t("admin.confirm.logout.action"),
          }
        : undefined;

  useEffect(() => {
    let isMounted = true;

    const loadSiteSettings = async () => {
      try {
        const settings = await getSiteSettings(authToken);
        if (isMounted) {
          setSiteSettings(settings);
        }
      } catch {
        if (isMounted) {
          setSiteSettings(undefined);
        }
      }
    };

    void loadSiteSettings();

    return () => {
      isMounted = false;
    };
  }, [authToken]);

  useEffect(() => {
    updateDocumentFavicon(siteSettings?.site.faviconUrl ?? "");
  }, [siteSettings?.site.faviconUrl]);

  const requestConfirmation = (action: AdminConfirmationAction) => {
    setIsAccountPopoverOpen(false);
    setConfirmationAction(action);
  };

  const handleConfirmAction = () => {
    if (confirmationAction === "open-blog") {
      setConfirmationAction(undefined);
      onOpenBlog();
      return;
    }

    if (confirmationAction === "logout") {
      setConfirmationAction(undefined);
      void onLogout();
    }
  };

  const accountPopoverContent = (
    <VStack gap={3} style={accountPopoverStyle}>
      <HStack gap={2} vAlign="center">
        <Avatar src={accountAvatarUrl} name={displayName} size="sm" />
        <VStack gap={0} style={topNavAccountTextStyle}>
          <Text type="label" style={topNavAccountTextStyle}>
            {displayName}
          </Text>
          <Text type="supporting" color="secondary" style={topNavAccountTextStyle}>
            {user.email}
          </Text>
        </VStack>
      </HStack>
      <Divider />
      <VStack gap={2}>
        <Button
          label={t("admin.actions.openBlog")}
          icon={<Home size={16} />}
          variant="secondary"
          width="100%"
          onClick={() => requestConfirmation("open-blog")}
        />
        <Button
          label={t("admin.actions.logout")}
          icon={<LogOut size={16} />}
          variant="ghost"
          width="100%"
          onClick={() => requestConfirmation("logout")}
        />
      </VStack>
    </VStack>
  );

  const topNav = (
    <TopNav
      label={t("admin.product")}
      heading={
        <TopNavHeading
          logo={brandLogo}
          logoLabel={t("admin.product")}
          heading={isNarrow ? undefined : t("admin.product")}
        />
      }
      endContent={
        <HStack gap={isNarrow ? 1 : 2} vAlign="center" wrap="wrap">
          <SegmentedControl
            label={t("language.label")}
            value={language}
            onChange={(nextLanguage) => changeAppLanguage(normalizeLanguage(nextLanguage))}
            size="sm"
          >
            {APP_LANGUAGES.map((item) => (
              <SegmentedControlItem
                key={item}
                value={item}
                label={t(`language.${item === "zh-CN" ? "zh" : "en"}`)}
              />
            ))}
          </SegmentedControl>
          <IconButton
            label={t(isDarkTheme ? "theme.switchToLight" : "theme.switchToDark")}
            tooltip={t(isDarkTheme ? "theme.switchToLight" : "theme.switchToDark")}
            icon={isDarkTheme ? <Sun size={16} /> : <Moon size={16} />}
            variant="ghost"
            size="sm"
            onClick={onToggleThemeMode}
          />
          <Popover
            label={displayName}
            content={accountPopoverContent}
            placement="below"
            alignment="end"
            width={260}
            isOpen={isAccountPopoverOpen}
            onOpenChange={setIsAccountPopoverOpen}
          >
            <Button label={displayName} variant="ghost" size="sm">
              <HStack gap={2} vAlign="center">
                <Avatar src={accountAvatarUrl} name={displayName} size="sm" />
                {!isNarrow && (
                  <VStack gap={0} style={topNavAccountTextStyle}>
                    <Text type="label" style={topNavAccountTextStyle}>
                      {displayName}
                    </Text>
                    <Text type="supporting" color="secondary" style={topNavAccountTextStyle}>
                      {user.email}
                    </Text>
                  </VStack>
                )}
              </HStack>
            </Button>
          </Popover>
        </HStack>
      }
    />
  );

  const sideNav = (
    <SideNav collapsible>
      {adminNavSections.map((section) => (
        <SideNavSection
          key={section.labelKey}
          title={t(section.labelKey)}
          subtitle={t(section.descriptionKey)}
          endContent={<Badge label={t("admin.nav.itemCount", { count: section.items.length })} />}
        >
          {section.items.map((item) => (
            <SideNavItem
              key={item.id}
              label={t(item.labelKey)}
              icon={item.icon}
              isSelected={activePageId === item.id}
              endContent={
                activePageId === item.id && isActivePagePlaceholder ? (
                  <Badge label={t("admin.placeholder.dev")} variant="neutral" />
                ) : undefined
              }
              onClick={() => setActivePageId(item.id)}
            />
          ))}
        </SideNavSection>
      ))}
    </SideNav>
  );

  return (
    <>
      <AppShell
        topNav={topNav}
        sideNav={sideNav}
        mobileNav={{ breakpoint: "md" }}
        variant="surface"
        contentPadding={0}
        style={pageStyle}
      >
        <Layout
          height="auto"
          header={
            <LayoutHeader hasDivider padding={isNarrow ? 3 : undefined} style={headerStyle}>
              <HStack gap={isNarrow ? 2 : 3} vAlign="center" wrap="wrap">
                <StackItem size="fill" style={headerTitleStyle}>
                  <VStack gap={1} style={pageHeaderStyle}>
                    <Breadcrumbs
                      label={t("admin.product")}
                      variant="supporting"
                      separator="/"
                      style={pageHeaderStyle}
                    >
                      <BreadcrumbItem startIcon={activePage.section.icon}>
                        {activeSectionTitle}
                      </BreadcrumbItem>
                      <BreadcrumbItem startIcon={activePage.item.icon} isCurrent>
                        {activeTitle}
                      </BreadcrumbItem>
                    </Breadcrumbs>
                    <Heading level={1}>{activeTitle}</Heading>
                  </VStack>
                </StackItem>
                <HStack gap={1} vAlign="center" wrap="wrap">
                  <Badge
                    label={t(
                      isActivePagePlaceholder ? "admin.placeholder.dev" : "admin.placeholder.ready",
                    )}
                    icon={<Boxes size={14} />}
                    variant={isActivePagePlaceholder ? "neutral" : "success"}
                  />
                  <IconButton
                    label={t("admin.actions.notifications")}
                    icon={<Bell size={16} />}
                    variant="ghost"
                  />
                </HStack>
              </HStack>
            </LayoutHeader>
          }
          content={
            <LayoutContent padding={isNarrow ? 3 : 4}>
              <AdminAsyncContent key={activePageId}>
                <VStack gap={4}>
                  {activePageId === "dashboard" ? (
                    <AdminDashboardPage
                      authToken={authToken}
                      isNarrow={isNarrow}
                      language={language}
                      siteSettings={siteSettings}
                      timeZone={siteTimeZone}
                      user={user}
                      onOpenBlog={onOpenBlog}
                      onPageChange={(pageId) => setActivePageId(pageId)}
                    />
                  ) : activePageId === "admin-settings" ? (
                    <AdminSettingsPage
                      authToken={authToken}
                      user={user}
                      isNarrow={isNarrow}
                      timeZone={siteTimeZone}
                      onUserUpdated={onUserUpdated}
                    />
                  ) : activePageId === "site-settings" ? (
                    <SiteSettingsPage
                      authToken={authToken}
                      isNarrow={isNarrow}
                      onSettingsUpdated={setSiteSettings}
                    />
                  ) : activePageId === "users" ? (
                    <UsersManagementPage
                      authToken={authToken}
                      isNarrow={isNarrow}
                      timeZone={siteTimeZone}
                    />
                  ) : activePageId === "subscriptions" ? (
                    <SubscriptionsPage
                      authToken={authToken}
                      isNarrow={isNarrow}
                      timeZone={siteTimeZone}
                      adminEmail={user.email}
                    />
                  ) : activePageId === "media" ? (
                    <MediaLibraryPage
                      authToken={authToken}
                      isNarrow={isNarrow}
                      timeZone={siteTimeZone}
                    />
                  ) : activePageId === "posts" ||
                    activePageId === "categories" ||
                    activePageId === "comments" ||
                    activePageId === "contributors" ||
                    activePageId === "tags" ? (
                    <ContentManagementPage
                      authToken={authToken}
                      initialView={
                        activePageId === "posts"
                          ? "articles"
                          : activePageId === "categories"
                            ? "categories"
                            : activePageId === "comments"
                              ? "comments"
                              : activePageId === "contributors"
                                ? "contributors"
                                : "tags"
                      }
                      isNarrow={isNarrow}
                      timeZone={siteTimeZone}
                    />
                  ) : activePageId === "navigation" ? (
                    <NavigationManagementPage authToken={authToken} isNarrow={isNarrow} />
                  ) : activePageId === "login-methods" ? (
                    <LoginMethodsPage authToken={authToken} isNarrow={isNarrow} />
                  ) : activePageId === "backups" ? (
                    <BackupPage authToken={authToken} isNarrow={isNarrow} timeZone={siteTimeZone} />
                  ) : (
                    <PlaceholderPage
                      title={activeTitle}
                      description={activeDescription}
                      sectionTitle={activeSectionTitle}
                      isNarrow={isNarrow}
                    />
                  )}
                </VStack>
              </AdminAsyncContent>
            </LayoutContent>
          }
        />
      </AppShell>
      {confirmationCopy !== undefined && (
        <AlertDialog
          isOpen
          title={confirmationCopy.title}
          description={confirmationCopy.description}
          cancelLabel={t("actions.cancel")}
          actionLabel={confirmationCopy.actionLabel}
          actionVariant="primary"
          onAction={handleConfirmAction}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setConfirmationAction(undefined);
            }
          }}
        />
      )}
    </>
  );
}
