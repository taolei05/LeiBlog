import type { AppLanguage } from "./i18n";

export type AdminUser = {
  id: string;
  role: "admin";
  username: string;
  email: string;
  tags: string[];
  commentEmailNotifications: boolean;
  newPostEmailNotifications: boolean;
  name?: string;
  avatarUrl?: string;
  bio?: string;
  blogUrl?: string;
};

export type AdminAuthState = {
  token: string;
  user: AdminUser;
};

export type ManagedUserRole = "admin" | "user";

export type ManagedUser = {
  id: string;
  role: ManagedUserRole;
  username: string;
  email: string;
  tags: string[];
  englishTags: string[];
  commentEmailNotifications: boolean;
  newPostEmailNotifications: boolean;
  createdAt: string;
  updatedAt: string;
  name?: string;
  englishName?: string;
  avatarUrl?: string;
  bio?: string;
  englishBio?: string;
  blogUrl?: string;
};

export type UserManagementSummary = {
  total: number;
  administrators: number;
  users: number;
  notificationSubscribers: number;
};

export type UserManagementPageInfo = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type UserManagementList = {
  users: ManagedUser[];
  summary: UserManagementSummary;
  pageInfo: UserManagementPageInfo;
};

export type ManagedUserDetails = {
  profileLocalizations: AdminProfileLocalizations;
  user: ManagedUser;
};

export type ManagedUserMutationResult = ManagedUserDetails & {
  ok: true;
  profileTranslation: AdminProfileTranslation;
};

export type AdminSocialLink = {
  label: string;
  url: string;
};

export type AdminProfileLocalization = {
  name: string;
  bio: string;
  tags: string[];
};

export type AdminProfileLocalizations = {
  zhCN: AdminProfileLocalization;
  en: AdminProfileLocalization;
};

export type AdminProfileTranslationStatus =
  | "completed"
  | "incomplete"
  | "missing-api-key"
  | "not-needed";

export type AdminProfileTranslationLocale = "zh-CN" | "en";

export type AdminProfileTranslationField = "name" | "bio" | "tags";

export type AdminProfileTranslation = {
  status: AdminProfileTranslationStatus;
  sourceLocale: AdminProfileTranslationLocale;
  targetLocale: AdminProfileTranslationLocale;
  targetLocales?: AdminProfileTranslationLocale[];
  requestedFields: AdminProfileTranslationField[];
  completedFields: AdminProfileTranslationField[];
  missingFields: AdminProfileTranslationField[];
};

export type AdminSettings = {
  user: AdminUser;
  socialLinks: AdminSocialLink[];
  profileLocalizations: AdminProfileLocalizations;
  profileTranslation?: AdminProfileTranslation;
};

export type SiteFilingRecord = {
  number: string;
  url: string;
};

export type SiteSettingsTranslationField =
  | "siteName"
  | "siteDescription"
  | "homepageCopy"
  | "seoTitle"
  | "seoDescription";

export type SiteSettingsTranslation = {
  status: AdminProfileTranslationStatus;
  sourceLocale: AdminProfileTranslationLocale;
  targetLocale: AdminProfileTranslationLocale;
  targetLocales?: AdminProfileTranslationLocale[];
  requestedFields: SiteSettingsTranslationField[];
  completedFields: SiteSettingsTranslationField[];
  missingFields: SiteSettingsTranslationField[];
};

export type SiteSettingsContentLocalization = {
  siteName: string;
  siteDescription: string;
  homepageCopy: string;
  seoTitle: string;
  seoDescription: string;
};

export type SiteSettingsLocalizations = {
  zhCN: SiteSettingsContentLocalization;
  en: SiteSettingsContentLocalization;
};

export type SiteSettings = {
  siteLocalizations: SiteSettingsLocalizations;
  siteTranslation?: SiteSettingsTranslation;
  site: {
    siteName: string;
    foundedAt: string;
    siteDescription: string;
    coverUrls: string[];
    homepageCopy: string;
    lightLogoUrl: string;
    darkLogoUrl: string;
    faviconUrl: string;
  };
  basics: {
    seoTitle: string;
    seoDescription: string;
    seoKeywords: string[];
    copyright: string;
    commentsEnabled: boolean;
    resendDomain: string;
    resendApiKeyConfigured: boolean;
    deeplApiKeyConfigured: boolean;
    ipGeolocationApiKeyConfigured: boolean;
  };
  filings: {
    icpRecords: SiteFilingRecord[];
    policeRecordNumber: string;
    policeRecordUrl: string;
  };
};

