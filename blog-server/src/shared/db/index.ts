import { appConfig } from "../config";

export type DbClient = Bun.SQL;

export const db = new Bun.SQL(appConfig.databaseUrl, {
  max: appConfig.databaseMaxConnections,
});

export function withTransaction<T>(
  handler: (tx: DbClient) => T | Promise<T>,
  client: DbClient = db
) {
  return client.begin(handler);
}

export async function pingDb(client: DbClient = db) {
  const [row] = await client<{ ok: number }[]>`SELECT 1 AS ok`;
  return row?.ok === 1;
}

export async function closeDb(client: DbClient = db) {
  await client.close({ timeout: 1 });
}
