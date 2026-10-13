import { isIP } from "node:net";

import { env } from "./env";

export type RequestMeta = {
  ip: string | null;
  userAgent: string | null;
};

type HeaderRecord = Record<string, string | undefined>;

type GetRequestMetaParameters = {
  headers: HeaderRecord;
  requestIp?: string | null;
  trustedProxyIps?: readonly string[];
};

const normalizeIp = (value: string | null | undefined) => {
  const trimmedValue = value?.trim();
  if (trimmedValue === undefined || trimmedValue.length === 0) {
    return null;
  }

  const unwrappedValue = (trimmedValue.match(/^\[([^\]]+)\]$/)?.[1] ?? trimmedValue).split("%")[0];
  if (!isIP(unwrappedValue)) {
    return null;
  }

  if (isIP(unwrappedValue) === 4) {
    return unwrappedValue;
  }

  const normalized = new URL(`http://[${unwrappedValue}]/`).hostname.slice(1, -1);
  const mapped = normalized.match(/^::ffff:([a-f\d]{1,4}):([a-f\d]{1,4})$/);
  if (mapped !== null) {
    const high = Number.parseInt(mapped[1], 16);
    const low = Number.parseInt(mapped[2], 16);
    return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  }

  return normalized;
};

const readForwardedIp = ({
  value,
  directIp,
  trustedProxyIps,
}: {
  value: string;
  directIp: string;
  trustedProxyIps: readonly string[];
}) => {
  const chain = value.split(",");
  let ip = directIp;
  // A proxy appends its peer. Stop at the first untrusted hop, ignoring attacker-supplied prefixes.
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    if (!isTrustedProxyIp({ ip, trustedProxyIps })) {
      break;
    }
    const candidate = normalizeIp(chain[index]);
    if (candidate === null) {
      break;
    }
    ip = candidate;
  }
  return ip;
};

const ipv4ToNumber = (ip: string) => {
  if (isIP(ip) !== 4) {
    return null;
  }

  return ip
    .split(".")
    .map(Number)
    .reduce((value, octet) => ((value << 8) + octet) >>> 0, 0);
};

const isIpv4CidrMatch = ({ cidr, ip }: { cidr: string; ip: string }) => {
  const [range, prefixRaw, extra] = cidr.split("/");
  if (extra !== undefined || range === undefined || prefixRaw === undefined) {
    return false;
  }

  const prefix = Number(prefixRaw);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }

  const ipNumber = ipv4ToNumber(ip);
  const rangeNumber = ipv4ToNumber(range);
  if (ipNumber === null || rangeNumber === null) {
    return false;
  }

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipNumber & mask) >>> 0 === (rangeNumber & mask) >>> 0;
};

const isTrustedProxyIp = ({
  ip,
  trustedProxyIps,
}: {
  ip: string;
  trustedProxyIps: readonly string[];
}) =>
  trustedProxyIps.some(
    (trustedIp) => normalizeIp(trustedIp) === ip || isIpv4CidrMatch({ cidr: trustedIp, ip }),
  );

export const isPrivateIp = (value: string): boolean => {
  const ip = normalizeIp(value);
  if (ip === null) {
    return false;
  }
  const ipVersion = isIP(ip);
  if (ipVersion === 4) {
    const [first = 0, second = 0] = ip.split(".").map(Number);
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }

  if (ipVersion !== 6) {
    return false;
  }

  const normalizedIp = ip.toLowerCase();
  if (normalizedIp.startsWith("::ffff:")) {
    const mappedIpv4 = normalizedIp.slice("::ffff:".length);
    return isIP(mappedIpv4) === 4 ? isPrivateIp(mappedIpv4) : false;
  }

  return (
    normalizedIp === "::" ||
    normalizedIp === "::1" ||
    normalizedIp.startsWith("fc") ||
    normalizedIp.startsWith("fd") ||
    /^fe[89ab]/.test(normalizedIp)
  );
};

export const getRequestMeta = ({
  headers,
  requestIp,
  trustedProxyIps = env.trustedProxyIps,
}: GetRequestMetaParameters): RequestMeta => {
  const directIp = normalizeIp(requestIp);
  const trustsProxy = directIp !== null && isTrustedProxyIp({ ip: directIp, trustedProxyIps });
  const forwarded = headers["x-forwarded-for"];
  const forwardedIp =
    trustsProxy && directIp !== null && forwarded !== undefined
      ? readForwardedIp({ value: forwarded, directIp, trustedProxyIps })
      : null;
  const realIp = trustsProxy ? normalizeIp(headers["x-real-ip"]) : null;

  return {
    ip: forwardedIp ?? realIp ?? directIp,
    userAgent: headers["user-agent"]?.slice(0, 1024) ?? null,
  };
};
