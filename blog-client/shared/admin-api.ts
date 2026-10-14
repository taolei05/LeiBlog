import type { AppLanguage } from "./i18n";
import { resolveApiBaseUrl } from "./api-base-url";
import { versionLocalMediaUrl } from "./media-url";
import { uploadFileRequest } from "./upload-request";
import type { UploadProgressHandler } from "./upload-request";

// A blank token selects HttpOnly cookie transport; API clients can still supply a bearer token.
export const COOKIE_ADMIN_AUTH_TOKEN = "";

const fetch: typeof globalThis.fetch = (input, init) => {
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined),
  );
  if (headers.get("authorization")?.trim() === "Bearer") {
    headers.delete("authorization");
  }
  return globalThis.fetch(input, { credentials: "include", ...init, headers });
};

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

export type AdminLoginMethod = "apple" | "github" | "google" | "password";

export type AdminLoginEvent = {
  id: string;
  createdAt: string;
  timeZone: string | null;
  timeZoneOffsetMinutes: number | null;
  ip: string | null;
  location: string | null;
  locationEn?: string | null;
  device: string | null;
  method: AdminLoginMethod | null;
  success: boolean;
  failureReason: string | null;
};

export type AdminLoginInfo = {
  lastLoginAt: string | null;
  lastLoginTimeZone: string | null;
  lastLoginTimeZoneOffsetMinutes: number | null;
  lastLoginIp: string | null;
  lastLoginLocation: string | null;
  lastLoginLocationEn?: string | null;
  lastLoginDevice: string | null;
  lastLoginMethod: AdminLoginMethod | null;
  recentLogins: AdminLoginEvent[];
};

export type AdminAuthState = {
  token: string;
  user: AdminUser;
};

export type BlogUserRole = "admin" | "user";

export type BlogUser = {
  profileLocalizations?: AdminProfileLocalizations;
  profileTranslation?: AdminProfileTranslation;
  avatarUrl?: string;
  bio?: string;
  blogUrl?: string;
  commentEmailNotifications?: boolean;
  createdAt?: string;
  id: string;
  lastLoginAt?: string | null;
  lastLoginDevice?: string | null;
  lastLoginIp?: string | null;
  lastLoginLocation?: string | null;
  lastLoginLocationEn?: string | null;
  lastLoginMethod?: AdminLoginMethod | null;
  lastLoginTimeZone?: string | null;
  lastLoginTimeZoneOffsetMinutes?: number | null;
  name?: string;
  newPostEmailNotifications?: boolean;
  role: BlogUserRole;
  tags?: string[];
  updatedAt?: string;
  username: string;
  email: string;
};

export type BlogAuthState = {
  user: BlogUser;
};

export type BlogEmailCodePurpose =
  | "email_change_current"
  | "email_change_new"
  | "password_change"
  | "password_reset"
  | "register";

export type BlogEmailCodeResponse = {
  expiresAt: string;
  ok: true;
  sent: boolean;
  validMinutes: number;
  devCode?: string;
};

export type AltchaPayload = string;

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

export type MediaFileType = "document" | "image" | "video";
export type MediaStorageProvider = "local" | "r2";

export type MediaAsset = {
  id: string;
  fileName: string;
  fileFormat: string;
  fileType: MediaFileType;
  fileSizeBytes: number;
  accessUrl: string;
  storageProvider: MediaStorageProvider;
  createdAt: string;
  updatedAt: string;
  folderId?: string;
  folderName?: string;
  folderSlug?: string;
  uploadedBy?: string;
};

export type MediaFolder = {
  id: string;
  name: string;
  slug: string;
  description: string;
  fileCount: number;
  isProtected: boolean;
  createdAt: string;
  updatedAt: string;
  systemKey?: string;
};

export type MediaFolderList = {
  folders: MediaFolder[];
};

export type MediaLibrarySummary = {
  total: number;
  images: number;
  videos: number;
  documents: number;
  storageBytes: number;
};

export type MediaLibraryPageInfo = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type MediaLibraryList = {
  media: MediaAsset[];
  summary: MediaLibrarySummary;
  pageInfo: MediaLibraryPageInfo;
};

export type MediaStorageMigrationResponse = {
  items: MediaAsset[];
  ok: true;
  updatedReferences: number;
};

export type NavigationItem = {
  createdAt: string;
  groupId: string;
  iconUrl: string | null;
  id: string;
  name: string;
  note: string | null;
  sortOrder: number;
  updatedAt: string;
  url: string;
};

export type NavigationGroup = {
  createdAt: string;
  id: string;
  items: NavigationItem[];
  name: string;
  nameEn: string | null;
  sortOrder: number;
  updatedAt: string;
};

export type NavigationList = {
  groups: NavigationGroup[];
  ok: boolean;
};

export type PublicNavigationItem = {
  iconUrl: string | null;
  id: string;
  name: string;
  note: string | null;
  url: string;
};

export type PublicNavigationGroup = {
  id: string;
  items: PublicNavigationItem[];
  name: string;
  nameEn: string | null;
};

export type PublicNavigationList = {
  groups: PublicNavigationGroup[];
  ok: boolean;
};

export type ArticleStatus = "draft" | "published" | "scheduled";

export type ContentPageInfo = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type ArticleTaxonomyLocalization = {
  description: string;
  name: string;
};

export type ArticleTaxonomyLocalizations = {
  en: ArticleTaxonomyLocalization;
  zhCN: ArticleTaxonomyLocalization;
};

export type ArticleLocalization = {
  contentMdx: string;
  summary: string;
  title: string;
};

export type ArticleLocalizations = {
  en: ArticleLocalization;
  zhCN: ArticleLocalization;
};

export type ArticleRelation = {
  color: string | null;
  description: string | null;
  id: string;
  localizations: ArticleTaxonomyLocalizations;
  name: string;
  slug: string;
};

export type ArticleContributorRelation = {
  avatarUrl: string | null;
  id: string;
  linkUrl: string | null;
  name: string;
};

export type ArticleCategory = {
  articleCount: number;
  createdAt: string;
  description: string | null;
  id: string;
  localizations: ArticleTaxonomyLocalizations;
  name: string;
  slug: string;
  sortOrder: number;
  updatedAt: string;
};

export type ArticleTag = {
  articleCount: number;
  color: string | null;
  createdAt: string;
  description: string | null;
  id: string;
  localizations: ArticleTaxonomyLocalizations;
  name: string;
  slug: string;
  updatedAt: string;
};

