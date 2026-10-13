import { createHash } from "node:crypto";

import { getRedisClient } from "./db/redis";

const MAX_EMAIL_CODE_ATTEMPTS = 5;
const EMAIL_CODE_ATTEMPT_WINDOW_SECONDS = 10 * 60;

type EmailVerificationAttemptParameters = {
  email: string;
  purpose: string;
};

export const reserveEmailVerificationAttempt = async ({
  email,
  purpose,
}: EmailVerificationAttemptParameters) => {
  const identity = createHash("sha256")
    .update(JSON.stringify([email.trim().toLowerCase(), purpose]))
    .digest("hex");

  try {
    const redis = await getRedisClient();
    const attempts = await redis.sendCommand([
      "EVAL",
      "local attempts = redis.call('INCR', KEYS[1]); if attempts == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return attempts",
      "1",
      `leiblog:email-code-attempts:${identity}`,
      String(EMAIL_CODE_ATTEMPT_WINDOW_SECONDS),
    ]);
    const count = Number(attempts);
    return Number.isSafeInteger(count) && count > 0 && count <= MAX_EMAIL_CODE_ATTEMPTS;
  } catch {
    return false;
  }
};
