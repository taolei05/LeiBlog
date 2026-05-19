import {
  AlertDialog,
  Button,
  Card,
  Checkbox,
  Chip,
  Label,
  ListBox,
  Pagination,
  SearchField,
  Select,
  Table,
  Tooltip,
} from "@heroui/react";
import type { Key, Selection } from "@heroui/react";
import type { ReactNode } from "react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import type { AppIconName } from "../../../shared/icons";
import { AppIcon } from "../../../shared/icons";
import { useAdminSession } from "../../../shared/routing/adminGuards";
import { showOperationToast } from "../../../shared/toast/operation-toast";

export type SortDirection = "asc" | "desc";
type ActionAccess = "danger" | "read" | "write";
type ActionConfirmation = "before" | "none";

type DataTableQuerySource = Record<string, string | null | undefined> | URLSearchParams;

export type DataTableRow = {
  id: string;
};

export type DataTableStatusTone = "accent" | "danger" | "default" | "success" | "warning";

export type DataTableColumn<T extends DataTableRow> = {
  className?: string;
  header: string;
  id: string;
  isRowHeader?: boolean;
  render?: (row: T) => ReactNode;
  searchValue?: (row: T) => string;
  sortable?: boolean;
  value: (row: T) => number | string;
};

export type DataTableFilter<T extends DataTableRow> = {
  allLabel?: string;
  key: string;
  label: string;
  options: Array<{
    label: string;
    predicate: (row: T) => boolean;
    value: string;
  }>;
};

export type DataTableActionContext<T extends DataTableRow> = {
  clearSelection: () => void;
  isReadOnly: boolean;
  selectedRows: T[];
  setNotice: (message: string) => void;
};

export type DataTableRowAction<T extends DataTableRow> = {
  access?: ActionAccess;
  confirmation?: ActionConfirmation;
  icon: AppIconName;
  isDisabled?: (row: T) => boolean;
  label: string;
  onPress: (row: T, context: DataTableActionContext<T>) => Promise<void> | void;
};

export type DataTableBulkAction<T extends DataTableRow> = {
  access?: ActionAccess;
  confirmation?: ActionConfirmation;
  icon: AppIconName;
  label: string;
  onPress: (rows: T[], context: DataTableActionContext<T>) => Promise<void> | void;
};

export type DataTableToolbarAction<T extends DataTableRow> = {
  access?: ActionAccess;
  confirmation?: ActionConfirmation;
  icon: AppIconName;
  label: string;
  onPress: (context: DataTableActionContext<T>) => Promise<void> | void;
};

export type DataTableProps<T extends DataTableRow> = {
  ariaLabel: string;
  bulkActions?: DataTableBulkAction<T>[];
  columns: DataTableColumn<T>[];
  defaultPageSize?: number;
  defaultSort?: {
    column: string;
    direction?: SortDirection;
  };
  emptyText?: string;
  filters?: DataTableFilter<T>[];
  pageSizeOptions?: number[];
  rowActions?: DataTableRowAction<T>[];
  rows: T[];
  searchPlaceholder: string;
  toolbarActions?: DataTableToolbarAction<T>[];
};

export type DataTableQueryState = {
  filterValues: Record<string, string>;
  pageSize: number;
  requestedPage: number;
  searchQuery: string;
  sortColumn: string;
  sortDirection: SortDirection;
};

export type DataTableViewModel<T extends DataTableRow> = {
  currentPage: number;
  filteredRows: T[];
  fromRow: number;
  pageCount: number;
  pageRows: T[];
  toRow: number;
};

type DataTablePaginationItem = "ellipsis-end" | "ellipsis-start" | number;

function normalize(value: number | string) {
  return String(value).trim().toLowerCase();
}

function compareValues(a: number | string, b: number | string, direction: SortDirection) {
  const result =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b), "zh-CN", {
          numeric: true,
          sensitivity: "base",
        });

  return direction === "desc" ? -result : result;
}

function getActionAccess(action: { access?: ActionAccess }) {
  return action.access ?? "write";
}

