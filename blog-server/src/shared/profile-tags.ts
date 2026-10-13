import type { Sql, TransactionSql } from "postgres";

export const USER_PROFILE_LOCALES = ["zh-CN", "en"] as const;
export type UserProfileLocale = (typeof USER_PROFILE_LOCALES)[number];

export const DEFAULT_USER_PROFILE_LOCALE: UserProfileLocale = "zh-CN";
export const USER_PROFILE_LOCALE_HEADER = "x-leiblog-locale";
export const USER_PROFILE_TRANSLATION_STATUS = {
  Completed: "completed",
  Incomplete: "incomplete",
  MissingApiKey: "missing-api-key",
  NotNeeded: "not-needed",
} as const;
export type UserProfileTranslationStatus =
  (typeof USER_PROFILE_TRANSLATION_STATUS)[keyof typeof USER_PROFILE_TRANSLATION_STATUS];
export const USER_PROFILE_TRANSLATION_FIELDS = ["name", "bio", "tags"] as const;
export type UserProfileTranslationField = (typeof USER_PROFILE_TRANSLATION_FIELDS)[number];

export const PROFILE_TAG_LOCALES = USER_PROFILE_LOCALES;
export type ProfileTagLocale = UserProfileLocale;
export const DEFAULT_PROFILE_TAG_LOCALE = DEFAULT_USER_PROFILE_LOCALE;
export const PROFILE_TAG_LOCALE_HEADER = USER_PROFILE_LOCALE_HEADER;

type UserProfileSql = Sql | TransactionSql;

export type UserProfileContent = {
  name: string;
  bio: string;
  tags: string[];
};

export type UserProfileLocalizations = {
  zhCN: UserProfileContent;
  en: UserProfileContent;
};

export type UserProfileWrite = {
  name: string | null;
  bio: string | null;
  tags: string[];
};

export type PreparedUserProfileInput = {
  source: UserProfileContent;
  sourceLocale: UserProfileLocale;
  target: Partial<UserProfileContent>;
  targetLocale: UserProfileLocale;
  translation: UserProfileTranslationSummary;
};

export type UserProfileTranslationSummary = {
  status: UserProfileTranslationStatus;
  sourceLocale: UserProfileLocale;
  targetLocale: UserProfileLocale;
  targetLocales: UserProfileLocale[];
  requestedFields: UserProfileTranslationField[];
  completedFields: UserProfileTranslationField[];
  missingFields: UserProfileTranslationField[];
};

type DeepLTranslation = {
  text?: string;
};

type DeepLTranslateResponse = {
  translations?: DeepLTranslation[];
};

type UserEnglishProfileRow = {
  name: string | null;
  bio: string | null;
  tags: string[];
};

type TranslatableUserProfileItem =
  | {
      kind: "name";
      value: string;
    }
  | {
      kind: "bio";
      value: string;
    }
  | {
      kind: "tag";
      index?: number;
      value: string;
    };

const createTranslatableTagItem = (value: string, index?: number): TranslatableUserProfileItem =>
  index === undefined
    ? {
        kind: "tag",
        value,
      }
    : {
        index,
        kind: "tag",
        value,
      };

const createEmptyUserProfile = (): UserProfileContent => ({
  name: "",
  bio: "",
  tags: [],
});

export const normalizeProfileTagLocale = (locale?: string | null): UserProfileLocale => {
  if (locale === undefined || locale === null) {
    return DEFAULT_USER_PROFILE_LOCALE;
  }

  return locale.toLowerCase().startsWith("en") ? "en" : "zh-CN";
};

export const normalizeProfileTagLabels = (values: string[]) => {
  const seenKeys = new Set<string>();

  return values.reduce<string[]>((labels, value) => {
    const label = value.trim();
    const key = label.toLocaleLowerCase();
    if (label.length === 0 || seenKeys.has(key)) {
      return labels;
    }

    seenKeys.add(key);
    return [...labels, label];
  }, []);
};

export const getOppositeProfileTagLocale = (locale: UserProfileLocale): UserProfileLocale =>
  locale === "zh-CN" ? "en" : "zh-CN";

type ToDeepLLanguageCodeParameters = {
  locale: UserProfileLocale;
  purpose: "source" | "target";
};

