export const SHANGHAI_TIME_ZONE = "Asia/Shanghai";

process.env.TZ ??= SHANGHAI_TIME_ZONE;

export function now() {
  return new Date();
}

export function toShanghaiISOString(date: Date = now()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: SHANGHAI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);

  return `${parts.replace(" ", "T")}+08:00`;
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}
