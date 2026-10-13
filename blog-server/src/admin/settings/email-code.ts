import { createHash } from "node:crypto";

import type { Sql } from "postgres";

import { reserveEmailVerificationAttempt } from "../../shared/email-verification";

export const consumeSecretRevealEmailCode = async ({
  email,
  emailCode,
  purpose,
  sql,
}: {
  email: string;
  emailCode: string;
  purpose: string;
  sql: Sql;
}) => {
  if (!(await reserveEmailVerificationAttempt({ email, purpose }))) {
    return false;
  }
  const codeHash = createHash("sha256").update(emailCode.trim()).digest("hex");
  // The latest issued code is the only valid one, even after it is consumed.
  const rows = await sql<{ id: string }[]>`
    UPDATE email_verification_codes
    SET consumed_at = now()
    WHERE id = (
      SELECT id FROM email_verification_codes
      WHERE lower(email) = ${email.toLowerCase()}
        AND purpose = ${purpose}
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    )
      AND consumed_at IS NULL
      AND expires_at > now()
      AND code_hash = ${codeHash}
    RETURNING id
  `;
  return rows.length === 1;
};
