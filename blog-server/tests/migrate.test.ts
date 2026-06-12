import { describe, expect, test } from "bun:test";

import { decideAppliedMigration } from "../src/db/migrate";

describe("migration decisions", () => {
  test("skips a changed consolidated baseline and allows later migrations", () => {
    expect(
      decideAppliedMigration({
        appliedChecksum: "old-baseline-checksum",
        currentChecksum: "new-baseline-checksum",
        file: "001_initial_schema.sql",
      })
    ).toBe("skip-consolidated-baseline");

    expect(
      decideAppliedMigration({
        appliedChecksum: undefined,
        currentChecksum: "comment-notifications-checksum",
        file: "003_add_comment_email_notifications.sql",
      })
    ).toBe("apply");
  });

  test("rejects a changed checksum for an already applied incremental migration", () => {
    expect(() =>
      decideAppliedMigration({
        appliedChecksum: "old-incremental-checksum",
        currentChecksum: "new-incremental-checksum",
        file: "003_add_comment_email_notifications.sql",
      })
    ).toThrow(
      "Migration checksum changed after apply: 003_add_comment_email_notifications.sql"
    );
  });
});
