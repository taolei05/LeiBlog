import { Button, Card, Chip, SearchField, Table } from "@heroui/react";
import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import { AppIcon, type AppIconName } from "../../../shared/icons";
import { useAdminSession } from "../../../shared/routing/adminGuards";

export type SortDirection = "asc" | "desc";
type ActionAccess = "danger" | "read" | "write";

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
  icon: AppIconName;
  isDisabled?: (row: T) => boolean;
  label: string;
  onPress: (row: T, context: DataTableActionContext<T>) => Promise<void> | void;
};

export type DataTableBulkAction<T extends DataTableRow> = {
  access?: ActionAccess;
  icon: AppIconName;
  label: string;
  onPress: (rows: T[], context: DataTableActionContext<T>) => Promise<void> | void;
};

export type DataTableToolbarAction<T extends DataTableRow> = {
  access?: ActionAccess;
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
  const [notice, setNotice] = useState("");
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
  const selectedRows = filteredRows.filter((row) => selectedRowIds.has(row.id));
  const filteredRowIds = useMemo(() => new Set(filteredRows.map((row) => row.id)), [filteredRows]);
  const allPageRowsSelected =
    pageRows.length > 0 && pageRows.every((row) => selectedRowIds.has(row.id));
  const hasActions = rowActions.length > 0;
  const hasSelection = bulkActions.length > 0;
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

  function togglePageSelection() {
    setSelectedRowIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (allPageRowsSelected) {
        pageRows.forEach((row) => nextIds.delete(row.id));
      } else {
        pageRows.forEach((row) => nextIds.add(row.id));
      }

      return nextIds;
    });
  }

  function toggleRowSelection(rowId: string) {
    setSelectedRowIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(rowId)) {
        nextIds.delete(rowId);
      } else {
        nextIds.add(rowId);
      }

      return nextIds;
    });
  }

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
            <label className="data-table-filter" key={filter.key}>
              <span>{filter.label}</span>
              <select
                className="data-table-filter__select"
                onChange={(event) => updateQuery(filter.key, event.target.value)}
                value={filterValues[filter.key] ?? ""}
              >
                <option value="">{filter.allLabel ?? "全部"}</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        {toolbarActions.length > 0 ? (
          <div className="data-table-actions">
            {toolbarActions.map((action) => (
              <Button
                isDisabled={isBlockedByReadOnly(action, session.isReadOnly)}
                key={action.label}
                onPress={() => void action.onPress(context)}
                size="sm"
                variant={getActionAccess(action) === "danger" ? "danger-soft" : "tertiary"}
              >
                <AppIcon name={action.icon} />
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="data-table-summary">
        <span>
          显示 {fromRow}-{toRow} / {filteredRows.length} 条
        </span>
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
            {bulkActions.map((action) => (
              <Button
                isDisabled={
                  selectedRows.length === 0 || isBlockedByReadOnly(action, session.isReadOnly)
                }
                key={action.label}
                onPress={() => void action.onPress(selectedRows, context)}
                size="sm"
                variant={getActionAccess(action) === "danger" ? "danger-soft" : "tertiary"}
              >
                <AppIcon name={action.icon} />
                {action.label}
              </Button>
            ))}
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
                <Table.Column id="selection">
                  <input
                    aria-label={`选择当前页${ariaLabel}`}
                    checked={allPageRowsSelected}
                    className="data-table-checkbox"
                    onChange={togglePageSelection}
                    type="checkbox"
                  />
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
                          <AppIcon
                            name={
                              activeDirection === "ascending"
                                ? "arrowUp"
                                : activeDirection === "descending"
                                  ? "arrowDown"
                                  : "swapVertical"
                            }
                            size={14}
                          />
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
                    <Table.Cell>
                      <input
                        aria-label={`选择${columns[0]?.value(row) ?? row.id}`}
                        checked={selectedRowIds.has(row.id)}
                        className="data-table-checkbox"
                        onChange={() => toggleRowSelection(row.id)}
                        type="checkbox"
                      />
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

                          return (
                            <Button
                              aria-label={`${action.label}${columns[0]?.value(row) ?? row.id}`}
                              isDisabled={isDisabled}
                              isIconOnly
                              key={action.label}
                              onPress={() => void action.onPress(row, context)}
                              size="sm"
                              variant={
                                getActionAccess(action) === "danger" ? "danger-soft" : "tertiary"
                              }
                            >
                              <AppIcon name={action.icon} />
                            </Button>
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
        <label className="data-table-filter">
          <span>每页</span>
          <select
            className="data-table-filter__select"
            onChange={(event) => updateQuery("size", event.target.value)}
            value={String(pageSize)}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option} 条
              </option>
            ))}
          </select>
        </label>
        <div className="data-table-pagination__controls">
          <Button
            isDisabled={currentPage <= 1}
            onPress={() => updateQuery("page", String(currentPage - 1), { resetPage: false })}
            size="sm"
            variant="tertiary"
          >
            <AppIcon name="chevronBack" />
            上一页
          </Button>
          <span>
            第 {currentPage} / {pageCount} 页
          </span>
          <Button
            isDisabled={currentPage >= pageCount}
            onPress={() => updateQuery("page", String(currentPage + 1), { resetPage: false })}
            size="sm"
            variant="tertiary"
          >
            下一页
            <AppIcon name="chevronForward" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