function isBlockedByReadOnly(action: { access?: ActionAccess }, isReadOnly: boolean) {
  return isReadOnly && getActionAccess(action) !== "read";
}

function requiresConfirmation(action: {
  access?: ActionAccess;
  confirmation?: ActionConfirmation;
}) {
  if (action.confirmation === "none") return false;

  return getActionAccess(action) !== "read";
}

function actionTone(action: { access?: ActionAccess }) {
  return getActionAccess(action) === "danger" ? "danger" : "warning";
}

function getPageSize(value: string | null, fallback: number, options: number[]) {
  const parsed = Number(value);

  return options.includes(parsed) ? parsed : fallback;
}

function getPage(value: string | null) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function getSortDirection(value: string | null, fallback: SortDirection = "asc") {
  return value === "asc" || value === "desc" ? value : fallback;
}

function getQueryValue(query: DataTableQuerySource, key: string) {
  return query instanceof URLSearchParams ? query.get(key) : (query[key] ?? null);
}

function toSelectedRowIds(selection: Selection, rows: DataTableRow[]) {
  if (selection === "all") {
    return new Set(rows.map((row) => row.id));
  }

  return new Set([...selection].map(String));
}

function getPaginationItems({
  currentPage,
  pageCount,
}: {
  currentPage: number;
  pageCount: number;
}): DataTablePaginationItem[] {
  const items: DataTablePaginationItem[] = [];
  let lastVisiblePage = 0;

  for (let page = 1; page <= pageCount; page += 1) {
    const isBoundary = page === 1 || page === pageCount;
    const isNearCurrent = Math.abs(page - currentPage) <= 1;
    const isNearStart = currentPage <= 4 && page <= 5;
    const isNearEnd = currentPage >= pageCount - 3 && page >= pageCount - 4;

    if (!isBoundary && !isNearCurrent && !isNearStart && !isNearEnd) {
      continue;
    }

    if (lastVisiblePage > 0 && page - lastVisiblePage > 1) {
      items.push(page < currentPage ? "ellipsis-start" : "ellipsis-end");
    }

    items.push(page);
    lastVisiblePage = page;
  }

  return items;
}

export function readDataTableQueryState<T extends DataTableRow>({
  defaultPageSize,
  defaultSort,
  filters,
  pageSizeOptions,
  query,
}: {
  defaultPageSize: number;
  defaultSort?: DataTableProps<T>["defaultSort"];
  filters: DataTableFilter<T>[];
  pageSizeOptions: number[];
  query: DataTableQuerySource;
}): DataTableQueryState {
  const fallbackSortDirection = defaultSort?.direction ?? "asc";

  return {
    filterValues: Object.fromEntries(
      filters.map((filter) => [filter.key, getQueryValue(query, filter.key) ?? ""]),
    ),
    pageSize: getPageSize(getQueryValue(query, "size"), defaultPageSize, pageSizeOptions),
    requestedPage: getPage(getQueryValue(query, "page")),
    searchQuery: getQueryValue(query, "q") ?? "",
    sortColumn: getQueryValue(query, "sort") ?? defaultSort?.column ?? "",
    sortDirection: getSortDirection(getQueryValue(query, "dir"), fallbackSortDirection),
  };
}

export function createDataTableViewModel<T extends DataTableRow>({
  columns,
  filterValues,
  filters,
  pageSize,
  requestedPage,
  rows,
  searchQuery,
  sortColumn,
  sortDirection,
}: DataTableQueryState & {
  columns: DataTableColumn<T>[];
  filters: DataTableFilter<T>[];
  rows: T[];
}): DataTableViewModel<T> {
  const normalizedQuery = normalize(searchQuery);
  const filteredRows = rows
    .filter((row) => {
      if (!normalizedQuery) return true;

      return columns.some((column) => {
        const value = column.searchValue?.(row) ?? column.value(row);

        return normalize(value).includes(normalizedQuery);
      });
    })
    .filter((row) =>
      filters.every((filter) => {
        const activeValue = filterValues[filter.key];
        const option = filter.options.find((item) => item.value === activeValue);

        return option ? option.predicate(row) : true;
      }),
    )
    .toSorted((firstRow, secondRow) => {
      const column = columns.find((item) => item.id === sortColumn && item.sortable);

      if (!column) return 0;

      return compareValues(column.value(firstRow), column.value(secondRow), sortDirection);
    });
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(requestedPage, pageCount);
  const pageRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const fromRow = filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const toRow = Math.min(currentPage * pageSize, filteredRows.length);

  return {
    currentPage,
    filteredRows,
    fromRow,
    pageCount,
    pageRows,
    toRow,
  };
}

