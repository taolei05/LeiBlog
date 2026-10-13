import type { Sql, TransactionSql } from "postgres";

import { getSql } from "../../shared/db/postgres";
import type {
  UserProfileLocalizations,
  UserProfileTranslationSummary,
} from "../../shared/profile-tags";
import {
  prepareUserProfileLocalizations,
  readUserProfileLocalizations,
  upsertUsersEnProfile,
} from "../../shared/profile-tags";
import { deleteAdminSessionsForUser } from "../auth/service";
import type { UserRole } from "../auth/types";
import { USER_ROLE } from "../auth/types";
import { readEncryptedSetting } from "../settings/service";

export type ManagedUser = {
  id: string;
  role: UserRole;
  username: string;
  email: string;
  tags: string[];
  englishTags: string[];
  commentEmailNotifications: boolean;
  newPostEmailNotifications: boolean;
  createdAt: string;
  updatedAt: string;
  name?: string;
  englishName?: string;
  avatarUrl?: string;
  bio?: string;
  englishBio?: string;
  blogUrl?: string;
};

export type UserManagementSummary = {
  total: number;
  administrators: number;
  users: number;
  notificationSubscribers: number;
};

export type UserManagementPageInfo = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type UserManagementList = {
  users: ManagedUser[];
  summary: UserManagementSummary;
  pageInfo: UserManagementPageInfo;
};

export type ManagedUserDetails = {
  profileLocalizations: UserProfileLocalizations;
  user: ManagedUser;
};

export type ManagedUserMutationSuccess = ManagedUserDetails & {
  ok: true;
  profileTranslation: UserProfileTranslationSummary;
};

export const MANAGED_USER_FAILURE = {
  CreateFailed: "create-failed",
  DeleteFailed: "delete-failed",
  EmailExists: "email-exists",
  InvalidIdentity: "invalid-identity",
  InvalidRole: "invalid-role",
  LastAdmin: "last-admin",
  NotFound: "not-found",
  PasswordTooShort: "password-too-short",
  SelfDelete: "self-delete",
  SelfRoleChange: "self-role-change",
  UpdateFailed: "update-failed",
  UsernameExists: "username-exists",
} as const;

export type ManagedUserFailure = (typeof MANAGED_USER_FAILURE)[keyof typeof MANAGED_USER_FAILURE];

export type ManagedUserMutationResult =
  | ManagedUserMutationSuccess
  | {
      ok: false;
      reason: ManagedUserFailure;
    };

export type DeleteManagedUserResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      reason: ManagedUserFailure;
    };

export type ManagedUserInput = {
  profileLocalizations: UserProfileLocalizations;
  role: UserRole;
  username: string;
  email: string;
  password: string;
  avatarUrl: string;
  blogUrl: string;
  commentEmailNotifications: boolean;
  newPostEmailNotifications: boolean;
};

type ManagedUsersSql = Sql | TransactionSql;

type ListManagedUsersParameters = {
  page?: number;
  pageSize?: number;
  query?: string;
  role?: UserRole | "all";
};

type GetManagedUserParameters = {
  userId: string;
};

type CreateManagedUserParameters = {
  input: ManagedUserInput;
};

type UpdateManagedUserParameters = {
  actorUserId: string;
  input: ManagedUserInput;
  userId: string;
};

type DeleteManagedUserParameters = {
  actorUserId: string;
  userId: string;
};

type ManagedUserRow = {
  id: string;
  role: UserRole;
  name: string | null;
  username: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  tags: string[];
  blogUrl: string | null;
  commentEmailNotifications: boolean;
  newPostEmailNotifications: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  englishName: string | null;
  englishBio: string | null;
  englishTags: string[] | null;
};

type ManagedUserCredentialRow = {
  id: string;
  role: UserRole;
  passwordHash: string;
};

