import { t } from "elysia";

const NavigationItem = t.Object({
  createdAt: t.String(),
  groupId: t.String(),
  iconUrl: t.Nullable(t.String()),
  id: t.String(),
  name: t.String(),
  note: t.Nullable(t.String()),
  sortOrder: t.Number(),
  updatedAt: t.String(),
  url: t.String(),
});

const NavigationGroup = t.Object({
  createdAt: t.String(),
  id: t.String(),
  items: t.Array(NavigationItem),
  name: t.String(),
  sortOrder: t.Number(),
  updatedAt: t.String(),
});

export const IdParams = t.Object({ id: t.String() });

export const NavigationGroupBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
});

export const NavigationItemBody = t.Object({
  groupId: t.String(),
  iconUrl: t.Optional(t.Nullable(t.String({ maxLength: 2048 }))),
  name: t.String({ minLength: 1, maxLength: 160 }),
  note: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
  url: t.String({ minLength: 1, maxLength: 2048 }),
});

export const NavigationReorderBody = t.Object({
  ids: t.Array(t.String()),
});

export const NavigationItemReorderBody = t.Object({
  groupId: t.String(),
  ids: t.Array(t.String()),
});

export const NavigationListResponse = t.Object({
  groups: t.Array(NavigationGroup),
  ok: t.Boolean(),
});

export const NavigationGroupResponse = t.Object({
  item: NavigationGroup,
  ok: t.Boolean(),
});

export const NavigationItemResponse = t.Object({
  item: NavigationItem,
  ok: t.Boolean(),
});

export const OkResponse = t.Object({ ok: t.Boolean() });
