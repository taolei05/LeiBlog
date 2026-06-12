# Comment Email Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-out comment email notifications for all enabled administrators and for users whose comments receive direct replies.

**Architecture:** Store one default-enabled notification preference on each user and expose it through the existing `/api/me` profile plus a focused preference update route. Add a comment notification service that resolves recipients and renders emails after comment creation, then trigger it without blocking the comment response. Reuse the current Resend sender and LeiBlog email shell, and add matching switches to the existing administrator settings and front-end personal center.

**Tech Stack:** PostgreSQL, Bun, Elysia 1.4, TypeScript, React 19, HeroUI v3, Resend HTTP API, Bun test, Vitest.

---

## File Structure

- `blog-server/src/db/migrations/001_initial_schema.sql`: add the preference to fresh databases.
- `blog-server/src/db/migrations/003_add_comment_email_notifications.sql`: add the preference to existing databases.
- `blog-server/src/shared/types/user.ts`: expose the preference in all user profiles.
- `blog-server/src/auth/service.ts`: keep profile projections complete and add the reusable comment notification email renderer.
- `blog-server/src/admin/users/service.ts`: keep administrator user profile projections complete.
- `blog-server/src/me/model.ts`: validate the preference update request.
- `blog-server/src/me/service.ts`: read and update the current user's preference.
- `blog-server/src/me/index.ts`: register `PATCH /api/me/preferences`.
- `blog-server/src/public/comments/notification.ts`: resolve notification context, recipients, deduplication, rendering, sending, and failure isolation.
- `blog-server/src/public/comments/service.ts`: schedule notifications only after a comment is committed.
- `blog-server/tests/migration-files.test.ts`: verify baseline and incremental schema.
- `blog-server/tests/auth-users.test.ts`: verify profile preference reads and updates.
- `blog-server/tests/comment-notifications.test.ts`: verify recipients, content, escaping, deduplication, and send failures.
- `blog-server/tests/comments.test.ts`: verify notification failures do not fail comment creation.
- `blog-client/src/features/admin/system/ProfilePage.tsx`: rename “偏好” and add the administrator switch.
- `blog-client/src/features/blog/auth/AuthPages.tsx`: parse, persist, and display the personal-center preference.
- `blog-client/src/shared/theme/layouts.css`: provide a restrained shared preference-row layout if HeroUI defaults are insufficient.
- `blog-client/tests/comment-notification-preferences.test.tsx`: verify administrator and front-end preference UI wiring.

### Task 1: Persist and Expose the User Preference

**Files:**
- Create: `blog-server/src/db/migrations/003_add_comment_email_notifications.sql`
- Modify: `blog-server/src/db/migrations/001_initial_schema.sql`
- Modify: `blog-server/src/shared/types/user.ts`
- Modify: `blog-server/src/auth/service.ts`
- Modify: `blog-server/src/admin/users/service.ts`
- Modify: `blog-server/src/me/service.ts`
- Modify: `blog-server/tests/migration-files.test.ts`
- Modify: `blog-server/tests/auth-users.test.ts`

- [ ] **Step 1: Write failing migration and profile tests**

Update the expected migration list and assert both fresh and incremental schemas contain the default-enabled field:

```ts
expect(migrationFiles).toEqual([
  "001_initial_schema.sql",
  "002_add_navigation_page.sql",
  "003_add_comment_email_notifications.sql",
]);
expect(migration).toContain(
  "comment_email_notifications_enabled boolean NOT NULL DEFAULT true",
);
expect(commentNotificationMigration).toContain(
  "ADD COLUMN IF NOT EXISTS comment_email_notifications_enabled boolean NOT NULL DEFAULT true",
);
```

Extend the profile service test:

```ts
const profile = await getUserProfile(user.id, testDb);
expect(profile.commentEmailNotificationsEnabled).toBe(true);
```

- [ ] **Step 2: Run focused tests and verify RED**

```bash
cd blog-server
bun test tests/migration-files.test.ts tests/auth-users.test.ts
```

Expected: FAIL because the migration and profile field do not exist.

- [ ] **Step 3: Add the baseline and incremental migration**

