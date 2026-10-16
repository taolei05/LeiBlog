import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import type { Subscription } from "../../../../shared/subscriptions-api";
import { SubscriptionTable } from "./subscription-table";

const item: Subscription = {
  id: "test",
  name: "Spaceship",
  serviceUrl: "https://www.spaceship.com/",
  category: "domain",
  details: "taolei.net\nContract <script>alert(1)</script>",
  notes: "",
  startDate: "2025-12-07",
  expiryDate: "2026-12-07",
  initialPrice: "78.00",
  renewalPrice: "9.00",
  initialCurrency: "HKD",
  renewalCurrency: "USD",
  renewalType: "manual",
  reminderEnabled: true,
  reminderDays: 7,
  reminderTime: "09:00:00",
  reminderTimes: ["09:00", "18:30"],
  recipientEmail: "admin@example.test",
  status: "normal",
  attachments: [],
  deliveryStatus: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};
const props = {
  items: [item],
  total: 30,
  page: 2,
  pageSize: 12,
  isLoading: false,
  isNarrow: false,
  language: "zh-CN" as const,
  displayCurrency: "CNY" as const,
  rates: {
    base: "USD" as const,
    rates: { USD: 1, CNY: 7, HKD: 7.8, EUR: 0.9, GBP: 0.8, JPY: 150 },
    updatedAt: "2026-01-01T00:00:00Z",
    nextUpdateAt: "2026-01-02T00:00:00Z",
  },
  onEdit: () => {},
  onDelete: () => {},
  onPageChange: () => {},
  onPageSizeChange: () => {},
};
describe("subscription management table", () => {
  it.each([
    { language: "zh-CN" as const, isNarrow: false },
    { language: "zh-CN" as const, isNarrow: true },
    { language: "en" as const, isNarrow: false },
    { language: "en" as const, isNarrow: true },
  ])(
    "renders aligned, paginated $language controls with narrow=$isNarrow",
    ({ language, isNarrow }) => {
      const html = renderToStaticMarkup(
        createElement(SubscriptionTable, { ...props, language, isNarrow }),
      );
      const headers = html.match(/<th\b[^>]*>[\s\S]*?<\/th>/g) ?? [];
      expect(headers[1]).toContain(language === "en" ? "Type" : "类型");
      expect(headers[2]).toContain(language === "en" ? "Details" : "详情");
      expect(headers[3]).toContain(language === "en" ? "Expiry date" : "到期日期");
      expect(html).toContain("taolei.net");
      expect(html).toContain("09:00, 18:30");
      expect(html).toContain("&lt;script&gt;");
      expect(html).not.toContain("<script>");
      expect(html).toContain("text-align:center");
      expect(html).toContain('aria-rowcount="30"');
      expect(html).toContain('aria-rowindex="13"');
      expect(html).toContain(
        language === "en" ? "30 records · Page 2 / 3" : "共 30 条记录 · 第 2 / 3 页",
      );
      expect(html).toContain(language === "en" ? "Subscription pagination" : "订阅分页");
      for (const [price, currency] of [
        [78, "HKD"],
        [9, "USD"],
        [70, "CNY"],
        [63, "CNY"],
      ] as const) {
        expect(html).toContain(
          new Intl.NumberFormat(language, { style: "currency", currency }).format(price),
        );
      }
    },
  );
  it("keeps existing rows visible while refreshing and frames empty/loading states", () => {
    expect(
      renderToStaticMarkup(createElement(SubscriptionTable, { ...props, isLoading: true })),
    ).toContain("Spaceship");
    const loading = renderToStaticMarkup(
      createElement(SubscriptionTable, { ...props, items: [], total: 0, isLoading: true }),
    );
    expect(loading).toContain("正在加载订阅");
    const empty = renderToStaticMarkup(
      createElement(SubscriptionTable, { ...props, items: [], total: 0 }),
    );
    expect(empty).toContain("没有匹配的订阅");
    expect(empty).not.toContain("订阅分页");
  });
});