export function DataStatusChip({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: DataTableStatusTone;
}) {
  return (
    <Chip color={tone} size="sm" variant="soft">
      <Chip.Label>{children}</Chip.Label>
    </Chip>
  );
}

function interpolateConfirmMessage(template: string, subject: string) {
  return template.replaceAll("{{subject}}", subject);
}

function AdminActionConfirm({
  actionLabel,
  children,
  description,
  onConfirm,
  tone,
}: {
  actionLabel: string;
  children: ReactNode;
  description: string;
  onConfirm: () => Promise<void> | void;
  tone: "danger" | "warning";
}) {
  return (
    <AlertDialog>
      {children}
      <AlertDialog.Backdrop>
        <AlertDialog.Container placement="center" size="sm">
          <AlertDialog.Dialog>
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status={tone} />
              <AlertDialog.Heading>确认{actionLabel}？</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>{description}</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">
                取消
              </Button>
              <Button
                onPress={() => {
                  void onConfirm();
                }}
                slot="close"
                variant={tone === "danger" ? "danger" : "primary"}
              >
                确认{actionLabel}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}

type DataTableRowActionButtonProps<T extends DataTableRow> = {
  action: DataTableRowAction<T>;
  context: DataTableActionContext<T>;
  isDisabled: boolean;
  row: T;
  subject: string;
};

function DataTableRowActionButton<T extends DataTableRow>({
  action,
  context,
  isDisabled,
  row,
  subject,
}: DataTableRowActionButtonProps<T>) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const shouldConfirm = requiresConfirmation(action) && !isDisabled;
  const tone = actionTone(action);

  const button = (
    <Tooltip delay={0}>
      <Button
        aria-label={`${action.label}${subject}`}
        isDisabled={isDisabled}
        isIconOnly
        onPress={
          shouldConfirm ? () => setIsConfirmOpen(true) : () => void action.onPress(row, context)
        }
        size="sm"
        variant={getActionAccess(action) === "danger" ? "danger-soft" : "tertiary"}
      >
        <AppIcon name={action.icon} />
      </Button>
      <Tooltip.Content showArrow className="data-table-action-tooltip" placement="top">
        <Tooltip.Arrow />
        <p>{action.label}</p>
      </Tooltip.Content>
    </Tooltip>
  );

  if (!shouldConfirm) {
    return button;
  }

  return (
    <>
      {button}
      <AlertDialog>
        <Button aria-hidden="true" className="visually-hidden" type="button" variant="tertiary">
          打开{action.label}确认
        </Button>
        <AlertDialog.Backdrop
          isOpen={isConfirmOpen}
          onOpenChange={(isOpen) => {
            setIsConfirmOpen(isOpen);
          }}
          variant="blur"
        >
          <AlertDialog.Container placement="center" size="sm">
            <AlertDialog.Dialog>
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status={tone} />
                <AlertDialog.Heading>确认{action.label}？</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>
                  {interpolateConfirmMessage(
                    `将对「{{subject}}」执行「${action.label}」。`,
                    subject,
                  )}
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="tertiary">
                  取消
                </Button>
                <Button
                  onPress={() => {
                    void action.onPress(row, context);
                    setIsConfirmOpen(false);
                  }}
                  slot="close"
                  variant={tone === "danger" ? "danger" : "primary"}
                >
                  确认{action.label}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </>
  );
}

