import type { AppIconName } from "../../../shared/icons";
import type { MdxContentRenderer } from "../../../shared/mdx/MdxRenderer";

export type BlogArticleTocItem = {
  id: string;
  title: string;
};

export type BlogArticle = {
  category: string;
  contentMdx: string;
  cover: string;
  date: string;
  excerpt: string;
  readTime: string;
  renderMdx: MdxContentRenderer;
  slug: string;
  tags: string[];
  title: string;
  toc: BlogArticleTocItem[];
};

const elysiaContentMdx = `---
title: 用 Elysia 重建博客后端
---

<Callout title="写在开头" tone="info">
  这篇文章记录一次把博客后端拆成认证、内容、媒体和缓存四个边界的过程。
</Callout>

## 从边界开始

第一步不是写接口，而是把后台、前台公开接口和普通用户接口分开。这样文章发布、评论和媒体上传各自拥有清晰的入口。

## 缓存要能被删除

\`\`\`ts
export function articleCacheKey(slug: string) {
  return \`post:\${slug}\`;
}
\`\`\`

## 图片只留下链接

<ImageLink src="https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80" alt="代码编辑器中的后端工程" caption="媒体库负责保存文件，文章正文只引用访问 URL。" />

<ReadNext to="/articles/heroui-theme-tokens" title="HeroUI v3 主题变量整理">
  下一步把前端主题和阅读体验接起来。
</ReadNext>
`;

const themeContentMdx = `## 主题变量如何进入阅读页

HeroUI v3 的变量、项目 token 和 MDXEditor 的变量放在同一套 CSS 入口里。这样代码块、表格、表单和阅读正文切换主题时不会出现割裂。

<Callout title="重点" tone="success">
  阅读页不直接关心组件库，只消费语义化 token。
</Callout>

\`\`\`css
.mdxeditor {
  --baseBg: var(--surface);
  --accentSolid: var(--accent);
}
\`\`\`
`;

const photoContentMdx = `## 夜色里最先出现的是反差

拍夜景时，我更关心冷暖光交界处的层次，而不是把画面整体提亮。暗部保留一点空间，城市才会像真的在呼吸。

<ImageLink src="https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=80" alt="夜色中的山林和光线" caption="图片在正文里仍然来自链接，方便后续由媒体库统一替换。" />

## 留一点慢下来的位置

照片和文章一样，都需要有一些不急着解释的部分。
`;

const redisContentMdx = `## 缓存键需要能读懂

缓存键不是只给机器看的，它也要能让排查问题的人快速知道来源和失效边界。

| 场景 | Key |
| --- | --- |
| 文章详情 | post:{slug} |
| 列表查询 | post:list:{hash} |
| 站点信息 | site:info |

<Callout title="删除策略" tone="warning">
  发布、下架、修改文章时同时清理详情和列表缓存，评论变化时只清理对应文章详情。
</Callout>
`;