const toDeepLLanguageCode = ({ locale, purpose }: ToDeepLLanguageCodeParameters) => {
  if (locale === "zh-CN") {
    return purpose === "source" ? "ZH" : "ZH-HANS";
  }

  return purpose === "source" ? "EN" : "EN-US";
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isDeepLTranslateResponse = (value: unknown): value is DeepLTranslateResponse => {
  if (!isObjectRecord(value)) {
    return false;
  }

  const translations = value.translations;
  if (translations === undefined) {
    return true;
  }

  return (
    Array.isArray(translations) &&
    translations.every(
      (translation) =>
        isObjectRecord(translation) &&
        (translation.text === undefined || typeof translation.text === "string"),
    )
  );
};

type TranslateTextsParameters = {
  apiKey: string;
  sourceLocale: UserProfileLocale;
  targetLocale: UserProfileLocale;
  texts: string[];
};

export const translateTexts = async ({
  apiKey,
  sourceLocale,
  targetLocale,
  texts,
}: TranslateTextsParameters) => {
  if (texts.length === 0) {
    return [];
  }

  const endpoint = apiKey.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";

  try {
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(10_000),
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_lang: toDeepLLanguageCode({ locale: sourceLocale, purpose: "source" }),
        target_lang: toDeepLLanguageCode({ locale: targetLocale, purpose: "target" }),
        text: texts,
      }),
    });

    if (!response.ok) {
      return [];
    }

    const payload: unknown = await response.json();
    if (!isDeepLTranslateResponse(payload)) {
      return [];
    }

    return texts.map((_, index) => payload.translations?.[index]?.text?.trim() ?? "");
  } catch {
    return [];
  }
};

type PrepareUserProfileInputParameters = {
  deeplApiKey?: string;
  profile: UserProfileContent;
  sourceLocale: UserProfileLocale;
};

type PrepareUserProfileLocalizationsParameters = {
  deeplApiKey?: string;
  profile: UserProfileLocalizations;
};

type CreateUserProfileTranslationSummaryParameters = {
  apiKeyConfigured: boolean;
  source: UserProfileContent;
  sourceLocale: UserProfileLocale;
  target: Partial<UserProfileContent>;
  targetLocale: UserProfileLocale;
  translatedTagCount: number;
};

const createUserProfileTranslationSummary = ({
  apiKeyConfigured,
  source,
  sourceLocale,
  target,
  targetLocale,
  translatedTagCount,
}: CreateUserProfileTranslationSummaryParameters): UserProfileTranslationSummary => {
  const requestedFields: UserProfileTranslationField[] = [];
  const completedFields: UserProfileTranslationField[] = [];

  if (source.name.length > 0) {
    requestedFields.push("name");
    if ((target.name?.trim() ?? "").length > 0) {
      completedFields.push("name");
    }
  }

  if (source.bio.length > 0) {
    requestedFields.push("bio");
    if ((target.bio?.trim() ?? "").length > 0) {
      completedFields.push("bio");
    }
  }

  if (source.tags.length > 0) {
    requestedFields.push("tags");
    if (translatedTagCount >= source.tags.length) {
      completedFields.push("tags");
    }
  }

  const missingFields = requestedFields.filter((field) => !completedFields.includes(field));
  const status =
    requestedFields.length === 0
      ? USER_PROFILE_TRANSLATION_STATUS.NotNeeded
      : missingFields.length === 0
        ? USER_PROFILE_TRANSLATION_STATUS.Completed
        : apiKeyConfigured
          ? USER_PROFILE_TRANSLATION_STATUS.Incomplete
          : USER_PROFILE_TRANSLATION_STATUS.MissingApiKey;

  return {
    status,
    sourceLocale,
    targetLocale,
    targetLocales: requestedFields.length > 0 ? [targetLocale] : [],
    requestedFields,
    completedFields,
    missingFields,
  };
};