type CountRow = {
  count: string;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const MIN_PASSWORD_LENGTH = 8;

const optionalText = (value: string | null) => {
  const trimmedValue = value?.trim() ?? "";
  return trimmedValue.length > 0 ? trimmedValue : undefined;
};

const toDatabaseText = (value: string) => {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
};

const normalizeTags = (tags: string[] | null) =>
  (tags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0);

const toTimestamp = (value: Date | string) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toManagedUser = (row: ManagedUserRow): ManagedUser => ({
  id: row.id,
  role: row.role,
  name: optionalText(row.name),
  englishName: optionalText(row.englishName),
  username: row.username,
  email: row.email,
  avatarUrl: optionalText(row.avatarUrl),
  bio: optionalText(row.bio),
  englishBio: optionalText(row.englishBio),
  tags: normalizeTags(row.tags),
  englishTags: normalizeTags(row.englishTags),
  blogUrl: optionalText(row.blogUrl),
  commentEmailNotifications: row.commentEmailNotifications,
  newPostEmailNotifications: row.newPostEmailNotifications,
  createdAt: toTimestamp(row.createdAt),
  updatedAt: toTimestamp(row.updatedAt),
});

const summarizeUsers = (users: ManagedUser[]): UserManagementSummary => ({
  administrators: users.filter((user) => user.role === USER_ROLE.Admin).length,
  notificationSubscribers: users.filter(
    (user) => user.commentEmailNotifications || user.newPostEmailNotifications,
  ).length,
  total: users.length,
  users: users.filter((user) => user.role === USER_ROLE.User).length,
});

const toPageSize = (value?: number) => {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(value)));
};

const toPage = (value?: number) => {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_PAGE;
  }

  return Math.max(1, Math.floor(value));
};

const isUserRole = (value: string): value is UserRole =>
  value === USER_ROLE.Admin || value === USER_ROLE.User;

type MatchesUserQueryParameters = {
  query: string;
  user: ManagedUser;
};

