import { requireAdmin, type AuthUser } from "../../shared/auth";
import { db, withTransaction, type DbClient } from "../../shared/db";
import { conflict, notFound, validationError } from "../../shared/errors";

export interface NavigationGroupInput {
  name: string;
}

export interface NavigationItemInput {
  groupId: string;
  iconUrl?: string | null;
  name: string;
  note?: string | null;
  url: string;
}

export interface NavigationReorderInput {
  ids: string[];
}

export interface NavigationItemReorderInput extends NavigationReorderInput {
  groupId: string;
}

interface NavigationGroupRow {
  created_at: Date | string;
  id: string;
  name: string;
  sort_order: number;
  updated_at: Date | string;
}

interface NavigationItemRow {
  created_at: Date | string;
  group_id: string;
  icon_url: string | null;
  id: string;
  name: string;
  note: string | null;
  sort_order: number;
  updated_at: Date | string;
  url: string;
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNavigationItem(row: NavigationItemRow) {
  return {
    createdAt: toIso(row.created_at),
    groupId: row.group_id,
    iconUrl: row.icon_url,
    id: row.id,
    name: row.name,
    note: row.note,
    sortOrder: row.sort_order,
    updatedAt: toIso(row.updated_at),
    url: row.url,
  };
}

function toNavigationGroup(row: NavigationGroupRow, items: NavigationItemRow[] = []) {
  return {
    createdAt: toIso(row.created_at),
    id: row.id,
    items: items.map(toNavigationItem),
    name: row.name,
    sortOrder: row.sort_order,
    updatedAt: toIso(row.updated_at),
  };
}

function cleanRequired(value: string, message: string) {
  const trimmed = value.trim();
  if (!trimmed) throw validationError(message);
  return trimmed;
}

function cleanOptional(value: string | null | undefined) {
  if (value === null) return null;
  const trimmed = value?.trim();
  return trimmed || null;
}

function cleanHttpUrl(value: string) {
  const trimmed = cleanRequired(value, "网址不能为空");

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw validationError("网址仅支持 http 或 https");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "网址仅支持 http 或 https") throw error;
    throw validationError("网址格式无效");
  }

  return trimmed;
}

async function getNavigationGroupRow(id: string, client: DbClient) {
  const [row] = await client<NavigationGroupRow[]>`
    SELECT id, name, sort_order, created_at, updated_at
    FROM navigation_groups
    WHERE id = ${id}
  `;
  if (!row) throw notFound("导航分组不存在");
  return row;
}

async function getNavigationItemRow(id: string, client: DbClient) {
  const [row] = await client<NavigationItemRow[]>`
    SELECT id, group_id, name, url, note, icon_url, sort_order, created_at, updated_at
    FROM navigation_items
    WHERE id = ${id}
  `;
  if (!row) throw notFound("导航网站不存在");
  return row;
}

async function ensureUniqueGroupName(name: string, client: DbClient, exceptId?: string) {
  const [row] = await client<{ id: string }[]>`
    SELECT id
    FROM navigation_groups
    WHERE lower(name) = lower(${name})
      AND (${exceptId ?? null}::uuid IS NULL OR id <> ${exceptId ?? null})
    LIMIT 1
  `;
  if (row) throw conflict("导航分组名称已存在");
}

function validateExactIds(actualIds: string[], requestedIds: string[], message: string) {
  if (
    actualIds.length !== requestedIds.length ||
    new Set(requestedIds).size !== requestedIds.length ||
    actualIds.some((id) => !requestedIds.includes(id))
  ) {
    throw validationError(message);
  }
}

export async function listNavigation(currentUser: AuthUser, client: DbClient = db) {
  requireAdmin(currentUser);
  const groups = await client<NavigationGroupRow[]>`
    SELECT id, name, sort_order, created_at, updated_at
    FROM navigation_groups
    ORDER BY sort_order ASC, created_at ASC
  `;
  const items = await client<NavigationItemRow[]>`
    SELECT id, group_id, name, url, note, icon_url, sort_order, created_at, updated_at
    FROM navigation_items
    ORDER BY group_id, sort_order ASC, created_at ASC
  `;

  return {
    ok: true,
    groups: groups.map((group) =>
      toNavigationGroup(group, items.filter((item) => item.group_id === group.id))
    ),
  };
}

export async function createNavigationGroup(
  currentUser: AuthUser,
  input: NavigationGroupInput,
  client: DbClient = db
) {
  requireAdmin(currentUser);
  const name = cleanRequired(input.name, "导航分组名称不能为空");
  await ensureUniqueGroupName(name, client);
  const [row] = await client<NavigationGroupRow[]>`
    INSERT INTO navigation_groups (name, sort_order)
    VALUES (
      ${name},
      (SELECT coalesce(max(sort_order), -1) + 1 FROM navigation_groups)
    )
    RETURNING id, name, sort_order, created_at, updated_at
  `;
  return toNavigationGroup(row);
}