export const prepareUserProfileInput = async ({
  deeplApiKey,
  profile,
  sourceLocale,
}: PrepareUserProfileInputParameters): Promise<PreparedUserProfileInput> => {
  const source: UserProfileContent = {
    name: profile.name.trim(),
    bio: profile.bio.trim(),
    tags: normalizeProfileTagLabels(profile.tags),
  };
  const targetLocale = getOppositeProfileTagLocale(sourceLocale);
  const apiKey = deeplApiKey?.trim();
  const apiKeyConfigured = apiKey !== undefined && apiKey.length > 0;
  const nameItem: TranslatableUserProfileItem = { kind: "name", value: source.name };
  const bioItem: TranslatableUserProfileItem = { kind: "bio", value: source.bio };
  const tagItems = source.tags.map(createTranslatableTagItem);
  const items = [nameItem, bioItem, ...tagItems].filter((item) => item.value.length > 0);
  const translations =
    apiKey === undefined || apiKey.length === 0
      ? []
      : await translateTexts({
          apiKey,
          sourceLocale,
          targetLocale,
          texts: items.map((item) => item.value),
        });

  const translatedTags: string[] = [];
  let translatedTagCount = 0;
  const target: Partial<UserProfileContent> = {};

  for (const [index, item] of items.entries()) {
    const translatedText = translations[index]?.trim();
    if (translatedText === undefined || translatedText.length === 0) {
      continue;
    }

    if (item.kind === "name") {
      target.name = translatedText;
      continue;
    }

    if (item.kind === "bio") {
      target.bio = translatedText;
      continue;
    }

    translatedTagCount += 1;
    translatedTags.push(translatedText);
  }

  const normalizedTranslatedTags = normalizeProfileTagLabels(translatedTags);
  if (normalizedTranslatedTags.length > 0) {
    target.tags = normalizedTranslatedTags;
  }

  return {
    source,
    sourceLocale,
    target,
    targetLocale,
    translation: createUserProfileTranslationSummary({
      apiKeyConfigured,
      source,
      sourceLocale,
      target,
      targetLocale,
      translatedTagCount,
    }),
  };
};

const toWritableUserProfile = (profile: UserProfileContent): UserProfileWrite => ({
  name: profile.name.length > 0 ? profile.name : null,
  bio: profile.bio.length > 0 ? profile.bio : null,
  tags: normalizeProfileTagLabels(profile.tags),
});

type ResolveUserProfileWriteParameters = {
  currentBase?: UserProfileContent;
  currentEnglish?: UserProfileContent;
  prepared: PreparedUserProfileInput;
};

export const resolveUserProfileWrite = ({
  currentBase = createEmptyUserProfile(),
  currentEnglish = createEmptyUserProfile(),
  prepared,
}: ResolveUserProfileWriteParameters) => {
  const { source, sourceLocale, target } = prepared;

  if (sourceLocale === "zh-CN") {
    return {
      base: toWritableUserProfile(source),
      english: toWritableUserProfile({
        name: source.name.length > 0 ? (target.name ?? currentEnglish.name) : "",
        bio: source.bio.length > 0 ? (target.bio ?? currentEnglish.bio) : "",
        tags: source.tags.length > 0 ? (target.tags ?? currentEnglish.tags) : [],
      }),
    };
  }

  return {
    base: toWritableUserProfile({
      name: source.name.length > 0 ? (target.name ?? currentBase.name) : "",
      bio: source.bio.length > 0 ? (target.bio ?? currentBase.bio) : "",
      tags: source.tags.length > 0 ? (target.tags ?? currentBase.tags) : [],
    }),
    english: toWritableUserProfile(source),
  };
};

const normalizeUserProfileContent = (profile: UserProfileContent): UserProfileContent => ({
  name: profile.name.trim(),
  bio: profile.bio.trim(),
  tags: normalizeProfileTagLabels(profile.tags),
});

type TranslationDirectionResult = {
  completedFields: UserProfileTranslationField[];
  requestedFields: UserProfileTranslationField[];
  sourceLocale: UserProfileLocale;
  target: UserProfileContent;
  targetLocale: UserProfileLocale;
};

type TranslateMissingProfileFieldsParameters = {
  apiKey?: string;
  source: UserProfileContent;
  sourceLocale: UserProfileLocale;
  target: UserProfileContent;
  targetLocale: UserProfileLocale;
};

