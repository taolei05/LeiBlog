import { Card, Chip } from "@heroui/react";
import type { ReactNode } from "react";

import { AppIcon, type AppIconName } from "../../../shared/icons";
import { useAdminSession } from "../../../shared/routing/adminGuards";

type AdminDataPageMetric = {
  label: string;
  value: string;
};

export type AdminDataPageProps = {
  children: ReactNode;
  description: string;
  eyebrow: string;
  icon: AppIconName;
  metrics: AdminDataPageMetric[];
  title: string;
  wide?: boolean;
};

export function AdminDataPage({
  children,
  description,
  eyebrow,
  icon,
  metrics,
  title,
  wide = false,
}: AdminDataPageProps) {
  const session = useAdminSession();

  return (
    <section className={wide ? "page-stack admin-page admin-page--wide" : "page-stack admin-page"}>
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

      {children}
    </section>
  );
}
