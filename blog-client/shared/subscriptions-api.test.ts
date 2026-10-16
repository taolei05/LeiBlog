import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  convertSubscriptionPrice,
  getSubscriptions,
  isExchangeRates,
  isSubscription,
  saveSubscription,
} from "./subscriptions-api";
import type { ExchangeRates } from "./subscriptions-api";

const rates: ExchangeRates = {
  base: "USD",
  rates: { USD: 1, CNY: 7, HKD: 7.8, EUR: 0.9, GBP: 0.8, JPY: 150 },
  updatedAt: "2026-10-16T00:00:00Z",
  nextUpdateAt: "2026-10-17T00:00:00Z",
};
const item = {
  id: "test",
  name: "Domain",
  serviceUrl: "https://example.test",
  category: "domain",
  details: "",
  notes: "",
  startDate: "2026-01-01",
  expiryDate: "2027-01-01",
  initialPrice: "1.20",
  renewalPrice: "9.00",
  initialCurrency: "HKD" as const,
  renewalCurrency: "USD" as const,
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
afterEach(() => vi.unstubAllGlobals());
describe("subscriptions API", () => {
  it("validates every configured reminder time", () => {
    expect(isSubscription(item)).toBe(true);
    for (const reminderTimes of [
      undefined,
      [],
      ["25:00"],
      ["9:00"],
      ["09:00", "09:00"],
      Array(13).fill("09:00"),
    ]) {
      expect(isSubscription({ ...item, reminderTimes })).toBe(false);
    }
  });
  it("validates entries, attachment metadata and rates before rendering", () => {
    expect(isSubscription(item)).toBe(true);
    expect(isSubscription({ ...item, attachments: [{ fileName: "invoice" }] })).toBe(false);
    expect(isSubscription({ ...item, initialCurrency: "XYZ" })).toBe(false);
    expect(isSubscription({ ...item, renewalCurrency: "XYZ" })).toBe(false);
    expect(isSubscription({ ...item, initialCurrency: undefined })).toBe(false);
    expect(isExchangeRates(rates)).toBe(true);
    expect(isExchangeRates({ ...rates, rates: { ...rates.rates, CNY: 0 } })).toBe(false);
  });
  it("converts cross rates without changing original monetary values", () => {
    expect(convertSubscriptionPrice("10.00", "USD", "CNY", rates)).toBe(70);
    expect(convertSubscriptionPrice("7.00", "CNY", "JPY", rates)).toBe(150);
    expect(item.initialPrice).toBe("1.20");
  });
  it("saves each price with its own currency", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ok: true, id: "test" }));
    vi.stubGlobal("fetch", fetcher);
    await saveSubscription({
      token: "",
      input: { ...item, category: "domain", renewalType: "manual" },
    });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
      initialPrice: "1.20",
      initialCurrency: "HKD",
      renewalPrice: "9.00",
      renewalCurrency: "USD",
    });
  });
  it("edits listed subscriptions without sending legacy or response-only fields", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          ok: true,
          items: [item],
          total: 1,
          page: 1,
          pageSize: 12,
          timeZone: "Asia/Shanghai",
        }),
      )
      .mockResolvedValueOnce(Response.json({ ok: true, id: item.id }));
    vi.stubGlobal("fetch", fetcher);
    const listed = await getSubscriptions({
      token: "",
      search: "",
      category: "all",
      status: "all",
      page: 1,
    });
    const subscription = listed.items[0];
    await expect(
      saveSubscription({
        id: subscription.id,
        token: "",
        input: { ...subscription, reminderTimes: ["09:00", "10:00"] },
      }),
    ).resolves.toBe(item.id);
    const [url, init] = fetcher.mock.calls[1];
    expect(String(url)).toContain(`/api/admin/subscriptions/${item.id}`);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({
      name: item.name,
      serviceUrl: item.serviceUrl,
      category: item.category,
      details: item.details,
      startDate: item.startDate,
      expiryDate: item.expiryDate,
      initialPrice: item.initialPrice,
      renewalPrice: item.renewalPrice,
      initialCurrency: item.initialCurrency,
      renewalCurrency: item.renewalCurrency,
      renewalType: item.renewalType,
      notes: item.notes,
      reminderEnabled: item.reminderEnabled,
      reminderDays: item.reminderDays,
      reminderTimes: ["09:00", "10:00"],
    });
  });
  it("uses HttpOnly credentials without a blank bearer and encodes filters", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        ok: true,
        items: [item],
        total: 1,
        page: 1,
        pageSize: 12,
        timeZone: "Asia/Shanghai",
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    const data = await getSubscriptions({
      token: "",
      search: "domain & server",
      category: "all",
      status: "all",
      page: 1,
      pageSize: 24,
    });
    expect(data.items).toHaveLength(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toContain("search=domain+%26+server");
    expect(String(url)).toContain("pageSize=24");
    expect(init.credentials).toBe("include");
    expect(new Headers(init.headers).has("authorization")).toBe(false);
  });
  it("rejects malformed lists and reports backend validation failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ ok: true, items: [{ name: "bad" }], total: 1 })),
    );
    await expect(
      getSubscriptions({ token: "", search: "", category: "all", status: "all", page: 1 }),
    ).rejects.toThrow("Invalid subscription response");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ message: "Administrator session required." }, { status: 401 }),
        ),
    );
    await expect(
      getSubscriptions({ token: "", search: "", category: "all", status: "all", page: 1 }),
    ).rejects.toThrow("Administrator session required");
  });
});