const translateMissingProfileFields = async ({
  apiKey,
  source,
  sourceLocale,
  target,
  targetLocale,
}: TranslateMissingProfileFieldsParameters): Promise<TranslationDirectionResult> => {
  const items: TranslatableUserProfileItem[] = [];
  const requestedFields: UserProfileTranslationField[] = [];

  if (source.name.length > 0 && target.name.length === 0) {
    requestedFields.push("name");
    items.push({ kind: "name", value: source.name });
  }

  if (source.bio.length > 0 && target.bio.length === 0) {
    requestedFields.push("bio");
    items.push({ kind: "bio", value: source.bio });
  }

  const missingTagItems = source.tags.reduce<TranslatableUserProfileItem[]>(
    (tagItems, tag, index) => {
      if ((target.tags[index]?.trim() ?? "").length > 0) {
        return tagItems;
      }

      return [...tagItems, createTranslatableTagItem(tag, index)];
    },
    [],
  );

  if (missingTagItems.length > 0) {
    requestedFields.push("tags");
    items.push(...missingTagItems);
  }

  const translations =
    apiKey === undefined || apiKey.length === 0
      ? []
      : await translateTexts({
          apiKey,
          sourceLocale,
          targetLocale,
          texts: items.map((item) => item.value),
        });
  const nextTarget: UserProfileContent = {
    ...target,
    tags: [...target.tags],
  };
  const translatedTags: Array<{ index?: number; value: string }> = [];
  let translatedTagCount = 0;

  for (const [index, item] of items.entries()) {
    const translatedText = translations[index]?.trim();
    if (translatedText === undefined || translatedText.length === 0) {
      continue;
    }

    if (item.kind === "name") {
      nextTarget.name = translatedText;
      continue;
    }

    if (item.kind === "bio") {
      nextTarget.bio = translatedText;
      continue;
    }

    translatedTagCount += 1;
    translatedTags.push({
      index: item.index,
      value: translatedText,
    });
  }

  if (translatedTags.length > 0) {
    const nextTags = [...nextTarget.tags];
    const appendedTags: string[] = [];

    for (const tag of translatedTags) {
      if (tag.index === undefined) {
        appendedTags.push(tag.value);
        continue;
      }

      nextTags[tag.index] = tag.value;
    }

    nextTarget.tags = normalizeProfileTagLabels([...nextTags, ...appendedTags]);
  }

  const completedFields = requestedFields.filter((field) => {
    if (field === "name") {
      return nextTarget.name.length > 0;
    }

    if (field === "bio") {
      return nextTarget.bio.length > 0;
    }

    return translatedTagCount >= missingTagItems.length;
  });

  return {
    completedFields,
    requestedFields,
    sourceLocale,
    target: nextTarget,
    targetLocale,
  };
};

const uniqueTranslationFields = (fields: UserProfileTranslationField[]) =>
  USER_PROFILE_TRANSLATION_FIELDS.filter((field) => fields.includes(field));

const uniqueLocales = (locales: UserProfileLocale[]) =>
  USER_PROFILE_LOCALES.filter((locale) => locales.includes(locale));

type CreateBilingualProfileTranslationSummaryParameters = {
  apiKeyConfigured: boolean;
  directions: TranslationDirectionResult[];
};

const createBilingualProfileTranslationSummary = ({
  apiKeyConfigured,
  directions,
}: CreateBilingualProfileTranslationSummaryParameters): UserProfileTranslationSummary => {
  const requestedFields = uniqueTranslationFields(
    directions.flatMap((direction) => direction.requestedFields),
  );
  const completedFields = uniqueTranslationFields(
    directions.flatMap((direction) => direction.completedFields),
  );
  const missingFields = requestedFields.filter((field) => !completedFields.includes(field));
  const requestedDirections = directions.filter(
    (direction) => direction.requestedFields.length > 0,
  );
  const firstRequestedDirection = requestedDirections[0];
  const sourceLocale = firstRequestedDirection?.sourceLocale ?? DEFAULT_USER_PROFILE_LOCALE;
  const targetLocale =
    firstRequestedDirection?.targetLocale ?? getOppositeProfileTagLocale(sourceLocale);
  const targetLocales = uniqueLocales(
    requestedDirections.map((direction) => direction.targetLocale),
  );
  const status =
    requestedFields.length === 0
      ? USER_PROFILE_TRANSLATION_STATUS.NotNeeded
      : missingFields.length === 0
        ? USER_PROFILE_TRANSLATION_STATUS.Completed
        : apiKeyConfigured
          ? USER_PROFILE_TRANSLATION_STATUS.Incomplete
          : USER_PROFILE_TRANSLATION_STATUS.MissingApiKey;

  return {
    status,
    sourceLocale,
    targetLocale,
    targetLocales,
    requestedFields,
    completedFields,
    missingFields,
  };
};