Add to `users` in `001_initial_schema.sql`:

```sql
comment_email_notifications_enabled boolean NOT NULL DEFAULT true,
```

Create `003_add_comment_email_notifications.sql`:

```sql
ALTER TABLE users
ADD COLUMN IF NOT EXISTS comment_email_notifications_enabled boolean NOT NULL DEFAULT true;
```

- [ ] **Step 4: Extend the shared user profile mapping**

Add the same camel-case field to `UserProfileSchema` and `UserProfile`, the snake-case field to `UserProfileRow`, and map it:

```ts
commentEmailNotificationsEnabled: row.comment_email_notifications_enabled,
```

Update every full user-profile projection in:

- `blog-server/src/auth/service.ts`
- `blog-server/src/admin/users/service.ts`
- `blog-server/src/me/service.ts`

Each projection must select:

```sql
comment_email_notifications_enabled
```

Any manually constructed `UserProfileRow` must set:

```ts
comment_email_notifications_enabled: true,
```

- [ ] **Step 5: Run focused tests and server typecheck**

```bash
cd blog-server
bun test tests/migration-files.test.ts tests/auth-users.test.ts
bun run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add blog-server/src/db/migrations/001_initial_schema.sql blog-server/src/db/migrations/003_add_comment_email_notifications.sql blog-server/src/shared/types/user.ts blog-server/src/auth/service.ts blog-server/src/admin/users/service.ts blog-server/src/me/service.ts blog-server/tests/migration-files.test.ts blog-server/tests/auth-users.test.ts
git commit -m "feat: add comment email notification preference"
```

### Task 2: Add the Current-User Preference API

**Files:**
- Modify: `blog-server/src/me/model.ts`
- Modify: `blog-server/src/me/service.ts`
- Modify: `blog-server/src/me/index.ts`
- Modify: `blog-server/tests/auth-users.test.ts`
- Modify: `blog-server/tests/http-routes.test.ts`

- [ ] **Step 1: Write failing service and route tests**

Add a service test:

```ts
const disabled = await updateMyPreferences(
  user.id,
  { commentEmailNotificationsEnabled: false },
  testDb,
);
expect(disabled.commentEmailNotificationsEnabled).toBe(false);

const refreshed = await getUserProfile(user.id, testDb);
expect(refreshed.commentEmailNotificationsEnabled).toBe(false);
```

Add a route-source assertion for:

```ts
.patch("/preferences"
```

- [ ] **Step 2: Run focused tests and verify RED**

```bash
cd blog-server
bun test tests/auth-users.test.ts tests/http-routes.test.ts
```

Expected: FAIL because `updateMyPreferences` and the route do not exist.

- [ ] **Step 3: Add request schema and service**

In `me/model.ts`:

```ts
export const UpdateMyPreferencesBody = t.Object({
  commentEmailNotificationsEnabled: t.Boolean(),
});
```

In `me/service.ts`:

```ts
export interface UpdateMyPreferencesInput {
  commentEmailNotificationsEnabled: boolean;
}

export async function updateMyPreferences(
  userId: string,
  input: UpdateMyPreferencesInput,
  client: DbClient = db,
) {
  await client`
    UPDATE users
    SET comment_email_notifications_enabled = ${input.commentEmailNotificationsEnabled},
        updated_at = now()
    WHERE id = ${userId}
  `;

  return getUserProfile(userId, client);
}
```

- [ ] **Step 4: Register the authenticated route**

Add:

```ts
.patch("/preferences", async ({ currentUser, body }) => ({
  ok: true,
  user: await updateMyPreferences(currentUser.id, body),
}), {
  body: UpdateMyPreferencesBody,
  response: { 200: MeResponse },
})
```

- [ ] **Step 5: Run focused tests and server typecheck**

```bash
cd blog-server
bun test tests/auth-users.test.ts tests/http-routes.test.ts
bun run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add blog-server/src/me/model.ts blog-server/src/me/service.ts blog-server/src/me/index.ts blog-server/tests/auth-users.test.ts blog-server/tests/http-routes.test.ts
git commit -m "feat: add comment notification preference API"
```