export async function updateNavigationGroup(
  currentUser: AuthUser,
  id: string,
  input: NavigationGroupInput,
  client: DbClient = db
) {
  requireAdmin(currentUser);
  await getNavigationGroupRow(id, client);
  const name = cleanRequired(input.name, "导航分组名称不能为空");
  await ensureUniqueGroupName(name, client, id);
  const [row] = await client<NavigationGroupRow[]>`
    UPDATE navigation_groups
    SET name = ${name}
    WHERE id = ${id}
    RETURNING id, name, sort_order, created_at, updated_at
  `;
  return toNavigationGroup(row);
}

export async function deleteNavigationGroup(
  currentUser: AuthUser,
  id: string,
  client: DbClient = db
) {
  requireAdmin(currentUser);
  await getNavigationGroupRow(id, client);
  const [count] = await client<{ total: string | number | bigint }[]>`
    SELECT count(*) AS total
    FROM navigation_items
    WHERE group_id = ${id}
  `;
  if (Number(count?.total ?? 0) > 0) {
    throw validationError("请先移动或删除组内网站");
  }
  await client`DELETE FROM navigation_groups WHERE id = ${id}`;
  return { ok: true };
}

export async function reorderNavigationGroups(
  currentUser: AuthUser,
  input: NavigationReorderInput,
  client: DbClient = db
) {
  requireAdmin(currentUser);
  return withTransaction(async (tx) => {
    const rows = await tx<{ id: string }[]>`SELECT id FROM navigation_groups FOR UPDATE`;
    validateExactIds(
      rows.map((row) => row.id),
      input.ids,
      "排序列表必须包含全部导航分组"
    );
    for (const [sortOrder, id] of input.ids.entries()) {
      await tx`UPDATE navigation_groups SET sort_order = ${sortOrder} WHERE id = ${id}`;
    }
    return { ok: true };
  }, client);
}

export async function createNavigationItem(
  currentUser: AuthUser,
  input: NavigationItemInput,
  client: DbClient = db
) {
  requireAdmin(currentUser);
  await getNavigationGroupRow(input.groupId, client);
  const name = cleanRequired(input.name, "网站名称不能为空");
  const url = cleanHttpUrl(input.url);
  const [row] = await client<NavigationItemRow[]>`
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
}

export async function updateNavigationItem(
  currentUser: AuthUser,
  id: string,
  input: NavigationItemInput,
  client: DbClient = db
) {
  requireAdmin(currentUser);
  const existing = await getNavigationItemRow(id, client);
  await getNavigationGroupRow(input.groupId, client);
  const name = cleanRequired(input.name, "网站名称不能为空");
  const url = cleanHttpUrl(input.url);

  return withTransaction(async (tx) => {
    const sortOrder =
      existing.group_id === input.groupId
        ? existing.sort_order
        : Number(
            (
              await tx<{ sort_order: number }[]>`
                SELECT coalesce(max(sort_order), -1) + 1 AS sort_order
                FROM navigation_items
                WHERE group_id = ${input.groupId}
              `
            )[0]?.sort_order ?? 0
          );
    const [row] = await tx<NavigationItemRow[]>`
      UPDATE navigation_items
      SET group_id = ${input.groupId},
          name = ${name},
          url = ${url},
          note = ${cleanOptional(input.note)},
          icon_url = ${cleanOptional(input.iconUrl)},
          sort_order = ${sortOrder}
      WHERE id = ${id}
      RETURNING id, group_id, name, url, note, icon_url, sort_order, created_at, updated_at
    `;
    return toNavigationItem(row);
  }, client);
}

export async function deleteNavigationItem(
  currentUser: AuthUser,
  id: string,
  client: DbClient = db
) {
  requireAdmin(currentUser);
  await getNavigationItemRow(id, client);
  await client`DELETE FROM navigation_items WHERE id = ${id}`;
  return { ok: true };
}

export async function reorderNavigationItems(
  currentUser: AuthUser,
  input: NavigationItemReorderInput,
  client: DbClient = db
) {
  requireAdmin(currentUser);
  await getNavigationGroupRow(input.groupId, client);
  return withTransaction(async (tx) => {
    const rows = await tx<{ id: string }[]>`
      SELECT id
      FROM navigation_items
      WHERE group_id = ${input.groupId}
      FOR UPDATE
    `;
    validateExactIds(
      rows.map((row) => row.id),
      input.ids,
      "排序列表必须包含组内全部网站"
    );
    for (const [sortOrder, id] of input.ids.entries()) {
      await tx`UPDATE navigation_items SET sort_order = ${sortOrder} WHERE id = ${id}`;
    }
    return { ok: true };
  }, client);
}
