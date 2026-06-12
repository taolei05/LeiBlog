# Navigation Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a database-backed public navigation page and a same-page admin manager for ordered navigation groups and website entries.

**Architecture:** Add independent admin and public navigation modules on the Elysia server, backed by `navigation_groups` and `navigation_items`. Add a protected `website-icons` media folder. On the client, add a focused admin manager with optimistic reorder helpers and a public grouped card page, then wire both into existing navigation and routing.

**Tech Stack:** PostgreSQL, Bun, Elysia, TypeScript, React 19, HeroUI v3, React Router, native HTML drag-and-drop, Vitest/Bun test.

---

## File Structure

- `blog-server/src/db/migrations/001_initial_schema.sql`: navigation tables, constraints, indexes, triggers.
- `blog-server/src/admin/media/service.ts`: protected `website-icons` system folder.
- `blog-server/src/admin/navigation/model.ts`: admin request and response schemas.
- `blog-server/src/admin/navigation/service.ts`: navigation CRUD, moves, reorder transactions.
- `blog-server/src/admin/navigation/index.ts`: authenticated admin navigation routes.
- `blog-server/src/public/navigation/model.ts`: public response schema.
- `blog-server/src/public/navigation/service.ts`: ordered non-empty public navigation query.
- `blog-server/src/public/navigation/index.ts`: public navigation route.
- `blog-server/src/admin/index.ts`, `blog-server/src/public/index.ts`: module registration.
- `blog-server/tests/navigation.test.ts`: real PostgreSQL service behavior.
- `blog-server/tests/media.test.ts`, `blog-server/tests/http-routes.test.ts`, `blog-server/tests/migration-files.test.ts`: integration coverage.
- `blog-client/src/features/admin/content/navigation-order.ts`: pure reorder and rollback-friendly helpers.
- `blog-client/src/features/admin/content/NavigationPage.tsx`: same-page group/item manager.
- `blog-client/src/features/blog/navigation/navigation-api.ts`: public payload parsing and asset URL normalization.
- `blog-client/src/features/blog/navigation/NavigationPage.tsx`: public grouped navigation cards and directory.
- `blog-client/src/app/admin/adminNavigation.ts`, `blog-client/src/app/blog/BlogLayout.tsx`, `blog-client/src/app/router.tsx`: routes and menu entries.
- `blog-client/src/shared/icons/AppIcon.tsx`: navigation and drag/reorder icon aliases if required.
- `blog-client/src/shared/theme/layouts.css`: public and admin navigation layouts.
- `blog-client/tests/navigation-page.test.tsx`, `blog-client/tests/admin-navigation-page.test.ts`, `blog-client/tests/navigation-order.test.ts`: client behavior and ordering coverage.

### Task 1: Database Schema and Protected Website Icon Folder

**Files:**
- Modify: `blog-server/src/db/migrations/001_initial_schema.sql`
- Modify: `blog-server/src/admin/media/service.ts`
- Modify: `blog-server/tests/migration-files.test.ts`
- Modify: `blog-server/tests/media.test.ts`

- [ ] **Step 1: Write failing schema and media-folder tests**

Add assertions that the migration contains both navigation tables, a case-insensitive unique group-name index, sort indexes, no cascading group delete, and update triggers. Extend the media test to call `listMediaFolders`, assert `website-icons` is protected, try to delete it, and expect the protected-folder error.

```ts
const websiteIcons = folders.items.find((folder) => folder.slug === "website-icons");
expect(websiteIcons?.systemKey).toBe("website-icons");
expect(websiteIcons?.isProtected).toBe(true);
await expect(deleteMediaFolder(currentAdmin, websiteIcons!.id, { client: testDb, config }))
  .rejects.toThrow("系统文件夹不能删除");
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
cd blog-server
bun test tests/migration-files.test.ts tests/media.test.ts
```

Expected: FAIL because navigation tables and `website-icons` do not exist.

- [ ] **Step 3: Implement schema and protected folder**

Add:

