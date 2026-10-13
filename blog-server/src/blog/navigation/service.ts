import type { Sql, TransactionSql } from "postgres";

import { getSql } from "../../shared/db/postgres";

type PublicNavigationSql = Sql | TransactionSql;

type PublicNavigationRow = {
  groupId: string;
  groupName: string;
  groupNameEn: string | null;
  iconUrl: string | null;
  itemId: string;
  itemName: string;
  note: string | null;
  url: string;
};

type PublicNavigationItem = {
  iconUrl: string | null;
  id: string;
  name: string;
  note: string | null;
  url: string;
};

type PublicNavigationGroup = {
  id: string;
  items: PublicNavigationItem[];
  name: string;
  nameEn: string | null;
};

export const listPublicNavigation = async (sql: PublicNavigationSql = getSql()) => {
  const rows = await sql<PublicNavigationRow[]>`
    SELECT navigation_groups.id AS group_id,
           navigation_groups.name AS group_name,
           navigation_groups.name_en AS group_name_en,
           navigation_items.id AS item_id,
           navigation_items.name AS item_name,
           navigation_items.url,
           navigation_items.note,
           navigation_items.icon_url
    FROM navigation_groups
    INNER JOIN navigation_items ON navigation_items.group_id = navigation_groups.id
    ORDER BY navigation_groups.sort_order ASC,
             navigation_groups.created_at ASC,
             navigation_items.sort_order ASC,
             navigation_items.created_at ASC
  `;
  const groups = new Map<string, PublicNavigationGroup>();

  for (const row of rows) {
    const currentGroup =
      groups.get(row.groupId) ??
      ({
        id: row.groupId,
        items: [],
        name: row.groupName,
        nameEn: row.groupNameEn,
      } satisfies PublicNavigationGroup);
    currentGroup.items.push({
      iconUrl: row.iconUrl,
      id: row.itemId,
      name: row.itemName,
      note: row.note,
      url: row.url,
    });
    groups.set(row.groupId, currentGroup);
  }

  return { groups: [...groups.values()], ok: true };
};