function DataTableSelect({
  allLabel,
  includeAll = true,
  label,
  onChange,
  options,
  value,
}: {
  allLabel?: string;
  includeAll?: boolean;
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  const activeValue = value || (includeAll ? "__all" : (options[0]?.value ?? null));

  return (
    <Select
      className="data-table-filter"
      onChange={(nextValue: Key | null) => {
        onChange(nextValue === null || nextValue === "__all" ? "" : String(nextValue));
      }}
      placeholder={allLabel ?? "全部"}
      value={activeValue}
      variant="secondary"
    >
      <Label>{label}</Label>
      <Select.Trigger className="data-table-filter__select">
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox aria-label={label}>
          {includeAll ? (
            <ListBox.Item id="__all" textValue={allLabel ?? "全部"}>
              {allLabel ?? "全部"}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ) : null}
          {options.map((option) => (
            <ListBox.Item id={option.value} key={option.value} textValue={option.label}>
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

export function DataTable<T extends DataTableRow>({
  ariaLabel,
  bulkActions = [],
  columns,
  defaultPageSize = 5,
  defaultSort,
  emptyText = "没有匹配的数据",
  filters = [],
  pageSizeOptions = [5, 10, 20],
  rowActions = [],
  rows,
  searchPlaceholder,
  toolbarActions = [],
}: DataTableProps<T>) {
  const session = useAdminSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());
  const [notice, setNoticeState] = useState("");
  const queryState = useMemo(
    () =>
      readDataTableQueryState({
        defaultPageSize,
        defaultSort,
        filters,
        pageSizeOptions,
        query: searchParams,
      }),
    [defaultPageSize, defaultSort, filters, pageSizeOptions, searchParams],
  );
  const deferredSearchQuery = useDeferredValue(queryState.searchQuery);
  const { filterValues, pageSize, searchQuery, sortColumn, sortDirection } = queryState;

  function updateQuery(key: string, value: string, options: { resetPage?: boolean } = {}) {
    const nextParams = new URLSearchParams(searchParams);

    if (value) {
      nextParams.set(key, value);
    } else {
      nextParams.delete(key);
    }

    if (options.resetPage ?? true) {
      nextParams.set("page", "1");
    }

    setSearchParams(nextParams, { replace: true });
  }

  function updateSort(column: string, direction: SortDirection) {
    const nextParams = new URLSearchParams(searchParams);

    nextParams.set("sort", column);
    nextParams.set("dir", direction);
    nextParams.set("page", "1");
    setSearchParams(nextParams, { replace: true });
  }

  const { currentPage, filteredRows, fromRow, pageCount, pageRows, toRow } = useMemo(
    () =>
      createDataTableViewModel({
        ...queryState,
        columns,
        filters,
        rows,
        searchQuery: deferredSearchQuery,
      }),
    [columns, deferredSearchQuery, filters, queryState, rows],
  );
  const paginationItems = useMemo(
    () => getPaginationItems({ currentPage, pageCount }),
    [currentPage, pageCount],
  );
  const selectedRows = filteredRows.filter((row) => selectedRowIds.has(row.id));
  const filteredRowIds = useMemo(() => new Set(filteredRows.map((row) => row.id)), [filteredRows]);
  const hasActions = rowActions.length > 0;
  const hasSelection = bulkActions.length > 0;
  function setNotice(message: string) {
    setNoticeState(message);
    showOperationToast(message);
  }

  const context: DataTableActionContext<T> = {
    clearSelection: () => setSelectedRowIds(new Set()),
    isReadOnly: session.isReadOnly,
    selectedRows,
    setNotice,
  };

  useEffect(() => {
    setSelectedRowIds((currentIds) => {
      const nextIds = new Set([...currentIds].filter((id) => filteredRowIds.has(id)));

      return nextIds.size === currentIds.size ? currentIds : nextIds;
    });
  }, [filteredRowIds]);

  return (
    <Card className="admin-data-card data-table-card">
      <div className="data-table-toolbar">
        <SearchField
          aria-label={`${ariaLabel}搜索`}
          className="admin-search data-table-search"
          fullWidth
          onChange={(value) => updateQuery("q", value)}
          value={searchQuery}
          variant="secondary"
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={searchPlaceholder} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        <div className="data-table-filters">
          {filters.map((filter) => (
            <DataTableSelect
              allLabel={filter.allLabel}
              key={filter.key}
              label={filter.label}
              onChange={(value) => updateQuery(filter.key, value)}
              options={filter.options}
              value={filterValues[filter.key] ?? ""}
            />
          ))}
        </div>

        {toolbarActions.length > 0 ? (
          <div className="data-table-actions">
            {toolbarActions.map((action) => {
              const isDisabled = isBlockedByReadOnly(action, session.isReadOnly);
              const button = (
                <Button
                  isDisabled={isDisabled}
                  key={action.label}
                  onPress={
                    requiresConfirmation(action) ? undefined : () => void action.onPress(context)
                  }
                  size="sm"
                  variant={getActionAccess(action) === "danger" ? "danger-soft" : "tertiary"}
                >
                  <AppIcon name={action.icon} />
                  {action.label}
                </Button>
              );

              return requiresConfirmation(action) && !isDisabled ? (
                <AdminActionConfirm
                  actionLabel={action.label}
                  description={`此操作会执行「${action.label}」，请确认后继续。`}
                  key={action.label}
                  onConfirm={() => action.onPress(context)}
                  tone={actionTone(action)}
                >
                  {button}
                </AdminActionConfirm>
              ) : (
                button
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="data-table-summary">
        <span>共 {filteredRows.length} 条记录</span>
        {session.isReadOnly ? (
          <Chip color="warning" size="sm" variant="soft">
            <Chip.Label>demo 只读，写操作已禁用</Chip.Label>
          </Chip>
        ) : null}
        {notice ? (
          <Chip color="success" size="sm" variant="soft">
            <Chip.Label>{notice}</Chip.Label>
          </Chip>
        ) : null}
      </div>

      {bulkActions.length > 0 ? (
        <div className="data-table-bulkbar">
          <span>已选择 {selectedRows.length} 项</span>
          <div className="data-table-bulkbar__actions">
            {bulkActions.map((action) => {
              const isDisabled =
                selectedRows.length === 0 || isBlockedByReadOnly(action, session.isReadOnly);
              const button = (
                <Button
                  isDisabled={isDisabled}
                  key={action.label}
                  onPress={
                    requiresConfirmation(action)
                      ? undefined
                      : () => void action.onPress(selectedRows, context)
                  }
                  size="sm"
                  variant={getActionAccess(action) === "danger" ? "danger-soft" : "tertiary"}
                >
                  <AppIcon name={action.icon} />
                  {action.label}
                </Button>
              );

              return requiresConfirmation(action) && !isDisabled ? (
                <AdminActionConfirm
                  actionLabel={action.label}
                  description={`将对已选的 ${selectedRows.length} 项执行「${action.label}」。`}
                  key={action.label}
                  onConfirm={() => action.onPress(selectedRows, context)}
                  tone={actionTone(action)}
                >
                  {button}
                </AdminActionConfirm>
              ) : (
                button
              );
            })}
          </div>
        </div>
      ) : null}

      <Table className="admin-table data-table" variant="secondary">
        <Table.ScrollContainer>
          <Table.Content
            aria-label={ariaLabel}
            className="data-table__content"
            onSortChange={(descriptor) =>
              updateSort(
                String(descriptor.column),
                descriptor.direction === "descending" ? "desc" : "asc",
              )
            }
            onSelectionChange={
              hasSelection
                ? (selection) => setSelectedRowIds(toSelectedRowIds(selection, filteredRows))
                : undefined
            }
            selectedKeys={hasSelection ? selectedRowIds : undefined}
            selectionMode={hasSelection ? "multiple" : undefined}
            sortDescriptor={
              sortColumn
                ? {
                    column: sortColumn,
                    direction: sortDirection === "desc" ? "descending" : "ascending",
                  }
                : undefined
            }
          >
            <Table.Header>
              {hasSelection ? (
                <Table.Column className="data-table-selection-cell" id="selection">
                  <Checkbox
                    aria-label={`选择当前页${ariaLabel}`}
                    className="data-table-checkbox"
                    slot="selection"
                    variant="secondary"
                  >
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                  </Checkbox>
                </Table.Column>
              ) : null}
              {columns.map((column) => (
                <Table.Column
                  allowsSorting={column.sortable}
                  className={column.className}
                  id={column.id}
                  isRowHeader={column.isRowHeader}
                  key={column.id}
                >
                  {column.sortable
                    ? ({ sortDirection: activeDirection }) => (
                        <span className="data-table-sort-label">
                          {column.header}
                          {activeDirection ? (
                            <AppIcon
                              name={activeDirection === "ascending" ? "arrowUp" : "arrowDown"}
                              size={14}
                            />
                          ) : null}
                        </span>
                      )
                    : column.header}
                </Table.Column>
              ))}
              {hasActions ? <Table.Column id="actions">操作</Table.Column> : null}
            </Table.Header>
            <Table.Body renderEmptyState={() => <span>{emptyText}</span>}>
              {pageRows.map((row) => (
                <Table.Row id={row.id} key={row.id}>
                  {hasSelection ? (
                    <Table.Cell className="data-table-selection-cell">
                      <Checkbox
                        aria-label={`选择${columns[0]?.value(row) ?? row.id}`}
                        className="data-table-checkbox"
                        slot="selection"
                        variant="secondary"
                      >
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox>
                    </Table.Cell>
                  ) : null}
                  {columns.map((column) => (
                    <Table.Cell className={column.className} key={column.id}>
                      {column.render ? column.render(row) : column.value(row)}
                    </Table.Cell>
                  ))}
                  {hasActions ? (
                    <Table.Cell>
                      <div className="data-table-row-actions">
                        {rowActions.map((action) => {
                          const isDisabled =
                            Boolean(action.isDisabled?.(row)) ||
                            isBlockedByReadOnly(action, session.isReadOnly);
                          const subject = String(columns[0]?.value(row) ?? row.id);

                          return (
                            <DataTableRowActionButton
                              action={action}
                              context={context}
                              isDisabled={isDisabled}
                              key={action.label}
                              row={row}
                              subject={subject}
                            />
                          );
                        })}
                      </div>
                    </Table.Cell>
                  ) : null}
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      <div className="data-table-pagination">
        <DataTableSelect
          includeAll={false}
          label="每页"
          onChange={(value) => updateQuery("size", value)}
          options={pageSizeOptions.map((option) => ({
            label: `${option} 条`,
            value: String(option),
          }))}
          value={String(pageSize)}
        />
        <Pagination className="data-table-pagination__controls" size="sm">
          <Pagination.Summary>
            显示 {fromRow}-{toRow} / {filteredRows.length} 条，第 {currentPage} / {pageCount} 页
          </Pagination.Summary>
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Previous
                isDisabled={currentPage <= 1}
                onPress={() => updateQuery("page", String(currentPage - 1), { resetPage: false })}
              >
                <Pagination.PreviousIcon />
              </Pagination.Previous>
            </Pagination.Item>
            {paginationItems.map((item) =>
              typeof item === "number" ? (
                <Pagination.Item key={item}>
                  <Pagination.Link
                    isActive={item === currentPage}
                    onPress={() => updateQuery("page", String(item), { resetPage: false })}
                  >
                    {item}
                  </Pagination.Link>
                </Pagination.Item>
              ) : (
                <Pagination.Item key={item}>
                  <Pagination.Ellipsis />
                </Pagination.Item>
              ),
            )}
            <Pagination.Item>
              <Pagination.Next
                isDisabled={currentPage >= pageCount}
                onPress={() => updateQuery("page", String(currentPage + 1), { resetPage: false })}
              >
                <Pagination.NextIcon />
              </Pagination.Next>
            </Pagination.Item>
          </Pagination.Content>
        </Pagination>
      </div>
    </Card>
  );
}