export type ArticleContributor = ArticleContributorRelation & {
  articleCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ArticleContent = {
  authorId: string | null;
  authorName: string | null;
  categories: ArticleRelation[];
  commentCount: number;
  contributors: ArticleContributorRelation[];
  contentMdx: string;
  coverImageUrl: string | null;
  createdAt: string;
  id: string;
  isPinned: boolean;
  localizations: ArticleLocalizations;
  publishedAt: string | null;
  readCount: number;
  scheduledPublishAt: string | null;
  slug: string;
  status: ArticleStatus;
  summary: string | null;
  tags: ArticleRelation[];
  title: string;
  updatedAt: string;
};

export type ArticleContentList = {
  items: ArticleContent[];
  ok: true;
  pageInfo: ContentPageInfo;
};

export type ArticleCategoryList = {
  items: ArticleCategory[];
  ok: true;
  pageInfo: ContentPageInfo;
};

export type ArticleTagList = {
  items: ArticleTag[];
  ok: true;
  pageInfo: ContentPageInfo;
};

export type ArticleContributorList = {
  items: ArticleContributor[];
  ok: true;
  pageInfo: ContentPageInfo;
};

export type ArticleContentPayload = {
  categoryIds: string[];
  contentMdx: string;
  contributorIds: string[];
  coverImageUrl: string | null;
  isPinned: boolean;
  localizations: {
    en: Partial<ArticleLocalization>;
  };
  publishedAt: string | null;
  scheduledPublishAt: string | null;
  slug: string;
  status: ArticleStatus;
  summary: string | null;
  tagIds: string[];
  title: string;
};

export type ArticleCategoryPayload = {
  description: string | null;
  localizations: {
    en: Partial<ArticleTaxonomyLocalization>;
  };
  name: string;
  slug: string;
};

export type ArticleTagPayload = ArticleCategoryPayload & {
  color: string | null;
};

export type ArticleContributorPayload = {
  avatarUrl: string | null;
  linkUrl: string | null;
  name: string;
};

export type CommentStatus = "approved" | "pending" | "rejected";
export type CommentTargetType = "article" | "guestbook";

export type CommentAuthor = {
  avatarUrl: string | null;
  blogUrl: string | null;
  id: string;
  name: string | null;
  role: BlogUserRole;
  tags: string[];
  username: string;
};

export type CommentItem = {
  articleId: string | null;
  articleTitle: string | null;
  author: CommentAuthor;
  content: string;
  createdAt: string;
  deletedAt: string | null;
  id: string;
  location: string | null;
  parentId: string | null;
  status: CommentStatus;
  targetType: CommentTargetType;
  updatedAt: string;
  userId: string;
};

export type CommentList = {
  items: CommentItem[];
  ok: true;
  pageInfo: ContentPageInfo;
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
  loginInfo: AdminLoginInfo;
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
    timeZone: string;
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
  storage: {
    r2AccessKeyId: string;
    r2AccountId: string;
    r2Bucket: string;
    r2Enabled: boolean;
    r2PublicBaseUrl: string;
    r2SecretAccessKeyConfigured: boolean;
  };
};

export type PublicSiteAuthor = {
  avatarUrl: string;
  blogUrl: string;
  profileLocalizations: AdminProfileLocalizations;
  socialLinks: AdminSocialLink[];
  username: string;
};

export type PublicSiteSettings = {
  author: PublicSiteAuthor | null;
  basics: {
    commentsEnabled: boolean;
    copyright: string;
  };
  filings: {
    icpRecords: SiteFilingRecord[];
    policeRecordNumber: string;
    policeRecordUrl: string;
  };
  siteLocalizations: SiteSettingsLocalizations;
  site: {
    siteName: string;
    foundedAt: string;
    siteDescription: string;
    coverUrls: string[];
    lightLogoUrl: string;
    darkLogoUrl: string;
    faviconUrl: string;
    timeZone: string;
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
    timeZone: string;
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
  storage: {
    r2AccessKeyId: string;
    r2AccountId: string;
    r2Bucket: string;
    r2Enabled: boolean;
    r2PublicBaseUrl: string;
    r2SecretAccessKey: string;
  };
};

export type SiteSettingsIntegrationTestResponse = {
  ok: true;
  message: string;
  details?: string;
};

export type SiteSettingsApiKeys = {
  deeplApiKey: string;
  ipGeolocationApiKey: string;
  r2SecretAccessKey: string;
  resendApiKey: string;
};

export type SiteSettingsApiKeyRevealCodeResponse = {
  ok: true;
  expiresAt: string;
  message: string;
  sent: boolean;
  validMinutes: number;
};

export type SiteSettingsApiKeysResponse = {
  ok: true;
  item: SiteSettingsApiKeys;
};

export type AuthProvider = "github" | "google";

export type PublicAuthProvider = {
  displayName: string;
  provider: AuthProvider;
};

export type PublicAuthProvidersResponse = {
  items: PublicAuthProvider[];
  ok: true;
};

export type AuthProviderSettingsItem = {
  provider: AuthProvider;
  displayName: string;
  enabled: boolean;
  clientId: string;
  hasClientSecret: boolean;
  redirectUri: string;
  scopes: string[];
};

export type AuthProviderSettingsResponse = {
  ok: true;
  items: AuthProviderSettingsItem[];
};

export type UpdateAuthProviderSettingsPayload = {
  clientId?: string | null;
  clientSecret?: string | null;
  displayName?: string | null;
  enabled: boolean;
  redirectUri?: string | null;
  scopes?: string[];
};

export type AuthProviderClientSecretResponse = {
  ok: true;
  item: {
    provider: AuthProvider;
    clientSecret: string;
  };
};

export type BackupManifest = {
  createdAt: string;
  format: "leiblog-backup";
  media: {
    included: boolean;
    total: number;
    totalBytes: number;
  };
  sensitiveFieldsExcluded: string[];
  tables: string[];
  version: number;
};

export type BackupPreviewResponse = {
  manifest: BackupManifest;
  media: {
    included: boolean;
    total: number;
    totalBytes: number;
  };
  ok: true;
  sensitiveConfigExported: boolean;
  tables: Record<string, number>;
};

export type BackupImportResponse = {
  importedMedia: number;
  importedRows: number;
  mode: "replace";
  ok: true;
  tables: Record<string, number>;
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
  requiresSetupToken?: boolean;
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
  setupToken?: string;
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
    timeZone: string;
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
  altcha: AltchaPayload;
  identifier: string;
  locale: AppLanguage;
  password: string;
};

type LoginBlogUserParams = {
  altcha: AltchaPayload;
  identifier: string;
  password: string;
};

type RegisterBlogUserParams = {
  altcha: AltchaPayload;
  username: string;
  password: string;
  email: string;
  emailCode: string;
  name?: string;
};

type RequestBlogEmailCodeParams = {
  altcha: AltchaPayload;
  email: string;
  locale: AppLanguage;
  purpose: Extract<BlogEmailCodePurpose, "password_reset" | "register">;
};

type StartBlogOAuthLoginParams = {
  altcha: AltchaPayload;
  locale: AppLanguage;
  provider: AuthProvider;
  returnTo: string;
};

type ResetBlogPasswordParams = {
  altcha: AltchaPayload;
  email: string;
  emailCode: string;
  password: string;
};

type RequestBlogAccountEmailCodeParams = (
  | {
      purpose: Extract<BlogEmailCodePurpose, "email_change_current" | "password_change">;
    }
  | {
      email: string;
      purpose: Extract<BlogEmailCodePurpose, "email_change_new">;
    }
) & {
  altcha: AltchaPayload;
  locale: AppLanguage;
};

type ChangeBlogUserEmailParams = {
  currentEmailCode: string;
  newEmail: string;
  newEmailCode: string;
};

type ChangeBlogUserPasswordParams =
  | {
      currentPassword: string;
      method: "password";
      newPassword: string;
    }
  | {
      emailCode: string;
      method: "email_code";
      newPassword: string;
    };

type UpdateBlogUserProfileParams = {
  profileLocalizations?: AdminProfileLocalizations;
  notificationEmailLocale?: "en" | "zh-CN";
  avatarUrl?: string;
  bio?: string;
  blogUrl?: string;
  commentEmailNotifications?: boolean;
  name?: string;
  newPostEmailNotifications?: boolean;
  tags?: string[];
  username?: string;
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

type MediaFileTypeFilter = MediaFileType | "all";
type MediaStorageProviderFilter = MediaStorageProvider | "all";

type GetMediaAssetsParameters = {
  fileType: MediaFileTypeFilter;
  folderSlug?: string;
  page: number;
  pageSize: number;
  query: string;
  storageProvider?: MediaStorageProviderFilter;
  token: string;
};

type MediaFolderPayload = {
  description: string;
  name: string;
  slug: string;
};

type GetMediaFoldersParameters = {
  token: string;
};

type CreateMediaFolderParameters = {
  payload: MediaFolderPayload;
  token: string;
};

type UpdateMediaFolderParameters = {
  folderId: string;
  payload: MediaFolderPayload;
  token: string;
};

type DeleteMediaFolderParameters = {
  folderId: string;
  token: string;
};

type UploadMediaAssetParameters = {
  onUploadProgress?: UploadProgressHandler;
  file: File;
  fileName?: string;
  folderSlug?: string;
  targetProvider?: MediaStorageProvider;
  token: string;
};

type MigrateMediaStorageParameters = {
  ids: string[];
  targetProvider: MediaStorageProvider;
  token: string;
};

type NavigationGroupPayload = {
  name: string;
  nameEn?: string | null;
};

type NavigationItemPayload = {
  groupId: string;
  iconUrl?: string | null;
  name: string;
  note?: string | null;
  url: string;
};

type NavigationGroupMutationParameters = {
  payload: NavigationGroupPayload;
  token: string;
};

type UpdateNavigationGroupParameters = NavigationGroupMutationParameters & {
  groupId: string;
};

type DeleteNavigationGroupParameters = {
  groupId: string;
  token: string;
};

type NavigationItemMutationParameters = {
  payload: NavigationItemPayload;
  token: string;
};

type UpdateNavigationItemParameters = NavigationItemMutationParameters & {
  itemId: string;
};

type DeleteNavigationItemParameters = {
  itemId: string;
  token: string;
};

type ReorderNavigationGroupsParameters = {
  groupIds: string[];
  token: string;
};

type ReorderNavigationItemsParameters = {
  groupId: string;
  itemIds: string[];
  token: string;
};

type GetArticlesParameters = {
  categorySlug?: string;
  page: number;
  pageSize: number;
  query: string;
  sortBy?: "createdAt" | "publishedAt" | "readCount" | "title" | "updatedAt";
  sortOrder?: "asc" | "desc";
  tagSlug?: string;
};

type GetAdminArticlesParameters = GetArticlesParameters & {
  status: ArticleStatus | "all";
  token: string;
};

type GetAdminTaxonomiesParameters = {
  page: number;
  pageSize: number;
  query: string;
  token: string;
};

type GetArticleContributorsParameters = GetAdminTaxonomiesParameters;

type ArticleContentMutationParameters = {
  payload: ArticleContentPayload;
  token: string;
};

type UpdateArticleContentParameters = ArticleContentMutationParameters & {
  articleId: string;
};

type DeleteArticleContentParameters = {
  articleId: string;
  token: string;
};

type ArticleCategoryMutationParameters = {
  payload: ArticleCategoryPayload;
  token: string;
};

type UpdateArticleCategoryParameters = ArticleCategoryMutationParameters & {
  categoryId: string;
};

type DeleteArticleCategoryParameters = {
  categoryId: string;
  token: string;
};

type ArticleTagMutationParameters = {
  payload: ArticleTagPayload;
  token: string;
};

type UpdateArticleTagParameters = ArticleTagMutationParameters & {
  tagId: string;
};

type DeleteArticleTagParameters = {
  tagId: string;
  token: string;
};

type ArticleContributorMutationParameters = {
  payload: ArticleContributorPayload;
  token: string;
};

type UpdateArticleContributorParameters = ArticleContributorMutationParameters & {
  contributorId: string;
};

type DeleteArticleContributorParameters = {
  contributorId: string;
  token: string;
};

type GetAdminCommentsParameters = {
  includeDeleted: boolean;
  page: number;
  pageSize: number;
  query: string;
  sortBy?: "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
  status: CommentStatus | "all";
  targetType: CommentTargetType | "all";
  token: string;
};

type ReviewAdminCommentParameters = {
  commentId: string;
  status: CommentStatus;
  token: string;
};

type DeleteAdminCommentParameters = {
  commentId: string;
  token: string;
};

type GetPublicArticleCommentsParameters = {
  articleSlug: string;
  locale: AppLanguage;
  page: number;
  pageSize: number;
  parentId?: string | null;
};

type GetPublicGuestbookCommentsParameters = {
  locale: AppLanguage;
  page: number;
  pageSize: number;
  parentId?: string | null;
};

type CreatePublicArticleCommentParameters = {
  altcha: AltchaPayload;
  articleSlug: string;
  content: string;
  locale: AppLanguage;
  parentId?: string | null;
};

type CreatePublicGuestbookCommentParameters = {
  altcha: AltchaPayload;
  content: string;
  locale: AppLanguage;
  parentId?: string | null;
};

type UploadPublicCommentImageParameters = {
  onUploadProgress?: UploadProgressHandler;
  file: File;
};

type UploadBlogUserAvatarParameters = {
  onUploadProgress?: UploadProgressHandler;
  file: File;
  fileName?: string;
};

type UploadInitialSetupMediaAssetParameters = {
  onUploadProgress?: UploadProgressHandler;
  file: File;
  fileName?: string;
  folderSlug?: string;
  setupToken?: string;
};

type UpdateMediaAssetParameters = {
  fileName: string;
  mediaId: string;
  token: string;
};

type DeleteMediaAssetParameters = {
  mediaId: string;
  token: string;
};

type DownloadMediaAssetParameters = {
  fileName: string;
  mediaId: string;
  token: string;
};

type TestResendApiKeyParameters = {
  locale: AppLanguage;
  resendApiKey: string;
  resendDomain: string;
  token: string;
};

type TestDeepLApiKeyParameters = {
  apiKey: string;
  locale: AppLanguage;
  token: string;
};

type TestIpGeolocationApiKeyParameters = {
  apiKey: string;
  locale: AppLanguage;
  token: string;
};

type SendSiteSettingsApiKeyRevealCodeParameters = {
  altcha: AltchaPayload;
  locale: AppLanguage;
  token: string;
};

type RevealSiteSettingsApiKeysParameters = {
  emailCode: string;
  locale: AppLanguage;
  token: string;
};

type UpdateAuthProviderSettingsParameters = {
  locale: AppLanguage;
  payload: UpdateAuthProviderSettingsPayload;
  provider: AuthProvider;
  token: string;
};

type SendAuthProviderClientSecretRevealCodeParameters = {
  altcha: AltchaPayload;
  locale: AppLanguage;
  provider: AuthProvider;
  token: string;
};

type RevealAuthProviderClientSecretParameters = {
  emailCode: string;
  locale: AppLanguage;
  provider: AuthProvider;
  token: string;
};

type DownloadBackupArchiveParameters = {
  token: string;
};

type PreviewBackupArchiveParameters = {
  onUploadProgress?: UploadProgressHandler;
  file: File;
  token: string;
};

type ImportBackupArchiveParameters = PreviewBackupArchiveParameters & {
  mode: "replace";
};

const PROFILE_TAG_LOCALE_HEADER = "x-leiblog-locale";

const API_BASE_URL = resolveApiBaseUrl({
  configuredUrl: import.meta.env.VITE_API_BASE_URL,
  isProduction: import.meta.env.PROD,
  location: typeof window === "undefined" ? undefined : window.location,
});

export const getAltchaChallengeUrl = () => `${API_BASE_URL}/api/altcha/challenge`;

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

type UploadJsonParameters<Result> = {
  body: FormData;
  file: File;
  headers?: HeadersInit;
  onUploadProgress?: UploadProgressHandler;
  url: string;
  isResponse: (value: unknown) => value is Result;
  failureMessage: string;
  invalidMessage: string;
};

const uploadJson = <Result>({
  body,
  file,
  headers,
  onUploadProgress,
  url,
  isResponse,
  failureMessage,
  invalidMessage,
}: UploadJsonParameters<Result>) =>
  uploadFileRequest({
    body,
    file,
    headers,
    onProgress: onUploadProgress,
    url,
    readResponse: async (response) => {
      const payload = await parseJson(response);
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, failureMessage));
      }
      if (!isResponse(payload)) {
        throw new Error(invalidMessage);
      }
      return payload;
    },
  });

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === "string";

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

