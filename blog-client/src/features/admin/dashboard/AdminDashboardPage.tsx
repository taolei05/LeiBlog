import { Button, Card, Chip, Table } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";

import { AppIcon } from "../../../shared/icons/AppIcon";
import { useAdminSession } from "../../../shared/routing/adminGuards";
import { adminFetch } from "../shared/admin-api";

const recentItems = [
  { name: "后台框架", status: "已完成", target: "阶段 3" },
  { name: "数据表与媒体库", status: "已完成", target: "阶段 4" },
  { name: "前台页面", status: "已完成", target: "阶段 5" },
] as const;

export function AdminDashboardPage() {
  const session = useAdminSession();
  const [metrics, setMetrics] = useState({
    mediaCreatedThisMonth: 0,
    pendingComments: 0,
    publishedArticles: 0,
  });

  useEffect(() => {
    let isActive = true;

    async function loadMetrics() {
      try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const [articles, comments, media] = await Promise.all([
          adminFetch<{ total: number }>("/admin/content/articles?status=published&pageSize=1"),
          adminFetch<{ total: number }>("/admin/comments/?status=pending&pageSize=1"),
          adminFetch<{ total: number }>(
            `/admin/media/?createdFrom=${encodeURIComponent(monthStart.toISOString())}&createdTo=${encodeURIComponent(nextMonthStart.toISOString())}&pageSize=1`,
          ),
        ]);

        if (!isActive) return;

        setMetrics({
          mediaCreatedThisMonth: media.total,
          pendingComments: comments.total,
          publishedArticles: articles.total,
        });
      } catch {
        if (!isActive) return;
      }
    }

    void loadMetrics();

    return () => {
      isActive = false;
    };
  }, []);
  const dashboardCards = useMemo(
    () => [
      { label: "文章", value: String(metrics.publishedArticles), description: "已发布内容" },
      { label: "评论", value: String(metrics.pendingComments), description: "待审核" },
      { label: "媒体", value: String(metrics.mediaCreatedThisMonth), description: "本月新增" },
    ],
    [metrics],
  );

  return (
    <section className="page-stack admin-page">
      <div className="admin-page__heading">
        <div className="page-heading page-heading--compact">
          <p className="eyebrow">主要</p>
          <h2>
            <AppIcon name="analytics" />
            仪表盘
          </h2>
          <p>后台守卫、导航、面包屑和可关闭标签页已接入。</p>
        </div>
        <Button variant="tertiary">
          <AppIcon name="download" />
          导出概览
        </Button>
      </div>

      <div className="admin-metric-grid">
        {dashboardCards.map((card) => (
          <Card className="admin-metric-card" key={card.label}>
            <Card.Header>
              <Card.Description>{card.label}</Card.Description>
              <Card.Title>{card.value}</Card.Title>
              <Card.Description>{card.description}</Card.Description>
            </Card.Header>
          </Card>
        ))}
      </div>

      <Card className="admin-status-card">
        <Card.Header>
          <Card.Title>
            <AppIcon name="shield" />
            后台访问状态
          </Card.Title>
          <Card.Description>
            当前会话角色为 {session.role}，
            {session.isReadOnly ? "写操作已在 UI 层置灰。" : "具备后台写操作入口。"}
          </Card.Description>
        </Card.Header>
        <Table className="admin-table" variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-label="后台阶段状态">
              <Table.Header>
                <Table.Column isRowHeader>模块</Table.Column>
                <Table.Column>状态</Table.Column>
                <Table.Column>目标</Table.Column>
              </Table.Header>
              <Table.Body>
                {recentItems.map((item) => (
                  <Table.Row id={item.name} key={item.name}>
                    <Table.Cell>{item.name}</Table.Cell>
                    <Table.Cell>
                      <Chip color={item.status === "已完成" ? "success" : "default"} variant="soft">
                        <Chip.Label>{item.status}</Chip.Label>
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>{item.target}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </Card>
    </section>
  );
}
