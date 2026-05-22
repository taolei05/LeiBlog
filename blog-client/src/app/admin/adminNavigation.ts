import type { AppIconName } from "../../shared/icons";

export type AdminNavSection = "主要" | "内容管理" | "系统";

export type AdminRouteMeta = {
  description: string;
  icon: AppIconName;
  label: string;
  path: string;
  section: AdminNavSection;
};

export const adminNavigationGroups: Array<{
  label: AdminNavSection;
  items: AdminRouteMeta[];
}> = [
  {
    label: "主要",
    items: [
      {
        description: "站点概览、近期动态和运营提示。",
        icon: "analytics",
        label: "仪表盘",
        path: "/admin",
        section: "主要",
      },
    ],
  },
  {
    label: "内容管理",
    items: [
      {
        description: "文章列表、状态筛选和发布操作。",
        icon: "documentText",
        label: "文章管理",
        path: "/admin/content/articles",
        section: "内容管理",
      },
      {
        description: "分类树、文章数量和排序。",
        icon: "albums",
        label: "分类管理",
        path: "/admin/content/categories",
        section: "内容管理",
      },
      {
        description: "标签维护、引用次数和合并。",
        icon: "pricetags",
        label: "标签管理",
        path: "/admin/content/tags",
        section: "内容管理",
      },
      {
        description: "评论审核、状态筛选和只读操作。",
        icon: "chatbubbles",
        label: "评论管理",
        path: "/admin/content/comments",
        section: "内容管理",
      },
      {
        description: "文章贡献者、头像和关联链接。",
        icon: "personAdd",
        label: "贡献者管理",
        path: "/admin/content/contributors",
        section: "内容管理",
      },
      {
        description: "媒体文件、链接复制和预览操作。",
        icon: "images",
        label: "媒体库",
        path: "/admin/content/media",
        section: "内容管理",
      },
    ],
  },
  {
    label: "系统",
    items: [
      {
        description: "后台用户、角色和访问状态。",
        icon: "people",
        label: "用户管理",
        path: "/admin/system/users",
        section: "系统",
      },
      {
        description: "当前管理员资料、安全和登录信息。",
        icon: "personCircle",
        label: "管理员设置",
        path: "/admin/system/profile",
        section: "系统",
      },
      {
        description: "HeroUI 主题 token、模式切换和组件预览。",
        icon: "colorPalette",
        label: "主题设置",
        path: "/admin/system/settings",
        section: "系统",
      },
      {
        description: "站点信息、SEO、备案和集成密钥。",
        icon: "settings",
        label: "站点设置",
        path: "/admin/system/site",
        section: "系统",
      },
    ],
  },
];

export const adminRoutes = adminNavigationGroups.flatMap((group) => group.items);

export const dashboardRoute = adminRoutes[0];

const adminSectionIconMap: Record<AdminNavSection, AppIconName> = {
  主要: "analytics",
  内容管理: "library",
  系统: "settings",
};

export function getAdminSectionIcon(section: AdminNavSection) {
  return adminSectionIconMap[section];
}

export function getAdminRouteMeta(pathname: string) {
  if (pathname === "/admin/content/articles/new") {
    return {
      description: "新建文章标题、摘要和 MDX 正文。",
      icon: "pencil",
      label: "新建文章",
      path: pathname,
      section: "内容管理",
    } satisfies AdminRouteMeta;
  }

  if (/^\/admin\/content\/articles\/[^/]+\/edit$/.test(pathname)) {
    return {
      description: "编辑文章标题、摘要和 MDX 正文。",
      icon: "pencil",
      label: "编辑文章",
      path: pathname,
      section: "内容管理",
    } satisfies AdminRouteMeta;
  }

  if (/^\/admin\/content\/categories\/[^/]+\/articles$/.test(pathname)) {
    return {
      description: "查看这个分类下的文章并继续管理。",
      icon: "albums",
      label: "分类文章",
      path: pathname,
      section: "内容管理",
    } satisfies AdminRouteMeta;
  }

  if (/^\/admin\/content\/tags\/[^/]+\/articles$/.test(pathname)) {
    return {
      description: "查看这个标签下的文章并继续管理。",
      icon: "pricetags",
      label: "标签文章",
      path: pathname,
      section: "内容管理",
    } satisfies AdminRouteMeta;
  }

  if (/^\/admin\/content\/contributors\/[^/]+\/articles$/.test(pathname)) {
    return {
      description: "查看这个贡献者关联的文章并继续管理。",
      icon: "personAdd",
      label: "贡献者文章",
      path: pathname,
      section: "内容管理",
    } satisfies AdminRouteMeta;
  }

  return adminRoutes.find((route) => route.path === pathname) ?? dashboardRoute;
}