const isOptionalNullableString = (value: unknown): value is string | null | undefined =>
  value === undefined || isNullableString(value);

const isManagedUserRole = (value: unknown): value is ManagedUserRole =>
  value === "admin" || value === "user";

const isBlogUserRole = (value: unknown): value is BlogUserRole =>
  value === "admin" || value === "user";

const isAdminLoginMethod = (value: unknown): value is AdminLoginMethod =>
  value === "apple" || value === "github" || value === "google" || value === "password";

const isMediaFileType = (value: unknown): value is MediaFileType =>
  value === "document" || value === "image" || value === "video";

const isMediaStorageProvider = (value: unknown): value is MediaStorageProvider =>
  value === "local" || value === "r2";

const isArticleStatus = (value: unknown): value is ArticleStatus =>
  value === "draft" || value === "published" || value === "scheduled";

const isCommentStatus = (value: unknown): value is CommentStatus =>
  value === "approved" || value === "pending" || value === "rejected";

const isCommentTargetType = (value: unknown): value is CommentTargetType =>
  value === "article" || value === "guestbook";

const isAdminProfileTranslationLocale = (value: unknown): value is AdminProfileTranslationLocale =>
  value === "zh-CN" || value === "en";

const isAdminProfileTranslationStatus = (value: unknown): value is AdminProfileTranslationStatus =>
  value === "completed" ||
  value === "incomplete" ||
  value === "missing-api-key" ||
  value === "not-needed";

const isAdminProfileTranslationField = (value: unknown): value is AdminProfileTranslationField =>
  value === "name" || value === "bio" || value === "tags";

const isAdminProfileTranslationFieldArray = (
  value: unknown,
): value is AdminProfileTranslationField[] =>
  Array.isArray(value) && value.every(isAdminProfileTranslationField);

const isSiteSettingsTranslationField = (value: unknown): value is SiteSettingsTranslationField =>
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

const isAdminProfileTranslation = (value: unknown): value is AdminProfileTranslation => {
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

const isAdminProfileLocalization = (value: unknown): value is AdminProfileLocalization => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.name === "string" && typeof record.bio === "string" && isStringArray(record.tags)
  );
};

const isAdminProfileLocalizations = (value: unknown): value is AdminProfileLocalizations => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return isAdminProfileLocalization(record.zhCN) && isAdminProfileLocalization(record.en);
};

const isAdminLoginEvent = (value: unknown): value is AdminLoginEvent => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.createdAt === "string" &&
    isNullableString(record.timeZone) &&
    (record.timeZoneOffsetMinutes === null || typeof record.timeZoneOffsetMinutes === "number") &&
    isNullableString(record.ip) &&
    isNullableString(record.location) &&
    isOptionalNullableString(record.locationEn) &&
    isNullableString(record.device) &&
    (record.method === null || isAdminLoginMethod(record.method)) &&
    typeof record.success === "boolean" &&
    isNullableString(record.failureReason)
  );
};

const isAdminLoginInfo = (value: unknown): value is AdminLoginInfo => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    isNullableString(record.lastLoginAt) &&
    isNullableString(record.lastLoginTimeZone) &&
    (record.lastLoginTimeZoneOffsetMinutes === null ||
      typeof record.lastLoginTimeZoneOffsetMinutes === "number") &&
    isNullableString(record.lastLoginIp) &&
    isNullableString(record.lastLoginLocation) &&
    isOptionalNullableString(record.lastLoginLocationEn) &&
    isNullableString(record.lastLoginDevice) &&
    (record.lastLoginMethod === null || isAdminLoginMethod(record.lastLoginMethod)) &&
    Array.isArray(record.recentLogins) &&
    record.recentLogins.every(isAdminLoginEvent)
  );
};

const isSiteSettingsTranslation = (value: unknown): value is SiteSettingsTranslation => {
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

const isSiteSettingsLocalizations = (value: unknown): value is SiteSettingsLocalizations => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    isSiteSettingsContentLocalization(record.zhCN) && isSiteSettingsContentLocalization(record.en)
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
    typeof record.newPostEmailNotifications === "boolean" &&
    isOptionalString(record.name) &&
    isOptionalString(record.avatarUrl) &&
    isOptionalString(record.bio) &&
    isOptionalString(record.blogUrl)
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

export const isAdminAuthState = (value: unknown): value is AdminAuthState => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.token === "string" &&
    (record.transport === "cookie" ? record.token === "" : record.token.trim().length > 0) &&
    (record.transport === undefined ||
      record.transport === "cookie" ||
      record.transport === "bearer") &&
    isAdminUser(record.user)
  );
};

export const isBlogUser = (value: unknown): value is BlogUser => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    isBlogUserRole(record.role) &&
    typeof record.username === "string" &&
    typeof record.email === "string" &&
    (record.profileLocalizations === undefined ||
      isAdminProfileLocalizations(record.profileLocalizations)) &&
    (record.profileTranslation === undefined ||
      isAdminProfileTranslation(record.profileTranslation)) &&
    isOptionalString(record.name) &&
    isOptionalString(record.avatarUrl) &&
    isOptionalString(record.bio) &&
    isOptionalString(record.blogUrl) &&
    (record.tags === undefined || isStringArray(record.tags)) &&
    (record.commentEmailNotifications === undefined ||
      typeof record.commentEmailNotifications === "boolean") &&
    (record.newPostEmailNotifications === undefined ||
      typeof record.newPostEmailNotifications === "boolean") &&
    isOptionalString(record.createdAt) &&
    isOptionalString(record.updatedAt) &&
    isOptionalNullableString(record.lastLoginAt) &&
    isOptionalNullableString(record.lastLoginIp) &&
    isOptionalNullableString(record.lastLoginLocation) &&
    isOptionalNullableString(record.lastLoginLocationEn) &&
    isOptionalNullableString(record.lastLoginDevice) &&
    isOptionalNullableString(record.lastLoginTimeZone) &&
    (record.lastLoginTimeZoneOffsetMinutes === undefined ||
      record.lastLoginTimeZoneOffsetMinutes === null ||
      typeof record.lastLoginTimeZoneOffsetMinutes === "number") &&
    (record.lastLoginMethod === undefined ||
      record.lastLoginMethod === null ||
      isAdminLoginMethod(record.lastLoginMethod))
  );
};

export const isBlogAuthState = (value: unknown): value is BlogAuthState => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return isBlogUser(record.user);
};

const isBlogMeResponse = (value: unknown): value is { user: BlogUser } => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isBlogUser(record.user);
};

const isBlogEmailCodeResponse = (value: unknown): value is BlogEmailCodeResponse => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    record.ok === true &&
    typeof record.expiresAt === "string" &&
    typeof record.sent === "boolean" &&
    typeof record.validMinutes === "number" &&
    isOptionalString(record.devCode)
  );
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

const isPublicSiteAuthor = (value: unknown): value is PublicSiteAuthor => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.avatarUrl === "string" &&
    typeof record.blogUrl === "string" &&
    isAdminProfileLocalizations(record.profileLocalizations) &&
    Array.isArray(record.socialLinks) &&
    record.socialLinks.every(isAdminSocialLink) &&
    typeof record.username === "string"
  );
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
    isAdminLoginInfo(record.loginInfo) &&
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
  const storage = record.storage;

  if (
    typeof site !== "object" ||
    site === null ||
    typeof basics !== "object" ||
    basics === null ||
    typeof filings !== "object" ||
    filings === null ||
    typeof storage !== "object" ||
    storage === null
  ) {
    return false;
  }

  const siteRecord = site as Record<string, unknown>;
  const basicsRecord = basics as Record<string, unknown>;
  const filingsRecord = filings as Record<string, unknown>;
  const storageRecord = storage as Record<string, unknown>;

  return (
    isSiteSettingsLocalizations(record.siteLocalizations) &&
    (record.siteTranslation === undefined || isSiteSettingsTranslation(record.siteTranslation)) &&
    typeof siteRecord.siteName === "string" &&
    typeof siteRecord.foundedAt === "string" &&
    typeof siteRecord.siteDescription === "string" &&
    isStringArray(siteRecord.coverUrls) &&
    typeof siteRecord.homepageCopy === "string" &&
    typeof siteRecord.lightLogoUrl === "string" &&
    typeof siteRecord.darkLogoUrl === "string" &&
    typeof siteRecord.faviconUrl === "string" &&
    typeof siteRecord.timeZone === "string" &&
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
    typeof filingsRecord.policeRecordUrl === "string" &&
    typeof storageRecord.r2AccessKeyId === "string" &&
    typeof storageRecord.r2AccountId === "string" &&
    typeof storageRecord.r2Bucket === "string" &&
    typeof storageRecord.r2Enabled === "boolean" &&
    typeof storageRecord.r2PublicBaseUrl === "string" &&
    typeof storageRecord.r2SecretAccessKeyConfigured === "boolean"
  );
};