### Task 3: Add the Comment Notification Email Template

**Files:**
- Modify: `blog-server/src/auth/service.ts`
- Create: `blog-server/tests/comment-notifications.test.ts`

- [ ] **Step 1: Write failing renderer tests**

Test exact requested wording and HTML escaping:

```ts
const html = renderCommentNotificationEmailHtml({
  content: `<script>alert("x")</script>`,
  description: "张三在《测试文章》文章评论了：",
  title: "新的文章评论",
});

expect(html).toContain("张三在《测试文章》文章评论了：");
expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
expect(html).not.toContain("<script>");
expect(html).toContain("LeiBlog");
```

- [ ] **Step 2: Run focused test and verify RED**

```bash
cd blog-server
bun test tests/comment-notifications.test.ts
```

Expected: FAIL because the renderer does not exist.

- [ ] **Step 3: Implement the renderer using the existing email shell**

Export a focused renderer from `auth/service.ts`:

```ts
export function renderCommentNotificationEmailHtml({
  content,
  description,
  title,
}: {
  content: string;
  description: string;
  title: string;
}) {
  return renderLeiBlogEmailHtml({
    bodyHtml: `
      <p style="margin:0 0 14px;color:#52525b;font-size:15px;line-height:1.7;">${escapeHtml(description)}</p>
      <div style="padding:16px 18px;border:1px solid #f0abfc;border-radius:18px;background:#fdf4ff;color:#3f3f46;font-size:14px;line-height:1.7;white-space:pre-wrap;word-break:break-word;">${escapeHtml(content)}</div>
    `,
    preheader: `${description}${content}`,
    title,
  });
}
```

- [ ] **Step 4: Run focused test and server typecheck**

```bash
cd blog-server
bun test tests/comment-notifications.test.ts
bun run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add blog-server/src/auth/service.ts blog-server/tests/comment-notifications.test.ts
git commit -m "feat: add comment notification email template"
```

### Task 4: Resolve and Send Comment Notifications

**Files:**
- Create: `blog-server/src/public/comments/notification.ts`
- Modify: `blog-server/tests/comment-notifications.test.ts`

- [ ] **Step 1: Write failing recipient and send tests**

Create a real PostgreSQL fixture with:

- Two enabled administrators with different emails.
- One disabled administrator.
- One administrator without an email.
- A comment author with a name.
- A direct parent author with notifications enabled.
- An unrelated thread participant.

Assert:

```ts
const notifications = await resolveCommentNotifications(reply.id, testDb);

expect(notifications.map((item) => item.to)).toEqual([
  "admin-one@example.com",
  "admin-two@example.com",
  "parent@example.com",
]);
expect(notifications[0]?.kind).toBe("admin");
expect(notifications[2]?.kind).toBe("reply");
expect(notifications.every((item) => !item.to.includes("unrelated"))).toBe(true);
```

Also cover:

```ts
expect(await resolveCommentNotifications(selfReply.id, testDb))
  .not.toContainEqual(expect.objectContaining({ kind: "reply" }));

expect(await resolveCommentNotifications(adminParentReply.id, testDb))
  .toHaveLength(1);
```

Because the database already enforces case-insensitive unique user emails, test defensive email deduplication through an exported pure recipient-merging helper:

```ts
const notification = {
  content: "内容",
  description: "描述：",
  kind: "admin" as const,
  subject: "主题",
};

expect(
  mergeCommentNotificationRecipients([
    { ...notification, to: "Admin@Example.com" },
    { ...notification, to: " admin@example.com " },
  ]),
).toEqual([expect.objectContaining({ kind: "admin", to: "admin@example.com" })]);
```

Mock `globalThis.fetch` and assert article/guestbook text and subjects are sent through Resend. Make one mocked send reject and assert the other recipients are still attempted.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
cd blog-server
bun test tests/comment-notifications.test.ts
```

Expected: FAIL because the notification service does not exist.

- [ ] **Step 3: Implement context and recipient resolution**

Create types:

```ts
export type CommentNotificationKind = "admin" | "reply";