export type UpdateAdminSettingsPayload = {
  profileLocalizations: AdminProfileLocalizations;
  username: string;
  email: string;
  avatarUrl: string;
  tagLocale: AppLanguage;
  socialLinks: AdminSocialLink[];
  blogUrl: string;
  commentEmailNotifications: boolean;
  newPostEmailNotifications: boolean;
  currentPassword: string;
  newPassword: string;
};

export type UpdateSiteSettingsPayload = {
  siteLocalizations: SiteSettingsLocalizations;
  site: {
    foundedAt: string;
    coverUrls: string[];
    lightLogoUrl: string;
    darkLogoUrl: string;
    faviconUrl: string;
  };
  basics: {
    seoKeywords: string[];
    copyright: string;
    commentsEnabled: boolean;
    resendDomain: string;
    resendApiKey: string;
    deeplApiKey: string;
    ipGeolocationApiKey: string;
  };
  filings: {
    icpRecords: SiteFilingRecord[];
    policeRecordNumber: string;
    policeRecordUrl: string;
  };
};

export type ManagedUserPayload = {
  profileLocalizations: AdminProfileLocalizations;
  role: ManagedUserRole;
  username: string;
  email: string;
  password: string;
  avatarUrl: string;
  blogUrl: string;
  commentEmailNotifications: boolean;
  newPostEmailNotifications: boolean;
};

export type AdminSetupStatus = {
  hasAdmin: boolean;
  requiresSetup: boolean;
};

type InitialSetupLink = {
  label: string;
  url: string;
};

type InitialSetupFilingRecord = {
  number: string;
  url: string;
};

export type InitialSetupPayload = {
  admin: {
    name: string;
    username: string;
    password: string;
    email: string;
    avatarUrl: string;
    bio: string;
    tags: string[];
    tagLocale: AppLanguage;
    socialLinks: InitialSetupLink[];
    blogUrl: string;
    commentEmailNotifications: boolean;
    newPostEmailNotifications: boolean;
  };
  site: {
    siteName: string;
    foundedAt: string;
    siteDescription: string;
    coverUrls: string[];
    homepageCopy: string;
    lightLogoUrl: string;
    darkLogoUrl: string;
    faviconUrl: string;
  };
  basics: {
    seoTitle: string;
    seoDescription: string;
    seoKeywords: string[];
    copyright: string;
    commentsEnabled: boolean;
    resendDomain: string;
    resendApiKey: string;
    deeplApiKey: string;
    ipGeolocationApiKey: string;
  };
  filings: {
    icpRecords: InitialSetupFilingRecord[];
    policeRecordNumber: string;
    policeRecordUrl: string;
  };
};

type LoginAdminParams = {
  identifier: string;
  locale: AppLanguage;
  password: string;
};

type GetManagedUsersParameters = {
  locale: AppLanguage;
  page: number;
  pageSize: number;
  query: string;
  role: ManagedUserRole | "all";
  token: string;
};

type GetManagedUserParameters = {
  locale: AppLanguage;
  token: string;
  userId: string;
};

type CreateManagedUserParameters = {
  locale: AppLanguage;
  payload: ManagedUserPayload;
  token: string;
};

type UpdateManagedUserParameters = {
  locale: AppLanguage;
  payload: ManagedUserPayload;
  token: string;
  userId: string;
};

type DeleteManagedUserParameters = {
  token: string;
  userId: string;
};

const DEFAULT_API_PORT = "3000";
const PROFILE_TAG_LOCALE_HEADER = "x-leiblog-locale";

const getDefaultApiBaseUrl = () => {
  if (typeof window === "undefined") {
    return `http://127.0.0.1:${DEFAULT_API_PORT}`;
  }

  return `${window.location.protocol}//${window.location.hostname}:${DEFAULT_API_PORT}`;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? getDefaultApiBaseUrl();

const parseJson = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get("content-type");
  if (contentType === null || !contentType.includes("application/json")) {
    return undefined;
  }

  return response.json() as Promise<unknown>;
};

