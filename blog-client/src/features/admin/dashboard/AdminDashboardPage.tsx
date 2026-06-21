import { Button, Card, Chip, Table } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AppIcon } from "../../../shared/icons/AppIcon";
import type { AppIconName } from "../../../shared/icons/AppIcon";
import { adminFetch } from "../shared/admin-api";

type ArticleStatus = "draft" | "offline" | "published";
type ChipColor = "accent" | "danger" | "default" | "success" | "warning";
type CommentStatus = "approved" | "pending" | "rejected";
type CommentTargetType = "article" | "guestbook";
type DashboardIntegrationState = "configured" | "disabled" | "enabled" | "missing";
type DashboardTaskTone = "accent" | "danger" | "default" | "success" | "warning";

type DashboardContentTask = {
  href: string;
  key: string;
  label: string;
  tone: DashboardTaskTone;
  value: number;
};

type DashboardIntegration = {
  key: string;
  label: string;
  state: DashboardIntegrationState;
};

type DashboardMetricCard = {
  description: string;
  icon: AppIconName;
  label: string;
  value: string;
};

type DashboardOverview = {
  contentTasks: DashboardContentTask[];
  integrations: DashboardIntegration[];
  metrics: {
    draftArticles: number;
    localMedia: number;
    pendingComments: number;
    publishedArticles: number;
    r2Media: number;
    scheduledArticles: number;
    totalComments: number;
    totalReads: number;
  };
  recentArticles: {
    commentCount: number;
    href: string;
    id: string;
    publicHref: string;
    readCount: number;
    scheduledPublishAt: string | null;
    status: ArticleStatus;
    title: string;
    updatedAt: string;
  }[];
  recentComments: {
    authorName: string;
    createdAt: string;
    excerpt: string;
    href: string;
    id: string;
    status: CommentStatus;
    targetTitle: string;
    targetType: CommentTargetType;
  }[];
  storage: {
    localCount: number;
    r2Configured: boolean;
    r2Count: number;
    r2Enabled: boolean;
    totalCount: number;
    totalSizeBytes: number;
  };
};

type DashboardOverviewResponse = {
  item: DashboardOverview;
  ok: boolean;
};

const emptyOverview: DashboardOverview = {
  contentTasks: [],
  integrations: [],
  metrics: {
    draftArticles: 0,
    localMedia: 0,
    pendingComments: 0,
    publishedArticles: 0,
    r2Media: 0,
    scheduledArticles: 0,
    totalComments: 0,
    totalReads: 0,
  },
  recentArticles: [],
  recentComments: [],
  storage: {
    localCount: 0,
    r2Configured: false,
    r2Count: 0,
    r2Enabled: false,
    totalCount: 0,
    totalSizeBytes: 0,
  },
};

