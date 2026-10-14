import type { JSONValue, Sql, TransactionSql } from "postgres";

import { getSql } from "./db/postgres";
import { env } from "./env";
import { translateTexts } from "./profile-tags";
import type { RequestMeta } from "./request-meta";
import { isPrivateIp, normalizeCountryCode } from "./request-meta";
import { decryptSecret } from "./security/encryption";
import { getTimeZoneOffsetMinutes, normalizeTimeZone, readSiteTimeZone } from "./time-zone";

export type LoginMethod = "apple" | "github" | "google" | "password";

export type UserLoginEvent = {
  id: string;
  createdAt: string;
  timeZone: string | null;
  timeZoneOffsetMinutes: number | null;
  ip: string | null;
  location: string | null;
  device: string | null;
  method: LoginMethod | null;
  success: boolean;
  failureReason: string | null;
};

export type UserLoginInfo = {
  lastLoginAt: string | null;
  lastLoginTimeZone: string | null;
  lastLoginTimeZoneOffsetMinutes: number | null;
  lastLoginIp: string | null;
  lastLoginLocation: string | null;
  lastLoginDevice: string | null;
  lastLoginMethod: LoginMethod | null;
  recentLogins: UserLoginEvent[];
};

type LoginMetadataSql = Sql | TransactionSql;

type EncryptedSettingRow = {
  encryptedValue: string;
};

type UserLoginInfoRow = {
  lastLoginAt: Date | string | null;
  lastLoginTimeZone: string | null;
  lastLoginTimeZoneOffsetMinutes: number | null;
  lastLoginDevice: unknown;
  lastLoginIp: string | null;
  lastLoginLocation: unknown;
  lastLoginMethod: LoginMethod | null;
};

type LoginAuditLogRow = {
  id: string;
  createdAt: Date | string;
  timeZone: string | null;
  timeZoneOffsetMinutes: number | null;
  device: unknown;
  failureReason: string | null;
  ip: string | null;
  location: unknown;
  loginMethod: LoginMethod | null;
  success: boolean;
};

type RecordLoginAttemptParameters = {
  failureReason?: string;
  loginMethod: LoginMethod;
  meta: RequestMeta;
  sql?: LoginMetadataSql;
  success: boolean;
  timeZone?: string;
  userId?: string;
};

type ReadUserLoginInfoParameters = {
  limit?: number;
  sql?: LoginMetadataSql;
  userId: string;
};

const DEFAULT_LOGIN_INFO: UserLoginInfo = {
  lastLoginAt: null,
  lastLoginTimeZone: null,
  lastLoginTimeZoneOffsetMinutes: null,
  lastLoginDevice: null,
  lastLoginIp: null,
  lastLoginLocation: null,
  lastLoginMethod: null,
  recentLogins: [],
};