const readErrorMessage = (body: unknown, fallback: string) => {
  if (typeof body !== "object" || body === null) {
    return fallback;
  }

  const record = body as Record<string, unknown>;
  return typeof record.message === "string" ? record.message : fallback;
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === "string";

const isManagedUserRole = (value: unknown): value is ManagedUserRole =>
  value === "admin" || value === "user";

const isAdminProfileTranslationLocale = (
  value: unknown,
): value is AdminProfileTranslationLocale => value === "zh-CN" || value === "en";

const isAdminProfileTranslationStatus = (
  value: unknown,
): value is AdminProfileTranslationStatus =>
  value === "completed" ||
  value === "incomplete" ||
  value === "missing-api-key" ||
  value === "not-needed";

const isAdminProfileTranslationField = (
  value: unknown,
): value is AdminProfileTranslationField =>
  value === "name" || value === "bio" || value === "tags";

const isAdminProfileTranslationFieldArray = (
  value: unknown,
): value is AdminProfileTranslationField[] =>
  Array.isArray(value) && value.every(isAdminProfileTranslationField);

const isSiteSettingsTranslationField = (
  value: unknown,
): value is SiteSettingsTranslationField =>
  value === "siteName" ||
  value === "siteDescription" ||
  value === "homepageCopy" ||
  value === "seoTitle" ||
  value === "seoDescription";

const isSiteSettingsTranslationFieldArray = (
  value: unknown,
): value is SiteSettingsTranslationField[] =>
  Array.isArray(value) && value.every(isSiteSettingsTranslationField);

const isAdminProfileTranslationLocaleArray = (
  value: unknown,
): value is AdminProfileTranslationLocale[] =>
  Array.isArray(value) && value.every(isAdminProfileTranslationLocale);

const isAdminProfileTranslation = (
  value: unknown,
): value is AdminProfileTranslation => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    isAdminProfileTranslationStatus(record.status) &&
    isAdminProfileTranslationLocale(record.sourceLocale) &&
    isAdminProfileTranslationLocale(record.targetLocale) &&
    (record.targetLocales === undefined ||
      isAdminProfileTranslationLocaleArray(record.targetLocales)) &&
    isAdminProfileTranslationFieldArray(record.requestedFields) &&
    isAdminProfileTranslationFieldArray(record.completedFields) &&
    isAdminProfileTranslationFieldArray(record.missingFields)
  );
};

const isAdminProfileLocalization = (
  value: unknown,
): value is AdminProfileLocalization => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.name === "string" &&
    typeof record.bio === "string" &&
    isStringArray(record.tags)
  );
};

const isAdminProfileLocalizations = (
  value: unknown,
): value is AdminProfileLocalizations => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    isAdminProfileLocalization(record.zhCN) &&
    isAdminProfileLocalization(record.en)
  );
};

const isSiteSettingsTranslation = (
  value: unknown,
): value is SiteSettingsTranslation => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    isAdminProfileTranslationStatus(record.status) &&
    isAdminProfileTranslationLocale(record.sourceLocale) &&
    isAdminProfileTranslationLocale(record.targetLocale) &&
    (record.targetLocales === undefined ||
      isAdminProfileTranslationLocaleArray(record.targetLocales)) &&
    isSiteSettingsTranslationFieldArray(record.requestedFields) &&
    isSiteSettingsTranslationFieldArray(record.completedFields) &&
    isSiteSettingsTranslationFieldArray(record.missingFields)
  );
};

const isSiteSettingsContentLocalization = (
  value: unknown,
): value is SiteSettingsContentLocalization => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.siteName === "string" &&
    typeof record.siteDescription === "string" &&
    typeof record.homepageCopy === "string" &&
    typeof record.seoTitle === "string" &&
    typeof record.seoDescription === "string"
  );
};

const isSiteSettingsLocalizations = (
  value: unknown,
): value is SiteSettingsLocalizations => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    isSiteSettingsContentLocalization(record.zhCN) &&
    isSiteSettingsContentLocalization(record.en)
  );
};

const isAdminUser = (value: unknown): value is AdminUser => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    record.role === "admin" &&
    typeof record.username === "string" &&
    typeof record.email === "string" &&
    isStringArray(record.tags) &&
    typeof record.commentEmailNotifications === "boolean" &&
    typeof record.newPostEmailNotifications === "boolean"
  );
};

const isManagedUser = (value: unknown): value is ManagedUser => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    isManagedUserRole(record.role) &&
    typeof record.username === "string" &&
    typeof record.email === "string" &&
    isStringArray(record.tags) &&
    isStringArray(record.englishTags) &&
    typeof record.commentEmailNotifications === "boolean" &&
    typeof record.newPostEmailNotifications === "boolean" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string" &&
    isOptionalString(record.name) &&
    isOptionalString(record.englishName) &&
    isOptionalString(record.avatarUrl) &&
    isOptionalString(record.bio) &&
    isOptionalString(record.englishBio) &&
    isOptionalString(record.blogUrl)
  );
};

