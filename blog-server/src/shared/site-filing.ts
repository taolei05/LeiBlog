export type IcpFilingRecord = {
  number: string;
  url: string | null;
};

export type IcpFilingRecordInput = {
  number?: string | null;
  url?: string | null;
};

const MAX_ICP_RECORDS = 20;

function cleanOptionalText(value: string | null | undefined) {
  if (value === null) return null;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseStoredRecords(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readStoredRecord(value: unknown): IcpFilingRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const number = typeof record.number === "string" ? cleanOptionalText(record.number) : null;
  if (!number) return null;

  const url = typeof record.url === "string" ? cleanOptionalText(record.url) : null;

  return { number, url };
}

export function cleanIcpFilingRecords({
  legacyNumber,
  legacyUrl,
  records,
}: {
  legacyNumber?: string | null;
  legacyUrl?: string | null;
  records?: IcpFilingRecordInput[] | null;
}) {
  if (Array.isArray(records)) {
    return records
      .map((record) => {
        const number = cleanOptionalText(record.number);
        if (!number) return null;

        return {
          number,
          url: cleanOptionalText(record.url),
        };
      })
      .filter((record): record is IcpFilingRecord => record !== null)
      .slice(0, MAX_ICP_RECORDS);
  }

  const number = cleanOptionalText(legacyNumber);
  if (!number) return [];

  return [{ number, url: cleanOptionalText(legacyUrl) }];
}

export function readStoredIcpFilingRecords({
  storedRecords,
}: {
  storedRecords: unknown;
}) {
  return parseStoredRecords(storedRecords)
    .map(readStoredRecord)
    .filter((record): record is IcpFilingRecord => record !== null)
    .slice(0, MAX_ICP_RECORDS);
}