const isPublicSiteSettings = (value: unknown): value is PublicSiteSettings => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const basics = record.basics;
  const filings = record.filings;
  const site = record.site;
  if (
    typeof basics !== "object" ||
    basics === null ||
    typeof filings !== "object" ||
    filings === null ||
    typeof site !== "object" ||
    site === null
  ) {
    return false;
  }

  const basicsRecord = basics as Record<string, unknown>;
  const filingsRecord = filings as Record<string, unknown>;
  const siteRecord = site as Record<string, unknown>;

  return (
    (record.author === null || isPublicSiteAuthor(record.author)) &&
    typeof basicsRecord.commentsEnabled === "boolean" &&
    typeof basicsRecord.copyright === "string" &&
    Array.isArray(filingsRecord.icpRecords) &&
    filingsRecord.icpRecords.every(isSiteFilingRecord) &&
    typeof filingsRecord.policeRecordNumber === "string" &&
    typeof filingsRecord.policeRecordUrl === "string" &&
    isSiteSettingsLocalizations(record.siteLocalizations) &&
    typeof siteRecord.siteName === "string" &&
    typeof siteRecord.foundedAt === "string" &&
    typeof siteRecord.siteDescription === "string" &&
    isStringArray(siteRecord.coverUrls) &&
    typeof siteRecord.lightLogoUrl === "string" &&
    typeof siteRecord.darkLogoUrl === "string" &&
    typeof siteRecord.faviconUrl === "string" &&
    typeof siteRecord.timeZone === "string"
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

const isMediaAsset = (value: unknown): value is MediaAsset => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.fileName === "string" &&
    typeof record.fileFormat === "string" &&
    isMediaFileType(record.fileType) &&
    typeof record.fileSizeBytes === "number" &&
    typeof record.accessUrl === "string" &&
    isMediaStorageProvider(record.storageProvider) &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string" &&
    isOptionalString(record.folderId) &&
    isOptionalString(record.folderName) &&
    isOptionalString(record.folderSlug) &&
    isOptionalString(record.uploadedBy)
  );
};

const isMediaFolder = (value: unknown): value is MediaFolder => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.slug === "string" &&
    typeof record.description === "string" &&
    typeof record.fileCount === "number" &&
    typeof record.isProtected === "boolean" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string" &&
    isOptionalString(record.systemKey)
  );
};

const isMediaFolderList = (value: unknown): value is MediaFolderList => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return Array.isArray(record.folders) && record.folders.every(isMediaFolder);
};

const isMediaLibrarySummary = (value: unknown): value is MediaLibrarySummary => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.total === "number" &&
    typeof record.images === "number" &&
    typeof record.videos === "number" &&
    typeof record.documents === "number" &&
    typeof record.storageBytes === "number"
  );
};

const isMediaLibraryPageInfo = (value: unknown): value is MediaLibraryPageInfo => {
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

const isMediaLibraryList = (value: unknown): value is MediaLibraryList => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    Array.isArray(record.media) &&
    record.media.every(isMediaAsset) &&
    isMediaLibrarySummary(record.summary) &&
    isMediaLibraryPageInfo(record.pageInfo)
  );
};

const isNavigationItem = (value: unknown): value is NavigationItem => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.groupId === "string" &&
    typeof record.name === "string" &&
    typeof record.url === "string" &&
    isNullableString(record.note) &&
    isNullableString(record.iconUrl) &&
    typeof record.sortOrder === "number" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string"
  );
};

const isNavigationGroup = (value: unknown): value is NavigationGroup => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    isNullableString(record.nameEn) &&
    typeof record.sortOrder === "number" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string" &&
    Array.isArray(record.items) &&
    record.items.every(isNavigationItem)
  );
};

const isNavigationList = (value: unknown): value is NavigationList => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    record.ok === true && Array.isArray(record.groups) && record.groups.every(isNavigationGroup)
  );
};

const isNavigationGroupMutationResponse = (
  value: unknown,
): value is { item: NavigationGroup; ok: true } => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return record.ok === true && isNavigationGroup(record.item);
};

const isNavigationItemMutationResponse = (
  value: unknown,
): value is { item: NavigationItem; ok: true } => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return record.ok === true && isNavigationItem(record.item);
};

const isPublicNavigationItem = (value: unknown): value is PublicNavigationItem => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.url === "string" &&
    isNullableString(record.note) &&
    isNullableString(record.iconUrl)
  );
};

const isPublicNavigationGroup = (value: unknown): value is PublicNavigationGroup => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    isNullableString(record.nameEn) &&
    Array.isArray(record.items) &&
    record.items.every(isPublicNavigationItem)
  );
};

const isPublicNavigationList = (value: unknown): value is PublicNavigationList => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    record.ok === true &&
    Array.isArray(record.groups) &&
    record.groups.every(isPublicNavigationGroup)
  );
};

const isContentPageInfo = (value: unknown): value is ContentPageInfo => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.page === "number" &&
    Number.isSafeInteger(record.page) &&
    record.page >= 1 &&
    typeof record.pageSize === "number" &&
    Number.isSafeInteger(record.pageSize) &&
    record.pageSize >= 1 &&
    typeof record.totalItems === "number" &&
    Number.isSafeInteger(record.totalItems) &&
    record.totalItems >= 0 &&
    typeof record.totalPages === "number" &&
    Number.isSafeInteger(record.totalPages) &&
    record.totalPages >= 0
  );
};

const isArticleTaxonomyLocalization = (value: unknown): value is ArticleTaxonomyLocalization => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return typeof record.description === "string" && typeof record.name === "string";
};

const isArticleTaxonomyLocalizations = (value: unknown): value is ArticleTaxonomyLocalizations => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return isArticleTaxonomyLocalization(record.en) && isArticleTaxonomyLocalization(record.zhCN);
};

const isArticleLocalization = (value: unknown): value is ArticleLocalization => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.contentMdx === "string" &&
    typeof record.summary === "string" &&
    typeof record.title === "string"
  );
};

const isArticleLocalizations = (value: unknown): value is ArticleLocalizations => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return isArticleLocalization(record.en) && isArticleLocalization(record.zhCN);
};

const isArticleRelation = (value: unknown): value is ArticleRelation => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.slug === "string" &&
    isNullableString(record.description) &&
    isNullableString(record.color) &&
    isArticleTaxonomyLocalizations(record.localizations)
  );
};

const isArticleContributorRelation = (value: unknown): value is ArticleContributorRelation => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    isNullableString(record.avatarUrl) &&
    isNullableString(record.linkUrl)
  );
};

const isArticleContent = (value: unknown): value is ArticleContent => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    isNullableString(record.authorId) &&
    isNullableString(record.authorName) &&
    Array.isArray(record.categories) &&
    record.categories.every(isArticleRelation) &&
    typeof record.commentCount === "number" &&
    Array.isArray(record.contributors) &&
    record.contributors.every(isArticleContributorRelation) &&
    typeof record.contentMdx === "string" &&
    isNullableString(record.coverImageUrl) &&
    typeof record.createdAt === "string" &&
    typeof record.isPinned === "boolean" &&
    isArticleLocalizations(record.localizations) &&
    isNullableString(record.publishedAt) &&
    typeof record.readCount === "number" &&
    isNullableString(record.scheduledPublishAt) &&
    typeof record.slug === "string" &&
    isArticleStatus(record.status) &&
    isNullableString(record.summary) &&
    Array.isArray(record.tags) &&
    record.tags.every(isArticleRelation) &&
    typeof record.title === "string" &&
    typeof record.updatedAt === "string"
  );
};

const isArticleCategory = (value: unknown): value is ArticleCategory => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.slug === "string" &&
    isNullableString(record.description) &&
    typeof record.articleCount === "number" &&
    typeof record.createdAt === "string" &&
    isArticleTaxonomyLocalizations(record.localizations) &&
    typeof record.sortOrder === "number" &&
    typeof record.updatedAt === "string"
  );
};

const isArticleTag = (value: unknown): value is ArticleTag => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.slug === "string" &&
    isNullableString(record.description) &&
    isNullableString(record.color) &&
    typeof record.articleCount === "number" &&
    typeof record.createdAt === "string" &&
    isArticleTaxonomyLocalizations(record.localizations) &&
    typeof record.updatedAt === "string"
  );
};

const isArticleContributor = (value: unknown): value is ArticleContributor => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    isArticleContributorRelation(value) &&
    typeof record.articleCount === "number" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string"
  );
};

const isArticleContentList = (value: unknown): value is ArticleContentList => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    record.ok === true &&
    Array.isArray(record.items) &&
    record.items.every(isArticleContent) &&
    isContentPageInfo(record.pageInfo)
  );
};

const isArticleCategoryList = (value: unknown): value is ArticleCategoryList => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    record.ok === true &&
    Array.isArray(record.items) &&
    record.items.every(isArticleCategory) &&
    isContentPageInfo(record.pageInfo)
  );
};

const isArticleTagList = (value: unknown): value is ArticleTagList => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    record.ok === true &&
    Array.isArray(record.items) &&
    record.items.every(isArticleTag) &&
    isContentPageInfo(record.pageInfo)
  );
};

const isArticleContributorList = (value: unknown): value is ArticleContributorList => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    record.ok === true &&
    Array.isArray(record.items) &&
    record.items.every(isArticleContributor) &&
    isContentPageInfo(record.pageInfo)
  );
};

const isArticleContentResponse = (value: unknown): value is { item: ArticleContent; ok: true } => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return record.ok === true && isArticleContent(record.item);
};

const isArticleCategoryResponse = (
  value: unknown,
): value is { item: ArticleCategory; ok: true } => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return record.ok === true && isArticleCategory(record.item);
};

const isArticleTagResponse = (value: unknown): value is { item: ArticleTag; ok: true } => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return record.ok === true && isArticleTag(record.item);
};

const isArticleContributorResponse = (
  value: unknown,
): value is { item: ArticleContributor; ok: true } => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return record.ok === true && isArticleContributor(record.item);
};

const isCommentAuthor = (value: unknown): value is CommentAuthor => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    typeof record.username === "string" &&
    isNullableString(record.name) &&
    isBlogUserRole(record.role) &&
    isNullableString(record.avatarUrl) &&
    isStringArray(record.tags) &&
    isNullableString(record.blogUrl)
  );
};

const isCommentItem = (value: unknown): value is CommentItem => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === "string" &&
    isCommentTargetType(record.targetType) &&
    isNullableString(record.articleId) &&
    isNullableString(record.articleTitle) &&
    typeof record.userId === "string" &&
    isNullableString(record.parentId) &&
    typeof record.content === "string" &&
    isCommentStatus(record.status) &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string" &&
    isNullableString(record.deletedAt) &&
    isNullableString(record.location) &&
    isCommentAuthor(record.author)
  );
};

const isCommentList = (value: unknown): value is CommentList => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    record.ok === true &&
    Array.isArray(record.items) &&
    record.items.every(isCommentItem) &&
    new Set(record.items.map((item) => item.id)).size === record.items.length &&
    isContentPageInfo(record.pageInfo)
  );
};

const isCommentResponse = (value: unknown): value is { item: CommentItem; ok: true } => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return record.ok === true && isCommentItem(record.item);
};