export const blogArticles: BlogArticle[] = [
  {
    category: "工程札记",
    contentMdx: elysiaContentMdx,
    cover:
      "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80",
    date: "2026-05-15",
    excerpt: "把后端、缓存、会话和前台路由拆成可持续演进的小块。",
    readTime: "8 分钟",
    renderMdx: ({
      Callout,
      CodeBlock,
      ImageLink,
      ReadNext,
      h2: Heading2,
      p: Paragraph,
      ul: List,
      li: ListItem,
    }) => (
      <>
        <Callout title="写在开头" tone="info">
          <Paragraph>
            这篇文章记录一次把博客后端拆成认证、内容、媒体和缓存四个边界的过程。每个边界都先留出清晰接口，再让前端慢慢接入真实数据。
          </Paragraph>
        </Callout>
        <Heading2 id="boundaries">从边界开始</Heading2>
        <Paragraph>
          第一刀不是写接口，而是把后台、前台公开接口和普通用户接口分开。这样文章发布、评论和媒体上传各自拥有清晰入口，后续权限收紧时也不会互相牵连。
        </Paragraph>
        <List>
          <ListItem>后台接口只接受 admin 或 demo 会话。</ListItem>
          <ListItem>公开文章接口只暴露已发布内容。</ListItem>
          <ListItem>媒体库负责文件落盘，正文只保存访问链接。</ListItem>
        </List>
        <Heading2 id="cache">缓存要能被删除</Heading2>
        <Paragraph>
          缓存设计的难点不是命中，而是知道什么时候该删。文章详情按 slug
          缓存，列表按查询参数哈希缓存，发布和下架时同时清理两类键。
        </Paragraph>
        <CodeBlock
          fileName="src/shared/cache/content.ts"
          language="ts"
        >{`export function articleCacheKey(slug: string) {
  return \`post:\${slug}\`;
}

export function articleListCacheKey(hash: string) {
  return \`post:list:\${hash}\`;
}`}</CodeBlock>
        <Heading2 id="media-url">图片只留下链接</Heading2>
        <Paragraph>
          文章内容不直接保存文件，也不把上传临时态混进正文。上传完成后只留下
          URL，未来迁移存储服务时正文不需要重写。
        </Paragraph>
        <ImageLink
          alt="代码编辑器中的后端工程"
          caption="媒体库负责保存文件，文章正文只引用访问 URL。"
          src="https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80"
        />
        <ReadNext title="HeroUI v3 主题变量整理" to="/articles/heroui-theme-tokens">
          下一步把前端主题和阅读体验接起来。
        </ReadNext>
      </>
    ),
    slug: "elysia-backend-rebuild",
    tags: ["Elysia", "后端", "架构"],
    title: "用 Elysia 重建博客后端",
    toc: [
      { id: "boundaries", title: "从边界开始" },
      { id: "cache", title: "缓存要能被删除" },
      { id: "media-url", title: "图片只留下链接" },
    ],
  },
  {
    category: "前端",
    contentMdx: themeContentMdx,
    cover:
      "https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=1200&q=80",
    date: "2026-05-14",
    excerpt: "HeroUI v3、CSS token 和深浅色主题如何被整理进同一个系统。",
    readTime: "6 分钟",
    renderMdx: ({ Callout, CodeBlock, h2: Heading2, p: Paragraph }) => (
      <>
        <Heading2 id="tokens">主题变量如何进入阅读页</Heading2>
        <Paragraph>
          HeroUI v3 的变量、项目 token 和 MDXEditor 的变量放在同一套 CSS
          入口里。这样代码块、表格、表单和阅读正文切换主题时不会出现割裂。
        </Paragraph>
        <Callout title="重点" tone="success">
          <Paragraph>阅读页不直接关心组件库，只消费语义化 token。</Paragraph>
        </Callout>
        <CodeBlock fileName="src/shared/theme/tokens.css" language="css">{`.mdxeditor {
  --baseBg: var(--surface);
  --accentSolid: var(--accent);
}`}</CodeBlock>
      </>
    ),
    slug: "heroui-theme-tokens",
    tags: ["React", "HeroUI", "主题"],
    title: "HeroUI v3 主题变量整理",
    toc: [{ id: "tokens", title: "主题变量如何进入阅读页" }],
  },
  {
    category: "摄影",
    contentMdx: photoContentMdx,
    cover:
      "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=80",
    date: "2026-05-08",
    excerpt: "一次夜间散步带回来的色温、反差和城市边缘。",
    readTime: "4 分钟",
    renderMdx: ({ ImageLink, h2: Heading2, p: Paragraph }) => (
      <>
        <Heading2 id="contrast">夜色里最先出现的是反差</Heading2>
        <Paragraph>
          拍夜景时，我更关心冷暖光交界处的层次，而不是把画面整体提亮。暗部保留一点空间，城市才会像真的在呼吸。
        </Paragraph>
        <ImageLink
          alt="夜色中的山林和光线"
          caption="图片在正文里仍然来自链接，方便后续由媒体库统一替换。"
          src="https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=80"
        />
        <Heading2 id="slow">留一点慢下来的位置</Heading2>
        <Paragraph>照片和文章一样，都需要有一些不急着解释的部分。</Paragraph>
      </>
    ),
    slug: "city-night-lights",
    tags: ["摄影", "城市", "生活"],
    title: "夜色里的城市光线",
    toc: [
      { id: "contrast", title: "夜色里最先出现的是反差" },
      { id: "slow", title: "留一点慢下来的位置" },
    ],
  },
  {
    category: "工程札记",
    contentMdx: redisContentMdx,
    cover:
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80",
    date: "2026-05-03",
    excerpt: "缓存键要能被人读懂，也要能被系统稳定删除。",
    readTime: "7 分钟",
    renderMdx: ({
      Callout,
      h2: Heading2,
      p: Paragraph,
      table: Table,
      tbody: TableBody,
      td: TableCell,
      th: TableHeadCell,
      thead: TableHead,
      tr: TableRow,
    }) => (
      <>
        <Heading2 id="readable">缓存键需要能读懂</Heading2>
        <Paragraph>
          缓存键不是只给机器看的，它也要能让排查问题的人快速知道来源和失效边界。
        </Paragraph>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeadCell>场景</TableHeadCell>
              <TableHeadCell>Key</TableHeadCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>文章详情</TableCell>
              <TableCell>post:{"{slug}"}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>列表查询</TableCell>
              <TableCell>post:list:{"{hash}"}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <Callout title="删除策略" tone="warning">
          <Paragraph>
            发布、下架、修改文章时同时清理详情和列表缓存，评论变化时只清理对应文章详情。
          </Paragraph>
        </Callout>
      </>
    ),
    slug: "redis-cache-keys",
    tags: ["Redis", "缓存", "后端"],
    title: "Redis 缓存键设计笔记",
    toc: [{ id: "readable", title: "缓存键需要能读懂" }],
  },
];

export const blogCategories = [
  { count: 18, description: "后端、部署、缓存和工程实践。", icon: "terminal", name: "工程札记" },
  { count: 12, description: "React、主题、交互和组件系统。", icon: "codeSlash", name: "前端" },
  { count: 9, description: "照片、观察和慢一点的记录。", icon: "image", name: "摄影" },
  { count: 6, description: "日常写作计划和生活片段。", icon: "heart", name: "生活" },
] satisfies Array<{
  count: number;
  description: string;
  icon: AppIconName;
  name: string;
}>;

export const blogTags = [
  "React",
  "HeroUI",
  "Elysia",
  "Redis",
  "MDX",
  "主题",
  "摄影",
  "写作",
  "架构",
  "缓存",
];

export const archiveGroups = [
  {
    articles: blogArticles.slice(0, 4),
    label: "2026 年 5 月",
  },
  {
    articles: [
      {
        ...blogArticles[1]!,
        date: "2026-04-28",
        slug: "setup-checklist",
        title: "首次配置流程验收清单",
      },
      {
        ...blogArticles[0]!,
        date: "2026-04-20",
        slug: "content-model-notes",
        title: "内容模型设计笔记",
      },
    ],
    label: "2026 年 4 月",
  },
];

export function getArticleBySlug(slug: string | undefined) {
  return blogArticles.find((article) => article.slug === slug) ?? blogArticles[0]!;
}