const toIsoString = (value: Date | string | null) => {
  if (value === null) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readMetadataRecord = (value: unknown) => {
  if (isObjectRecord(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  // Earlier versions stored JSON text inside JSONB; decode that one extra layer on read.
  try {
    const parsed: unknown = JSON.parse(value);
    return isObjectRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const readJsonText = (value: unknown, key: string) => {
  if (!isObjectRecord(value)) {
    return null;
  }

  const field = value[key];
  return typeof field === "string" && field.trim().length > 0 ? field.trim() : null;
};

type UserAgentMatch = {
  label: string;
  pattern: RegExp;
};

const BROWSER_PATTERNS: readonly UserAgentMatch[] = [
  { label: "Microsoft Edge", pattern: /\bEdg\/([\d.]+)/ },
  { label: "Firefox", pattern: /\bFirefox\/([\d.]+)/ },
  { label: "Chrome", pattern: /\bChrome\/([\d.]+)/ },
  { label: "Safari", pattern: /\bVersion\/([\d.]+).*Safari\// },
];

const readUserAgentText = (value: unknown) => {
  const record = readMetadataRecord(value);
  if (record !== null) {
    return readJsonText(record, "userAgent");
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return null;
};

const getMajorVersion = (version: string | undefined) => version?.split(".")[0];

const describeBrowser = (userAgent: string) => {
  for (const { label, pattern } of BROWSER_PATTERNS) {
    const match = userAgent.match(pattern);
    if (match === null) {
      continue;
    }

    const majorVersion = getMajorVersion(match[1]);
    return majorVersion === undefined ? label : `${label} ${majorVersion}`;
  }

  return undefined;
};

const describeOperatingSystem = (userAgent: string) => {
  if (/iPad|iPhone|iPod/.test(userAgent)) {
    return "iOS";
  }

  if (/Macintosh|Mac OS X/.test(userAgent)) {
    return "macOS";
  }

  if (/Windows NT/.test(userAgent)) {
    return "Windows";
  }

  const androidVersion = userAgent.match(/\bAndroid\s+([\d.]+)/)?.[1];
  if (androidVersion !== undefined) {
    return `Android ${getMajorVersion(androidVersion) ?? androidVersion}`;
  }

  if (/\bLinux\b/.test(userAgent)) {
    return "Linux";
  }

  return undefined;
};

export const describeDevice = (value: unknown) => {
  const userAgent = readUserAgentText(value);
  if (userAgent === null) {
    return null;
  }

  const parts = [describeOperatingSystem(userAgent), describeBrowser(userAgent)].filter(
    (part) => part !== undefined,
  );

  return parts.length > 0 ? parts.join(" / ") : userAgent.slice(0, 160);
};

const countryNames = new Intl.DisplayNames(["zh-CN"], { type: "region", fallback: "none" });

export const describeLocation = (input: unknown) => {
  const value = readMetadataRecord(input);
  const location = readJsonText(value, "location");
  if (location !== null) {
    return location;
  }

  const city = readJsonText(value, "city");
  const province =
    readJsonText(value, "state_prov") ??
    readJsonText(value, "stateProv") ??
    readJsonText(value, "region");
  const countryCode = normalizeCountryCode(
    readJsonText(value, "country_code2") ?? readJsonText(value, "countryCode2") ?? undefined,
  );
  const country =
    readJsonText(value, "country_name") ??
    readJsonText(value, "countryName") ??
    readJsonText(value, "country") ??
    (countryCode === undefined ? null : (countryNames.of(countryCode) ?? null));
  const parts = [country, province, city].filter(
    (part, index, all): part is string =>
      part !== null &&
      all.findIndex((other) => other?.toLowerCase() === part.toLowerCase()) === index,
  );

  return parts.length > 0 ? parts.join(" ") : null;
};

const withLocationText = (location: Record<string, unknown>, text: string) => ({
  ...location,
  location: text,
});

const readEncryptedSetting = async ({
  key,
  sql,
}: {
  key: "deepl_api_key" | "ip_geolocation_api_key";
  sql: LoginMetadataSql;
}) => {
  const rows = await sql<EncryptedSettingRow[]>`
    SELECT encrypted_value
    FROM encrypted_settings
    WHERE key = ${key}
    LIMIT 1
  `;
  const row = rows[0];
  if (row === undefined) {
    return undefined;
  }

  return decryptSecret({
    value: row.encryptedValue,
    secret: env.configEncryptionSecret,
  });
};

const localizeLocation = async ({
  location,
  sql,
}: {
  location: Record<string, unknown>;
  sql: LoginMetadataSql;
}) => {
  const sourceText = describeLocation(location);
  if (sourceText === null) {
    return location;
  }

  if (/\p{Script=Han}/u.test(sourceText)) {
    return withLocationText(location, sourceText);
  }

  try {
    const deeplApiKey = await readEncryptedSetting({ key: "deepl_api_key", sql });
    if (deeplApiKey === undefined) {
      return withLocationText(location, sourceText);
    }

    const translatedTexts = await translateTexts({
      apiKey: deeplApiKey,
      sourceLocale: "en",
      targetLocale: "zh-CN",
      texts: [sourceText],
    });
    const translatedText = translatedTexts[0]?.trim();

    return withLocationText(location, translatedText?.length ? translatedText : sourceText);
  } catch {
    return withLocationText(location, sourceText);
  }
};

export const resolveLoginLocation = async ({
  meta,
  sql,
}: {
  meta: RequestMeta;
  sql: LoginMetadataSql;
}) => {
  if (meta.ip === null || isPrivateIp(meta.ip)) {
    return null;
  }

  const countryCode = normalizeCountryCode(meta.countryCode);
  const fallback = countryCode === undefined ? null : { country_code2: countryCode };

  try {
    const apiKey = await readEncryptedSetting({ key: "ip_geolocation_api_key", sql });
    if (apiKey === undefined) {
      return fallback;
    }

    const apiUrl = new URL("https://api.ipgeolocation.io/ipgeo");
    apiUrl.searchParams.set("apiKey", apiKey);
    apiUrl.searchParams.set("ip", meta.ip);
    apiUrl.searchParams.set("lang", "cn");

    const response = await fetch(apiUrl, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) {
      return fallback;
    }

    const payload: unknown = await response.json();
    if (!isObjectRecord(payload) || describeLocation(payload) === null) {
      return fallback;
    }

    return await localizeLocation({ location: payload, sql });
  } catch {
    return fallback;
  }
};

export const recordLoginAttempt = async ({
  failureReason,
  loginMethod,
  meta,
  sql = getSql(),
  success,
  timeZone: inputTimeZone,
  userId,
}: RecordLoginAttemptParameters) => {
  const now = new Date();
  const timeZone = normalizeTimeZone(inputTimeZone ?? (await readSiteTimeZone({ sql })));
  const timeZoneOffsetMinutes = getTimeZoneOffsetMinutes({ date: now, timeZone });
  const location = success ? await resolveLoginLocation({ meta, sql }) : null;
  const device = { userAgent: meta.userAgent };
  const locationJson = location === null ? null : sql.json(location as JSONValue);
  const deviceJson = sql.json(device);

  await sql`
    INSERT INTO login_audit_logs (
      user_id,
      ip,
      location,
      device,
      user_agent,
      login_method,
      time_zone,
      time_zone_offset_minutes,
      success,
      failure_reason
    )
    VALUES (
      ${userId ?? null},
      ${meta.ip},
      ${locationJson}::jsonb,
      ${deviceJson}::jsonb,
      ${meta.userAgent},
      ${loginMethod},
      ${timeZone},
      ${timeZoneOffsetMinutes},
      ${success},
      ${success ? null : (failureReason ?? "INVALID_CREDENTIALS")}
    )
  `;

  if (!success || userId === undefined) {
    return;
  }

  await sql`
    UPDATE users
    SET
      last_login_at = now(),
      last_login_time_zone = ${timeZone},
      last_login_time_zone_offset_minutes = ${timeZoneOffsetMinutes},
      last_login_ip = ${meta.ip},
      last_login_location = ${locationJson}::jsonb,
      last_login_device = ${deviceJson}::jsonb,
      last_login_method = ${loginMethod}
    WHERE id = ${userId}
  `;
};

const toLoginEvent = (row: LoginAuditLogRow): UserLoginEvent => ({
  id: row.id,
  createdAt: toIsoString(row.createdAt) ?? "",
  timeZone: row.timeZone,
  timeZoneOffsetMinutes: row.timeZoneOffsetMinutes,
  ip: row.ip,
  location: describeLocation(row.location),
  device: describeDevice(row.device),
  method: row.loginMethod,
  success: row.success,
  failureReason: row.failureReason,
});

export const readUserLoginInfo = async ({
  limit = 5,
  sql = getSql(),
  userId,
}: ReadUserLoginInfoParameters): Promise<UserLoginInfo> => {
  const rows = await sql<UserLoginInfoRow[]>`
    SELECT
      last_login_at,
      last_login_time_zone,
      last_login_time_zone_offset_minutes,
      host(last_login_ip) AS last_login_ip,
      last_login_location,
      last_login_device,
      last_login_method
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;
  const row = rows[0];
  if (row === undefined) {
    return DEFAULT_LOGIN_INFO;
  }

  const auditRows =
    limit <= 0
      ? []
      : await sql<LoginAuditLogRow[]>`
          SELECT
            id,
            created_at,
            time_zone,
            time_zone_offset_minutes,
            host(ip) AS ip,
            location,
            device,
            login_method,
            success,
            failure_reason
          FROM login_audit_logs
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          LIMIT ${limit}
        `;

  return {
    lastLoginAt: toIsoString(row.lastLoginAt),
    lastLoginTimeZone: row.lastLoginTimeZone,
    lastLoginTimeZoneOffsetMinutes: row.lastLoginTimeZoneOffsetMinutes,
    lastLoginIp: row.lastLoginIp,
    lastLoginLocation: describeLocation(row.lastLoginLocation),
    lastLoginDevice: describeDevice(row.lastLoginDevice),
    lastLoginMethod: row.lastLoginMethod,
    recentLogins: auditRows.map(toLoginEvent),
  };
};
