import { getSql } from "./postgres";

export const runMigrations = async () => {
  const schemaFile = Bun.file(new URL("./schema.sql", import.meta.url));
  const schemaSql = await schemaFile.text();
  const sql = getSql();

  await sql.begin(async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(1818585442, 1)`;
    await transaction.unsafe(schemaSql);
  });
};