```sql
CREATE TABLE navigation_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX navigation_groups_name_unique
ON navigation_groups (lower(name));

CREATE TABLE navigation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES navigation_groups(id) ON DELETE RESTRICT,
  name varchar(160) NOT NULL,
  url varchar(2048) NOT NULL,
  note varchar(500),
  icon_url varchar(2048),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Add ordered indexes and existing `set_updated_at` triggers. Extend `MediaSystemFolderKey` and `DEFAULT_MEDIA_FOLDERS` with:

```ts
{
  description: "导航页网站图标只能存储到这里。",
  name: "网址图标",
  slug: "website-icons",
  systemKey: "website-icons",
}
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Task 1 focused test command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add blog-server/src/db/migrations/001_initial_schema.sql blog-server/src/admin/media/service.ts blog-server/tests/migration-files.test.ts blog-server/tests/media.test.ts
git commit -m "feat: add navigation schema and icon folder"
```

### Task 2: Navigation Server Services and Routes

**Files:**
- Create: `blog-server/src/admin/navigation/model.ts`
- Create: `blog-server/src/admin/navigation/service.ts`
- Create: `blog-server/src/admin/navigation/index.ts`
- Create: `blog-server/src/public/navigation/model.ts`
- Create: `blog-server/src/public/navigation/service.ts`
- Create: `blog-server/src/public/navigation/index.ts`
- Create: `blog-server/tests/navigation.test.ts`
- Modify: `blog-server/src/admin/index.ts`
- Modify: `blog-server/src/public/index.ts`
- Modify: `blog-server/tests/http-routes.test.ts`

- [ ] **Step 1: Write failing service and route tests**

Create a real PostgreSQL test that:

```ts
const tools = await createNavigationGroup(currentAdmin, { name: "常用工具" }, testDb);
const ai = await createNavigationGroup(currentAdmin, { name: "AI 导航" }, testDb);
const item = await createNavigationItem(currentAdmin, {
  groupId: tools.id,
  name: "Can I use",
  url: "https://caniuse.com",
  note: "前端 API 兼容性查询",
}, testDb);

await reorderNavigationGroups(currentAdmin, { ids: [ai.id, tools.id] }, testDb);
await updateNavigationItem(currentAdmin, item.id, { groupId: ai.id }, testDb);
await expect(deleteNavigationGroup(currentAdmin, ai.id, testDb))
  .rejects.toThrow("请先移动或删除组内网站");

const publicGroups = await listPublicNavigation(testDb);
expect(publicGroups.map((group) => group.name)).toEqual(["AI 导航"]);
expect(publicGroups[0]?.items[0]?.url).toBe("https://caniuse.com");
```

Also test duplicate names, non-HTTP(S) URLs, incomplete/duplicate reorder IDs, item reorder, empty-group filtering, ordinary-user rejection, and expected route paths.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
cd blog-server
bun test tests/navigation.test.ts tests/http-routes.test.ts
```

Expected: FAIL because navigation modules do not exist.

- [ ] **Step 3: Implement admin model and service**

Expose:

```ts
export interface NavigationGroupInput { name: string }
export interface NavigationItemInput {
  groupId: string;
  iconUrl?: string | null;
  name: string;
  note?: string | null;
  url: string;
}
export interface NavigationReorderInput { ids: string[] }
```

Implement:

```ts
listNavigation
createNavigationGroup
updateNavigationGroup
deleteNavigationGroup
reorderNavigationGroups
createNavigationItem
updateNavigationItem
deleteNavigationItem
reorderNavigationItems
```

All mutations require `requireAdmin`. Validate trimmed names and `new URL(url).protocol` in `http:`/`https:`. Use `client.begin` transactions for reorders and cross-group moves. Validate reorder IDs exactly match the current database IDs before updates.

- [ ] **Step 4: Implement public service and route registration**

`listPublicNavigation` returns only groups with at least one item, ordered by group and item `sort_order`. Register:

```ts
adminModule.use(adminNavigationModule)
publicModule.use(publicNavigationModule)
```

Use admin prefix `/navigation` and public `GET /navigation`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the Task 2 focused test command. Expected: PASS.

- [ ] **Step 6: Run server typecheck**

