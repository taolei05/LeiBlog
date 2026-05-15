import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.TZ ??= "Asia/Shanghai";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://taolei:12345678@localhost:5432/lei_blog";

const migrationsDir = fileURLToPath(new URL("./migrations", import.meta.url));
const sql = new Bun.SQL(databaseUrl, { max: 1 });

function checksum(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const appliedRows = await sql<{ filename: string; checksum: string }[]>`
    SELECT filename, checksum
    FROM schema_migrations
    ORDER BY filename
  `;
  const applied = new Map(
    appliedRows.map((row) => [row.filename, row.checksum])
  );

  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const content = await readFile(join(migrationsDir, file), "utf8");
    const hash = checksum(content);
    const existingHash = applied.get(file);

    if (existingHash === hash) {
      console.log(`skip ${file}`);
      continue;
    }

    if (existingHash && existingHash !== hash) {
      throw new Error(`Migration checksum changed after apply: ${file}`);
    }

    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`
        INSERT INTO schema_migrations (filename, checksum)
        VALUES (${file}, ${hash})
      `;
    });

    console.log(`applied ${file}`);
  }

  if (files.length === 0) {
    console.log("no migration files found");
  }
}

try {
  await main();
} finally {
  await sql.end();
}
