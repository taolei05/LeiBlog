import type { Sql, TransactionSql } from "postgres";

import { getSql } from "../../shared/db/postgres";
import { translateTexts } from "../../shared/profile-tags";
import { readEncryptedSetting } from "../settings/service";

type NavigationSql = Sql | TransactionSql;

export type NavigationItem = {
  createdAt: string;
  groupId: string;
  iconUrl: string | null;
  id: string;
  name: string;
  note: string | null;
  sortOrder: number;
  updatedAt: string;
  url: string;
};

export type NavigationGroup = {
  createdAt: string;
  id: string;
  items: NavigationItem[];
  name: string;
  nameEn: string | null;
  sortOrder: number;
  updatedAt: string;
};

export type NavigationGroupInput = {
  name: string;
  nameEn?: string | null;
};

export type NavigationItemInput = {
  groupId: string;
  iconUrl?: string | null;
  name: string;
  note?: string | null;
  url: string;
};

export type NavigationReorderInput = {
  ids: string[];
};

export type NavigationItemReorderInput = NavigationReorderInput & {
  groupId: string;
};

export const NAVIGATION_FAILURE = {
  GroupHasItems: "group-has-items",
  GroupNameExists: "group-name-exists",
  GroupNotFound: "group-not-found",
  InvalidGroupName: "invalid-group-name",
  InvalidItemName: "invalid-item-name",
  InvalidOrder: "invalid-order",
  InvalidUrl: "invalid-url",
  ItemNotFound: "item-not-found",
} as const;

export type NavigationFailure = (typeof NAVIGATION_FAILURE)[keyof typeof NAVIGATION_FAILURE];

export class NavigationError extends Error {
  readonly reason: NavigationFailure;

  constructor(reason: NavigationFailure, message: string) {
    super(message);
    this.reason = reason;
  }
}

type NavigationGroupRow = {
  createdAt: Date | string;
  id: string;
  name: string;
  nameEn: string | null;
  sortOrder: number;
  updatedAt: Date | string;
};

type NavigationItemRow = {
  createdAt: Date | string;
  groupId: string;
  iconUrl: string | null;
  id: string;
  name: string;
  note: string | null;
  sortOrder: number;
  updatedAt: Date | string;
  url: string;
};

const toTimestamp = (value: Date | string) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toNavigationItem = (row: NavigationItemRow): NavigationItem => ({
  createdAt: toTimestamp(row.createdAt),
  groupId: row.groupId,
  iconUrl: row.iconUrl,
  id: row.id,
  name: row.name,
  note: row.note,
  sortOrder: row.sortOrder,
  updatedAt: toTimestamp(row.updatedAt),
  url: row.url,
});

const toNavigationGroup = (
  row: NavigationGroupRow,
  items: readonly NavigationItemRow[] = [],
): NavigationGroup => ({
  createdAt: toTimestamp(row.createdAt),
  id: row.id,
  items: items.map(toNavigationItem),
  name: row.name,
  nameEn: row.nameEn,
  sortOrder: row.sortOrder,
  updatedAt: toTimestamp(row.updatedAt),
});

const cleanRequired = ({
  message,
  reason,
  value,
}: {
  message: string;
  reason: NavigationFailure;
  value: string;
}) => {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    throw new NavigationError(reason, message);
  }

  return trimmedValue;
};

const cleanOptional = (value: string | null | undefined) => {
  const trimmedValue = value?.trim() ?? "";
  return trimmedValue.length > 0 ? trimmedValue : null;
};

const NAVIGATION_GROUP_NAME_MAX_LENGTH = 100;

const cleanOptionalGroupName = (value: string | null | undefined) => {
  const trimmedValue = cleanOptional(value);
  if (trimmedValue === null) {
    return null;
  }

  const truncatedValue = trimmedValue.slice(0, NAVIGATION_GROUP_NAME_MAX_LENGTH).trim();
  return truncatedValue.length > 0 ? truncatedValue : null;
};

const readNavigationGroupNameTranslation = async (name: string) => {
  const apiKey = (await readEncryptedSetting("deepl_api_key"))?.trim();
  if (apiKey === undefined || apiKey.length === 0) {
    return null;
  }

  const translatedTexts = await translateTexts({
    apiKey,
    sourceLocale: "zh-CN",
    targetLocale: "en",
    texts: [name],
  });

  return cleanOptionalGroupName(translatedTexts[0]);
};

const resolveNavigationGroupNameEn = async ({
  name,
  nameEn,
}: {
  name: string;
  nameEn: string | null;
}) => {
  if (nameEn !== null) {
    return nameEn;
  }

  return readNavigationGroupNameTranslation(name);
};

