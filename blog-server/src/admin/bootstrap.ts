import { getSql } from "../shared/db/postgres";
import { env } from "../shared/env";
import {
  prepareUserProfileInput,
  resolveUserProfileWrite,
  upsertUsersEnProfile,
} from "../shared/profile-tags";
import { USER_ROLE } from "./auth/types";

type CountRow = {
  count: string;
};

type BootstrapUserRow = {
  id: string;
};

export const ensureBootstrapAdmin = async () => {
  const password = env.adminBootstrapPassword;
  if (password === undefined) {
    return;
  }

  const sql = getSql();
  const rows = await sql<CountRow[]>`
    SELECT count(*)::text AS count
    FROM users
    WHERE role = ${USER_ROLE.Admin}
  `;

  const row = rows[0];
  if (row !== undefined && Number(row.count) > 0) {
    return;
  }

  const passwordHash = await Bun.password.hash(password);
  const preparedProfile = await prepareUserProfileInput({
    profile: {
      name: env.adminBootstrapName ?? "",
      bio: "",
      tags: env.adminBootstrapTags,
    },
    sourceLocale: "zh-CN",
  });
  const profileWrite = resolveUserProfileWrite({
    prepared: preparedProfile,
  });

  await sql.begin(async (transaction) => {
    const insertedUsers = await transaction<BootstrapUserRow[]>`
      INSERT INTO users (
        role,
        name,
        username,
        password_hash,
        email,
        tags
      )
      VALUES (
        ${USER_ROLE.Admin},
        ${profileWrite.base.name},
        ${env.adminBootstrapUsername},
        ${passwordHash},
        ${env.adminBootstrapEmail},
        ${transaction.array(profileWrite.base.tags, 25)}::text[]
      )
      RETURNING id
    `;
    const insertedUser = insertedUsers[0];
    if (insertedUser === undefined) {
      return;
    }

    await upsertUsersEnProfile({
      profile: profileWrite.english,
      sql: transaction,
      userId: insertedUser.id,
    });
  });

  console.log(`Bootstrapped admin user "${env.adminBootstrapUsername}".`);
};