export interface CommentEmailNotification {
  content: string;
  description: string;
  kind: CommentNotificationKind;
  subject: string;
  to: string;
}
```

Query the created comment, author, article title, direct parent author, parent preference, and all enabled administrators. Resolve the author display name with:

```ts
const displayName = row.author_name?.trim() || row.author_username;
const targetName = row.target_type === "guestbook" ? "留言板" : `《${row.article_title}》文章`;
```

Normalize and validate recipient emails:

```ts
function normalizeRecipientEmail(value: string | null) {
  const email = value?.trim().toLowerCase() ?? "";
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function mergeCommentNotificationRecipients(
  notifications: CommentEmailNotification[],
) {
  const byEmail = new Map<string, CommentEmailNotification>();

  for (const notification of notifications) {
    const email = normalizeRecipientEmail(notification.to);
    if (!email || byEmail.has(email)) continue;
    byEmail.set(email, { ...notification, to: email });
  }

  return [...byEmail.values()];
}
```

Build candidate notifications with all administrators first, followed by the direct parent author's reply notification only when the parent author differs from the reply author. Pass the candidates to `mergeCommentNotificationRecipients`; administrator notifications win because they appear first.

- [ ] **Step 4: Implement isolated sending**

Use the existing sender and renderer:

```ts
export async function sendCommentEmailNotifications(
  commentId: string,
  client: DbClient = db,
) {
  const notifications = await resolveCommentNotifications(commentId, client);
  const results = await Promise.allSettled(
    notifications.map((notification) =>
      sendResendEmail(client, {
        html: renderCommentNotificationEmailHtml(notification),
        subject: notification.subject,
        text: `${notification.description}${notification.content}`,
        to: notification.to,
      }),
    ),
  );

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error("评论通知邮件发送失败", {
        commentId,
        error: result.reason,
        to: notifications[index]?.to,
      });
    }
  });
}
```

Add a non-throwing scheduler:

```ts
export function scheduleCommentEmailNotifications(
  commentId: string,
  client: DbClient = db,
) {
  void sendCommentEmailNotifications(commentId, client).catch((error) => {
    console.error("评论通知任务执行失败", { commentId, error });
  });
}
```

- [ ] **Step 5: Run focused tests and server typecheck**

```bash
cd blog-server
bun test tests/comment-notifications.test.ts
bun run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add blog-server/src/public/comments/notification.ts blog-server/tests/comment-notifications.test.ts
git commit -m "feat: resolve and send comment notifications"
```

### Task 5: Trigger Notifications After Comment Creation

**Files:**
- Modify: `blog-server/src/public/comments/service.ts`
- Modify: `blog-server/tests/comments.test.ts`

- [ ] **Step 1: Write a failing integration test**

Configure a Resend domain and encrypted key, replace `globalThis.fetch` with a function that throws for the Resend URL, then create a comment:

```ts
let resendAttempted = false;
globalThis.fetch = Object.assign(async (input: RequestInfo | URL) => {
  if (String(input) === "https://api.resend.com/emails") {
    resendAttempted = true;
    throw new Error("resend unavailable");
  }
  throw new Error(`Unexpected fetch URL: ${String(input)}`);
}, globalThis.fetch);

const comment = await createPublicComment(
  currentUser,
  articleId,
  { content: "邮件失败仍正常发布" },
  testDb,
);

