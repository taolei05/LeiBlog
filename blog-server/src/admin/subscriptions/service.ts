import type { Sql } from "postgres";
import { getSql } from "../../shared/db/postgres";
import { readSiteTimeZone } from "../../shared/time-zone";
import { isMediaFileContentValid } from "../media/file-policy";
import type { SubscriptionInput } from "./domain";
import { normalizeSubscription, SubscriptionError } from "./domain";

type ListParameters = {
  search?: string;
  category?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sql?: Sql;
};

export const listSubscriptions = async ({
  search = "",
  category = "all",
  status = "all",
  page = 1,
  pageSize = 12,
  sql = getSql(),
}: ListParameters = {}) => {
  const timeZone = await readSiteTimeZone({ sql });
  const records = await sql<{ items: Record<string, unknown>[]; total: number }[]>`
    WITH data AS (
      SELECT s.id, s.name, s.service_url, s.category, s.details, s.notes, s.currency, s.renewal_type,
        s.reminder_enabled, s.reminder_days, s.created_at, s.updated_at,
        s.start_date::text AS start_date, s.expiry_date::text AS expiry_date,
        s.reminder_time::text AS reminder_time, s.initial_price::text AS initial_price,
        s.renewal_price::text AS renewal_price, u.email AS recipient_email,
        CASE WHEN s.expiry_date IS NULL THEN 'normal'
          WHEN s.expiry_date < (now() AT TIME ZONE ${timeZone})::date THEN 'expired'
          WHEN s.expiry_date <= (now() AT TIME ZONE ${timeZone})::date + s.reminder_days THEN 'expiring'
          ELSE 'normal' END AS status,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id', f.id, 'fileName', f.file_name,
          'fileSize', f.file_size, 'createdAt', f.created_at) ORDER BY f.created_at, f.id)
          FROM subscription_attachments f WHERE f.subscription_id = s.id), '[]') AS attachments,
        (SELECT j.status FROM email_notification_jobs j WHERE j.subscription_id = s.id
          AND j.subscription_expiry = s.expiry_date ORDER BY j.created_at DESC, j.id DESC LIMIT 1) AS delivery_status
      FROM subscriptions s LEFT JOIN users u ON u.id = s.reminder_recipient_id
      WHERE (${category} = 'all' OR s.category = ${category})
        AND (${search} = '' OR strpos(lower(s.name || ' ' || s.service_url || ' ' || s.details || ' ' || s.notes), lower(${search})) > 0)
    ), filtered AS (SELECT * FROM data WHERE ${status} = 'all' OR status = ${status})
    SELECT (SELECT count(*)::integer FROM filtered) AS total,
      COALESCE((SELECT jsonb_agg(row_to_json(p)) FROM (
        SELECT * FROM filtered ORDER BY expiry_date ASC NULLS LAST, created_at DESC, id
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      ) p), '[]') AS items
  `;
  return { ok: true, items: records[0].items, total: records[0].total, page, pageSize, timeZone };
};

export const saveSubscription = async ({
  id,
  userId,
  input,
  sql = getSql(),
}: {
  id?: string;
  userId: string;
  input: SubscriptionInput;
  sql?: Sql;
}) => {
  const value = normalizeSubscription(input);
  const subscriptionId = id ?? crypto.randomUUID();
  await sql.begin(async (tx) => {
    if (id !== undefined) {
      const locked = await tx`SELECT id FROM subscriptions WHERE id = ${id} FOR UPDATE`;
      if (locked.length === 0)
        throw new SubscriptionError("Subscription not found. / 订阅不存在。", 404);
      await tx`
        UPDATE subscriptions SET name = ${value.name}, service_url = ${value.serviceUrl}, category = ${value.category},
          details = ${value.details}, start_date = ${value.startDate}, expiry_date = ${value.expiryDate},
          initial_price = ${value.initialPrice}, renewal_price = ${value.renewalPrice}, currency = ${value.currency},
          renewal_type = ${value.renewalType}, notes = ${value.notes}, reminder_enabled = ${value.reminderEnabled},
          reminder_days = ${value.reminderDays}, reminder_time = ${value.reminderTime}, reminder_revision = reminder_revision + 1
        WHERE id = ${id}
      `;
      await tx`UPDATE email_notification_jobs SET status = 'skipped', completed_at = now()
        WHERE subscription_id = ${id} AND status = 'pending'
          AND (locked_until IS NULL OR locked_until <= now())`;
    } else {
      await tx`INSERT INTO subscriptions (id, name, service_url, category, details, start_date, expiry_date,
        initial_price, renewal_price, currency, renewal_type, notes, reminder_enabled, reminder_days,
        reminder_time, reminder_recipient_id)
        VALUES (${subscriptionId}, ${value.name}, ${value.serviceUrl}, ${value.category}, ${value.details},
          ${value.startDate}, ${value.expiryDate}, ${value.initialPrice}, ${value.renewalPrice}, ${value.currency},
          ${value.renewalType}, ${value.notes}, ${value.reminderEnabled}, ${value.reminderDays}, ${value.reminderTime}, ${userId})`;
    }
  });
  return { ok: true, id: subscriptionId };
};

