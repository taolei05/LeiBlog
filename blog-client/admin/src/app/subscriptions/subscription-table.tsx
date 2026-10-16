import { ExternalLink, Paperclip, Pencil, Trash2 } from "lucide-react";
import { Card } from "@astryxdesign/core/Card";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Pagination } from "@astryxdesign/core/Pagination";
import { Spinner } from "@astryxdesign/core/Spinner";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Table, pixel, useTableStickyColumns } from "@astryxdesign/core/Table";
import type { TableColumn } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import type { AppLanguage } from "../../../../shared/i18n";
import {
  convertSubscriptionPrice,
  getSubscriptionServiceUrl,
} from "../../../../shared/subscriptions-api";
import type {
  ExchangeRates,
  Subscription,
  SubscriptionCurrency,
} from "../../../../shared/subscriptions-api";
import { subscriptionCopy } from "./copy";

type Row = Subscription & Record<string, unknown>;
type SubscriptionTableProps = {
  items: Subscription[];
  total: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  isNarrow: boolean;
  language: AppLanguage;
  displayCurrency: SubscriptionCurrency;
  rates?: ExchangeRates;
  onEdit: (item: Subscription) => void;
  onDelete: (item: Subscription) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};
export const SubscriptionTable = ({
  items,
  total,
  page,
  pageSize,
  isLoading,
  isNarrow,
  language,
  displayCurrency,
  rates,
  onEdit,
  onDelete,
  onPageChange,
  onPageSizeChange,
}: SubscriptionTableProps) => {
  const copy = subscriptionCopy[language];
  const stickyColumns = useTableStickyColumns<Row>({ endKeys: ["actions"] });
  const money = (value: string | number, currency: SubscriptionCurrency) =>
    new Intl.NumberFormat(language, { style: "currency", currency }).format(Number(value));
  const priceCell = (row: Subscription, kind: "initial" | "renewal") => {
    const price = kind === "initial" ? row.initialPrice : row.renewalPrice;
    const currency = kind === "initial" ? row.initialCurrency : row.renewalCurrency;
    return (
      <VStack gap={1} hAlign="center">
        <Text>{money(price, currency)}</Text>
        {rates && currency !== displayCurrency && (
          <Text type="supporting" color="secondary">
            ≈{" "}
            {money(
              convertSubscriptionPrice(price, currency, displayCurrency, rates),
              displayCurrency,
            )}
          </Text>
        )}
      </VStack>
    );
  };
  const columns: TableColumn<Row>[] = [
    {
      key: "name",
      header: copy.name,
      width: pixel(220),
      renderCell: (row) => (
        <VStack gap={1} hAlign="center" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
          <Text weight="semibold">{row.name}</Text>
          {getSubscriptionServiceUrl(row.serviceUrl) && (
            <a href={row.serviceUrl} target="_blank" rel="noopener noreferrer">
              <HStack gap={1} hAlign="center" vAlign="center">
                <ExternalLink size={14} />
                <Text type="supporting">{getSubscriptionServiceUrl(row.serviceUrl)?.hostname}</Text>
              </HStack>
            </a>
          )}
        </VStack>
      ),
    },
    {
      key: "category",
      header: copy.category,
      width: pixel(110),
      renderCell: (row) => copy.categories[row.category],
    },
    {
      key: "details",
      header: copy.details,
      width: pixel(240),
      renderCell: (row) => (
        <Text style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxWidth: "36ch" }}>
          {row.details || "—"}
        </Text>
      ),
    },
    {
      key: "expiryDate",
      header: copy.expiryDate,
      width: pixel(140),
      renderCell: (row) => (
        <VStack gap={1} hAlign="center">
          <Text>{row.expiryDate ?? "—"}</Text>
          <Text type="supporting" color="secondary">
            {row.startDate}
          </Text>
        </VStack>
      ),
    },
    {
      key: "status",
      header: copy.status,
      width: pixel(130),
      renderCell: (row) => (
        <HStack gap={2} hAlign="center" vAlign="center">
          <StatusDot
            label={copy[row.status]}
            variant={
              row.status === "expired" ? "error" : row.status === "expiring" ? "warning" : "success"
            }
          />
          <Text>{copy[row.status]}</Text>
        </HStack>
      ),
    },
    {
      key: "initialPrice",
      header: copy.initialPrice,
      width: pixel(150),
      renderCell: (row) => priceCell(row, "initial"),
    },
    {
      key: "renewalPrice",
      header: copy.renewalPrice,
      width: pixel(150),
      renderCell: (row) => priceCell(row, "renewal"),
    },
    {
      key: "renewalType",
      header: copy.renewalType,
      width: pixel(160),
      renderCell: (row) => copy.renewals[row.renewalType],
    },
    {
      key: "reminderTime",
      header: copy.reminder,
      width: pixel(170),
      renderCell: (row) => (
        <VStack gap={1} hAlign="center">
          <Text>
            {row.reminderEnabled
              ? copy.reminderSchedule
                  .replace("{{days}}", String(row.reminderDays))
                  .replace("{{time}}", row.reminderTime.slice(0, 5))
              : copy.off}
          </Text>
          <Text type="supporting" color="secondary">
            {row.deliveryStatus ? copy.deliveries[row.deliveryStatus] : copy.notSent}
          </Text>
        </VStack>
      ),
    },
    {
      key: "attachments",
      header: copy.attachments,
      width: pixel(90),
      renderCell: (row) => (
        <HStack gap={1} hAlign="center" vAlign="center">
          <Paperclip size={14} />
          <Text>{row.attachments.length}</Text>
        </HStack>
      ),
    },
    {
      key: "actions",
      header: copy.actions,
      width: pixel(110),
      renderCell: (row) => (
        <HStack gap={1} hAlign="center" vAlign="center">
          <IconButton
            label={copy.edit}
            tooltip={copy.edit}
            icon={<Pencil size={16} />}
            variant="ghost"
            onClick={() => onEdit(row)}
          />
          <IconButton
            label={copy.delete}
            tooltip={copy.delete}
            icon={<Trash2 size={16} />}
            variant="ghost"
            onClick={() => onDelete(row)}
          />
        </HStack>
      ),
    },
  ];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <Card padding={0} style={{ overflow: "hidden", width: "100%", minWidth: 0 }}>
      {isLoading && items.length === 0 ? (
        <HStack gap={2} vAlign="center" padding={isNarrow ? 4 : 6}>
          <Spinner size="sm" />
          <Text type="supporting" color="secondary">
            {copy.loading}
          </Text>
        </HStack>
      ) : items.length === 0 ? (
        <EmptyState title={copy.empty} />
      ) : (
        <VStack style={{ overflowX: "auto", width: "100%", minWidth: 0 }}>
          <Table<Row>
            data={items as Row[]}
            columns={columns.map((column) => ({ ...column, align: "center" }))}
            idKey="id"
            density={isNarrow ? "compact" : "balanced"}
            dividers="rows"
            hasHover
            style={{ minWidth: "max-content", width: "100%" }}
            textOverflow="wrap"
            verticalAlign="middle"
            plugins={{ stickyColumns }}
            rowCount={total}
            rowIndexStart={(page - 1) * pageSize + 1}
          />
        </VStack>
      )}
      {total > 0 && (
        <HStack
          gap={3}
          hAlign="between"
          vAlign="center"
          wrap="wrap"
          padding={4}
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <Text type="supporting" color="secondary">
            {copy.pageSummary
              .replace("{{count}}", String(total))
              .replace("{{page}}", String(page))
              .replace("{{pages}}", String(totalPages))}
          </Text>
          <Pagination
            label={copy.pagination}
            pageLabel={copy.pageLabel}
            page={page}
            pageSize={pageSize}
            pageSizeOptions={[12, 24, 48]}
            totalItems={total}
            variant={isNarrow ? "compact" : "pages"}
            isDisabled={isLoading}
            onChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </HStack>
      )}
    </Card>
  );
};