const isCommentImageUploadResponse = (value: unknown): value is { accessUrl: string; ok: true } => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return record.ok === true && typeof record.accessUrl === "string";
};

const isMediaAssetMutationResponse = (value: unknown): value is { item: MediaAsset; ok: true } => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return record.ok === true && isMediaAsset(record.item);
};

const isMediaStorageMigrationResponse = (
  value: unknown,
): value is MediaStorageMigrationResponse => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    record.ok === true &&
    Array.isArray(record.items) &&
    record.items.every(isMediaAsset) &&
    typeof record.updatedReferences === "number"
  );
};

const isMediaFolderMutationResponse = (
  value: unknown,
): value is { item: MediaFolder; ok: true } => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return record.ok === true && isMediaFolder(record.item);
};

const isManagedUserDetails = (value: unknown): value is ManagedUserDetails => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return isManagedUser(record.user) && isAdminProfileLocalizations(record.profileLocalizations);
};

const isManagedUserMutationResult = (value: unknown): value is ManagedUserMutationResult => {
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

const isOkResponse = (value: unknown): value is { ok: true } => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return record.ok === true;
};

const isNumberRecord = (value: unknown): value is Record<string, number> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((item) => typeof item === "number");
};

const isBackupManifest = (value: unknown): value is BackupManifest => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const media = record.media;
  if (typeof media !== "object" || media === null) {
    return false;
  }

  const mediaRecord = media as Record<string, unknown>;
  return (
    record.format === "leiblog-backup" &&
    typeof record.createdAt === "string" &&
    typeof record.version === "number" &&
    isStringArray(record.sensitiveFieldsExcluded) &&
    isStringArray(record.tables) &&
    typeof mediaRecord.included === "boolean" &&
    typeof mediaRecord.total === "number" &&
    typeof mediaRecord.totalBytes === "number"
  );
};

const isBackupPreviewResponse = (value: unknown): value is BackupPreviewResponse => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const media = record.media;
  if (typeof media !== "object" || media === null) {
    return false;
  }

  const mediaRecord = media as Record<string, unknown>;
  return (
    record.ok === true &&
    isBackupManifest(record.manifest) &&
    typeof mediaRecord.included === "boolean" &&
    typeof mediaRecord.total === "number" &&
    typeof mediaRecord.totalBytes === "number" &&
    typeof record.sensitiveConfigExported === "boolean" &&
    isNumberRecord(record.tables)
  );
};

const isBackupImportResponse = (value: unknown): value is BackupImportResponse => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.ok === true &&
    record.mode === "replace" &&
    typeof record.importedMedia === "number" &&
    typeof record.importedRows === "number" &&
    isNumberRecord(record.tables)
  );
};

const isSiteSettingsIntegrationTestResponse = (
  value: unknown,
): value is SiteSettingsIntegrationTestResponse => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.ok === true && typeof record.message === "string" && isOptionalString(record.details)
  );
};

const isSiteSettingsApiKeyRevealCodeResponse = (
  value: unknown,
): value is SiteSettingsApiKeyRevealCodeResponse => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.ok === true &&
    typeof record.expiresAt === "string" &&
    typeof record.message === "string" &&
    typeof record.sent === "boolean" &&
    typeof record.validMinutes === "number"
  );
};

const isSiteSettingsApiKeys = (value: unknown): value is SiteSettingsApiKeys => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.deeplApiKey === "string" &&
    typeof record.ipGeolocationApiKey === "string" &&
    typeof record.r2SecretAccessKey === "string" &&
    typeof record.resendApiKey === "string"
  );
};

const isSiteSettingsApiKeysResponse = (value: unknown): value is SiteSettingsApiKeysResponse => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return record.ok === true && isSiteSettingsApiKeys(record.item);
};

const isAuthProvider = (value: unknown): value is AuthProvider =>
  value === "github" || value === "google";

const isPublicAuthProvider = (value: unknown): value is PublicAuthProvider => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return isAuthProvider(record.provider) && typeof record.displayName === "string";
};

const isPublicAuthProvidersResponse = (value: unknown): value is PublicAuthProvidersResponse => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.ok === true && Array.isArray(record.items) && record.items.every(isPublicAuthProvider)
  );
};

const isAuthProviderSettingsItem = (value: unknown): value is AuthProviderSettingsItem => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    isAuthProvider(record.provider) &&
    typeof record.displayName === "string" &&
    typeof record.enabled === "boolean" &&
    typeof record.clientId === "string" &&
    typeof record.hasClientSecret === "boolean" &&
    typeof record.redirectUri === "string" &&
    isStringArray(record.scopes)
  );
};

const isAuthProviderSettingsResponse = (value: unknown): value is AuthProviderSettingsResponse => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.ok === true &&
    Array.isArray(record.items) &&
    record.items.every(isAuthProviderSettingsItem)
  );
};

const isAuthProviderClientSecretResponse = (
  value: unknown,
): value is AuthProviderClientSecretResponse => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (record.ok !== true || typeof record.item !== "object" || record.item === null) {
    return false;
  }

  const item = record.item as Record<string, unknown>;
  return isAuthProvider(item.provider) && typeof item.clientSecret === "string";
};

const isAdminSetupStatus = (value: unknown): value is AdminSetupStatus => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.hasAdmin === "boolean" &&
    typeof record.requiresSetup === "boolean" &&
    (record.requiresSetupToken === undefined || typeof record.requiresSetupToken === "boolean")
  );
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

export const loginAdmin = async ({ altcha, identifier, locale, password }: LoginAdminParams) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ altcha, identifier: identifier.trim(), locale, password }),
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Login failed."));
  }

  if (!isAdminAuthState(body)) {
    throw new Error("Login response was invalid.");
  }

  return { token: COOKIE_ADMIN_AUTH_TOKEN, user: body.user };
};

export const loginBlogUser = async ({ altcha, identifier, password }: LoginBlogUserParams) => {
  const response = await fetch(`${API_BASE_URL}/api/blog/auth/login`, {
    credentials: "include",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ altcha, identifier: identifier.trim(), password }),
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "登录失败。"));
  }

  if (!isBlogAuthState(body)) {
    throw new Error("登录响应格式异常。");
  }

  return body;
};

export const registerBlogUser = async (payload: RegisterBlogUserParams) => {
  const response = await fetch(`${API_BASE_URL}/api/blog/auth/register`, {
    credentials: "include",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
      email: payload.email.trim(),
      username: payload.username.trim(),
      name: payload.name?.trim() || undefined,
    }),
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "注册失败。"));
  }

  if (!isBlogAuthState(body)) {
    throw new Error("注册响应格式异常。");
  }

  return body;
};

export const requestBlogEmailCode = async ({
  email,
  locale,
  purpose,
  altcha,
}: RequestBlogEmailCodeParams) => {
  const response = await fetch(`${API_BASE_URL}/api/blog/auth/email-code`, {
    credentials: "include",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ altcha, email: email.trim(), locale, purpose }),
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "邮箱验证码发送失败。"));
  }

  if (!isBlogEmailCodeResponse(body)) {
    throw new Error("邮箱验证码响应格式异常。");
  }

  return body;
};

export const getBlogOAuthProviders = async () => {
  const response = await fetch(`${API_BASE_URL}/api/blog/auth/providers`, {
    credentials: "include",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "第三方登录方式加载失败。"));
  }

  if (!isPublicAuthProvidersResponse(body)) {
    throw new Error("第三方登录方式响应格式异常。");
  }

  return body.items;
};

