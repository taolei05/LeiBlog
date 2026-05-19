import type { UserRole } from "../../shared/auth";
import type { DbClient } from "../../shared/db";
import { hashPassword } from "../../shared/auth";
import { clearSiteCache } from "../../shared/cache/content";
import { encryptSecret } from "../../shared/crypto";
import { db, withTransaction } from "../../shared/db";
import { conflict, validationError } from "../../shared/errors";
import { toUserProfile, type UserProfile, type UserProfileRow } from "../../shared/types/user";

export type SetupStepKey =
  | "admin"
  | "site-info"
  | "site-config"
  | "filing"
  | "complete"
  | "completed";

export interface SetupServiceOptions {
  client?: DbClient;
  secret?: string;
}

export interface SetupAdminInput {
  username: string;
  password: string;
  email?: string;
  name?: string;
  tags?: string[];
  description?: string;
  avatarUrl?: string;
}

export interface SetupSiteInfoInput {
  siteName: string;
  description?: string;
  logoDarkUrl?: string;
  logoLightUrl?: string;
  faviconUrl?: string;
  establishedAt: string;
}

export interface SetupSiteConfigInput {
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  copyright?: string;
  resendDomain?: string;
  resendApiKey?: string;
  deeplApiKey?: string;
  ipgeolocationApiKey?: string;
  commentsEnabled: boolean;
}

export interface SetupFilingInput {
  icpNumber?: string;
  icpUrl?: string;
  policeNumber?: string;
  policeUrl?: string;
}

interface SetupStateRow {
  is_completed: boolean;
  current_step: SetupStepKey;
  completed_at: Date | null;
}

interface AdminCountRow {
  admin_count: string;
}

interface DemoUserRow {
  id: string;
  role: UserRole;
  username: string;
}

const STEPS: Array<{ key: SetupStepKey; title: string }> = [
  { key: "admin", title: "配置管理员" },
  { key: "site-info", title: "配置站点信息" },
  { key: "site-config", title: "站点基本配置" },
  { key: "filing", title: "站点备案配置" },
  { key: "complete", title: "完成配置" },
];

function cleanOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanList(values: string[] | undefined) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function parseDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw validationError("建站时间格式无效");
  }

  return date;
}

async function ensureSetupState(client: DbClient) {
  await client`
    INSERT INTO setup_state (id, is_completed, current_step)
    VALUES (1, false, 'admin')
    ON CONFLICT (id) DO NOTHING
  `;
}

async function hasAdminUser(client: DbClient) {
  const [row] = await client<AdminCountRow[]>`
    SELECT count(*) AS admin_count
    FROM users
    WHERE role = 'admin'
  `;

  return Number(row?.admin_count ?? 0) > 0;
}

async function getSetupState(client: DbClient) {
  await ensureSetupState(client);
  const hasAdmin = await hasAdminUser(client);

  if (!hasAdmin) {
    await client`
      UPDATE setup_state
      SET is_completed = false,
          current_step = 'admin',
          completed_at = null
      WHERE id = 1
    `;
  }

  const [state] = await client<SetupStateRow[]>`
    SELECT is_completed, current_step, completed_at
    FROM setup_state
    WHERE id = 1
  `;

  if (!state) {
    throw new Error("Setup state is missing");
  }

  return state;
}

async function ensureSetupOpen(client: DbClient) {
  const state = await getSetupState(client);
  if (state.is_completed) {
    throw conflict("首次配置已完成");
  }

  return state;
}

async function setCurrentStep(client: DbClient, step: SetupStepKey) {
  await client`
    UPDATE setup_state
    SET current_step = ${step}
    WHERE id = 1
  `;
}

function toSetupStatus(state: SetupStateRow) {
  const currentStep = state.is_completed ? "completed" : state.current_step;
  const currentIndex = STEPS.findIndex((step) => step.key === currentStep);
  const completedIndex = state.is_completed ? STEPS.length : currentIndex;

  return {
    ok: true,
    isCompleted: state.is_completed,
    currentStep,
    completedAt: state.completed_at?.toISOString() ?? null,
    steps: STEPS.map((step, index) => ({
      ...step,
      isCompleted: index < completedIndex,
    })),
  };
}

export async function getSetupStatus(options: SetupServiceOptions = {}) {
  const client = options.client ?? db;
  return toSetupStatus(await getSetupState(client));
}

async function getUserProfileById(id: string, client: DbClient) {
  const [row] = await client<UserProfileRow[]>`
    SELECT id, username, email, name, description, tags, role, avatar_url,
           social_links, blog_url, created_at, updated_at, last_login_at,
           host(last_login_ip) AS last_login_ip
    FROM users
    WHERE id = ${id}
  `;

  if (!row) throw validationError("演示账户创建失败");
  return toUserProfile(row);
}