export const prepareUserProfileLocalizations = async ({
  deeplApiKey,
  profile,
}: PrepareUserProfileLocalizationsParameters) => {
  const apiKey = deeplApiKey?.trim();
  const apiKeyConfigured = apiKey !== undefined && apiKey.length > 0;
  const zhCN = normalizeUserProfileContent(profile.zhCN);
  const en = normalizeUserProfileContent(profile.en);
  const enDirection = await translateMissingProfileFields({
    apiKey,
    source: zhCN,
    sourceLocale: "zh-CN",
    target: en,
    targetLocale: "en",
  });
  const zhDirection = await translateMissingProfileFields({
    apiKey,
    source: enDirection.target,
    sourceLocale: "en",
    target: zhCN,
    targetLocale: "zh-CN",
  });
  const localizations: UserProfileLocalizations = {
    zhCN: zhDirection.target,
    en: enDirection.target,
  };

  return {
    base: toWritableUserProfile(localizations.zhCN),
    english: toWritableUserProfile(localizations.en),
    localizations,
    translation: createBilingualProfileTranslationSummary({
      apiKeyConfigured,
      directions: [enDirection, zhDirection],
    }),
  };
};

type ReadUsersEnProfileParameters = {
  sql: UserProfileSql;
  userId: string;
};

export const readUsersEnProfile = async ({
  sql,
  userId,
}: ReadUsersEnProfileParameters): Promise<UserProfileContent> => {
  const rows = await sql<UserEnglishProfileRow[]>`
    SELECT name, bio, tags
    FROM users_en
    WHERE user_id = ${userId}
    LIMIT 1
  `;
  const row = rows[0];
  if (row === undefined) {
    return createEmptyUserProfile();
  }

  return {
    name: row.name ?? "",
    bio: row.bio ?? "",
    tags: normalizeProfileTagLabels(row.tags),
  };
};

type ReadUserProfileLocalizationsParameters = {
  base: UserProfileWrite;
  sql: UserProfileSql;
  userId: string;
};

export const readUserProfileLocalizations = async ({
  base,
  sql,
  userId,
}: ReadUserProfileLocalizationsParameters): Promise<UserProfileLocalizations> => {
  const english = await readUsersEnProfile({ sql, userId });

  return {
    zhCN: {
      name: base.name ?? "",
      bio: base.bio ?? "",
      tags: normalizeProfileTagLabels(base.tags),
    },
    en: english,
  };
};

type UpsertUsersEnProfileParameters = {
  profile: UserProfileWrite;
  sql: UserProfileSql;
  userId: string;
};

export const upsertUsersEnProfile = async ({
  profile,
  sql,
  userId,
}: UpsertUsersEnProfileParameters) => {
  await sql`
    INSERT INTO users_en (user_id, name, bio, tags)
    VALUES (
      ${userId},
      ${profile.name},
      ${profile.bio},
      ${sql.array(profile.tags, 25)}::text[]
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
      name = EXCLUDED.name,
      bio = EXCLUDED.bio,
      tags = EXCLUDED.tags
  `;
};

type ReadLocalizedUserProfileParameters = {
  base: UserProfileWrite;
  locale: UserProfileLocale;
  sql: UserProfileSql;
  userId: string;
};

type PickLocalizedTextParameters = {
  fallback: string | null;
  preferred: string | null;
};

const pickLocalizedText = ({ fallback, preferred }: PickLocalizedTextParameters) => {
  const trimmedPreferred = preferred?.trim() ?? "";
  if (trimmedPreferred.length > 0) {
    return trimmedPreferred;
  }

  return fallback?.trim() ?? "";
};

export const readLocalizedUserProfile = async ({
  base,
  locale,
  sql,
  userId,
}: ReadLocalizedUserProfileParameters): Promise<UserProfileContent> => {
  const english = await readUsersEnProfile({ sql, userId });
  const baseProfile: UserProfileContent = {
    name: base.name ?? "",
    bio: base.bio ?? "",
    tags: normalizeProfileTagLabels(base.tags),
  };

  if (locale === "en") {
    return {
      name: pickLocalizedText({ fallback: baseProfile.name, preferred: english.name }),
      bio: pickLocalizedText({ fallback: baseProfile.bio, preferred: english.bio }),
      tags: english.tags.length > 0 ? english.tags : baseProfile.tags,
    };
  }

  return {
    name: pickLocalizedText({ fallback: english.name, preferred: baseProfile.name }),
    bio: pickLocalizedText({ fallback: english.bio, preferred: baseProfile.bio }),
    tags: baseProfile.tags.length > 0 ? baseProfile.tags : english.tags,
  };
};
