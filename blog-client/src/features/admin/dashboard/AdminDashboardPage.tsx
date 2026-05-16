import { Button, Card, Chip, Table } from "@heroui/react";

import { AppIcon } from "../../../shared/icons/AppIcon";
import { useAdminSession } from "../../../shared/routing/adminGuards";

const dashboardCards = [
  { label: "文章", value: "48", description: "已发布内容" },
  { label: "评论", value: "5", description: "待审核" },
  { label: "媒体", value: "21", description: "本月新增" },
] as const;

const recentItems = [
  { name: "后台框架", status: "已完成", target: "阶段 3" },
  { name: "数据表与媒体库", status: "已完成", target: "阶段 4" },
  { name: "前台页面占位", status: "待开始", target: "阶段 5" },
] as const;

export function AdminDashboardPage() {
  const session = useAdminSession();

  return (
    <section className="page-stack admin-page">
      <div className="admin-page__heading">
        <div className="page-heading page-heading--compact">
          <p className="eyebrow">主要</p>
          <h2>
            <AppIcon name="analytics" />
            仪表盘
          </h2>
          <p>后台守卫、导航、面包屑、可关闭标签页和页面占位已接入，后续阶段会继续补齐真实数据。</p>
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
