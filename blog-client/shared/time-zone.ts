import { tz, tzOffset } from "@date-fns/tz";
import { format } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";

export const DEFAULT_SITE_TIME_ZONE = "Asia/Shanghai";

export const SITE_TIME_ZONE_VALUES = [
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Taipei",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "UTC",
] as const;

type FormatDateTimeInTimeZoneParameters = {
  fallback?: string;
  language: string;
  timeZone: string;
  value: string | null;
};

type FormatDateInTimeZoneParameters = {
  fallback?: string;
  language: string;
  timeZone: string;
  value?: string | null;
};

type FormatYearInTimeZoneParameters = {
  fallback?: string;
  timeZone: string;
  value?: string | null;
};

type FormatMonthInTimeZoneParameters = {
  fallback?: string;
  language: string;
  timeZone: string;
  value?: string | null;
};

type FormatDayInTimeZoneParameters = {
  fallback?: string;
  timeZone: string;
  value?: string | null;
};

type TimeZoneOption = {
  description: string;
  label: string;
  value: string;
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

export const getSystemTimeZone = () => {
  const systemTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return normalizeTimeZone(systemTimeZone);
};

export const getTimeZoneOffsetMinutes = ({
  date = new Date(),
  timeZone,
}: {
  date?: Date;
  timeZone: string;
}) => tzOffset(normalizeTimeZone(timeZone), date);

export const formatTimeZoneOffset = ({
  date = new Date(),
  timeZone,
}: {
  date?: Date;
  timeZone: string;
}) => {
  const offset = getTimeZoneOffsetMinutes({ date, timeZone });
  const sign = offset >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offset);
  const hours = Math.floor(absoluteOffset / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (absoluteOffset % 60).toString().padStart(2, "0");

  return `GMT${sign}${hours}:${minutes}`;
};

export const createTimeZoneOptions = ({
  selectedTimeZone,
}: {
  selectedTimeZone?: string;
} = {}): TimeZoneOption[] => {
  const normalizedSelectedTimeZone =
    selectedTimeZone === undefined ? undefined : normalizeTimeZone(selectedTimeZone);
  const values =
    normalizedSelectedTimeZone !== undefined &&
    !SITE_TIME_ZONE_VALUES.includes(
      normalizedSelectedTimeZone as (typeof SITE_TIME_ZONE_VALUES)[number],
    )
      ? [normalizedSelectedTimeZone, ...SITE_TIME_ZONE_VALUES]
      : SITE_TIME_ZONE_VALUES;

  return values.map((timeZone) => ({
    description: formatTimeZoneOffset({ timeZone }),
    label: timeZone,
    value: timeZone,
  }));
};

export const formatCurrentMinuteInTimeZone = (timeZone: string) =>
  format(new Date(), "yyyy-MM-dd HH:mm", { in: tz(normalizeTimeZone(timeZone)) });

export const formatDateTimeInTimeZone = ({
  fallback,
  language,
  timeZone,
  value,
}: FormatDateTimeInTimeZoneParameters) => {
  if (value === null || value.trim().length === 0) {
    return fallback ?? "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback ?? value;
  }

  const normalizedLanguage = language.toLowerCase().startsWith("en") ? "en" : "zh-CN";
  const formatPattern = normalizedLanguage === "en" ? "MMM d, yyyy HH:mm" : "yyyy年MM月dd日 HH:mm";

  return format(date, formatPattern, {
    in: tz(normalizeTimeZone(timeZone)),
    locale: normalizedLanguage === "en" ? enUS : zhCN,
  });
};

export const formatDateInTimeZone = ({
  fallback,
  language,
  timeZone,
  value,
}: FormatDateInTimeZoneParameters) => {
  if (value === undefined || value === null || value.trim().length === 0) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback ?? value;
  }

  const normalizedLanguage = language.toLowerCase().startsWith("en") ? "en" : "zh-CN";
  const formatPattern = normalizedLanguage === "en" ? "MMM d, yyyy" : "yyyy年MM月dd日";

  return format(date, formatPattern, {
    in: tz(normalizeTimeZone(timeZone)),
    locale: normalizedLanguage === "en" ? enUS : zhCN,
  });
};

export const formatYearInTimeZone = ({
  fallback,
  timeZone,
  value,
}: FormatYearInTimeZoneParameters) => {
  if (value === undefined || value === null || value.trim().length === 0) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback ?? value;
  }

  return format(date, "yyyy", {
    in: tz(normalizeTimeZone(timeZone)),
  });
};

export const formatMonthInTimeZone = ({
  fallback,
  language,
  timeZone,
  value,
}: FormatMonthInTimeZoneParameters) => {
  if (value === undefined || value === null || value.trim().length === 0) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback ?? value;
  }

  const normalizedLanguage = language.toLowerCase().startsWith("en") ? "en" : "zh-CN";

  return format(date, normalizedLanguage === "en" ? "MMM" : "M月", {
    in: tz(normalizeTimeZone(timeZone)),
    locale: normalizedLanguage === "en" ? enUS : zhCN,
  });
};

export const formatDayInTimeZone = ({
  fallback,
  timeZone,
  value,
}: FormatDayInTimeZoneParameters) => {
  if (value === undefined || value === null || value.trim().length === 0) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback ?? value;
  }

  return format(date, "d", {
    in: tz(normalizeTimeZone(timeZone)),
  });
};
