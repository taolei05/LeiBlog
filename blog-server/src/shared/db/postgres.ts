import postgres from "postgres";
import type { Sql } from "postgres";

import { env } from "../env";

let sqlClient: Sql | undefined;

export const getSql = () => {
  if (sqlClient !== undefined) {
    return sqlClient;
  }

  sqlClient = postgres(env.databaseUrl, {
    max: 10,
    transform: postgres.camel,
  });

  return sqlClient;
};

export const closeSql = async () => {
  const sql = sqlClient;
  if (sql === undefined) {
    return;
  }

  sqlClient = undefined;
  await sql.end({ timeout: 5 });
};