const cleanHttpUrl = (value: string) => {
  const trimmedValue = cleanRequired({
    message: "Website URL is required.",
    reason: NAVIGATION_FAILURE.InvalidUrl,
    value,
  });

  try {
    const url = new URL(trimmedValue);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return trimmedValue;
    }
  } catch {
    throw new NavigationError(NAVIGATION_FAILURE.InvalidUrl, "Website URL is invalid.");
  }

  throw new NavigationError(NAVIGATION_FAILURE.InvalidUrl, "Website URL must use http or https.");
};

const readNavigationGroupRow = async ({
  groupId,
  sql,
}: {
  groupId: string;
  sql: NavigationSql;
}) => {
  const [row] = await sql<NavigationGroupRow[]>`
    SELECT id, name, name_en, sort_order, created_at, updated_at
    FROM navigation_groups
    WHERE id = ${groupId}
  `;

  if (row === undefined) {
    throw new NavigationError(NAVIGATION_FAILURE.GroupNotFound, "Navigation group was not found.");
  }

  return row;
};

const readNavigationItemRow = async ({ itemId, sql }: { itemId: string; sql: NavigationSql }) => {
  const [row] = await sql<NavigationItemRow[]>`
    SELECT id, group_id, name, url, note, icon_url, sort_order, created_at, updated_at
    FROM navigation_items
    WHERE id = ${itemId}
  `;

  if (row === undefined) {
    throw new NavigationError(NAVIGATION_FAILURE.ItemNotFound, "Navigation item was not found.");
  }

  return row;
};

const ensureUniqueGroupName = async ({
  exceptId,
  name,
  sql,
}: {
  exceptId?: string;
  name: string;
  sql: NavigationSql;
}) => {
  const [row] = await sql<{ id: string }[]>`
    SELECT id
    FROM navigation_groups
    WHERE lower(name) = lower(${name})
      AND (${exceptId ?? null}::uuid IS NULL OR id <> ${exceptId ?? null})
    LIMIT 1
  `;

  if (row !== undefined) {
    throw new NavigationError(
      NAVIGATION_FAILURE.GroupNameExists,
      "Navigation group name already exists.",
    );
  }
};

const validateExactIds = ({
  actualIds,
  message,
  requestedIds,
}: {
  actualIds: readonly string[];
  message: string;
  requestedIds: readonly string[];
}) => {
  if (
    actualIds.length !== requestedIds.length ||
    new Set(requestedIds).size !== requestedIds.length ||
    actualIds.some((id) => !requestedIds.includes(id))
  ) {
    throw new NavigationError(NAVIGATION_FAILURE.InvalidOrder, message);
  }
};

export const listNavigation = async () => {
  const sql = getSql();
  const groups = await sql<NavigationGroupRow[]>`
    SELECT id, name, name_en, sort_order, created_at, updated_at
    FROM navigation_groups
    ORDER BY sort_order ASC, created_at ASC
  `;
  const items = await sql<NavigationItemRow[]>`
    SELECT id, group_id, name, url, note, icon_url, sort_order, created_at, updated_at
    FROM navigation_items
    ORDER BY group_id, sort_order ASC, created_at ASC
  `;

  return {
    groups: groups.map((group) =>
      toNavigationGroup(
        group,
        items.filter((item) => item.groupId === group.id),
      ),
    ),
    ok: true,
  };
};

export const createNavigationGroup = async (input: NavigationGroupInput) => {
  const sql = getSql();
  const name = cleanRequired({
    message: "Navigation group name is required.",
    reason: NAVIGATION_FAILURE.InvalidGroupName,
    value: input.name,
  });
  const nameEn = await resolveNavigationGroupNameEn({
    name,
    nameEn: cleanOptionalGroupName(input.nameEn),
  });

  await ensureUniqueGroupName({ name, sql });
  const [row] = await sql<NavigationGroupRow[]>`
    INSERT INTO navigation_groups (name, name_en, sort_order)
    VALUES (
      ${name},
      ${nameEn},
      (SELECT coalesce(max(sort_order), -1) + 1 FROM navigation_groups)
    )
    RETURNING id, name, name_en, sort_order, created_at, updated_at
  `;

  return toNavigationGroup(row);
};

export const updateNavigationGroup = async ({
  groupId,
  input,
}: {
  groupId: string;
  input: NavigationGroupInput;
}) => {
  const sql = getSql();
  await readNavigationGroupRow({ groupId, sql });
  const name = cleanRequired({
    message: "Navigation group name is required.",
    reason: NAVIGATION_FAILURE.InvalidGroupName,
    value: input.name,
  });
  const nameEn = await resolveNavigationGroupNameEn({
    name,
    nameEn: cleanOptionalGroupName(input.nameEn),
  });

  await ensureUniqueGroupName({ exceptId: groupId, name, sql });
  const [row] = await sql<NavigationGroupRow[]>`
    UPDATE navigation_groups
    SET name = ${name},
        name_en = ${nameEn}
    WHERE id = ${groupId}
    RETURNING id, name, name_en, sort_order, created_at, updated_at
  `;

  return toNavigationGroup(row);
};