export const startBlogOAuthLogin = async ({ provider, ...payload }: StartBlogOAuthLoginParams) => {
  const response = await fetch(`${API_BASE_URL}/api/blog/auth/oauth/${provider}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await parseJson(response);
  if (!response.ok) {
    throw new Error(readErrorMessage(body, "第三方登录验证失败。"));
  }
  if (typeof body !== "object" || body === null) {
    throw new Error("第三方登录响应格式异常。");
  }
  const record = body as Record<string, unknown>;
  if (record.ok !== true || typeof record.authorizationUrl !== "string") {
    throw new Error("第三方登录响应格式异常。");
  }
  const authorization = new URL(record.authorizationUrl);
  const expected =
    provider === "github"
      ? "https://github.com/login/oauth/authorize"
      : "https://accounts.google.com/o/oauth2/v2/auth";
  if (`${authorization.origin}${authorization.pathname}` !== expected) {
    throw new Error("第三方登录授权地址无效。");
  }

  return authorization.toString();
};

export const getBlogMe = async () => {
  const response = await fetch(`${API_BASE_URL}/api/blog/auth/me`, {
    credentials: "include",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "登录状态已过期。"));
  }

  if (!isBlogMeResponse(body)) {
    throw new Error("用户信息响应格式异常。");
  }

  return body.user;
};

export const updateBlogUserProfile = async (payload: UpdateBlogUserProfileParams) => {
  const response = await fetch(`${API_BASE_URL}/api/blog/auth/me`, {
    credentials: "include",
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      profileLocalizations: payload.profileLocalizations,
      avatarUrl: payload.avatarUrl?.trim(),
      bio: payload.bio?.trim(),
      blogUrl: payload.blogUrl?.trim(),
      commentEmailNotifications: payload.commentEmailNotifications,
      name: payload.name?.trim(),
      newPostEmailNotifications: payload.newPostEmailNotifications,
      notificationEmailLocale: payload.notificationEmailLocale,
      tags: payload.tags?.map((tag) => tag.trim()).filter((tag) => tag.length > 0),
      username: payload.username?.trim(),
    }),
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "个人资料保存失败。"));
  }

  if (!isBlogMeResponse(body)) {
    throw new Error("个人资料响应格式异常。");
  }

  return body.user;
};

export const uploadBlogUserAvatar = async ({
  file,
  fileName,
  onUploadProgress,
}: UploadBlogUserAvatarParameters) => {
  const formData = new FormData();
  formData.set("file", file);
  if (fileName !== undefined && fileName.trim().length > 0) {
    formData.set("fileName", fileName.trim());
  }

  const body = await uploadJson({
    file,
    onUploadProgress,
    url: `${API_BASE_URL}/api/blog/auth/me/avatar`,
    body: formData,
    isResponse: isMediaAssetMutationResponse,
    failureMessage: "头像上传失败。",
    invalidMessage: "头像上传响应格式异常。",
  });

  return body.item;
};

export const requestBlogAccountEmailCode = async (payload: RequestBlogAccountEmailCodeParams) => {
  const bodyPayload =
    payload.purpose === "email_change_new"
      ? {
          altcha: payload.altcha,
          email: payload.email.trim(),
          locale: payload.locale,
          purpose: payload.purpose,
        }
      : { altcha: payload.altcha, locale: payload.locale, purpose: payload.purpose };
  const response = await fetch(`${API_BASE_URL}/api/blog/auth/me/email-code`, {
    credentials: "include",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyPayload),
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "账号验证码发送失败。"));
  }

  if (!isBlogEmailCodeResponse(body)) {
    throw new Error("账号验证码响应格式异常。");
  }

  return body;
};

export const changeBlogUserEmail = async (payload: ChangeBlogUserEmailParams) => {
  const response = await fetch(`${API_BASE_URL}/api/blog/auth/me/email`, {
    credentials: "include",
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currentEmailCode: payload.currentEmailCode.trim(),
      newEmail: payload.newEmail.trim(),
      newEmailCode: payload.newEmailCode.trim(),
    }),
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "修改邮箱失败。"));
  }

  if (!isBlogMeResponse(body)) {
    throw new Error("修改邮箱响应格式异常。");
  }

  return body.user;
};

export const changeBlogUserPassword = async (payload: ChangeBlogUserPasswordParams) => {
  const bodyPayload =
    payload.method === "password"
      ? {
          currentPassword: payload.currentPassword,
          method: payload.method,
          newPassword: payload.newPassword,
        }
      : {
          emailCode: payload.emailCode.trim(),
          method: payload.method,
          newPassword: payload.newPassword,
        };
  const response = await fetch(`${API_BASE_URL}/api/blog/auth/me/password`, {
    credentials: "include",
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyPayload),
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "修改密码失败。"));
  }

  if (!isOkResponse(body)) {
    throw new Error("修改密码响应格式异常。");
  }

  return body;
};

export const resetBlogPassword = async (payload: ResetBlogPasswordParams) => {
  const response = await fetch(`${API_BASE_URL}/api/blog/auth/password/reset`, {
    credentials: "include",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: payload.email.trim(),
      altcha: payload.altcha,
      emailCode: payload.emailCode.trim(),
      password: payload.password,
    }),
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "重置密码失败。"));
  }

  if (!isOkResponse(body)) {
    throw new Error("重置密码响应格式异常。");
  }

  return body;
};

export const logoutBlogUser = async () => {
  const response = await fetch(`${API_BASE_URL}/api/blog/auth/logout`, {
    credentials: "include",
    method: "POST",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "退出登录失败。"));
  }

  if (!isOkResponse(body)) {
    throw new Error("退出登录响应格式异常。");
  }

  return body;
};

export const completeInitialSetup = async ({ setupToken, ...payload }: InitialSetupPayload) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/setup/initial`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Setup-Token": setupToken ?? "",
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

  return { token: COOKIE_ADMIN_AUTH_TOKEN, user: body.user };
};

export const uploadInitialSetupMediaAsset = async ({
  file,
  fileName,
  folderSlug,
  setupToken,
  onUploadProgress,
}: UploadInitialSetupMediaAssetParameters) => {
  const formData = new FormData();
  formData.set("file", file);
  if (fileName !== undefined && fileName.trim().length > 0) {
    formData.set("fileName", fileName.trim());
  }
  if (folderSlug !== undefined && folderSlug.trim().length > 0) {
    formData.set("folderSlug", folderSlug.trim());
  }

  const body = await uploadJson({
    file,
    onUploadProgress,
    url: `${API_BASE_URL}/api/admin/setup/media`,
    body: formData,
    headers: { "X-Setup-Token": setupToken ?? "" },
    isResponse: isMediaAssetMutationResponse,
    failureMessage: "Initial setup media upload failed.",
    invalidMessage: "Initial setup media upload response was invalid.",
  });

  return body.item;
};

export const translateArticleBody = async ({
  content,
  sourceLocale,
  token,
  signal,
}: {
  content: string;
  sourceLocale: AppLanguage;
  token: string;
  signal?: AbortSignal;
}) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/content/articles/translate`, {
    method: "POST",
    credentials: "include",
    signal,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content, sourceLocale }),
  });
  const body: unknown = await parseJson(response);
  if (!response.ok) {
    throw new Error(
      typeof body === "object" &&
        body !== null &&
        "reason" in body &&
        typeof body.reason === "string"
        ? body.reason
        : "translation-failed",
    );
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("content" in body) ||
    typeof body.content !== "string"
  )
    throw new Error("translation-failed");
  return body.content;
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

export const getMediaAssets = async ({
  fileType,
  folderSlug,
  page,
  pageSize,
  query,
  storageProvider = "all",
  token,
}: GetMediaAssetsParameters) => {
  const searchParams = new URLSearchParams({
    fileType,
    page: String(page),
    pageSize: String(pageSize),
    query: query.trim(),
    storageProvider,
  });
  if (folderSlug !== undefined && folderSlug.trim().length > 0) {
    searchParams.set("folderSlug", folderSlug.trim());
  }

  const response = await fetch(`${API_BASE_URL}/api/admin/media?${searchParams.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Media library request failed."));
  }

  if (!isMediaLibraryList(body)) {
    throw new Error("Media library response was invalid.");
  }

  return body;
};

export const getMediaFolders = async ({ token }: GetMediaFoldersParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/media/folders`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Media folders request failed."));
  }

  if (!isMediaFolderList(body)) {
    throw new Error("Media folders response was invalid.");
  }

  return body;
};

export const createMediaFolder = async ({ payload, token }: CreateMediaFolderParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/media/folders`, {
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Media folder creation failed."));
  }

  if (!isMediaFolderMutationResponse(body)) {
    throw new Error("Media folder creation response was invalid.");
  }

  return body.item;
};

export const updateMediaFolder = async ({
  folderId,
  payload,
  token,
}: UpdateMediaFolderParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/media/folders/${folderId}`, {
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Media folder update failed."));
  }

  if (!isMediaFolderMutationResponse(body)) {
    throw new Error("Media folder update response was invalid.");
  }

  return body.item;
};

export const deleteMediaFolder = async ({ folderId, token }: DeleteMediaFolderParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/media/folders/${folderId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: "DELETE",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Media folder deletion failed."));
  }

  if (!isOkResponse(body)) {
    throw new Error("Media folder deletion response was invalid.");
  }

  return body;
};

export const uploadMediaAsset = async ({
  file,
  fileName,
  folderSlug,
  targetProvider,
  token,
  onUploadProgress,
}: UploadMediaAssetParameters) => {
  const formData = new FormData();
  formData.set("file", file);
  if (fileName !== undefined && fileName.trim().length > 0) {
    formData.set("fileName", fileName.trim());
  }
  if (folderSlug !== undefined && folderSlug.trim().length > 0) {
    formData.set("folderSlug", folderSlug.trim());
  }
  if (targetProvider !== undefined) {
    formData.set("targetProvider", targetProvider);
  }

  const body = await uploadJson({
    file,
    onUploadProgress,
    url: `${API_BASE_URL}/api/admin/media`,
    body: formData,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    isResponse: isMediaAssetMutationResponse,
    failureMessage: "Media upload failed.",
    invalidMessage: "Media upload response was invalid.",
  });

  return body.item;
};

export const migrateMediaStorage = async ({
  ids,
  targetProvider,
  token,
}: MigrateMediaStorageParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/media/storage/migrate`, {
    body: JSON.stringify({ ids, targetProvider }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Media storage migration failed."));
  }

  if (!isMediaStorageMigrationResponse(body)) {
    throw new Error("Media storage migration response was invalid.");
  }

  return body;
};

export const getNavigation = async (token: string) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/navigation`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Navigation request failed."));
  }

  if (!isNavigationList(body)) {
    throw new Error("Navigation response was invalid.");
  }

  return body;
};

export const createNavigationGroup = async ({
  payload,
  token,
}: NavigationGroupMutationParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/navigation/groups`, {
    body: JSON.stringify({
      name: payload.name.trim(),
      nameEn: payload.nameEn?.trim() || null,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Navigation group creation failed."));
  }

  if (!isNavigationGroupMutationResponse(body)) {
    throw new Error("Navigation group creation response was invalid.");
  }

  return body.item;
};

export const updateNavigationGroup = async ({
  groupId,
  payload,
  token,
}: UpdateNavigationGroupParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/navigation/groups/${groupId}`, {
    body: JSON.stringify({
      name: payload.name.trim(),
      nameEn: payload.nameEn?.trim() || null,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Navigation group update failed."));
  }

  if (!isNavigationGroupMutationResponse(body)) {
    throw new Error("Navigation group update response was invalid.");
  }

  return body.item;
};

export const deleteNavigationGroup = async ({
  groupId,
  token,
}: DeleteNavigationGroupParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/navigation/groups/${groupId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: "DELETE",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Navigation group deletion failed."));
  }

  if (!isOkResponse(body)) {
    throw new Error("Navigation group deletion response was invalid.");
  }

  return body;
};

export const reorderNavigationGroups = async ({
  groupIds,
  token,
}: ReorderNavigationGroupsParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/navigation/groups/reorder`, {
    body: JSON.stringify({ ids: groupIds }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Navigation group order update failed."));
  }

  if (!isOkResponse(body)) {
    throw new Error("Navigation group order response was invalid.");
  }

  return body;
};

export const createNavigationItem = async ({
  payload,
  token,
}: NavigationItemMutationParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/navigation/items`, {
    body: JSON.stringify({
      groupId: payload.groupId,
      iconUrl: payload.iconUrl?.trim() || null,
      name: payload.name.trim(),
      note: payload.note?.trim() || null,
      url: payload.url.trim(),
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Navigation item creation failed."));
  }

  if (!isNavigationItemMutationResponse(body)) {
    throw new Error("Navigation item creation response was invalid.");
  }

  return body.item;
};

export const updateNavigationItem = async ({
  itemId,
  payload,
  token,
}: UpdateNavigationItemParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/navigation/items/${itemId}`, {
    body: JSON.stringify({
      groupId: payload.groupId,
      iconUrl: payload.iconUrl?.trim() || null,
      name: payload.name.trim(),
      note: payload.note?.trim() || null,
      url: payload.url.trim(),
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Navigation item update failed."));
  }

  if (!isNavigationItemMutationResponse(body)) {
    throw new Error("Navigation item update response was invalid.");
  }

  return body.item;
};

export const deleteNavigationItem = async ({ itemId, token }: DeleteNavigationItemParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/navigation/items/${itemId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: "DELETE",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Navigation item deletion failed."));
  }

  if (!isOkResponse(body)) {
    throw new Error("Navigation item deletion response was invalid.");
  }

  return body;
};

export const reorderNavigationItems = async ({
  groupId,
  itemIds,
  token,
}: ReorderNavigationItemsParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/navigation/items/reorder`, {
    body: JSON.stringify({ groupId, ids: itemIds }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Navigation item order update failed."));
  }

  if (!isOkResponse(body)) {
    throw new Error("Navigation item order response was invalid.");
  }

  return body;
};

export const updateMediaAsset = async ({
  fileName,
  mediaId,
  token,
}: UpdateMediaAssetParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/media/${mediaId}`, {
    body: JSON.stringify({ fileName }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Media update failed."));
  }

  if (!isMediaAssetMutationResponse(body)) {
    throw new Error("Media update response was invalid.");
  }

  return body.item;
};

export const deleteMediaAsset = async ({ mediaId, token }: DeleteMediaAssetParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/media/${mediaId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: "DELETE",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Media deletion failed."));
  }

  if (!isOkResponse(body)) {
    throw new Error("Media deletion response was invalid.");
  }

  return body;
};

const readDownloadFileName = (response: Response, fallback: string) => {
  const disposition = response.headers.get("content-disposition");
  if (disposition === null) {
    return fallback;
  }

  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encodedName !== undefined) {
    return decodeURIComponent(encodedName);
  }

  const quotedName = disposition.match(/filename="([^"]+)"/i)?.[1];
  return quotedName ?? fallback;
};

export const downloadMediaAsset = async ({
  fileName,
  mediaId,
  token,
}: DownloadMediaAssetParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/media/${mediaId}/download`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: "GET",
  });

  if (!response.ok) {
    const body = await parseJson(response);
    throw new Error(readErrorMessage(body, "Media download failed."));
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = readDownloadFileName(response, fileName);
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const downloadBackupArchive = async ({ token }: DownloadBackupArchiveParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/backup/export`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: "GET",
  });

  if (!response.ok) {
    const body = await parseJson(response);
    throw new Error(readErrorMessage(body, "Backup export failed."));
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = readDownloadFileName(response, "leiblog-backup.zip");
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const createBackupFormData = (file: File, mode?: "replace") => {
  const formData = new FormData();
  formData.set("file", file);
  if (mode !== undefined) {
    formData.set("mode", mode);
  }

  return formData;
};

export const previewBackupArchive = async ({
  file,
  token,
  onUploadProgress,
}: PreviewBackupArchiveParameters) => {
  return uploadJson({
    file,
    onUploadProgress,
    url: `${API_BASE_URL}/api/admin/backup/preview`,
    body: createBackupFormData(file),
    headers: {
      Authorization: `Bearer ${token}`,
    },
    isResponse: isBackupPreviewResponse,
    failureMessage: "Backup preview failed.",
    invalidMessage: "Backup preview response was invalid.",
  });
};

export const importBackupArchive = async ({
  file,
  mode,
  token,
  onUploadProgress,
}: ImportBackupArchiveParameters) => {
  return uploadJson({
    file,
    onUploadProgress,
    url: `${API_BASE_URL}/api/admin/backup/import`,
    body: createBackupFormData(file, mode),
    headers: {
      Authorization: `Bearer ${token}`,
    },
    isResponse: isBackupImportResponse,
    failureMessage: "Backup import failed.",
    invalidMessage: "Backup import response was invalid.",
  });
};

export const resolveAdminAssetUrl = (url: string) => {
  const trimmedUrl = url.trim();
  if (
    trimmedUrl.startsWith("http://") ||
    trimmedUrl.startsWith("https://") ||
    trimmedUrl.startsWith("data:")
  ) {
    return versionLocalMediaUrl({ value: trimmedUrl, origin: API_BASE_URL });
  }

  if (trimmedUrl.startsWith("/")) {
    return versionLocalMediaUrl({ value: `${API_BASE_URL}${trimmedUrl}`, origin: API_BASE_URL });
  }

  return trimmedUrl;
};

export const getPublicSiteSettings = async () => {
  const response = await fetch(`${API_BASE_URL}/api/blog/settings`);
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Site settings request failed."));
  }

  if (!isPublicSiteSettings(body)) {
    throw new Error("Public site settings response was invalid.");
  }

  return body;
};

export const getPublicNavigation = async () => {
  const response = await fetch(`${API_BASE_URL}/api/blog/navigation`);
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Navigation request failed."));
  }

  if (!isPublicNavigationList(body)) {
    throw new Error("Public navigation response was invalid.");
  }

  return body.groups;
};

const appendArticleListSearchParams = (
  searchParams: URLSearchParams,
  { categorySlug, page, pageSize, query, sortBy, sortOrder, tagSlug }: GetArticlesParameters,
) => {
  searchParams.set("page", String(page));
  searchParams.set("pageSize", String(pageSize));
  searchParams.set("query", query.trim());
  if (categorySlug !== undefined && categorySlug.trim().length > 0) {
    searchParams.set("categorySlug", categorySlug.trim());
  }
  if (tagSlug !== undefined && tagSlug.trim().length > 0) {
    searchParams.set("tagSlug", tagSlug.trim());
  }
  if (sortBy !== undefined) {
    searchParams.set("sortBy", sortBy);
  }
  if (sortOrder !== undefined) {
    searchParams.set("sortOrder", sortOrder);
  }
};

export const getPublicArticles = async (parameters: GetArticlesParameters) => {
  const searchParams = new URLSearchParams();
  appendArticleListSearchParams(searchParams, parameters);

  const response = await fetch(`${API_BASE_URL}/api/blog/articles?${searchParams.toString()}`);
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Article list request failed."));
  }

  if (!isArticleContentList(body)) {
    throw new Error("Article list response was invalid.");
  }

  return body;
};

export const getPublicArticle = async (slug: string) => {
  const response = await fetch(`${API_BASE_URL}/api/blog/articles/${encodeURIComponent(slug)}`);
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Article request failed."));
  }

  if (!isArticleContentResponse(body)) {
    throw new Error("Article response was invalid.");
  }

  return body.item;
};

