import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

import { createChallenge, randomInt, verifySolution } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import type { Challenge, Solution } from "altcha-lib/types";

import { getRedisClient } from "./db/redis";
import { env } from "./env";

const ALTCHA_CHALLENGE_TTL_SECONDS = 10 * 60;
const ALTCHA_REPLAY_TTL_SECONDS = ALTCHA_CHALLENGE_TTL_SECONDS + 60;
const ALTCHA_REPLAY_PREFIX = "leiblog:altcha:";
const ALTCHA_HMAC_KEY_SUFFIX = ":key-signature";

export const ALTCHA_FAILURE_REASON = {
  Expired: "altcha-expired",
  Invalid: "altcha-invalid",
  Replayed: "altcha-replayed",
} as const;

export type AltchaFailureReason =
  (typeof ALTCHA_FAILURE_REASON)[keyof typeof ALTCHA_FAILURE_REASON];

export type AltchaVerificationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      reason: AltchaFailureReason;
    };

type AltchaPayload = {
  challenge: Challenge;
  solution: Solution;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isChallenge = (value: unknown): value is Challenge => {
  if (!isRecord(value) || !isRecord(value.parameters)) {
    return false;
  }

  const parameters = value.parameters;

  return (
    typeof parameters.algorithm === "string" &&
    typeof parameters.cost === "number" &&
    typeof parameters.keyLength === "number" &&
    typeof parameters.keyPrefix === "string" &&
    typeof parameters.nonce === "string" &&
    typeof parameters.salt === "string" &&
    (value.signature === undefined || typeof value.signature === "string")
  );
};

const isSolution = (value: unknown): value is Solution => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.counter === "number" &&
    typeof value.derivedKey === "string" &&
    (value.time === undefined || typeof value.time === "number")
  );
};

const parseJsonPayload = (payload: string): unknown | undefined => {
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return undefined;
  }
};

const decodeBase64Payload = (payload: string) => {
  try {
    return Buffer.from(payload, "base64").toString("utf8");
  } catch {
    return undefined;
  }
};

const readAltchaPayload = (payload: unknown): AltchaPayload | undefined => {
  if (!isRecord(payload)) {
    return undefined;
  }

  if (!isChallenge(payload.challenge) || !isSolution(payload.solution)) {
    return undefined;
  }

  return {
    challenge: payload.challenge,
    solution: payload.solution,
  };
};

const parseAltchaPayload = (payload: string): AltchaPayload | undefined => {
  const trimmedPayload = payload.trim();
  const decodedPayload = decodeBase64Payload(trimmedPayload);
  const payloadCandidates = [
    parseJsonPayload(trimmedPayload),
    decodedPayload === undefined ? undefined : parseJsonPayload(decodedPayload),
  ];

  for (const payloadCandidate of payloadCandidates) {
    const altchaPayload = readAltchaPayload(payloadCandidate);
    if (altchaPayload !== undefined) {
      return altchaPayload;
    }
  }

  return undefined;
};

const markPayloadAsUsed = async (challenge: Challenge) => {
  // The signed challenge is stable across encodings and solution metadata.
  const key = `${ALTCHA_REPLAY_PREFIX}${createHash("sha256")
    .update(challenge.signature ?? "")
    .digest("hex")}`;
  try {
    const redis = await getRedisClient();
    const result = await redis.sendCommand([
      "SET",
      key,
      "1",
      "EX",
      String(ALTCHA_REPLAY_TTL_SECONDS),
      "NX",
    ]);

    return String(result) === "OK";
  } catch {
    return false;
  }
};

export const createAltchaChallenge = async () =>
  createChallenge({
    algorithm: "PBKDF2/SHA-256",
    cost: 5_000,
    counter: randomInt(5_000, 10_000),
    deriveKey,
    expiresAt: new Date(Date.now() + ALTCHA_CHALLENGE_TTL_SECONDS * 1000),
    hmacKeySignatureSecret: `${env.altchaSecret}${ALTCHA_HMAC_KEY_SUFFIX}`,
    hmacSignatureSecret: env.altchaSecret,
  });

export const verifyAltchaPayload = async (
  payload: string | undefined,
): Promise<AltchaVerificationResult> => {
  if (payload === undefined || payload.length > 20_000 || payload.trim().length === 0) {
    return {
      ok: false,
      reason: ALTCHA_FAILURE_REASON.Invalid,
    };
  }

  const parsedPayload = parseAltchaPayload(payload);
  if (parsedPayload === undefined) {
    return {
      ok: false,
      reason: ALTCHA_FAILURE_REASON.Invalid,
    };
  }

  const verification = await verifySolution({
    challenge: parsedPayload.challenge,
    deriveKey,
    hmacKeySignatureSecret: `${env.altchaSecret}${ALTCHA_HMAC_KEY_SUFFIX}`,
    hmacSignatureSecret: env.altchaSecret,
    solution: parsedPayload.solution,
  }).catch(() => undefined);

  if (verification === undefined) {
    return {
      ok: false,
      reason: ALTCHA_FAILURE_REASON.Invalid,
    };
  }

  if (verification.expired) {
    return {
      ok: false,
      reason: ALTCHA_FAILURE_REASON.Expired,
    };
  }

  if (!verification.verified) {
    return {
      ok: false,
      reason: ALTCHA_FAILURE_REASON.Invalid,
    };
  }

  const isUnusedPayload = await markPayloadAsUsed(parsedPayload.challenge);
  if (!isUnusedPayload) {
    return {
      ok: false,
      reason: ALTCHA_FAILURE_REASON.Replayed,
    };
  }

  return { ok: true };
};

export const readAltchaFailureMessage = ({
  locale,
  reason,
}: {
  locale?: string | null;
  reason: AltchaFailureReason;
}) => {
  const isEnglish = locale?.toLowerCase().startsWith("en") === true;
  if (reason === ALTCHA_FAILURE_REASON.Expired) {
    return isEnglish
      ? "Human verification expired. Please try again."
      : "人机验证已过期，请重新验证。";
  }

  if (reason === ALTCHA_FAILURE_REASON.Replayed) {
    return isEnglish
      ? "Human verification was already used. Please try again."
      : "人机验证已使用，请重新验证。";
  }

  return isEnglish ? "Complete human verification first." : "请先完成人机验证。";
};