const isAdminAuthState = (value: unknown): value is AdminAuthState => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return typeof record.token === "string" && isAdminUser(record.user);
};

const isAdminMeResponse = (value: unknown): value is { user: AdminUser } => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isAdminUser(record.user);
};

const isAdminSocialLink = (value: unknown): value is AdminSocialLink => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return typeof record.label === "string" && typeof record.url === "string";
};

const isSiteFilingRecord = (value: unknown): value is SiteFilingRecord => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return typeof record.number === "string" && typeof record.url === "string";
};

const isAdminSettings = (value: unknown): value is AdminSettings => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    isAdminUser(record.user) &&
    Array.isArray(record.socialLinks) &&
    record.socialLinks.every(isAdminSocialLink) &&
    isAdminProfileLocalizations(record.profileLocalizations) &&
    (record.profileTranslation === undefined ||
      isAdminProfileTranslation(record.profileTranslation))
  );
};

const isSiteSettings = (value: unknown): value is SiteSettings => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const site = record.site;
  const basics = record.basics;
  const filings = record.filings;

  if (
    typeof site !== "object" ||
    site === null ||
    typeof basics !== "object" ||
    basics === null ||
    typeof filings !== "object" ||
    filings === null
  ) {
    return false;
  }

  const siteRecord = site as Record<string, unknown>;
  const basicsRecord = basics as Record<string, unknown>;
  const filingsRecord = filings as Record<string, unknown>;

  return (
    isSiteSettingsLocalizations(record.siteLocalizations) &&
    (record.siteTranslation === undefined ||
      isSiteSettingsTranslation(record.siteTranslation)) &&
    typeof siteRecord.siteName === "string" &&
    typeof siteRecord.foundedAt === "string" &&
    typeof siteRecord.siteDescription === "string" &&
    isStringArray(siteRecord.coverUrls) &&
    typeof siteRecord.homepageCopy === "string" &&
    typeof siteRecord.lightLogoUrl === "string" &&
    typeof siteRecord.darkLogoUrl === "string" &&
    typeof siteRecord.faviconUrl === "string" &&
    typeof basicsRecord.seoTitle === "string" &&
    typeof basicsRecord.seoDescription === "string" &&
    isStringArray(basicsRecord.seoKeywords) &&
    typeof basicsRecord.copyright === "string" &&
    typeof basicsRecord.commentsEnabled === "boolean" &&
    typeof basicsRecord.resendDomain === "string" &&
    typeof basicsRecord.resendApiKeyConfigured === "boolean" &&
    typeof basicsRecord.deeplApiKeyConfigured === "boolean" &&
    typeof basicsRecord.ipGeolocationApiKeyConfigured === "boolean" &&
    Array.isArray(filingsRecord.icpRecords) &&
    filingsRecord.icpRecords.every(isSiteFilingRecord) &&
    typeof filingsRecord.policeRecordNumber === "string" &&
    typeof filingsRecord.policeRecordUrl === "string"
  );
};

const isUserManagementSummary = (value: unknown): value is UserManagementSummary => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.total === "number" &&
    typeof record.administrators === "number" &&
    typeof record.users === "number" &&
    typeof record.notificationSubscribers === "number"
  );
};

const isUserManagementPageInfo = (value: unknown): value is UserManagementPageInfo => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.page === "number" &&
    typeof record.pageSize === "number" &&
    typeof record.totalItems === "number" &&
    typeof record.totalPages === "number"
  );
};

const isUserManagementList = (value: unknown): value is UserManagementList => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    Array.isArray(record.users) &&
    record.users.every(isManagedUser) &&
    isUserManagementSummary(record.summary) &&
    isUserManagementPageInfo(record.pageInfo)
  );
};

const isManagedUserDetails = (value: unknown): value is ManagedUserDetails => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    isManagedUser(record.user) &&
    isAdminProfileLocalizations(record.profileLocalizations)
  );
};

const isManagedUserMutationResult = (
  value: unknown,
): value is ManagedUserMutationResult => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    record.ok === true &&
    isManagedUserDetails(value) &&
    isAdminProfileTranslation(record.profileTranslation)
  );
};

const isDeleteManagedUserResponse = (value: unknown): value is { ok: true } => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return record.ok === true;
};