export const getPublicArticleComments = async ({
  articleSlug,
  locale,
  page,
  pageSize,
  parentId,
}: GetPublicArticleCommentsParameters) => {
  const searchParams = new URLSearchParams({
    locale,
    page: String(page),
    pageSize: String(pageSize),
  });
  if (parentId !== undefined && parentId !== null && parentId.trim().length > 0) {
    searchParams.set("parentId", parentId.trim());
  }

  const response = await fetch(
    `${API_BASE_URL}/api/blog/articles/${encodeURIComponent(articleSlug)}/comments?${searchParams.toString()}`,
    {
      credentials: "include",
    },
  );
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Article comments request failed."));
  }

  if (!isCommentList(body)) {
    throw new Error("Article comments response was invalid.");
  }

  return body;
};

export const getPublicGuestbookComments = async ({
  locale,
  page,
  pageSize,
  parentId,
}: GetPublicGuestbookCommentsParameters) => {
  const searchParams = new URLSearchParams({
    locale,
    page: String(page),
    pageSize: String(pageSize),
  });
  if (parentId !== undefined && parentId !== null && parentId.trim().length > 0) {
    searchParams.set("parentId", parentId.trim());
  }

  const response = await fetch(
    `${API_BASE_URL}/api/blog/guestbook/comments?${searchParams.toString()}`,
    {
      credentials: "include",
    },
  );
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Guestbook comments request failed."));
  }

  if (!isCommentList(body)) {
    throw new Error("Guestbook comments response was invalid.");
  }

  return body;
};

export const createPublicArticleComment = async ({
  altcha,
  articleSlug,
  content,
  locale,
  parentId,
}: CreatePublicArticleCommentParameters) => {
  const searchParams = new URLSearchParams({ locale });

  const response = await fetch(
    `${API_BASE_URL}/api/blog/articles/${encodeURIComponent(articleSlug)}/comments?${searchParams.toString()}`,
    {
      body: JSON.stringify({
        altcha,
        content: content.trim(),
        parentId: parentId?.trim() || null,
      }),
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Comment creation failed."));
  }

  if (!isCommentResponse(body)) {
    throw new Error("Comment creation response was invalid.");
  }

  return body.item;
};

export const createPublicGuestbookComment = async ({
  altcha,
  content,
  locale,
  parentId,
}: CreatePublicGuestbookCommentParameters) => {
  const searchParams = new URLSearchParams({ locale });

  const response = await fetch(
    `${API_BASE_URL}/api/blog/guestbook/comments?${searchParams.toString()}`,
    {
      body: JSON.stringify({
        altcha,
        content: content.trim(),
        parentId: parentId?.trim() || null,
      }),
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Guestbook message creation failed."));
  }

  if (!isCommentResponse(body)) {
    throw new Error("Guestbook message creation response was invalid.");
  }

  return body.item;
};

export const uploadPublicCommentImage = async ({
  file,
  onUploadProgress,
}: UploadPublicCommentImageParameters) => {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("fileName", file.name);

  const body = await uploadJson({
    file,
    onUploadProgress,
    url: `${API_BASE_URL}/api/blog/comments/images`,
    body: formData,
    isResponse: isCommentImageUploadResponse,
    failureMessage: "Comment image upload failed.",
    invalidMessage: "Comment image upload response was invalid.",
  });

  return body.accessUrl;
};

export const getPublicArticleCategories = async () => {
  const response = await fetch(`${API_BASE_URL}/api/blog/categories`);
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Article categories request failed."));
  }

  if (!isArticleCategoryList(body)) {
    throw new Error("Article categories response was invalid.");
  }

  return body;
};

export const getPublicArticleTags = async () => {
  const response = await fetch(`${API_BASE_URL}/api/blog/tags`);
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Article tags request failed."));
  }

  if (!isArticleTagList(body)) {
    throw new Error("Article tags response was invalid.");
  }

  return body;
};

