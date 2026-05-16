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
        description: "文章列表、状态筛选、发布操作占位。",
        icon: "documentText",
        label: "文章管理",
        path: "/admin/content/articles",
        section: "内容管理",
      },
      {
        description: "分类树、文章数量和排序占位。",
        icon: "albums",
        label: "分类管理",
        path: "/admin/content/categories",
        section: "内容管理",
      },
      {
        description: "标签维护、引用次数和合并占位。",
        icon: "pricetags",
        label: "标签管理",
        path: "/admin/content/tags",
        section: "内容管理",
      },
      {
        description: "评论审核、状态筛选和只读操作占位。",
        icon: "chatbubbles",
        label: "评论管理",
        path: "/admin/content/comments",
        section: "内容管理",
      },
      {
        description: "媒体文件、链接复制和预览操作占位。",
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
        description: "后台用户、角色和访问状态占位。",
        icon: "people",
        label: "用户管理",
        path: "/admin/system/users",
        section: "系统",
      },
      {
        description: "个人资料、头像和偏好设置占位。",
        icon: "personCircle",
        label: "个人设置",
        path: "/admin/system/profile",
        section: "系统",
      },
      {
        description: "HeroUI 主题、站点配置和集成设置。",
        icon: "colorPalette",
        label: "系统设置",
        path: "/admin/system/settings",
        section: "系统",
      },
    ],
  },
];

export const adminRoutes = adminNavigationGroups.flatMap((group) => group.items);

export const dashboardRoute = adminRoutes[0];

export function getAdminRouteMeta(pathname: string) {
  return adminRoutes.find((route) => route.path === pathname) ?? dashboardRoute;
}