export async function getOrCreateSetupDemoUser(
  options: SetupServiceOptions = {}
): Promise<{ signableUser: DemoUserRow; user: UserProfile }> {
  const client = options.client ?? db;
  const passwordHash = await hashPassword(`demo-${Date.now()}-${Math.random()}`);
  let userId = "";

  await withTransaction(async (tx) => {
    const [existing] = await tx<DemoUserRow[]>`
      SELECT id, username, role
      FROM users
      WHERE lower(username) = 'demo'
      LIMIT 1
    `;

    if (existing) {
      await tx`
        UPDATE users
        SET role = 'demo',
            name = '只读演示',
            description = '后台初始化阶段使用的只读演示账户。',
            tags = ${tx.array(["demo", "只读"], "TEXT")},
            password_hash = ${passwordHash}
        WHERE id = ${existing.id}
      `;
      userId = existing.id;
      return;
    }

    const [created] = await tx<DemoUserRow[]>`
      INSERT INTO users (
        username, password_hash, email, name, description, tags, role
      )
      VALUES (
        'demo',
        ${passwordHash},
        null,
        '只读演示',
        '后台初始化阶段使用的只读演示账户。',
        ${tx.array(["demo", "只读"], "TEXT")},
        'demo'
      )
      RETURNING id, username, role
    `;

    userId = created.id;
  }, client);

  const user = await getUserProfileById(userId, client);

  return {
    signableUser: {
      id: user.id,
      role: user.role,
      username: user.username,
    },
    user,
  };
}

export async function configureAdmin(
  input: SetupAdminInput,
  options: SetupServiceOptions = {}
) {
  const client = options.client ?? db;
  const passwordHash = await hashPassword(input.password);
  const tags = cleanList(input.tags);

  await withTransaction(async (tx) => {
    await ensureSetupOpen(tx);

    const [admin] = await tx<{ id: string }[]>`
      SELECT id
      FROM users
      WHERE role = 'admin'
      ORDER BY created_at
      LIMIT 1
    `;

    if (admin) {
      await tx`
        UPDATE users
        SET username = ${input.username.trim()},
            password_hash = ${passwordHash},
            email = ${cleanOptional(input.email)},
            name = ${cleanOptional(input.name)},
            tags = ${tx.array(tags, "TEXT")},
            description = ${input.description?.trim() ?? ""},
            avatar_url = ${cleanOptional(input.avatarUrl)}
        WHERE id = ${admin.id}
      `;
    } else {
      await tx`
        INSERT INTO users (
          username, password_hash, email, name, tags, description, avatar_url, role
        )
        VALUES (
          ${input.username.trim()},
          ${passwordHash},
          ${cleanOptional(input.email)},
          ${cleanOptional(input.name)},
          ${tx.array(tags, "TEXT")},
          ${input.description?.trim() ?? ""},
          ${cleanOptional(input.avatarUrl)},
          'admin'
        )
      `;
    }

    await setCurrentStep(tx, "site-info");
  }, client);

  await clearSiteCache();
  return getSetupStatus({ client });
}

export async function configureSiteInfo(
  input: SetupSiteInfoInput,
  options: SetupServiceOptions = {}
) {
  const client = options.client ?? db;
  const establishedAt = parseDate(input.establishedAt);

  await withTransaction(async (tx) => {
    await ensureSetupOpen(tx);

    await tx`
      INSERT INTO site_info (
        id, site_name, description, logo_dark_url, logo_light_url, favicon_url, established_at
      )
      VALUES (
        1,
        ${input.siteName.trim()},
        ${input.description?.trim() ?? ""},
        ${cleanOptional(input.logoDarkUrl)},
        ${cleanOptional(input.logoLightUrl)},
        ${cleanOptional(input.faviconUrl)},
        ${establishedAt}
      )
      ON CONFLICT (id) DO UPDATE
      SET site_name = EXCLUDED.site_name,
          description = EXCLUDED.description,
          logo_dark_url = EXCLUDED.logo_dark_url,
          logo_light_url = EXCLUDED.logo_light_url,
          favicon_url = EXCLUDED.favicon_url,
          established_at = EXCLUDED.established_at
    `;

    await setCurrentStep(tx, "site-config");
  }, client);

  await clearSiteCache();
  return getSetupStatus({ client });
}

