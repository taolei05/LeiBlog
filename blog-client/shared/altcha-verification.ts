export type AltchaFailure = "failed" | "expired";

type AltchaEventStateParameters = {
  detail: unknown;
  type: string;
};

type AltchaEventParameters = AltchaEventStateParameters & { hiddenPayload: string };

const readAltchaEventRecord = (detail: unknown) =>
  typeof detail === "object" && detail !== null && !Array.isArray(detail)
    ? (detail as Record<string, unknown>)
    : undefined;

export const readAltchaEventFailure = ({
  detail,
  type,
}: AltchaEventStateParameters): AltchaFailure | undefined => {
  const state = readAltchaEventRecord(detail)?.state;
  if (type === "expired" || (type === "statechange" && state === "expired")) {
    return "expired";
  }
  if (type === "error" || (type === "statechange" && state === "error")) {
    return "failed";
  }
  return undefined;
};

export const readAltchaEventPayload = ({ detail, hiddenPayload, type }: AltchaEventParameters) => {
  const record = readAltchaEventRecord(detail);
  if (type !== "verified" && !(type === "statechange" && record?.state === "verified")) {
    return "";
  }

  return (typeof record?.payload === "string" ? record.payload : hiddenPayload).trim();
};

type PendingAltchaRequest = {
  id: number;
  resolve: (value: string | undefined) => void;
};

export const createAltchaRequestController = () => {
  let nextId = 0;
  let pending: PendingAltchaRequest | undefined;

  const cancel = () => {
    const request = pending;
    pending = undefined;
    request?.resolve(undefined);
  };

  return {
    cancel,
    request: () => {
      cancel();
      const id = ++nextId;
      const promise = new Promise<string | undefined>((resolve) => {
        pending = { id, resolve };
      });
      return { id, promise };
    },
    resolve: (id: number, value: string | undefined) => {
      if (pending === undefined || pending.id !== id) {
        return false;
      }

      const request = pending;
      pending = undefined;
      request.resolve(value);
      return true;
    },
  };
};
