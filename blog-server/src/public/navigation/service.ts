import { db, type DbClient } from "../../shared/db";

interface NavigationRow {
  group_id: string;
  group_name: string;
  icon_url: string | null;
  item_id: string;
  item_name: string;
  note: string | null;
  url: string;
}

export async function listPublicNavigation(client: DbClient = db) {
  const rows = await client<NavigationRow[]>`
    SELECT ng.id AS group_id,
           ng.name AS group_name,
           ni.id AS item_id,
           ni.name AS item_name,
           ni.url,
           ni.note,
           ni.icon_url
    FROM navigation_groups ng
    INNER JOIN navigation_items ni ON ni.group_id = ng.id
    ORDER BY ng.sort_order ASC, ng.created_at ASC, ni.sort_order ASC, ni.created_at ASC
  `;
  const groups = new Map<string, {
    id: string;
    items: Array<{
      iconUrl: string | null;
      id: string;
      name: string;
      note: string | null;
      url: string;
    }>;
    name: string;
  }>();

  for (const row of rows) {
    const group = groups.get(row.group_id) ?? {
      id: row.group_id,
      items: [],
      name: row.group_name,
    };
    group.items.push({
      iconUrl: row.icon_url,
      id: row.item_id,
      name: row.item_name,
      note: row.note,
      url: row.url,
    });
    groups.set(row.group_id, group);
  }

  return { groups: [...groups.values()], ok: true };
}