const matchesUserQuery = ({ query, user }: MatchesUserQueryParameters) => {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (normalizedQuery.length === 0) {
    return true;
  }

  const searchableText = [
    user.name,
    user.englishName,
    user.username,
    user.email,
    user.bio,
    user.englishBio,
    user.blogUrl,
    ...user.tags,
    ...user.englishTags,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLocaleLowerCase();

  return searchableText.includes(normalizedQuery);
};

type ReadManagedUserRowsParameters = {
  sql: ManagedUsersSql;
};

const readManagedUserRows = async ({ sql }: ReadManagedUserRowsParameters) =>
  sql<ManagedUserRow[]>`
    SELECT
      users.id,
      users.role,
      users.name,
      users.username,
      users.email,
      users.avatar_url,
      users.bio,
      users.tags,
      users.blog_url,
      users.comment_email_notifications,
      users.new_post_email_notifications,
      users.created_at,
      users.updated_at,
      users_en.name AS english_name,
      users_en.bio AS english_bio,
      users_en.tags AS english_tags
    FROM users
    LEFT JOIN users_en
      ON users_en.user_id = users.id
    ORDER BY users.created_at DESC, lower(users.username) ASC
  `;

type ReadManagedUserRowParameters = {
  sql: ManagedUsersSql;
  userId: string;
};

const readManagedUserRow = async ({ sql, userId }: ReadManagedUserRowParameters) => {
  const rows = await sql<ManagedUserRow[]>`
    SELECT
      users.id,
      users.role,
      users.name,
      users.username,
      users.email,
      users.avatar_url,
      users.bio,
      users.tags,
      users.blog_url,
      users.comment_email_notifications,
      users.new_post_email_notifications,
      users.created_at,
      users.updated_at,
      users_en.name AS english_name,
      users_en.bio AS english_bio,
      users_en.tags AS english_tags
    FROM users
    LEFT JOIN users_en
      ON users_en.user_id = users.id
    WHERE users.id = ${userId}
    LIMIT 1
  `;

  return rows[0];
};

type ReadManagedUserDetailsParameters = {
  sql: ManagedUsersSql;
  userId: string;
};

const readManagedUserDetails = async ({
  sql,
  userId,
}: ReadManagedUserDetailsParameters): Promise<ManagedUserDetails | undefined> => {
  const row = await readManagedUserRow({ sql, userId });
  if (row === undefined) {
    return undefined;
  }

  const profileLocalizations = await readUserProfileLocalizations({
    base: {
      bio: row.bio,
      name: row.name,
      tags: row.tags,
    },
    sql,
    userId,
  });

  return {
    profileLocalizations,
    user: toManagedUser(row),
  };
};

type CountIdentityConflictsParameters = {
  field: "username" | "email";
  sql: ManagedUsersSql;
  userId?: string;
  value: string;
};

const countIdentityConflicts = async ({
  field,
  sql,
  userId,
  value,
}: CountIdentityConflictsParameters) => {
  if (field === "username") {
    const rows =
      userId === undefined
        ? await sql<CountRow[]>`
            SELECT count(*)::text AS count
            FROM users
            WHERE lower(username) = lower(${value})
          `
        : await sql<CountRow[]>`
            SELECT count(*)::text AS count
            FROM users
            WHERE id <> ${userId}
              AND lower(username) = lower(${value})
          `;

    return Number(rows[0]?.count ?? 0);
  }

  const rows =
    userId === undefined
      ? await sql<CountRow[]>`
          SELECT count(*)::text AS count
          FROM users
          WHERE lower(email) = lower(${value})
        `
      : await sql<CountRow[]>`
          SELECT count(*)::text AS count
          FROM users
          WHERE id <> ${userId}
            AND lower(email) = lower(${value})
        `;

  return Number(rows[0]?.count ?? 0);
};

type ReadAdminCountParameters = {
  sql: ManagedUsersSql;
};

const readAdminCount = async ({ sql }: ReadAdminCountParameters) => {
  const rows = await sql<CountRow[]>`
    SELECT count(*)::text AS count
    FROM users
    WHERE role = ${USER_ROLE.Admin}
  `;

  return Number(rows[0]?.count ?? 0);
};

type ReadManagedUserCredentialParameters = {
  sql: ManagedUsersSql;
  userId: string;
};

const readManagedUserCredential = async ({ sql, userId }: ReadManagedUserCredentialParameters) => {
  const rows = await sql<ManagedUserCredentialRow[]>`
    SELECT id, role, password_hash
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  return rows[0];
};

type ValidateManagedUserInputParameters = {
  input: ManagedUserInput;
  passwordRequired: boolean;
};

const validateManagedUserInput = ({
  input,
  passwordRequired,
}: ValidateManagedUserInputParameters): ManagedUserFailure | undefined => {
  if (!isUserRole(input.role)) {
    return MANAGED_USER_FAILURE.InvalidRole;
  }

  if (input.username.trim().length === 0 || input.email.trim().length === 0) {
    return MANAGED_USER_FAILURE.InvalidIdentity;
  }

  if (passwordRequired && input.password.length < MIN_PASSWORD_LENGTH) {
    return MANAGED_USER_FAILURE.PasswordTooShort;
  }

  if (
    !passwordRequired &&
    input.password.length > 0 &&
    input.password.length < MIN_PASSWORD_LENGTH
  ) {
    return MANAGED_USER_FAILURE.PasswordTooShort;
  }

  return undefined;
};

type CreateMutationSuccessParameters = {
  profileTranslation: UserProfileTranslationSummary;
  sql: ManagedUsersSql;
  userId: string;
};

const createMutationSuccess = async ({
  profileTranslation,
  sql,
  userId,
}: CreateMutationSuccessParameters): Promise<ManagedUserMutationResult> => {
  const details = await readManagedUserDetails({ sql, userId });
  if (details === undefined) {
    return { ok: false, reason: MANAGED_USER_FAILURE.UpdateFailed };
  }

  return {
    ok: true,
    profileTranslation,
    ...details,
  };
};

export const listManagedUsers = async ({
  page,
  pageSize,
  query = "",
  role = "all",
}: ListManagedUsersParameters = {}): Promise<UserManagementList> => {
  const sql = getSql();
  const rows = await readManagedUserRows({ sql });
  const users = rows.map(toManagedUser);
  const filteredUsers = users.filter(
    (user) =>
      (role === "all" || user.role === role) &&
      matchesUserQuery({
        query,
        user,
      }),
  );
  const safePageSize = toPageSize(pageSize);
  const totalItems = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.min(toPage(page), totalPages);
  const startIndex = (safePage - 1) * safePageSize;

  return {
    pageInfo: {
      page: safePage,
      pageSize: safePageSize,
      totalItems,
      totalPages,
    },
    summary: summarizeUsers(users),
    users: filteredUsers.slice(startIndex, startIndex + safePageSize),
  };
};

export const getManagedUser = async ({
  userId,
}: GetManagedUserParameters): Promise<ManagedUserDetails | undefined> => {
  const sql = getSql();
  return readManagedUserDetails({ sql, userId });
};

export const createManagedUser = async ({
  input,
}: CreateManagedUserParameters): Promise<ManagedUserMutationResult> => {
  const validationFailure = validateManagedUserInput({
    input,
    passwordRequired: true,
  });
  if (validationFailure !== undefined) {
    return { ok: false, reason: validationFailure };
  }

  const username = input.username.trim();
  const email = input.email.trim();
  const deeplApiKey = await readEncryptedSetting("deepl_api_key");
  const preparedProfile = await prepareUserProfileLocalizations({
    deeplApiKey,
    profile: input.profileLocalizations,
  });
  const passwordHash = await Bun.password.hash(input.password);
  const sql = getSql();

  return sql.begin<ManagedUserMutationResult>(async (transaction) => {
    await transaction`LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE`;

    const usernameConflictCount = await countIdentityConflicts({
      field: "username",
      sql: transaction,
      value: username,
    });
    if (usernameConflictCount > 0) {
      return { ok: false, reason: MANAGED_USER_FAILURE.UsernameExists };
    }

    const emailConflictCount = await countIdentityConflicts({
      field: "email",
      sql: transaction,
      value: email,
    });
    if (emailConflictCount > 0) {
      return { ok: false, reason: MANAGED_USER_FAILURE.EmailExists };
    }

    const createdRows = await transaction<Array<{ id: string }>>`
      INSERT INTO users (
        role,
        name,
        username,
        password_hash,
        email,
        avatar_url,
        bio,
        tags,
        blog_url,
        comment_email_notifications,
        new_post_email_notifications
      )
      VALUES (
        ${input.role},
        ${preparedProfile.base.name},
        ${username},
        ${passwordHash},
        ${email},
        ${toDatabaseText(input.avatarUrl)},
        ${preparedProfile.base.bio},
        ${transaction.array(preparedProfile.base.tags, 25)}::text[],
        ${toDatabaseText(input.blogUrl)},
        ${input.commentEmailNotifications},
        ${input.newPostEmailNotifications}
      )
      RETURNING id
    `;
    const createdUser = createdRows[0];
    if (createdUser === undefined) {
      return { ok: false, reason: MANAGED_USER_FAILURE.CreateFailed };
    }

    await upsertUsersEnProfile({
      profile: preparedProfile.english,
      sql: transaction,
      userId: createdUser.id,
    });

    return createMutationSuccess({
      profileTranslation: preparedProfile.translation,
      sql: transaction,
      userId: createdUser.id,
    });
  });
};

export const updateManagedUser = async ({
  actorUserId,
  input,
  userId,
}: UpdateManagedUserParameters): Promise<ManagedUserMutationResult> => {
  const validationFailure = validateManagedUserInput({
    input,
    passwordRequired: false,
  });
  if (validationFailure !== undefined) {
    return { ok: false, reason: validationFailure };
  }

  if (actorUserId === userId && input.role !== USER_ROLE.Admin) {
    return { ok: false, reason: MANAGED_USER_FAILURE.SelfRoleChange };
  }

  const username = input.username.trim();
  const email = input.email.trim();
  const deeplApiKey = await readEncryptedSetting("deepl_api_key");
  const preparedProfile = await prepareUserProfileLocalizations({
    deeplApiKey,
    profile: input.profileLocalizations,
  });
  const sql = getSql();
  let shouldClearAdminSessions = false;

  const result = await sql.begin<ManagedUserMutationResult>(async (transaction) => {
    await transaction`LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE`;

    const currentUser = await readManagedUserCredential({
      sql: transaction,
      userId,
    });
    if (currentUser === undefined) {
      return { ok: false, reason: MANAGED_USER_FAILURE.NotFound };
    }

    if (currentUser.role === USER_ROLE.Admin && input.role !== USER_ROLE.Admin) {
      const adminCount = await readAdminCount({ sql: transaction });
      if (adminCount <= 1) {
        return { ok: false, reason: MANAGED_USER_FAILURE.LastAdmin };
      }

      shouldClearAdminSessions = true;
    }

    const usernameConflictCount = await countIdentityConflicts({
      field: "username",
      sql: transaction,
      userId,
      value: username,
    });
    if (usernameConflictCount > 0) {
      return { ok: false, reason: MANAGED_USER_FAILURE.UsernameExists };
    }

    const emailConflictCount = await countIdentityConflicts({
      field: "email",
      sql: transaction,
      userId,
      value: email,
    });
    if (emailConflictCount > 0) {
      return { ok: false, reason: MANAGED_USER_FAILURE.EmailExists };
    }

    const passwordHash =
      input.password.length > 0
        ? await Bun.password.hash(input.password)
        : currentUser.passwordHash;

    const credentialsChanged = input.password.length > 0 || input.role !== currentUser.role;
    if (credentialsChanged) {
      shouldClearAdminSessions = true;
      await transaction`
        UPDATE auth_sessions
        SET revoked_at = now()
        WHERE user_id = ${userId}
          AND revoked_at IS NULL
      `;
    }

    await transaction`
      UPDATE users
      SET
        role = ${input.role},
        name = ${preparedProfile.base.name},
        username = ${username},
        password_hash = ${passwordHash},
        email = ${email},
        avatar_url = ${toDatabaseText(input.avatarUrl)},
        bio = ${preparedProfile.base.bio},
        tags = ${transaction.array(preparedProfile.base.tags, 25)}::text[],
        blog_url = ${toDatabaseText(input.blogUrl)},
        comment_email_notifications = ${input.commentEmailNotifications},
        new_post_email_notifications = ${input.newPostEmailNotifications}
      WHERE id = ${userId}
    `;

    await upsertUsersEnProfile({
      profile: preparedProfile.english,
      sql: transaction,
      userId,
    });

    return createMutationSuccess({
      profileTranslation: preparedProfile.translation,
      sql: transaction,
      userId,
    });
  });

  if (result.ok && shouldClearAdminSessions) {
    await deleteAdminSessionsForUser({ userId });
  }

  return result;
};

export const deleteManagedUser = async ({
  actorUserId,
  userId,
}: DeleteManagedUserParameters): Promise<DeleteManagedUserResult> => {
  if (actorUserId === userId) {
    return { ok: false, reason: MANAGED_USER_FAILURE.SelfDelete };
  }

  const sql = getSql();
  const result = await sql.begin<DeleteManagedUserResult>(async (transaction) => {
    await transaction`LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE`;

    const currentUser = await readManagedUserCredential({
      sql: transaction,
      userId,
    });
    if (currentUser === undefined) {
      return { ok: false, reason: MANAGED_USER_FAILURE.NotFound };
    }

    if (currentUser.role === USER_ROLE.Admin) {
      const adminCount = await readAdminCount({ sql: transaction });
      if (adminCount <= 1) {
        return { ok: false, reason: MANAGED_USER_FAILURE.LastAdmin };
      }
    }

    const deletedRows = await transaction<Array<{ id: string }>>`
      DELETE FROM users
      WHERE id = ${userId}
      RETURNING id
    `;
    if (deletedRows[0] === undefined) {
      return { ok: false, reason: MANAGED_USER_FAILURE.DeleteFailed };
    }

    return { ok: true };
  });

  if (result.ok) {
    await deleteAdminSessionsForUser({ userId });
  }

  return result;
};