export async function configureSiteConfig(
  input: SetupSiteConfigInput,
  options: SetupServiceOptions = {}
) {
  const client = options.client ?? db;
  const secret = options.secret;
  const seoKeywords = cleanList(input.seoKeywords);
  const resendApiKey = encryptSecret(cleanOptional(input.resendApiKey), secret);
  const deeplApiKey = encryptSecret(cleanOptional(input.deeplApiKey), secret);
  const ipgeolocationApiKey = encryptSecret(
    cleanOptional(input.ipgeolocationApiKey),
    secret
  );

  await withTransaction(async (tx) => {
    await ensureSetupOpen(tx);

    await tx`
      INSERT INTO site_config (
        id,
        seo_title,
        seo_description,
        seo_keywords,
        copyright,
        resend_domain,
        resend_api_key_encrypted,
        deepl_api_key_encrypted,
        ipgeolocation_api_key_encrypted,
        comments_enabled
      )
      VALUES (
        1,
        ${input.seoTitle?.trim() ?? ""},
        ${input.seoDescription?.trim() ?? ""},
        ${tx.array(seoKeywords, "TEXT")},
        ${input.copyright?.trim() ?? ""},
        ${cleanOptional(input.resendDomain)},
        ${resendApiKey ? JSON.stringify(resendApiKey) : null}::jsonb,
        ${deeplApiKey ? JSON.stringify(deeplApiKey) : null}::jsonb,
        ${ipgeolocationApiKey ? JSON.stringify(ipgeolocationApiKey) : null}::jsonb,
        ${input.commentsEnabled}
      )
      ON CONFLICT (id) DO UPDATE
      SET seo_title = EXCLUDED.seo_title,
          seo_description = EXCLUDED.seo_description,
          seo_keywords = EXCLUDED.seo_keywords,
          copyright = EXCLUDED.copyright,
          resend_domain = EXCLUDED.resend_domain,
          resend_api_key_encrypted = EXCLUDED.resend_api_key_encrypted,
          deepl_api_key_encrypted = EXCLUDED.deepl_api_key_encrypted,
          ipgeolocation_api_key_encrypted = EXCLUDED.ipgeolocation_api_key_encrypted,
          comments_enabled = EXCLUDED.comments_enabled
    `;

    await setCurrentStep(tx, "filing");
  }, client);

  await clearSiteCache();
  return getSetupStatus({ client });
}

export async function configureFiling(
  input: SetupFilingInput,
  options: SetupServiceOptions = {}
) {
  const client = options.client ?? db;

  await withTransaction(async (tx) => {
    await ensureSetupOpen(tx);

    await tx`
      INSERT INTO site_filing (
        id, icp_number, icp_url, police_number, police_url
      )
      VALUES (
        1,
        ${cleanOptional(input.icpNumber)},
        ${cleanOptional(input.icpUrl)},
        ${cleanOptional(input.policeNumber)},
        ${cleanOptional(input.policeUrl)}
      )
      ON CONFLICT (id) DO UPDATE
      SET icp_number = EXCLUDED.icp_number,
          icp_url = EXCLUDED.icp_url,
          police_number = EXCLUDED.police_number,
          police_url = EXCLUDED.police_url
    `;

    await setCurrentStep(tx, "complete");
  }, client);

  await clearSiteCache();
  return getSetupStatus({ client });
}

export async function completeSetup(options: SetupServiceOptions = {}) {
  const client = options.client ?? db;

  await withTransaction(async (tx) => {
    await ensureSetupOpen(tx);

    const [requirements] = await tx<{
      admin_count: string;
      site_info_count: string;
      site_config_count: string;
      filing_count: string;
    }[]>`
      SELECT
        (SELECT count(*) FROM users WHERE role = 'admin') AS admin_count,
        (SELECT count(*) FROM site_info WHERE id = 1) AS site_info_count,
        (SELECT count(*) FROM site_config WHERE id = 1) AS site_config_count,
        (SELECT count(*) FROM site_filing WHERE id = 1) AS filing_count
    `;

    const missing = [
      [requirements?.admin_count, "管理员"],
      [requirements?.site_info_count, "站点信息"],
      [requirements?.site_config_count, "站点配置"],
      [requirements?.filing_count, "备案配置"],
    ]
      .filter(([count]) => Number(count) < 1)
      .map(([, name]) => name);

    if (missing.length > 0) {
      throw validationError(`首次配置未完成：${missing.join("、")}`);
    }

    await tx`
      UPDATE setup_state
      SET is_completed = true,
          current_step = 'completed',
          completed_at = now()
      WHERE id = 1
    `;
  }, client);

  return getSetupStatus({ client });
}
