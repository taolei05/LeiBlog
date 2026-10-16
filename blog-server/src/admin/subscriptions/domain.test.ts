import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { getSubscriptionStatus, normalizeSubscription, subscriptionInputSchema } from "./domain";

export const subscriptionFixture = {
  name: "Example domain",
  serviceUrl: "https://example.com",
  category: "domain",
  details: "",
  startDate: "2026-01-01",
  expiryDate: "2026-10-20",
  initialPrice: "1.20",
  renewalPrice: "99.00",
  currency: "CNY",
  renewalType: "manual",
  notes: "",
  reminderEnabled: true,
  reminderDays: 7,
  reminderTime: "09:00",
} as const;

describe("subscription validation and calendar status", () => {
  test("accepts exact decimal strings, not numeric floating money", () => {
    expect(Value.Check(subscriptionInputSchema, subscriptionFixture)).toBe(true);
    expect(
      Value.Check(subscriptionInputSchema, { ...subscriptionFixture, initialPrice: 1.2 }),
    ).toBe(false);
    expect(
      Value.Check(subscriptionInputSchema, { ...subscriptionFixture, initialPrice: "-1" }),
    ).toBe(false);
    expect(
      Value.Check(subscriptionInputSchema, { ...subscriptionFixture, renewalPrice: "1.001" }),
    ).toBe(false);
  });
  test("rejects impossible dates, reversed dates and unsafe URLs", () => {
    expect(() =>
      normalizeSubscription({ ...subscriptionFixture, startDate: "2026-02-30" }),
    ).toThrow();
    expect(() =>
      normalizeSubscription({ ...subscriptionFixture, startDate: "2027-01-01" }),
    ).toThrow();
    expect(() =>
      normalizeSubscription({ ...subscriptionFixture, serviceUrl: "javascript:alert(1)" }),
    ).toThrow();
    expect(() => normalizeSubscription({ ...subscriptionFixture, name: "  " })).toThrow();
  });
  test("perpetual licenses have neither expiry nor reminders", () => {
    const value = normalizeSubscription({ ...subscriptionFixture, renewalType: "perpetual" });
    expect(value.expiryDate).toBeNull();
    expect(value.reminderEnabled).toBe(false);
  });
  test("expiry is inclusive in site calendar, independent of server timezone", () => {
    const input = { expiryDate: "2026-10-20", reminderDays: 7 };
    expect(getSubscriptionStatus({ ...input, today: "2026-10-12" })).toBe("normal");
    expect(getSubscriptionStatus({ ...input, today: "2026-10-13" })).toBe("expiring");
    expect(getSubscriptionStatus({ ...input, today: "2026-10-20" })).toBe("expiring");
    expect(getSubscriptionStatus({ ...input, today: "2026-10-21" })).toBe("expired");
    expect(getSubscriptionStatus({ ...input, expiryDate: null, today: "2030-01-01" })).toBe(
      "normal",
    );
  });
});
