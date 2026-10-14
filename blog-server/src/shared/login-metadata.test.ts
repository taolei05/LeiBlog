import { afterEach, describe, expect, spyOn, test } from "bun:test";
import type { Sql } from "postgres";

import { env } from "./env";
import { describeLocation, resolveLoginLocation } from "./login-metadata";
import { encryptSecret } from "./security/encryption";

const noSettingsSql = (async () => []) as unknown as Sql;
const meta = { ip: "203.0.113.9", userAgent: null, countryCode: "CN" };
const countryName = new Intl.DisplayNames(["zh-CN"], { type: "region" }).of("CN") ?? null;
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("login location", () => {
  test("includes province and city without repeating identical names", () => {
    expect(describeLocation({ country_name: "中国", state_prov: "山东省", city: "济南市" })).toBe(
      "中国 山东省 济南市",
    );
    expect(
      describeLocation({ country_name: "Singapore", state_prov: "Singapore", city: "Singapore" }),
    ).toBe("Singapore");
    expect(describeLocation({ location: "已保存的地点", city: "Shanghai" })).toBe("已保存的地点");
    expect(describeLocation(null)).toBeNull();
  });

  test("uses trusted country data when no geolocation service is configured", async () => {
    const fetchSpy = spyOn(globalThis, "fetch");
    const location = await resolveLoginLocation({ meta, sql: noSettingsSql });
    expect(location).toEqual({ country_code2: "CN" });
    expect(describeLocation(location)).toBe(countryName);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("does not geolocate private addresses or invent missing locations", async () => {
    expect(
      await resolveLoginLocation({ meta: { ...meta, ip: "192.168.1.2" }, sql: noSettingsSql }),
    ).toBeNull();
    expect(
      await resolveLoginLocation({
        meta: { ip: "203.0.113.9", userAgent: null },
        sql: noSettingsSql,
      }),
    ).toBeNull();
    expect(
      await resolveLoginLocation({ meta: { ...meta, countryCode: "XX" }, sql: noSettingsSql }),
    ).toBeNull();
  });

  test("country fallback survives a failed or unavailable provider", async () => {
    const encryptedValue = encryptSecret({
      value: "test-api-key",
      secret: env.configEncryptionSecret,
    });
    const sql = (async () => [{ encryptedValue }]) as unknown as Sql;
    for (const response of [
      new Response("unavailable", { status: 503 }),
      Response.json([]),
      Response.json({ message: "invalid" }),
    ]) {
      spyOn(globalThis, "fetch").mockResolvedValue(response);
      expect(describeLocation(await resolveLoginLocation({ meta, sql }))).toBe(countryName);
    }
    spyOn(globalThis, "fetch").mockRejectedValue(new Error("timeout"));
    expect(describeLocation(await resolveLoginLocation({ meta, sql }))).toBe(countryName);
  });

  test("country fallback survives invalid stored credentials", async () => {
    const sql = (async () => [{ encryptedValue: "invalid" }]) as unknown as Sql;
    expect(describeLocation(await resolveLoginLocation({ meta, sql }))).toBe(countryName);
  });

  test("keeps the provider location when translation fails", async () => {
    const encryptedValue = encryptSecret({
      value: "test-api-key",
      secret: env.configEncryptionSecret,
    });
    const sql = (async () => [{ encryptedValue }]) as unknown as Sql;
    spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          country_name: "United States",
          state_prov: "California",
          city: "San Francisco",
        }),
      )
      .mockRejectedValue(new Error("Translation unavailable"));
    expect(describeLocation(await resolveLoginLocation({ meta, sql }))).toBe(
      "United States California San Francisco",
    );
  });

  test("uses complete Chinese provider data without an unnecessary translation request", async () => {
    const encryptedValue = encryptSecret({
      value: "test-api-key",
      secret: env.configEncryptionSecret,
    });
    const sql = (async () => [{ encryptedValue }]) as unknown as Sql;
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ country_name: "中国", state_prov: "山东省", city: "济南市" }),
    );
    expect(describeLocation(await resolveLoginLocation({ meta, sql }))).toBe("中国 山东省 济南市");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(new URL(String(fetchSpy.mock.calls[0]?.[0])).searchParams.get("ip")).toBe(meta.ip);
  });
});
