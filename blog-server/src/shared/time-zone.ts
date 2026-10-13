import { TZDate, tz, tzOffset } from "@date-fns/tz";
import { format } from "date-fns";
import type { Sql, TransactionSql } from "postgres";

const DATE_TIME_MINUTE_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;

export const DEFAULT_SITE_TIME_ZONE = "Asia/Shanghai";

type TimeZoneSql = Sql | TransactionSql;

type SiteTimeZoneRow = {
  timeZone: string | null;
};

export const isValidTimeZone = (value: string) => {
  try {
    Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

export const normalizeTimeZone = (value?: string | null) => {
  const trimmedValue = value?.trim();

  return trimmedValue !== undefined && isValidTimeZone(trimmedValue)
    ? trimmedValue
    : DEFAULT_SITE_TIME_ZONE;
};

export const getTimeZoneOffsetMinutes = ({
  date = new Date(),
  timeZone,
}: {
  date?: Date;
  timeZone: string;
}) => tzOffset(normalizeTimeZone(timeZone), date);

export const parseMinuteTimestampInTimeZone = ({
  timeZone,
  value,
}: {
  timeZone: string;
  value: string;
}) => {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return null;
  }

  const match = DATE_TIME_MINUTE_PATTERN.exec(trimmedValue);
  if (match === null) {
    return undefined;
  }

  const [, yearText = "", monthText = "", dayText = "", hourText = "", minuteText = ""] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const resolvedTimeZone = normalizeTimeZone(timeZone);
  const date = new TZDate(year, month - 1, day, hour, minute, 0, resolvedTimeZone);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return undefined;
  }

  return new Date(date.getTime());
};

export const formatMinuteTimestampInTimeZone = ({
  timeZone,
  value,
}: {
  timeZone: string;
  value: Date | null;
}) => {
  if (value === null) {
    return "";
  }

  return format(value, "yyyy-MM-dd HH:mm", { in: tz(normalizeTimeZone(timeZone)) });
};

export const readSiteTimeZone = async ({ sql }: { sql: TimeZoneSql }) => {
  const rows = await sql<SiteTimeZoneRow[]>`
    SELECT time_zone
    FROM site_settings
    WHERE id = 1
    LIMIT 1
  `;

  return normalizeTimeZone(rows[0]?.timeZone);
};