```bash
cd blog-server
bun run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add blog-server/src/admin/navigation blog-server/src/public/navigation blog-server/src/admin/index.ts blog-server/src/public/index.ts blog-server/tests/navigation.test.ts blog-server/tests/http-routes.test.ts
git commit -m "feat: add navigation APIs"
```

### Task 3: Client Ordering Helpers and Admin Navigation Wiring

**Files:**
- Create: `blog-client/src/features/admin/content/navigation-order.ts`
- Create: `blog-client/tests/navigation-order.test.ts`
- Modify: `blog-client/src/app/admin/adminNavigation.ts`
- Modify: `blog-client/tests/admin-content-forms.test.ts`

- [ ] **Step 1: Write failing helper and wiring tests**

Test pure helpers:

```ts
expect(moveOrderedItem(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
expect(moveOrderedItem(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
expect(reorderByDrop(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
```

Add a source-level assertion that admin navigation contains “导航页管理” immediately after “贡献者管理”.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
cd blog-client
bun run test tests/navigation-order.test.ts tests/admin-content-forms.test.ts
```

Expected: FAIL because helpers and admin route do not exist.

- [ ] **Step 3: Implement helpers and admin wiring**

Implement immutable helpers:

```ts
export function moveOrderedItem(ids: string[], id: string, delta: -1 | 1): string[]
export function reorderByDrop(ids: string[], draggedId: string, targetId: string): string[]
```

Add the admin nav entry after contributors. Defer router wiring until the real page is created in Task 4.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Task 3 focused test command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add blog-client/src/features/admin/content/navigation-order.ts blog-client/src/app/admin/adminNavigation.ts blog-client/tests/navigation-order.test.ts blog-client/tests/admin-content-forms.test.ts
git commit -m "feat: add navigation ordering helpers"
```

### Task 4: Admin Navigation Management Page

**Files:**
- Create: `blog-client/src/features/admin/content/NavigationPage.tsx`
- Create: `blog-client/tests/admin-navigation-page.test.ts`
- Modify: `blog-client/src/app/router.tsx`
- Modify: `blog-client/src/shared/theme/layouts.css`
- Modify: `blog-client/tests/router-bundle-boundary.test.ts`

- [ ] **Step 1: Write failing admin-page tests**

Test source-visible and pure behavior:

```ts
expect(source).toContain('folderSlug="website-icons"');
expect(source).toContain('draggable');
expect(source).toContain("moveOrderedItem");
expect(source).toContain("reorderByDrop");
expect(source).toContain("请先移动或删除组内网站");
```

Test exported optimistic reorder helper usage by injecting a failing save callback and asserting rollback to the previous IDs.
Add a source-level assertion that the router contains `/admin/content/navigation`.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
cd blog-client
bun run test tests/admin-navigation-page.test.ts tests/navigation-order.test.ts
```

Expected: FAIL because the admin page does not exist.

- [ ] **Step 3: Implement same-page management**

Build `NavigationPage` with:

- `AdminDataPage` metrics.
- Group list with selection, item counts, create/edit/delete, drag handles, and up/down buttons.
- Current-group item table/cards with create/edit/delete, drag handles, and up/down buttons.
- `MediaAssetField folderSlug="website-icons"` for optional icon.
- Item group selector for cross-group moves.
- Native `draggable`, `onDragStart`, `onDragOver`, and `onDrop`.
- Shared optimistic save function that snapshots state, updates immediately, calls reorder API, and restores snapshot on error.

Use endpoints from Task 2 and preserve form state on failed saves.

- [ ] **Step 4: Add responsive admin styles**

Add focused `navigation-admin-*` classes. Keep drag handles visible on pointer-capable desktop, keep up/down controls always usable, and use a one-column group/item layout on narrow screens.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run Task 4 focused tests. Expected: PASS.

- [ ] **Step 6: Run client type and lint check**

```bash
cd blog-client
bun run check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add blog-client/src/features/admin/content/NavigationPage.tsx blog-client/src/app/router.tsx blog-client/src/shared/theme/layouts.css blog-client/tests/admin-navigation-page.test.ts
git commit -m "feat: add navigation admin manager"
```

### Task 5: Public Navigation Page and Top-Level Link

**Files:**
- Create: `blog-client/src/features/blog/navigation/navigation-api.ts`
- Create: `blog-client/src/features/blog/navigation/NavigationPage.tsx`
- Create: `blog-client/tests/navigation-page.test.tsx`
- Modify: `blog-client/src/app/blog/BlogLayout.tsx`
- Modify: `blog-client/src/app/router.tsx`
- Modify: `blog-client/src/shared/theme/layouts.css`

- [ ] **Step 1: Write failing public-page tests**

Test payload normalization filters empty groups and resolves icon assets:

```ts
expect(normalizeNavigationGroups(payload)).toEqual([
  expect.objectContaining({ name: "常用工具", items: [expect.objectContaining({ name: "Can I use" })] }),
]);
```

Render the page with fixture groups and assert:

```ts
expect(card).toHaveAttribute("target", "_blank");
expect(card).toHaveAttribute("rel", expect.stringContaining("noopener"));
expect(screen.queryByText("空分组")).toBeNull();
expect(screen.getByLabelText("导航页目录")).toBeTruthy();
```

Add a source assertion that `BlogLayout` includes a top-level `/navigation` entry and the router includes the public route.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
cd blog-client
bun run test tests/navigation-page.test.tsx
```