export const deleteNavigationGroup = async ({ groupId }: { groupId: string }) => {
  const sql = getSql();
  await readNavigationGroupRow({ groupId, sql });
  const [count] = await sql<{ total: string | number | bigint }[]>`
    SELECT count(*) AS total
    FROM navigation_items
    WHERE group_id = ${groupId}
  `;

  if (Number(count?.total ?? 0) > 0) {
    throw new NavigationError(
      NAVIGATION_FAILURE.GroupHasItems,
      "Move or delete the websites in this group first.",
    );
  }

  await sql`DELETE FROM navigation_groups WHERE id = ${groupId}`;
  return { ok: true };
};

export const reorderNavigationGroups = async (input: NavigationReorderInput) => {
  const sql = getSql();

  await sql.begin(async (transaction) => {
    const rows = await transaction<{ id: string }[]>`SELECT id FROM navigation_groups FOR UPDATE`;
    validateExactIds({
      actualIds: rows.map((row) => row.id),
      message: "Order list must contain every navigation group.",
      requestedIds: input.ids,
    });

    for (const [sortOrder, id] of input.ids.entries()) {
      await transaction`UPDATE navigation_groups SET sort_order = ${sortOrder} WHERE id = ${id}`;
    }
  });

  return { ok: true };
};

export const createNavigationItem = async (input: NavigationItemInput) => {
  const sql = getSql();
  await readNavigationGroupRow({ groupId: input.groupId, sql });
  const name = cleanRequired({
    message: "Website name is required.",
    reason: NAVIGATION_FAILURE.InvalidItemName,
    value: input.name,
  });
  const url = cleanHttpUrl(input.url);
  const [row] = await sql<NavigationItemRow[]>`
    INSERT INTO navigation_items (group_id, name, url, note, icon_url, sort_order)
    VALUES (
      ${input.groupId},
      ${name},
      ${url},
      ${cleanOptional(input.note)},
      ${cleanOptional(input.iconUrl)},
      (
        SELECT coalesce(max(sort_order), -1) + 1
        FROM navigation_items
        WHERE group_id = ${input.groupId}
      )
    )
    RETURNING id, group_id, name, url, note, icon_url, sort_order, created_at, updated_at
  `;

  return toNavigationItem(row);
};

export const updateNavigationItem = async ({
  input,
  itemId,
}: {
  input: NavigationItemInput;
  itemId: string;
}) => {
  const sql = getSql();
  const existing = await readNavigationItemRow({ itemId, sql });
  await readNavigationGroupRow({ groupId: input.groupId, sql });
  const name = cleanRequired({
    message: "Website name is required.",
    reason: NAVIGATION_FAILURE.InvalidItemName,
    value: input.name,
  });
  const url = cleanHttpUrl(input.url);

  return sql.begin(async (transaction) => {
    const sortOrder =
      existing.groupId === input.groupId
        ? existing.sortOrder
        : Number(
            (
              await transaction<{ sortOrder: number | string }[]>`
                SELECT coalesce(max(sort_order), -1) + 1 AS sort_order
                FROM navigation_items
                WHERE group_id = ${input.groupId}
              `
            )[0]?.sortOrder ?? 0,
          );
    const [row] = await transaction<NavigationItemRow[]>`
      UPDATE navigation_items
      SET group_id = ${input.groupId},
          name = ${name},
          url = ${url},
          note = ${cleanOptional(input.note)},
          icon_url = ${cleanOptional(input.iconUrl)},
          sort_order = ${sortOrder}
      WHERE id = ${itemId}
      RETURNING id, group_id, name, url, note, icon_url, sort_order, created_at, updated_at
    `;

    return toNavigationItem(row);
  });
};

export const deleteNavigationItem = async ({ itemId }: { itemId: string }) => {
  const sql = getSql();
  await readNavigationItemRow({ itemId, sql });
  await sql`DELETE FROM navigation_items WHERE id = ${itemId}`;
  return { ok: true };
};

export const reorderNavigationItems = async (input: NavigationItemReorderInput) => {
  const sql = getSql();
  await readNavigationGroupRow({ groupId: input.groupId, sql });

  await sql.begin(async (transaction) => {
    const rows = await transaction<{ id: string }[]>`
      SELECT id
      FROM navigation_items
      WHERE group_id = ${input.groupId}
      FOR UPDATE
    `;
    validateExactIds({
      actualIds: rows.map((row) => row.id),
      message: "Order list must contain every website in the group.",
      requestedIds: input.ids,
    });

    for (const [sortOrder, id] of input.ids.entries()) {
      await transaction`UPDATE navigation_items SET sort_order = ${sortOrder} WHERE id = ${id}`;
    }
  });

  return { ok: true };
};