export const getAdminArticles = async ({
  status,
  token,
  ...parameters
}: GetAdminArticlesParameters) => {
  const searchParams = new URLSearchParams();
  appendArticleListSearchParams(searchParams, parameters);
  searchParams.set("status", status);

  const response = await fetch(
    `${API_BASE_URL}/api/admin/content/articles?${searchParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Article management request failed."));
  }

  if (!isArticleContentList(body)) {
    throw new Error("Article management response was invalid.");
  }

  return body;
};

export const getAdminArticle = async ({ articleId, token }: DeleteArticleContentParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/content/articles/${articleId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Article details request failed."));
  }

  if (!isArticleContentResponse(body)) {
    throw new Error("Article details response was invalid.");
  }

  return body.item;
};

export const createArticleContent = async ({
  payload,
  token,
}: ArticleContentMutationParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/content/articles`, {
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Article creation failed."));
  }

  if (!isArticleContentResponse(body)) {
    throw new Error("Article creation response was invalid.");
  }

  return body.item;
};

export const updateArticleContent = async ({
  articleId,
  payload,
  token,
}: UpdateArticleContentParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/content/articles/${articleId}`, {
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Article update failed."));
  }

  if (!isArticleContentResponse(body)) {
    throw new Error("Article update response was invalid.");
  }

  return body.item;
};

export const deleteArticleContent = async ({
  articleId,
  token,
}: DeleteArticleContentParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/content/articles/${articleId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: "DELETE",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Article deletion failed."));
  }

  if (!isOkResponse(body)) {
    throw new Error("Article deletion response was invalid.");
  }

  return body;
};

export const getArticleCategories = async ({
  page,
  pageSize,
  query,
  token,
}: GetAdminTaxonomiesParameters) => {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    query: query.trim(),
  });
  const response = await fetch(
    `${API_BASE_URL}/api/admin/content/categories?${searchParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Article categories request failed."));
  }

  if (!isArticleCategoryList(body)) {
    throw new Error("Article categories response was invalid.");
  }

  return body;
};

export const createArticleCategory = async ({
  payload,
  token,
}: ArticleCategoryMutationParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/content/categories`, {
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Article category creation failed."));
  }

  if (!isArticleCategoryResponse(body)) {
    throw new Error("Article category creation response was invalid.");
  }

  return body.item;
};

export const updateArticleCategory = async ({
  categoryId,
  payload,
  token,
}: UpdateArticleCategoryParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/content/categories/${categoryId}`, {
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Article category update failed."));
  }

  if (!isArticleCategoryResponse(body)) {
    throw new Error("Article category update response was invalid.");
  }

  return body.item;
};

export const deleteArticleCategory = async ({
  categoryId,
  token,
}: DeleteArticleCategoryParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/content/categories/${categoryId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: "DELETE",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Article category deletion failed."));
  }

  if (!isOkResponse(body)) {
    throw new Error("Article category deletion response was invalid.");
  }

  return body;
};

export const getArticleTags = async ({
  page,
  pageSize,
  query,
  token,
}: GetAdminTaxonomiesParameters) => {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    query: query.trim(),
  });
  const response = await fetch(
    `${API_BASE_URL}/api/admin/content/tags?${searchParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Article tags request failed."));
  }

  if (!isArticleTagList(body)) {
    throw new Error("Article tags response was invalid.");
  }

  return body;
};

export const createArticleTag = async ({ payload, token }: ArticleTagMutationParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/content/tags`, {
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Article tag creation failed."));
  }

  if (!isArticleTagResponse(body)) {
    throw new Error("Article tag creation response was invalid.");
  }

  return body.item;
};

export const updateArticleTag = async ({ payload, tagId, token }: UpdateArticleTagParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/content/tags/${tagId}`, {
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Article tag update failed."));
  }

  if (!isArticleTagResponse(body)) {
    throw new Error("Article tag update response was invalid.");
  }

  return body.item;
};

export const deleteArticleTag = async ({ tagId, token }: DeleteArticleTagParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/content/tags/${tagId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: "DELETE",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Article tag deletion failed."));
  }

  if (!isOkResponse(body)) {
    throw new Error("Article tag deletion response was invalid.");
  }

  return body;
};

export const getArticleContributors = async ({
  page,
  pageSize,
  query,
  token,
}: GetArticleContributorsParameters) => {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    query: query.trim(),
  });
  const response = await fetch(
    `${API_BASE_URL}/api/admin/content/contributors?${searchParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Article contributors request failed."));
  }

  if (!isArticleContributorList(body)) {
    throw new Error("Article contributors response was invalid.");
  }

  return body;
};

export const createArticleContributor = async ({
  payload,
  token,
}: ArticleContributorMutationParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/content/contributors`, {
    body: JSON.stringify({
      avatarUrl: payload.avatarUrl?.trim() || null,
      linkUrl: payload.linkUrl?.trim() || null,
      name: payload.name.trim(),
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Article contributor creation failed."));
  }

  if (!isArticleContributorResponse(body)) {
    throw new Error("Article contributor creation response was invalid.");
  }

  return body.item;
};

export const updateArticleContributor = async ({
  contributorId,
  payload,
  token,
}: UpdateArticleContributorParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/content/contributors/${contributorId}`, {
    body: JSON.stringify({
      avatarUrl: payload.avatarUrl?.trim() || null,
      linkUrl: payload.linkUrl?.trim() || null,
      name: payload.name.trim(),
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Article contributor update failed."));
  }

  if (!isArticleContributorResponse(body)) {
    throw new Error("Article contributor update response was invalid.");
  }

  return body.item;
};

export const deleteArticleContributor = async ({
  contributorId,
  token,
}: DeleteArticleContributorParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/content/contributors/${contributorId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: "DELETE",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Article contributor deletion failed."));
  }

  if (!isOkResponse(body)) {
    throw new Error("Article contributor deletion response was invalid.");
  }

  return body;
};

export const getAdminComments = async ({
  includeDeleted,
  page,
  pageSize,
  query,
  sortBy = "createdAt",
  sortOrder = "desc",
  status,
  targetType,
  token,
}: GetAdminCommentsParameters) => {
  const searchParams = new URLSearchParams({
    includeDeleted: String(includeDeleted),
    page: String(page),
    pageSize: String(pageSize),
    query: query.trim(),
    sortBy,
    sortOrder,
    status,
    targetType,
  });
  const response = await fetch(`${API_BASE_URL}/api/admin/comments?${searchParams.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Comments management request failed."));
  }

  if (!isCommentList(body)) {
    throw new Error("Comments management response was invalid.");
  }

  return body;
};

export const reviewAdminComment = async ({
  commentId,
  status,
  token,
}: ReviewAdminCommentParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/comments/${commentId}/status`, {
    body: JSON.stringify({ status }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Comment status update failed."));
  }

  if (!isCommentResponse(body)) {
    throw new Error("Comment status response was invalid.");
  }

  return body.item;
};

export const deleteAdminComment = async ({ commentId, token }: DeleteAdminCommentParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/comments/${commentId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: "DELETE",
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Comment deletion failed."));
  }

  if (!isOkResponse(body)) {
    throw new Error("Comment deletion response was invalid.");
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
  locale,
  token,
  payload,
}: {
  locale?: AppLanguage;
  token: string;
  payload: UpdateSiteSettingsPayload;
}) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/settings/site`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(locale === undefined ? {} : { [PROFILE_TAG_LOCALE_HEADER]: locale }),
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

export const getAuthProviderSettings = async (token: string, locale?: AppLanguage) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/settings/login-methods`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(locale === undefined ? {} : { [PROFILE_TAG_LOCALE_HEADER]: locale }),
    },
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Login method settings request failed."));
  }

  if (!isAuthProviderSettingsResponse(body)) {
    throw new Error("Login method settings response was invalid.");
  }

  return body;
};

export const updateAuthProviderSettings = async ({
  locale,
  payload,
  provider,
  token,
}: UpdateAuthProviderSettingsParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/settings/login-methods/${provider}`, {
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
    throw new Error(readErrorMessage(body, "Login method settings update failed."));
  }

  if (
    typeof body !== "object" ||
    body === null ||
    (body as Record<string, unknown>).ok !== true ||
    !isAuthProviderSettingsItem((body as Record<string, unknown>).item)
  ) {
    throw new Error("Login method settings response was invalid.");
  }

  return body as { item: AuthProviderSettingsItem; ok: true };
};

export const sendAuthProviderClientSecretRevealCode = async ({
  altcha,
  locale,
  provider,
  token,
}: SendAuthProviderClientSecretRevealCodeParameters) => {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/settings/login-methods/${provider}/client-secret/email-code`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        [PROFILE_TAG_LOCALE_HEADER]: locale,
      },
      body: JSON.stringify({ altcha }),
    },
  );
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Email code request failed."));
  }

  if (!isSiteSettingsApiKeyRevealCodeResponse(body)) {
    throw new Error("Email code response was invalid.");
  }

  return body;
};

export const revealAuthProviderClientSecret = async ({
  emailCode,
  locale,
  provider,
  token,
}: RevealAuthProviderClientSecretParameters) => {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/settings/login-methods/${provider}/client-secret/reveal`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        [PROFILE_TAG_LOCALE_HEADER]: locale,
      },
      body: JSON.stringify({ emailCode: emailCode.trim() }),
    },
  );
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Client Secret reveal failed."));
  }

  if (!isAuthProviderClientSecretResponse(body)) {
    throw new Error("Client Secret reveal response was invalid.");
  }

  return body;
};

export const sendSiteSettingsApiKeyRevealCode = async ({
  altcha,
  locale,
  token,
}: SendSiteSettingsApiKeyRevealCodeParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/settings/site/api-keys/email-code`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      [PROFILE_TAG_LOCALE_HEADER]: locale,
    },
    body: JSON.stringify({ altcha }),
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "Email code request failed."));
  }

  if (!isSiteSettingsApiKeyRevealCodeResponse(body)) {
    throw new Error("Email code response was invalid.");
  }

  return body;
};

export const revealSiteSettingsApiKeys = async ({
  emailCode,
  locale,
  token,
}: RevealSiteSettingsApiKeysParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/settings/site/api-keys/reveal`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      [PROFILE_TAG_LOCALE_HEADER]: locale,
    },
    body: JSON.stringify({ emailCode: emailCode.trim() }),
  });
  const body = await parseJson(response);

  if (!response.ok) {
    throw new Error(readErrorMessage(body, "API key reveal failed."));
  }

  if (!isSiteSettingsApiKeysResponse(body)) {
    throw new Error("API key reveal response was invalid.");
  }

  return body;
};

type TestSiteSettingsIntegrationParameters = {
  fallbackError: string;
  locale: AppLanguage;
  path: "test-deepl" | "test-ip-geolocation" | "test-resend";
  payload: unknown;
  token: string;
};

const testSiteSettingsIntegration = async ({
  fallbackError,
  locale,
  path,
  payload,
  token,
}: TestSiteSettingsIntegrationParameters) => {
  const response = await fetch(`${API_BASE_URL}/api/admin/settings/site/api-keys/${path}`, {
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
    throw new Error(readErrorMessage(body, fallbackError));
  }

  if (!isSiteSettingsIntegrationTestResponse(body)) {
    throw new Error("Site settings test response was invalid.");
  }

  return body;
};

export const testResendApiKey = async ({
  locale,
  resendApiKey,
  resendDomain,
  token,
}: TestResendApiKeyParameters) =>
  testSiteSettingsIntegration({
    fallbackError: "Resend API key test failed.",
    locale,
    path: "test-resend",
    payload: {
      resendApiKey: resendApiKey.trim(),
      resendDomain: resendDomain.trim(),
    },
    token,
  });

export const testDeepLApiKey = async ({ apiKey, locale, token }: TestDeepLApiKeyParameters) =>
  testSiteSettingsIntegration({
    fallbackError: "DeepL API key test failed.",
    locale,
    path: "test-deepl",
    payload: {
      apiKey: apiKey.trim(),
    },
    token,
  });

export const testIpGeolocationApiKey = async ({
  apiKey,
  locale,
  token,
}: TestIpGeolocationApiKeyParameters) =>
  testSiteSettingsIntegration({
    fallbackError: "IPGeolocation API key test failed.",
    locale,
    path: "test-ip-geolocation",
    payload: {
      apiKey: apiKey.trim(),
    },
    token,
  });

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
