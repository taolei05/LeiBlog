import { afterEach, describe, expect, spyOn, test } from "bun:test";
import type { Sql } from "postgres";

import { env } from "./env";
import { describeDevice, describeLocation, resolveLoginLocation, readLocationLabels } from "./login-metadata";
import { encryptSecret } from "./security/encryption";

const noSettingsSql = (async () => []) as unknown as Sql;
const meta = { ip: "203.0.113.9", userAgent: null, countryCode: "CN" };
const countryName = new Intl.DisplayNames(["zh-CN"], { type: "region" }).of("CN") ?? null;
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("login location", () => {
  test("reads bilingual saved metadata and country-only fallbacks", () => {
    expect(describeLocation({ location: "日本东京", location_en: "Tokyo, Japan" }, "en")).toBe("Tokyo, Japan");
    expect(describeLocation({ countryCode2: "JP" }, "en")).toBe("Japan");
    expect(describeLocation({ location: "日本东京", location_en: "Tokyo, Japan" })).toBe("日本东京");
  });

  test("translates historical labels once, without sending IP or device metadata", async () => {
    const encryptedValue = encryptSecret({ value: "test-api-key", secret: env.configEncryptionSecret });
    const sql = (async () => [{ encryptedValue }]) as unknown as Sql;
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ translations: [{ text: "Tokyo, Japan" }] }));
    const metadata = { location: "日本东京历史测试", ip: "203.0.113.9", userAgent: "private-device" };
    const first = await readLocationLabels({ values: [metadata, JSON.stringify(metadata)], sql });
    expect(first).toEqual([{ zhCN: metadata.location, en: "Tokyo, Japan" }, { zhCN: metadata.location, en: "Tokyo, Japan" }]);
    await readLocationLabels({ values: [metadata], sql });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = String(fetchSpy.mock.calls[0]?.[1]?.body);
    expect(body).not.toContain(metadata.ip);
    expect(body).not.toContain(metadata.userAgent);
    expect(JSON.parse(body)).toMatchObject({ source_lang: "ZH", target_lang: "EN-US", text: [metadata.location] });
  });
  test("reads existing JSON-encoded metadata as well as structured objects", () => {
    const location = { country_name: "中国", state_prov: "山东省", city: "济南市" };
    expect(describeLocation(JSON.stringify(location))).toBe("中国 山东省 济南市");
    expect(describeLocation(JSON.stringify({ location: "已保存的地点" }))).toBe("已保存的地点");
    expect(describeLocation(JSON.stringify({ country_code2: "CN" }))).toBe(countryName);
    const device = { userAgent: "unrecognized-test-browser" };
    expect(describeDevice(JSON.stringify(device))).toBe(device.userAgent);
    expect(describeDevice(JSON.stringify({ userAgent: null }))).toBeNull();
    expect(describeDevice("unrecognized-test-browser")).toBe("unrecognized-test-browser");
  });

  test("ignores malformed or non-object stored location values", () => {
    for (const value of ["{invalid", "null", "[]", '"text"', "42", "", [], 42, null]) {
      expect(describeLocation(value)).toBeNull();
    }
  });

  test("accepts database camelCase JSON keys and original provider keys", () => {
    expect(describeLocation({ countryCode2: "CN" })).toBe(countryName);
    expect(describeLocation({ countryName: "中国", stateProv: "山东省", city: "济南市" })).toBe(
      "中国 山东省 济南市",
    );
  });

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

  test("keeps Chinese provider data and saves its English translation", async () => {
    const encryptedValue = encryptSecret({
      value: "test-api-key",
      secret: env.configEncryptionSecret,
    });
    const sql = (async () => [{ encryptedValue }]) as unknown as Sql;
    const fetchSpy = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ country_name: "中国", state_prov: "山东省", city: "济南市" }))
      .mockResolvedValueOnce(Response.json({ translations: [{ text: "Jinan, Shandong, China" }] }));
    const location = await resolveLoginLocation({ meta, sql });
    expect(describeLocation(location)).toBe("中国 山东省 济南市");
    expect(describeLocation(location, "en")).toBe("Jinan, Shandong, China");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(new URL(String(fetchSpy.mock.calls[0]?.[0])).searchParams.get("ip")).toBe(meta.ip);
  });
});
