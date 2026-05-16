import { describe, expect, it } from "vitest";

import {
  createDataTableViewModel,
  readDataTableQueryState,
  type DataTableColumn,
  type DataTableFilter,
  type DataTableRow,
} from "../src/features/admin/shared/DataTable";

type TestRow = DataTableRow & {
  category: string;
  status: "draft" | "published";
  title: string;
  views: number;
};

const rows: TestRow[] = [
  { category: "前端", id: "react", status: "published", title: "React 主题整理", views: 8 },
  { category: "后端", id: "elysia", status: "published", title: "Elysia 后端重建", views: 12 },
  { category: "后端", id: "redis", status: "published", title: "Redis 缓存键", views: 2 },
  { category: "生活", id: "draft", status: "draft", title: "五月写作计划", views: 4 },
];

const columns: DataTableColumn<TestRow>[] = [
  {
    header: "标题",
    id: "title",
    searchValue: (row) => `${row.title} ${row.category}`,
    sortable: true,
    value: (row) => row.title,
  },
  {
    header: "浏览",
    id: "views",
    sortable: true,
    value: (row) => row.views,
  },
];

const filters: DataTableFilter<TestRow>[] = [
  {
    key: "status",
    label: "状态",
    options: [
      { label: "已发布", predicate: (row) => row.status === "published", value: "published" },
      { label: "草稿", predicate: (row) => row.status === "draft", value: "draft" },
    ],
  },
];

describe("DataTable query parameters", () => {
  it("reads URL parameters and applies filter, sort, and pagination", () => {
    const queryState = readDataTableQueryState({
      defaultPageSize: 5,
      defaultSort: { column: "title", direction: "asc" },
      filters,
      pageSizeOptions: [2, 5],
      query: new URLSearchParams("status=published&sort=views&dir=desc&page=2&size=2"),
    });
    const viewModel = createDataTableViewModel({ ...queryState, columns, filters, rows });

    expect(queryState).toMatchObject({
      filterValues: { status: "published" },
      pageSize: 2,
      requestedPage: 2,
      sortColumn: "views",
      sortDirection: "desc",
    });
    expect(viewModel.filteredRows.map((row) => row.id)).toEqual(["elysia", "react", "redis"]);
    expect(viewModel.pageRows.map((row) => row.id)).toEqual(["redis"]);
    expect(viewModel.currentPage).toBe(2);
    expect(viewModel.fromRow).toBe(3);
    expect(viewModel.toRow).toBe(3);
  });

  it("clamps invalid paging values and searches configured columns", () => {
    const queryState = readDataTableQueryState({
      defaultPageSize: 5,
      defaultSort: { column: "views", direction: "desc" },
      filters,
      pageSizeOptions: [2, 5],
      query: {
        page: "-1",
        q: "前端",
        size: "99",
      },
    });
    const viewModel = createDataTableViewModel({ ...queryState, columns, filters, rows });

    expect(queryState.pageSize).toBe(5);
    expect(queryState.requestedPage).toBe(1);
    expect(viewModel.pageRows.map((row) => row.id)).toEqual(["react"]);
    expect(viewModel.pageCount).toBe(1);
  });
});