expect(comment.content).toBe("邮件失败仍正常发布");
await Bun.sleep(20);
expect(resendAttempted).toBe(true);
```

Wait one event-loop turn and assert the comment remains in `listPublicComments`.

- [ ] **Step 2: Run focused test and verify RED**

```bash
cd blog-server
bun test tests/comments.test.ts
```

Expected: FAIL because comment creation does not schedule notifications.

- [ ] **Step 3: Schedule only after commit and cache clearing**

Import and call:

```ts
scheduleCommentEmailNotifications(comment.id, client);
```

Place it after the comment transaction completes and after article cache invalidation, immediately before returning the created comment. Do not `await` the scheduler.

- [ ] **Step 4: Run comment and notification tests**

```bash
cd blog-server
bun test tests/comments.test.ts tests/comment-notifications.test.ts
bun run typecheck
```

Expected: PASS, including the send-failure case.

- [ ] **Step 5: Commit**

```bash
git add blog-server/src/public/comments/service.ts blog-server/tests/comments.test.ts
git commit -m "feat: trigger comment email notifications"
```

### Task 6: Add the Administrator Preference Switch

**Files:**
- Modify: `blog-client/src/features/admin/system/ProfilePage.tsx`
- Modify: `blog-client/src/shared/theme/layouts.css`
- Create: `blog-client/tests/comment-notification-preferences.test.tsx`

- [ ] **Step 1: Write failing administrator UI tests**

Assert the source and static markup include:

```ts
expect(adminProfileSource).toContain('title="偏好设置"');
expect(adminProfileSource).toContain("评论邮件通知");
expect(adminProfileSource).toContain('adminFetch<{ user: AdminProfile }>("/me/preferences"');
expect(adminProfileSource).toContain("commentEmailNotificationsEnabled");
expect(adminProfileSource).not.toContain('title="偏好"');
```

- [ ] **Step 2: Run focused test and verify RED**

```bash
cd blog-client
bun run test tests/comment-notification-preferences.test.tsx
```

Expected: FAIL because the administrator preference switch does not exist.

- [ ] **Step 3: Add administrator state and optimistic save**

Add `commentEmailNotificationsEnabled: boolean` to `AdminProfile`. Add saving state and a handler that keeps the previous value, optimistically changes the switch, calls:

```ts
const response = await adminFetch<{ user: AdminProfile }>("/me/preferences", {
  body: { commentEmailNotificationsEnabled: nextValue },
  method: "PATCH",
});
```

On success, replace `profile` with `response.user` and show a success toast. On failure, restore the previous value and show the existing danger toast.

- [ ] **Step 4: Replace the placeholder preference block**

Rename the accordion trigger and add:

```tsx
<AdminAccountAccordionItem icon="sparkles" id="preferences" title="偏好设置">
  <div className="account-preference-list">
    <Switch
      isDisabled={isSavingPreferences || !profile}
      isSelected={profile?.commentEmailNotificationsEnabled ?? true}
      onChange={saveCommentEmailNotificationPreference}
    >
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Switch.Content>
        <strong>评论邮件通知</strong>
        <span>接收全站文章和留言板的新评论、新回复邮件。</span>
      </Switch.Content>
    </Switch>
  </div>
</AdminAccountAccordionItem>
```

Add `Switch` to the HeroUI imports. Add only the minimal shared spacing style required for a full-width, restrained row.

- [ ] **Step 5: Run focused test, client check, and build**

```bash
cd blog-client
bun run test tests/comment-notification-preferences.test.tsx
bun run check
bun run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add blog-client/src/features/admin/system/ProfilePage.tsx blog-client/src/shared/theme/layouts.css blog-client/tests/comment-notification-preferences.test.tsx
git commit -m "feat: add admin comment notification preference"
```

### Task 7: Add the Front-End Personal-Center Preference

**Files:**
- Modify: `blog-client/src/features/blog/auth/AuthPages.tsx`
- Modify: `blog-client/src/shared/theme/layouts.css`
- Modify: `blog-client/tests/comment-notification-preferences.test.tsx`

- [ ] **Step 1: Write failing personal-center tests**

Assert:

```ts
expect(authPagesSource).toContain('"preferences"');
expect(authPagesSource).toContain("偏好设置");
expect(authPagesSource).toContain("评论回复邮件通知");
expect(authPagesSource).toContain('authJsonRequest<unknown>("/me/preferences"');
expect(authPagesSource).toContain("commentEmailNotificationsEnabled");
```

- [ ] **Step 2: Run focused test and verify RED**

```bash
cd blog-client
bun run test tests/comment-notification-preferences.test.tsx
```

Expected: FAIL because the personal-center preference panel does not exist.

- [ ] **Step 3: Parse and persist the preference**

Add the field to `BlogAuthUser`, parse it with a default of `true` for older stored sessions, and support `preferences` in `ProfilePanelMode`:

```ts
type ProfilePanelMode = "email" | "password" | "preferences" | "profile" | "theme";
```

Add:

```ts
async function updateCurrentBlogUserPreferences(
  token: string,
  commentEmailNotificationsEnabled: boolean,
) {
  const payload = await authJsonRequest<unknown>("/me/preferences", {
    body: { commentEmailNotificationsEnabled },
    method: "PATCH",
    token,
  });

  return parseMeResponse(payload);
}
```

Use optimistic state with rollback, update the stored blog session on success, and show existing operation toasts.

- [ ] **Step 4: Add the personal-center accordion item**

Add before the front-end theme panel:

```tsx
<Accordion.Item className="site-settings-card front-profile-accordion-card" id="preferences">
  <Accordion.Heading>
    <Accordion.Trigger>
      <AppIcon name="sparkles" />
      偏好设置
      <Accordion.Indicator />
    </Accordion.Trigger>
  </Accordion.Heading>
  <Accordion.Panel>
    <Accordion.Body>
      <div className="account-preference-list">
        <Switch
          isDisabled={isSavingPreferences}
          isSelected={user.commentEmailNotificationsEnabled}
          onChange={saveCommentEmailNotificationPreference}
        >
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <Switch.Content>
            <strong>评论回复邮件通知</strong>
            <span>自己的评论收到直接回复时，通过邮箱通知我。</span>
          </Switch.Content>
        </Switch>
      </div>
    </Accordion.Body>
  </Accordion.Panel>
