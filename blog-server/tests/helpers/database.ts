import { readFileSync } from "node:fs";
import { join } from "node:path";

export const TEST_POSTGRES_ADMIN_URL =
  process.env.TEST_POSTGRES_ADMIN_URL ??
  "postgres://taolei:12345678@localhost:5432/postgres";

export const TEST_POSTGRES_BASE_URL =
  process.env.TEST_POSTGRES_BASE_URL ??
  "postgres://taolei:12345678@localhost:5432";

export interface TestDatabase {
  databaseName: string;
  databaseUrl: string;
  drop: () => Promise<void>;
}

function createDatabaseName(prefix: string) {
  const safePrefix = prefix.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
  return `${safePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function createMigratedTestDatabase(prefix: string): Promise<TestDatabase> {
  const databaseName = createDatabaseName(prefix);
  const databaseUrl = `${TEST_POSTGRES_BASE_URL}/${databaseName}`;
  const adminDb = new Bun.SQL(TEST_POSTGRES_ADMIN_URL, { max: 1 });
  let testDb: Bun.SQL | null = null;

  await adminDb.unsafe(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
  await adminDb.unsafe(`CREATE DATABASE ${databaseName}`);

  try {
    testDb = new Bun.SQL(databaseUrl, { max: 1 });
    const migration = readFileSync(
      join(import.meta.dir, "../../src/db/migrations/001_initial_schema.sql"),
      "utf8"
    );
    await testDb.unsafe(migration);
  } finally {
    await testDb?.close({ timeout: 1 });
  }

  return {
    databaseName,
    databaseUrl,
    async drop() {
      await adminDb.unsafe(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
      await adminDb.close({ timeout: 1 });
    },
  };
}