export const deleteSubscription = async (id: string, sql = getSql()) => {
  const rows = await sql`DELETE FROM subscriptions WHERE id = ${id} RETURNING id`;
  if (rows.length === 0) throw new SubscriptionError("Subscription not found. / 订阅不存在。", 404);
  return { ok: true };
};

export const uploadSubscriptionAttachment = async ({
  id,
  file,
  sql = getSql(),
}: {
  id: string;
  file: File;
  sql?: Sql;
}) => {
  if (file.size < 1 || file.size > 5 * 1024 * 1024)
    throw new SubscriptionError("Files must be 1 byte to 5 MiB. / 附件最大 5 MiB。");
  const fileName = file.name.replace(/[\x00-\x1f\x7f/\\]/g, "_").slice(0, 200);
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const bytes = Buffer.from(await file.arrayBuffer());
  // Reuse signature checks; downloads are always attachments, never active inline content.
  if (!(await isMediaFileContentValid({ bytes, fileFormat: extension })))
    throw new SubscriptionError(
      "Supported: PDF, DOC/DOCX, TXT/MD, JPG/PNG/GIF/WEBP/ICO. / 文件类型或内容无效。",
    );
  return sql.begin(async (tx) => {
    const rows = await tx`SELECT id FROM subscriptions WHERE id = ${id} FOR UPDATE`;
    if (rows.length === 0)
      throw new SubscriptionError("Subscription not found. / 订阅不存在。", 404);
    const [count] =
      await tx`SELECT count(*)::integer AS count FROM subscription_attachments WHERE subscription_id = ${id}`;
    if (count.count >= 10)
      throw new SubscriptionError("Maximum 10 attachments. / 每条订阅最多 10 个附件。");
    const [item] =
      await tx`INSERT INTO subscription_attachments (subscription_id, file_name, content_type, file_size, content)
      VALUES (${id}, ${fileName}, 'application/octet-stream', ${bytes.length}, ${bytes})
      RETURNING id, file_name, file_size, created_at`;
    return { ok: true, item };
  });
};

export const downloadSubscriptionAttachment = async ({
  id,
  attachmentId,
  sql = getSql(),
}: {
  id: string;
  attachmentId: string;
  sql?: Sql;
}) => {
  const [file] = await sql<{ content: Buffer; fileName: string; fileSize: number }[]>`
    SELECT content, file_name, file_size FROM subscription_attachments WHERE id = ${attachmentId} AND subscription_id = ${id}`;
  if (file === undefined) throw new SubscriptionError("Attachment not found. / 附件不存在。", 404);
  return new Response(new Uint8Array(file.content), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(file.fileSize),
      "Content-Disposition": `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(file.fileName).replace(/'/g, "%27")}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
};

export const deleteSubscriptionAttachment = async ({
  id,
  attachmentId,
  sql = getSql(),
}: {
  id: string;
  attachmentId: string;
  sql?: Sql;
}) => {
  const rows =
    await sql`DELETE FROM subscription_attachments WHERE id = ${attachmentId} AND subscription_id = ${id} RETURNING id`;
  if (rows.length === 0) throw new SubscriptionError("Attachment not found. / 附件不存在。", 404);
  return { ok: true };
};

export const queueDueSubscriptionReminders = async (sql: Sql = getSql()) => {
  const timeZone = await readSiteTimeZone({ sql });
  await sql`
    INSERT INTO email_notification_jobs (kind, recipient_id, subscription_id, subscription_revision, subscription_expiry)
    SELECT 'subscription_expiry', s.reminder_recipient_id, s.id, s.reminder_revision, s.expiry_date
    FROM subscriptions s JOIN users u ON u.id = s.reminder_recipient_id AND u.role = 'admin'
    WHERE s.reminder_enabled AND s.expiry_date >= (now() AT TIME ZONE ${timeZone})::date
      AND ((s.expiry_date - s.reminder_days + s.reminder_time) AT TIME ZONE ${timeZone}) <= now()
      AND NOT EXISTS (SELECT 1 FROM email_notification_jobs j WHERE j.subscription_id = s.id
        AND j.subscription_expiry = s.expiry_date AND j.status IN ('pending', 'sent', 'failed'))
    ON CONFLICT DO NOTHING
  `;
};