</Accordion.Item>
```

Add `Switch` to the HeroUI imports. Keep the switch layout shared with the administrator page.

- [ ] **Step 5: Run focused tests, client check, and build**

```bash
cd blog-client
bun run test tests/comment-notification-preferences.test.tsx
bun run check
bun run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add blog-client/src/features/blog/auth/AuthPages.tsx blog-client/src/shared/theme/layouts.css blog-client/tests/comment-notification-preferences.test.tsx
git commit -m "feat: add user comment notification preference"
```

### Task 8: Full Regression and Browser Verification

**Files:**
- Modify only files required by failures discovered during verification.

- [ ] **Step 1: Run the complete server suite**

```bash
cd blog-server
bun run check
```

Expected: all server tests and typecheck pass.

- [ ] **Step 2: Run the complete client suite**

```bash
cd blog-client
bun run test
bun run check
bun run build
```

Expected: all client tests, checks, and production build pass.

- [ ] **Step 3: Run database migration verification**

Against the local development database:

```bash
cd blog-server
bun run db:migrate
```

Expected: migration `003_add_comment_email_notifications.sql` applies successfully and is idempotent on a second run.

- [ ] **Step 4: Verify administrator settings in the browser**

Open the administrator settings page and verify:

- The accordion title is “偏好设置”.
- The “评论邮件通知” switch defaults to enabled.
- Toggling saves immediately and remains correct after refresh.
- Saving failure restores the previous state.
- Desktop and mobile layouts remain consistent with the existing settings page.

- [ ] **Step 5: Verify the front-end personal center in the browser**

Open `/profile?panel=preferences` and verify:

- The personal center contains “偏好设置”.
- The “评论回复邮件通知” switch defaults to enabled.
- Toggling saves immediately and remains correct after refresh.
- Saving failure restores the previous state.
- Desktop and mobile layouts remain consistent with the existing personal center.

- [ ] **Step 6: Verify end-to-end notification behavior**

Using configured test email addresses:

- Post an article comment and confirm each enabled administrator email receives one notification.
- Post a guestbook comment and confirm the target text says “留言板”.
- Reply to another user's comment and confirm the direct parent author receives one reply notification.
- Reply to one's own comment and confirm no user reply notification is sent.
- Disable an administrator or user's preference and confirm that recipient is skipped.
- Use duplicate-case administrator emails and confirm only one email is sent.
- Simulate Resend failure and confirm the comment still appears successfully.

- [ ] **Step 7: Commit verification fixes, if any**

When verification changes files, inspect `git status --short`, stage only those exact fixes, and commit:

```bash
git commit -m "fix: finalize comment email notifications"
```

Skip this commit when verification requires no fixes.
