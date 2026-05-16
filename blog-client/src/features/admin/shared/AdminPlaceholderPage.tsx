import { Button, Card, Chip, SearchField, Table } from "@heroui/react";

import { AppIcon, type AppIconName } from "../../../shared/icons";
import { useAdminSession } from "../../../shared/routing/adminGuards";

type PlaceholderMetric = {
  label: string;
  value: string;
};

type PlaceholderRow = {
  description: string;
  name: string;
  status: "待接入" | "只读" | "规划中";
  updatedAt: string;
};

export type AdminPlaceholderPageProps = {
  actions?: Array<{
    icon: AppIconName;
    label: string;
  }>;
  description: string;
  eyebrow: string;
  icon: AppIconName;
  metrics: PlaceholderMetric[];
  rows: PlaceholderRow[];
  title: string;
};

export function AdminPlaceholderPage({
  actions = [
    { icon: "filter", label: "筛选" },
    { icon: "download", label: "导出" },
  ],
  description,
  eyebrow,
  icon,
  metrics,
  rows,
  title,
}: AdminPlaceholderPageProps) {
  const session = useAdminSession();

  return (
    <section className="page-stack admin-page">
      <div className="admin-page__heading">
        <div className="page-heading page-heading--compact">
          <p className="eyebrow">{eyebrow}</p>
          <h2>
            <AppIcon name={icon} />
            {title}
          </h2>
          <p>{description}</p>
        </div>
        {session.isReadOnly ? (
          <Chip color="warning" variant="soft">
            <Chip.Label>demo 只读</Chip.Label>
          </Chip>
        ) : null}
      </div>

      <div className="admin-metric-grid">
        {metrics.map((metric) => (
          <Card className="admin-metric-card" key={metric.label}>
            <Card.Header>
              <Card.Description>{metric.label}</Card.Description>
              <Card.Title>{metric.value}</Card.Title>
            </Card.Header>
          </Card>
        ))}
      </div>

      <Card className="admin-data-card">
        <div className="admin-data-card__toolbar">
          <SearchField aria-label={`${title}搜索`} className="admin-search" fullWidth>
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder={`搜索${title}`} />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <div className="admin-data-card__actions">
            {actions.map((action) => (
              <Button
                isDisabled={session.isReadOnly && action.label !== "筛选"}
                key={action.label}
                size="sm"
                variant="tertiary"
              >
                <AppIcon name={action.icon} />
                {action.label}
              </Button>
            ))}
          </div>
        </div>

        <Table className="admin-table" variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-label={`${title}占位表格`}>
              <Table.Header>
                <Table.Column isRowHeader>名称</Table.Column>
                <Table.Column>状态</Table.Column>
                <Table.Column>更新时间</Table.Column>
                <Table.Column>说明</Table.Column>
              </Table.Header>
              <Table.Body>
                {rows.map((row) => (
                  <Table.Row id={row.name} key={row.name}>
                    <Table.Cell>{row.name}</Table.Cell>
                    <Table.Cell>
                      <Chip
                        color={
                          row.status === "只读"
                            ? "warning"
                            : row.status === "规划中"
                              ? "accent"
                              : "default"
                        }
                        variant="soft"
                      >
                        <Chip.Label>{row.status}</Chip.Label>
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>{row.updatedAt}</Table.Cell>
                    <Table.Cell>{row.description}</Table.Cell>
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