const fileSizeUnits = ["B", "KB", "MB", "GB", "TB"] as const;

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatFileSize(bytes: number) {
  if (bytes <= 0) return "0 B";

  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < fileSizeUnits.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${
    fileSizeUnits[unitIndex]
  }`;
}

function formatDateTime(value: string | null) {
  if (!value) return "未设置";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  });
}

function getArticleStatusLabel(article: DashboardOverview["recentArticles"][number]) {
  if (article.status === "draft" && article.scheduledPublishAt) return "定时";
  if (article.status === "draft") return "草稿";
  if (article.status === "offline") return "下架";
  return "已发布";
}

function getArticleStatusColor(article: DashboardOverview["recentArticles"][number]): ChipColor {
  if (article.status === "draft" && article.scheduledPublishAt) return "accent";
  if (article.status === "draft") return "default";
  if (article.status === "offline") return "danger";
  return "success";
}

function getCommentStatusLabel(status: CommentStatus) {
  if (status === "approved") return "已通过";
  if (status === "rejected") return "已拒绝";
  return "待审核";
}

function getCommentStatusColor(status: CommentStatus): ChipColor {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  return "warning";
}

function getIntegrationStateLabel(state: DashboardIntegrationState) {
  if (state === "configured") return "已配置";
  if (state === "enabled") return "已启用";
  if (state === "disabled") return "未启用";
  return "未配置";
}

function getIntegrationStateColor(state: DashboardIntegrationState): ChipColor {
  if (state === "configured" || state === "enabled") return "success";
  if (state === "disabled") return "default";
  return "warning";
}

function getTaskIcon(key: string): AppIconName {
  if (key.includes("comment")) return "chatbubbles";
  if (key.includes("scheduled")) return "calendar";
  if (key.includes("draft")) return "documentText";
  return "sparkles";
}

function openPublicPage(href: string) {
  if (typeof window === "undefined") return;

  window.open(href, "_blank", "noopener,noreferrer");
}

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [overview, setOverview] = useState<DashboardOverview>(emptyOverview);
  const [pageNotice, setPageNotice] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadOverview() {
      try {
        setIsLoading(true);
        const response = await adminFetch<DashboardOverviewResponse>("/admin/dashboard/overview");
        if (!isActive) return;

        setOverview(response.item);
        setPageNotice("");
      } catch (error) {
        if (!isActive) return;

        setPageNotice(error instanceof Error ? error.message : "仪表盘数据加载失败");
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadOverview();

    return () => {
      isActive = false;
    };
  }, []);

  const dashboardCards = useMemo<DashboardMetricCard[]>(
    () => [
      {
        description: "需要处理",
        icon: "chatbubbles",
        label: "待审核评论",
        value: formatNumber(overview.metrics.pendingComments),
      },
      {
        description: "等待发布",
        icon: "calendar",
        label: "定时文章",
        value: formatNumber(overview.metrics.scheduledArticles),
      },
      {
        description: "编辑中",
        icon: "documentText",
        label: "草稿文章",
        value: formatNumber(overview.metrics.draftArticles),
      },
      {
        description: "前台阅读量",
        icon: "analytics",
        label: "总阅读",
        value: formatNumber(overview.metrics.totalReads),
      },
    ],
    [overview.metrics],
  );
  const storageItems = useMemo(
    () => [
      {
        label: "服务器文件",
        value: formatNumber(overview.storage.localCount),
      },
      {
        label: "Cloudflare R2 文件",
        value: formatNumber(overview.storage.r2Count),
      },
      {
        label: "媒体总量",
        value: formatNumber(overview.storage.totalCount),
      },
      {
        label: "占用空间",
        value: formatFileSize(overview.storage.totalSizeBytes),
      },
    ],
    [overview.storage],
  );

  return (
    <section className="page-stack admin-page admin-page--wide dashboard-page">
      <div className="admin-page__heading">
        <div className="page-heading page-heading--compact">
          <p className="eyebrow">主要</p>
          <h2>
            <AppIcon name="analytics" />
            仪表盘
          </h2>
          <p>集中查看内容待办、最近动态、媒体存储和关键集成状态。</p>
        </div>
        <div className="dashboard-quick-actions">
          <Button onPress={() => void navigate("/admin/content/articles/new")} variant="primary">
            <AppIcon name="create" />
            新建文章
          </Button>
          <Button onPress={() => void navigate("/admin/content/media")} variant="secondary">
            <AppIcon name="cloudUpload" />
            上传媒体
          </Button>
          <Button onPress={() => void navigate("/admin/system/site")} variant="tertiary">
            <AppIcon name="settings" />
            站点设置
          </Button>
        </div>
      </div>

      {pageNotice ? (
        <Chip color="danger" variant="soft">
          <Chip.Label>{pageNotice}</Chip.Label>
        </Chip>
      ) : null}

      <div className="admin-metric-grid dashboard-metric-grid">
        {dashboardCards.map((card) => (
          <Card className="admin-metric-card dashboard-metric-card" key={card.label}>
            <Card.Header>
              <Card.Description>
                <AppIcon name={card.icon} />
                {card.label}
              </Card.Description>
              <Card.Title>{card.value}</Card.Title>
              <Card.Description>{card.description}</Card.Description>
            </Card.Header>
          </Card>
        ))}
      </div>

      <div className="dashboard-workspace-grid">
        <Card className="admin-status-card dashboard-workspace-card dashboard-workspace-card--tasks">
          <Card.Header>
            <Card.Title>
              <AppIcon name="sparkles" />
              内容待办
            </Card.Title>
            <Card.Description>
              {isLoading ? "正在刷新后台待办。" : "优先处理会影响发布和互动的事项。"}
            </Card.Description>
          </Card.Header>
          <div className="dashboard-card-body">
            <div className="dashboard-task-list">
              {overview.contentTasks.map((task) => (
                <div className="dashboard-task-row" key={task.key}>
                  <div className="dashboard-task-main">
                    <span className={`dashboard-task-icon dashboard-task-icon--${task.tone}`}>
                      <AppIcon name={getTaskIcon(task.key)} />
                    </span>
                    <div>
                      <strong>{task.label}</strong>
                      <span>{formatNumber(task.value)} 项</span>
                    </div>
                  </div>
                  <Button
                    onPress={() => void navigate(task.href)}
                    size="sm"
                    variant={task.value > 0 ? "primary" : "tertiary"}
                  >
                    处理
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="admin-status-card dashboard-workspace-card">
          <Card.Header>
            <Card.Title>
              <AppIcon name="server" />
              媒体存储
            </Card.Title>
            <Card.Description>
              {overview.storage.r2Enabled ? "Cloudflare R2 已启用。" : "当前主要使用服务器存储。"}
            </Card.Description>
          </Card.Header>
          <div className="dashboard-card-body">
            <div className="dashboard-storage-grid">
              {storageItems.map((item) => (
                <div className="dashboard-storage-item" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="admin-status-card dashboard-workspace-card dashboard-workspace-card--wide">
          <Card.Header>
            <Card.Title>
              <AppIcon name="reader" />
              最近文章
            </Card.Title>
            <Card.Description>最近编辑或进入发布队列的文章。</Card.Description>
          </Card.Header>
          <Table className="admin-table dashboard-table" variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-label="最近文章">
                <Table.Header>
                  <Table.Column isRowHeader>文章</Table.Column>
                  <Table.Column>状态</Table.Column>
                  <Table.Column>阅读</Table.Column>
                  <Table.Column>评论</Table.Column>
                  <Table.Column>更新时间</Table.Column>
                  <Table.Column>操作</Table.Column>
                </Table.Header>
                <Table.Body renderEmptyState={() => <span>暂无文章动态</span>}>
                  {overview.recentArticles.map((article) => (
                    <Table.Row id={article.id} key={article.id}>
                      <Table.Cell>
                        <div className="dashboard-table-title">
                          <strong>{article.title}</strong>
                          {article.scheduledPublishAt ? (
                            <span>计划：{formatDateTime(article.scheduledPublishAt)}</span>
                          ) : null}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <Chip color={getArticleStatusColor(article)} variant="soft">
                          <Chip.Label>{getArticleStatusLabel(article)}</Chip.Label>
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>{formatNumber(article.readCount)}</Table.Cell>
                      <Table.Cell>{formatNumber(article.commentCount)}</Table.Cell>
                      <Table.Cell>{formatDateTime(article.updatedAt)}</Table.Cell>
                      <Table.Cell>
                        <div className="dashboard-table-actions">
                          <Button
                            onPress={() => void navigate(article.href)}
                            size="sm"
                            variant="tertiary"
                          >
                            编辑
                          </Button>
                          <Button
                            onPress={() => openPublicPage(article.publicHref)}
                            size="sm"
                            variant="tertiary"
                          >
                            查看
                          </Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </Card>

        <Card className="admin-status-card dashboard-workspace-card dashboard-workspace-card--wide">
          <Card.Header>
            <Card.Title>
              <AppIcon name="chatbubbles" />
              最新评论
            </Card.Title>
            <Card.Description>公开评论接口最近收到的评论。</Card.Description>
          </Card.Header>
          <Table className="admin-table dashboard-table" variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-label="最新评论">
                <Table.Header>
                  <Table.Column isRowHeader>评论</Table.Column>
                  <Table.Column>状态</Table.Column>
                  <Table.Column>评论者</Table.Column>
                  <Table.Column>位置</Table.Column>
                  <Table.Column>时间</Table.Column>
                  <Table.Column>操作</Table.Column>
                </Table.Header>
                <Table.Body renderEmptyState={() => <span>暂无评论动态</span>}>
                  {overview.recentComments.map((comment) => (
                    <Table.Row id={comment.id} key={comment.id}>
                      <Table.Cell>
                        <div className="dashboard-table-title">
                          <strong>{comment.excerpt}</strong>
                          <span>{comment.targetTitle}</span>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <Chip color={getCommentStatusColor(comment.status)} variant="soft">
                          <Chip.Label>{getCommentStatusLabel(comment.status)}</Chip.Label>
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>{comment.authorName}</Table.Cell>
                      <Table.Cell>{comment.targetType === "article" ? "文章" : "页面"}</Table.Cell>
                      <Table.Cell>{formatDateTime(comment.createdAt)}</Table.Cell>
                      <Table.Cell>
                        <Button
                          onPress={() => openPublicPage(comment.href)}
                          size="sm"
                          variant="tertiary"
                        >
                          查看
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </Card>

        <Card className="admin-status-card dashboard-workspace-card dashboard-workspace-card--wide">
          <Card.Header>
            <Card.Title>
              <AppIcon name="settings" />
              集成状态
            </Card.Title>
            <Card.Description>后台关键外部服务与开关配置。</Card.Description>
          </Card.Header>
          <div className="dashboard-card-body">
            <div className="dashboard-integration-list">
              {overview.integrations.map((integration) => (
                <div className="dashboard-integration-row" key={integration.key}>
                  <span>{integration.label}</span>
                  <Chip color={getIntegrationStateColor(integration.state)} variant="soft">
                    <Chip.Label>{getIntegrationStateLabel(integration.state)}</Chip.Label>
                  </Chip>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
