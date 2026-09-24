import { getSql } from "./postgres";

export const runMigrations = async () => {
  const schemaFile = Bun.file(new URL("./schema.sql", import.meta.url));
  const schemaSql = await schemaFile.text();
  const sql = getSql();

  await sql.unsafe(schemaSql);
};