Expected: FAIL because public navigation modules and route do not exist.

- [ ] **Step 3: Implement API parser and public page**

Create typed groups/items, strict payload parsing, icon URL normalization, and `fetchPublicNavigation()`.

Render:

- Loading/error/empty states.
- Only non-empty grouped sections.
- Entire-card external anchors with `target="_blank"` and `rel="noopener noreferrer"`.
- Optional image icon with an `AppIcon name="link"` fallback.
- Stable section IDs and a right-side `<nav aria-label="导航页目录">`.
- Smooth anchor scrolling using CSS `scroll-behavior` and `scroll-margin-top`.

- [ ] **Step 4: Wire route, top-level nav, and responsive styles**

Add `/navigation` as a primary navigation item and public route. Add `navigation-page-*` styles for a multi-column card grid, sticky directory on desktop, hidden directory and reduced columns on small screens, plus light/dark token-based states.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run Task 5 focused tests. Expected: PASS.

- [ ] **Step 6: Run React best-practices review**

Review all new/changed TSX files for semantic anchors/buttons, hook cleanup, stable keys, alt text, and accessible drag alternatives. Fix any violations before continuing.

- [ ] **Step 7: Commit**

```bash
git add blog-client/src/features/blog/navigation blog-client/src/app/blog/BlogLayout.tsx blog-client/src/app/router.tsx blog-client/src/shared/theme/layouts.css blog-client/tests/navigation-page.test.tsx
git commit -m "feat: add public navigation page"
```

### Task 6: Full Verification and Browser Acceptance

**Files:**
- Modify only files required by failures found during verification.

- [ ] **Step 1: Run full server verification**

```bash
cd blog-server
bun run db:migrate
bun run check
```

Expected: migration succeeds; typecheck and all server tests pass.

- [ ] **Step 2: Run full client verification**

```bash
cd blog-client
bun run test
bun run check
bun run build
```

Expected: all client tests, checks, and production build pass.

- [ ] **Step 3: Start local application**

Start the existing server and client development commands using the repository’s configured environment.

- [ ] **Step 4: Browser-check public page**

Verify `/navigation` at desktop and mobile widths:

- top-level “导航页” link is visible;
- grouped card grid matches the reference hierarchy;
- sticky directory appears only on desktop;
- empty groups are absent;
- icon fallback works;
- external cards open safely in a new tab;
- light and dark themes remain readable.

- [ ] **Step 5: Browser-check admin page**

Verify `/admin/content/navigation`:

- location below contributors in sidebar;
- group and item CRUD;
- protected icon upload target;
- drag reorder saves immediately;
- up/down reorder saves immediately;
- failed reorder visibly rolls back;
- non-empty group deletion is blocked;
- moving an item to another group places it at the target end.

- [ ] **Step 6: Run final diff and regression checks**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only intended feature files and ignored `.codegraph/` state remain.
