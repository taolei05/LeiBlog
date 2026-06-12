import { t } from "elysia";

const PublicNavigationItem = t.Object({
  iconUrl: t.Nullable(t.String()),
  id: t.String(),
  name: t.String(),
  note: t.Nullable(t.String()),
  url: t.String(),
});

const PublicNavigationGroup = t.Object({
  id: t.String(),
  items: t.Array(PublicNavigationItem),
  name: t.String(),
});

export const PublicNavigationResponse = t.Object({
  groups: t.Array(PublicNavigationGroup),
  ok: t.Boolean(),
});