const isAdminSetupStatus = (value: unknown): value is AdminSetupStatus => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return typeof record.hasAdmin === "boolean" && typeof record.requiresSetup === "boolean";
};

export const getAdminSetupStatus = async () => {
  const response = await fetch(`${API_BASE_URL}/api/admin/setup/status`);
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Setup status request failed."));
  }

  if (!isAdminSetupStatus(body)) {
    throw new Error("Setup status response was invalid.");
  }

  return body;
};

export const loginAdmin = async ({ identifier, locale, password }: LoginAdminParams) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ identifier: identifier.trim(), locale, password }),
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Login failed."));
  }

  if (!isAdminAuthState(body)) {
    throw new Error("Login response was invalid.");
  }

  return body;
};

export const completeInitialSetup = async (payload: InitialSetupPayload) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/setup/initial`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Initial setup failed."));
  }

  if (!isAdminAuthState(body)) {
    throw new Error("Initial setup response was invalid.");
  }

  return body;
};

export const getAdminMe = async (token: string, locale: AppLanguage) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      [PROFILE_TAG_LOCALE_HEADER]: locale,
    },
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Session expired."));
  }

  if (!isAdminMeResponse(body)) {
    throw new Error("Profile response was invalid.");
  }

  return body.user;
};

export const getAdminSettings = async (token: string, locale: AppLanguage) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/settings/administrator`, {
    headers: {
      Authorization: `Bearer ${token}`,
      [PROFILE_TAG_LOCALE_HEADER]: locale,
    },
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Administrator settings request failed."));
  }

  if (!isAdminSettings(body)) {
    throw new Error("Administrator settings response was invalid.");
  }

  return body;
};

export const getManagedUsers = async ({
  locale,
  page,
  pageSize,
  query,
  role,
  token,
}: GetManagedUsersParameters) => {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    query: query.trim(),
    role,
  });
  const response = await fetch(`${API_BASE_URL}/api/admin/users?${searchParams.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      [PROFILE_TAG_LOCALE_HEADER]: locale,
    },
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "User management request failed."));
  }

  if (!isUserManagementList(body)) {
    throw new Error("User management response was invalid.");
  }

  return body;
};

export const getManagedUser = async ({ locale, token, userId }: GetManagedUserParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      [PROFILE_TAG_LOCALE_HEADER]: locale,
    },
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "User details request failed."));
  }

  if (!isManagedUserDetails(body)) {
    throw new Error("User details response was invalid.");
  }

  return body;
};

export const createManagedUser = async ({
  locale,
  payload,
  token,
}: CreateManagedUserParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      [PROFILE_TAG_LOCALE_HEADER]: locale,
    },
    body: JSON.stringify(payload),
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "User creation failed."));
  }

  if (!isManagedUserMutationResult(body)) {
    throw new Error("User creation response was invalid.");
  }

  return body;
};

export const updateManagedUser = async ({
  locale,
  payload,
  token,
  userId,
}: UpdateManagedUserParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      [PROFILE_TAG_LOCALE_HEADER]: locale,
    },
    body: JSON.stringify(payload),
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "User update failed."));
  }

  if (!isManagedUserMutationResult(body)) {
    throw new Error("User update response was invalid.");
  }

  return body;
};

export const deleteManagedUser = async ({ token, userId }: DeleteManagedUserParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "User deletion failed."));
  }

  if (!isDeleteManagedUserResponse(body)) {
    throw new Error("User deletion response was invalid.");
  }

  return body;
};

export const updateAdminSettings = async ({
  token,
  payload,
}: {
  token: string;
  payload: UpdateAdminSettingsPayload;
}) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/settings/administrator`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Administrator settings update failed."));
  }

  if (!isAdminSettings(body)) {
    throw new Error("Administrator settings response was invalid.");
  }

  return body;
};

export const getSiteSettings = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/settings/site`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Site settings request failed."));
  }

  if (!isSiteSettings(body)) {
    throw new Error("Site settings response was invalid.");
  }

  return body;
};

export const updateSiteSettings = async ({
  token,
  payload,
}: {
  token: string;
  payload: UpdateSiteSettingsPayload;
}) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/settings/site`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Site settings update failed."));
  }

  if (!isSiteSettings(body)) {
    throw new Error("Site settings response was invalid.");
  }

  return body;
};

export const logoutAdmin = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/auth/logout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Logout failed."));
  }
};
