import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Bell,
  BellRing,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserCircle,
  Users,
  X,
} from "lucide-react";

import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Dialog } from "@astryxdesign/core/Dialog";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { Grid } from "@astryxdesign/core/Grid";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Layout, LayoutContent, LayoutFooter, LayoutHeader } from "@astryxdesign/core/Layout";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { Pagination } from "@astryxdesign/core/Pagination";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Spinner } from "@astryxdesign/core/Spinner";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Switch } from "@astryxdesign/core/Switch";
import {
  Table,
  pixel,
  useTableSortable,
  useTableSortableState,
  useTableStickyColumns,
} from "@astryxdesign/core/Table";
import type { TableColumn } from "@astryxdesign/core/Table";
import { Heading, Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Tokenizer } from "@astryxdesign/core/Tokenizer";
import { createStaticSource } from "@astryxdesign/core/Typeahead";
import type { SearchableItem } from "@astryxdesign/core/Typeahead";

import {
  AdminFeedbackBanner,
  createAdminFeedbackBanner,
} from "../components/admin-feedback-banner";
import type { AdminFeedbackBannerState } from "../components/admin-feedback-banner";
import { AdminActionTooltip } from "../components/admin-action-tooltip";
import type {
  AdminProfileLocalizations,
  AdminProfileTranslation,
  ManagedUser,
  ManagedUserPayload,
  ManagedUserRole,
  UserManagementList,
} from "../../../../shared/admin-api";
import {
  createManagedUser,
  deleteManagedUser,
  getManagedUser,
  getManagedUsers,
  resolveAdminAssetUrl,
  updateManagedUser,
} from "../../../../shared/admin-api";
import type { AppLanguage } from "../../../../shared/i18n";
import { normalizeLanguage } from "../../../../shared/i18n";
import { formatDateTimeInTimeZone } from "../../../../shared/time-zone";

type UserRoleFilter = "all" | ManagedUserRole;
type UserSortKey = "displayName" | "role" | "tags" | "notifications" | "createdAt" | "updatedAt";
type UserTableRow = ManagedUser & Record<string, unknown>;
type UserFormMode = "create" | "edit";
type UserFormField =
  | "nameZh"
  | "nameEn"
  | "username"
  | "email"
  | "password"
  | "avatarUrl"
  | "blogUrl"
  | "bioZh"
  | "bioEn"
  | "tagsZh"
  | "tagsEn";
type UserFormErrors = Partial<Record<UserFormField, string>>;
type UserTagItemData = {
  __createdValue?: string;
};
type UserTagItem = SearchableItem<UserTagItemData>;
type BulkDeleteResult = { ok: true } | { error: unknown; ok: false };

type UserFormState = {
  mode: UserFormMode;
  id?: string;
  role: ManagedUserRole;
  nameZh: string;
  nameEn: string;
  username: string;
  email: string;
  password: string;
  avatarUrl: string;
  blogUrl: string;
  bioZh: string;
  bioEn: string;
  tagsZh: string;
  tagsEn: string;
  commentEmailNotifications: boolean;
  newPostEmailNotifications: boolean;
};

type UsersManagementPageProps = {
  authToken: string;
  isNarrow: boolean;
  timeZone: string;
};

const USER_ROLE_FILTERS: UserRoleFilter[] = ["all", "admin", "user"];
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EMPTY_ERRORS: UserFormErrors = {};

const EMPTY_USER_MANAGEMENT_LIST: UserManagementList = {
  pageInfo: {
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 1,
  },
  summary: {
    administrators: 0,
    notificationSubscribers: 0,
    total: 0,
    users: 0,
  },
  users: [],
};

const USER_MANAGEMENT_ERROR_KEYS: Record<string, string> = {
  "At least one administrator must remain.": "admin.userManagement.errors.lastAdmin",
  "Email is already used.": "admin.userManagement.errors.emailExists",
  "Password must be at least 8 characters.": "admin.userManagement.errors.passwordTooShort",
  "Role is invalid.": "admin.userManagement.errors.invalidRole",
  "User could not be created.": "admin.userManagement.errors.createFailed",
  "User could not be deleted.": "admin.userManagement.errors.deleteFailed",
  "User could not be updated.": "admin.userManagement.errors.updateFailed",
  "User was not found.": "admin.userManagement.errors.notFound",
  "Username and email are required.": "admin.userManagement.errors.invalidIdentity",
  "Username is already used.": "admin.userManagement.errors.usernameExists",
  "You cannot delete your own account.": "admin.userManagement.errors.selfDelete",
  "You cannot remove your own administrator role.": "admin.userManagement.errors.selfRoleChange",
};

const pageStackStyle: CSSProperties = {
  width: "100%",
};

const summaryIconStyle: CSSProperties = {
  color: "var(--color-text-secondary)",
};

const filterCardStyle: CSSProperties = {
  width: "100%",
};

const tableCardStyle: CSSProperties = {
  overflow: "hidden",
  width: "100%",
};

const tableViewportStyle: CSSProperties = {
  overflowX: "auto",
  width: "100%",
};

const contentAdaptiveTableStyle: CSSProperties = {
  minWidth: "max-content",
  width: "100%",
};

const tableFooterStyle: CSSProperties = {
  borderTop: "1px solid var(--color-border)",
  padding: 16,
};

const userIdentityStyle: CSSProperties = {
  justifyContent: "center",
  minWidth: 0,
};

const userIdentityTextStyle: CSSProperties = {
  minWidth: 0,
  textAlign: "center",
};

const roleFilterStyle: CSSProperties = {
  minWidth: 240,
};

const summaryValueStyle: CSSProperties = {
  lineHeight: 1,
};

const actionsCellStyle: CSSProperties = {
  alignItems: "center",
  display: "flex",
  justifyContent: "center",
  width: "100%",
};

const selectionToolbarStyle: CSSProperties = {
  borderBottom: "1px solid var(--color-border)",
  padding: 12,
};

const dialogHeaderTitleStyle: CSSProperties = {
  minWidth: 0,
};

const optionalText = (value: string | undefined) => {
  const trimmedValue = value?.trim() ?? "";
  return trimmedValue.length > 0 ? trimmedValue : undefined;
};

const clampNumber = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const estimateTextWidth = (value: string) =>
  Array.from(value).reduce((totalWidth, character) => {
    if (/[\u3040-\u30ff\u3400-\u9fff\uff00-\uffef]/u.test(character)) {
      return totalWidth + 14;
    }

    if (/[A-Z0-9@.]/u.test(character)) {
      return totalWidth + 8;
    }

    return totalWidth + 7;
  }, 0);

type CreateAdaptiveColumnWidthParameters = {
  header: string;
  maxWidth: number;
  minWidth: number;
  padding?: number;
  values: readonly string[];
};

const createAdaptiveColumnWidth = ({
  header,
  maxWidth,
  minWidth,
  padding = 48,
  values,
}: CreateAdaptiveColumnWidthParameters) => {
  const widestContent = Math.max(
    estimateTextWidth(header),
    ...values.map((value) => estimateTextWidth(value)),
  );

  return pixel(Math.round(clampNumber(widestContent + padding, minWidth, maxWidth)));
};

const splitValues = (raw: string) =>
  raw
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);

const createTagItems = (values: string[]): UserTagItem[] => {
  const seenKeys = new Set<string>();

  return values.reduce<UserTagItem[]>((items, value) => {
    const label = value.trim();
    const key = label.toLocaleLowerCase();
    if (label.length === 0 || seenKeys.has(key)) {
      return items;
    }

    seenKeys.add(key);
    return [...items, { id: label, label }];
  }, []);
};

const createTagsText = (items: UserTagItem[]) =>
  createTagItems(items.map((item) => item.label))
    .map((item) => item.label)
    .join(", ");

const isValidUrl = (value: string) => {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return true;
  }

  try {
    new URL(trimmedValue);
    return true;
  } catch {
    return false;
  }
};

const isValidMediaAssetUrl = (value: string) => {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    return true;
  }

  if (trimmedValue.startsWith("/uploads/")) {
    return true;
  }

  return isValidUrl(trimmedValue);
};

type CreateEmptyFormStateParameters = {
  mode: UserFormMode;
};

const createEmptyFormState = ({ mode }: CreateEmptyFormStateParameters): UserFormState => ({
  avatarUrl: "",
  bioEn: "",
  bioZh: "",
  blogUrl: "",
  commentEmailNotifications: false,
  email: "",
  mode,
  nameEn: "",
  nameZh: "",
  newPostEmailNotifications: false,
  password: "",
  role: "user",
  tagsEn: "",
  tagsZh: "",
  username: "",
});

type CreateFormStateFromUserParameters = {
  profileLocalizations: AdminProfileLocalizations;
  user: ManagedUser;
};

const createFormStateFromUser = ({
  profileLocalizations,
  user,
}: CreateFormStateFromUserParameters): UserFormState => ({
  avatarUrl: user.avatarUrl ?? "",
  bioEn: profileLocalizations.en.bio,
  bioZh: profileLocalizations.zhCN.bio,
  blogUrl: user.blogUrl ?? "",
  commentEmailNotifications: user.commentEmailNotifications,
  email: user.email,
  id: user.id,
  mode: "edit",
  nameEn: profileLocalizations.en.name,
  nameZh: profileLocalizations.zhCN.name,
  newPostEmailNotifications: user.newPostEmailNotifications,
  password: "",
  role: user.role,
  tagsEn: profileLocalizations.en.tags.join(", "),
  tagsZh: profileLocalizations.zhCN.tags.join(", "),
  username: user.username,
});

type GetDisplayNameParameters = {
  language: AppLanguage;
  user: ManagedUser;
};

const getDisplayName = ({ language, user }: GetDisplayNameParameters) => {
  if (language === "en") {
    return optionalText(user.englishName) ?? optionalText(user.name) ?? user.username;
  }

  return optionalText(user.name) ?? optionalText(user.englishName) ?? user.username;
};

type GetLocalizedTagsParameters = {
  language: AppLanguage;
  user: ManagedUser;
};

const getLocalizedTags = ({ language, user }: GetLocalizedTagsParameters) => {
  const primaryTags = language === "en" ? user.englishTags : user.tags;
  const fallbackTags = language === "en" ? user.tags : user.englishTags;

  return primaryTags.length > 0 ? primaryTags : fallbackTags;
};

type FormatDateTimeParameters = {
  language: string;
  timeZone: string;
  value: string;
};

const formatDateTime = ({ language, timeZone, value }: FormatDateTimeParameters) =>
  formatDateTimeInTimeZone({ language, timeZone, value });

const compareDate = (left: string, right: string) =>
  new Date(left).getTime() - new Date(right).getTime();

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message.length > 0 ? error.message : fallback;

type CreatePayloadParameters = {
  form: UserFormState;
};

const createPayload = ({ form }: CreatePayloadParameters): ManagedUserPayload => ({
  avatarUrl: form.avatarUrl.trim(),
  blogUrl: form.blogUrl.trim(),
  commentEmailNotifications: form.commentEmailNotifications,
  email: form.email.trim(),
  newPostEmailNotifications: form.newPostEmailNotifications,
  password: form.password,
  profileLocalizations: {
    en: {
      bio: form.bioEn.trim(),
      name: form.nameEn.trim(),
      tags: splitValues(form.tagsEn),
    },
    zhCN: {
      bio: form.bioZh.trim(),
      name: form.nameZh.trim(),
      tags: splitValues(form.tagsZh),
    },
  },
  role: form.role,
  username: form.username.trim(),
});

type SummaryCardProps = {
  description: string;
  icon: ReactNode;
  label: string;
  value: number;
};

const SummaryCard = ({ description, icon, label, value }: SummaryCardProps) => (
  <Card padding={4}>
    <VStack gap={3}>
      <HStack gap={2} vAlign="center">
        <span style={summaryIconStyle}>{icon}</span>
        <Text type="label" color="secondary">
          {label}
        </Text>
      </HStack>
      <Heading level={3} style={summaryValueStyle}>
        {value}
      </Heading>
      <Text type="supporting" color="secondary">
        {description}
      </Text>
    </VStack>
  </Card>
);

type RoleBadgeProps = {
  role: ManagedUserRole;
};

const RoleBadge = ({ role }: RoleBadgeProps) => {
  const { t } = useTranslation();

  return (
    <Badge
      label={t(`admin.userManagement.roles.${role}`)}
      icon={role === "admin" ? <ShieldCheck size={14} /> : <UserCircle size={14} />}
      variant={role === "admin" ? "success" : "neutral"}
    />
  );
};

type NotificationCellProps = {
  user: ManagedUser;
};

const NotificationCell = ({ user }: NotificationCellProps) => {
  const { t } = useTranslation();
  const labels = [
    user.commentEmailNotifications ? t("admin.userManagement.notifications.comment") : undefined,
    user.newPostEmailNotifications ? t("admin.userManagement.notifications.newPost") : undefined,
  ].filter((label): label is string => label !== undefined);

  if (labels.length === 0) {
    return (
      <Text type="supporting" color="secondary">
        {t("admin.userManagement.notifications.none")}
      </Text>
    );
  }

  return (
    <HStack gap={1} hAlign="center" wrap="wrap">
      {labels.map((label) => (
        <Badge key={label} label={label} icon={<Bell size={14} />} />
      ))}
    </HStack>
  );
};

type UserActionsCellProps = {
  isNarrow: boolean;
  onDelete: () => void;
  onEdit: () => void;
};

const UserActionsCell = ({ isNarrow, onDelete, onEdit }: UserActionsCellProps) => {
  const { t } = useTranslation();

  if (isNarrow) {
    return (
      <div style={actionsCellStyle}>
        <MoreMenu
          alignment="end"
          className="admin-list-actions-menu"
          icon={<MoreHorizontal size={16} />}
          label={t("admin.userManagement.actions")}
          presentation="adaptive"
          items={[
            {
              icon: <Pencil size={16} />,
              id: "edit",
              label: t("admin.userManagement.edit"),
              onClick: onEdit,
            },
            {
              icon: <Trash2 size={16} />,
              id: "delete",
              label: t("admin.userManagement.delete"),
              onClick: onDelete,
              variant: "destructive",
            },
          ]}
        />
      </div>
    );
  }

  return (
    <HStack gap={1} hAlign="center" style={actionsCellStyle}>
      <AdminActionTooltip label={t("admin.userManagement.edit")}>
        <IconButton
          label={t("admin.userManagement.edit")}
          icon={<Pencil size={16} />}
          variant="ghost"
          size="sm"
          onClick={onEdit}
        />
      </AdminActionTooltip>
      <AdminActionTooltip label={t("admin.userManagement.delete")}>
        <IconButton
          label={t("admin.userManagement.delete")}
          icon={<Trash2 size={16} />}
          variant="ghost"
          size="sm"
          onClick={onDelete}
        />
      </AdminActionTooltip>
    </HStack>
  );
};

export function UsersManagementPage({ authToken, isNarrow, timeZone }: UsersManagementPageProps) {
  const { i18n, t } = useTranslation();
  const language = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  const [usersData, setUsersData] = useState<UserManagementList>(EMPTY_USER_MANAGEMENT_LIST);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRoleFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [isOpeningForm, setIsOpeningForm] = useState(false);
  const [userForm, setUserForm] = useState<UserFormState>();
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [deletingUser, setDeletingUser] = useState<ManagedUser>();
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [banner, setBanner] = useState<AdminFeedbackBannerState>();
  const collator = useMemo(
    () => new Intl.Collator(language, { numeric: true, sensitivity: "base" }),
    [language],
  );

  const getUserManagementErrorMessage = useCallback(
    (error: unknown, fallback: string) => {
      const message = getErrorMessage(error, fallback);
      const translationKey = USER_MANAGEMENT_ERROR_KEYS[message];
      if (translationKey === undefined) {
        return message;
      }

      return t(translationKey);
    },
    [t],
  );

  const loadUsers = useCallback(async () => {
    setIsLoading(true);

    try {
      const nextUsersData = await getManagedUsers({
        locale: language,
        page,
        pageSize,
        query,
        role: roleFilter,
        token: authToken,
      });
      setUsersData(nextUsersData);
      if (nextUsersData.pageInfo.page !== page) {
        setPage(nextUsersData.pageInfo.page);
      }
    } catch (error) {
      const message = getUserManagementErrorMessage(error, t("admin.userManagement.loadFailed"));
      setBanner(
        createAdminFeedbackBanner({
          description: message,
          status: "error",
          title: t("admin.userManagement.loadFailed"),
        }),
      );
    } finally {
      setIsLoading(false);
    }
  }, [authToken, getUserManagementErrorMessage, language, page, pageSize, query, roleFilter, t]);

  useEffect(() => {
    let isMounted = true;

    const loadMountedUsers = async () => {
      setIsLoading(true);

      try {
        const nextUsersData = await getManagedUsers({
          locale: language,
          page,
          pageSize,
          query,
          role: roleFilter,
          token: authToken,
        });
        if (!isMounted) {
          return;
        }

        setUsersData(nextUsersData);
        if (nextUsersData.pageInfo.page !== page) {
          setPage(nextUsersData.pageInfo.page);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message = getUserManagementErrorMessage(error, t("admin.userManagement.loadFailed"));
        setBanner(
          createAdminFeedbackBanner({
            description: message,
            status: "error",
            title: t("admin.userManagement.loadFailed"),
          }),
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadMountedUsers();

    return () => {
      isMounted = false;
    };
  }, [authToken, getUserManagementErrorMessage, language, page, pageSize, query, roleFilter, t]);

  const rows = useMemo<UserTableRow[]>(
    () => usersData.users.map((user) => ({ ...user })),
    [usersData.users],
  );

  const { sortConfig, sortedData } = useTableSortableState<UserTableRow, UserSortKey>({
    allowUnsortedState: false,
    comparators: {
      createdAt: (left, right) => compareDate(left.createdAt, right.createdAt),
      displayName: (left, right) =>
        collator.compare(
          getDisplayName({ language, user: left }),
          getDisplayName({ language, user: right }),
        ),
      notifications: (left, right) =>
        Number(left.commentEmailNotifications || left.newPostEmailNotifications) -
        Number(right.commentEmailNotifications || right.newPostEmailNotifications),
      role: (left, right) => collator.compare(left.role, right.role),
      tags: (left, right) =>
        collator.compare(
          getLocalizedTags({ language, user: left }).join(" "),
          getLocalizedTags({ language, user: right }).join(" "),
        ),
      updatedAt: (left, right) => compareDate(left.updatedAt, right.updatedAt),
    },
    data: rows,
    defaultSort: [{ direction: "descending", sortKey: "createdAt" }],
  });
  const sortablePlugin = useTableSortable<UserTableRow, UserSortKey>(sortConfig);
  const stickyColumnsPlugin = useTableStickyColumns<UserTableRow>({ endKeys: ["actions"] });
  const selectedUsers = useMemo(
    () => sortedData.filter((user) => selectedUserIds.has(user.id)),
    [selectedUserIds, sortedData],
  );
  const selectedUserCount = selectedUsers.length;
  const isAllVisibleUsersSelected =
    sortedData.length > 0 && sortedData.every((user) => selectedUserIds.has(user.id));
  const isVisibleUserSelectionIndeterminate = selectedUserCount > 0 && !isAllVisibleUsersSelected;
  const columnWidths = useMemo(() => {
    const notificationText = (user: UserTableRow) => {
      const notifications = [
        user.commentEmailNotifications
          ? t("admin.userManagement.notifications.comment")
          : undefined,
        user.newPostEmailNotifications
          ? t("admin.userManagement.notifications.newPost")
          : undefined,
      ].filter((notification): notification is string => notification !== undefined);

      return notifications.length > 0
        ? notifications.join(" / ")
        : t("admin.userManagement.notifications.none");
    };

    return {
      createdAt: createAdaptiveColumnWidth({
        header: t("admin.userManagement.columns.createdAt"),
        maxWidth: 190,
        minWidth: 150,
        values: sortedData.map((user) =>
          formatDateTime({ language, timeZone, value: user.createdAt }),
        ),
      }),
      displayName: createAdaptiveColumnWidth({
        header: t("admin.userManagement.columns.profile"),
        maxWidth: 380,
        minWidth: 280,
        padding: 84,
        values: sortedData.map(
          (user) => `${getDisplayName({ language, user })} @${user.username} / ${user.email}`,
        ),
      }),
      notifications: createAdaptiveColumnWidth({
        header: t("admin.userManagement.columns.notifications"),
        maxWidth: 240,
        minWidth: 150,
        values: sortedData.map(notificationText),
      }),
      role: createAdaptiveColumnWidth({
        header: t("admin.userManagement.columns.role"),
        maxWidth: 140,
        minWidth: 112,
        values: sortedData.map((user) => t(`admin.userManagement.roles.${user.role}`)),
      }),
      tags: createAdaptiveColumnWidth({
        header: t("admin.userManagement.columns.tags"),
        maxWidth: 320,
        minWidth: 180,
        values: sortedData.map((user) => {
          const tags = getLocalizedTags({ language, user });

          return tags.length > 0 ? tags.join(" / ") : t("common.notProvided");
        }),
      }),
      updatedAt: createAdaptiveColumnWidth({
        header: t("admin.userManagement.columns.updatedAt"),
        maxWidth: 190,
        minWidth: 150,
        values: sortedData.map((user) =>
          formatDateTime({ language, timeZone, value: user.updatedAt }),
        ),
      }),
    };
  }, [language, sortedData, t, timeZone]);

  useEffect(() => {
    const visibleUserIds = new Set(usersData.users.map((user) => user.id));

    setSelectedUserIds((current) => {
      const nextSelectedUserIds = new Set(
        Array.from(current).filter((userId) => visibleUserIds.has(userId)),
      );

      return nextSelectedUserIds.size === current.size ? current : nextSelectedUserIds;
    });
  }, [usersData.users]);

  const toggleUserSelection = useCallback((userId: string, isSelected: boolean) => {
    setSelectedUserIds((current) => {
      const nextSelectedUserIds = new Set(current);
      if (isSelected) {
        nextSelectedUserIds.add(userId);
      } else {
        nextSelectedUserIds.delete(userId);
      }

      return nextSelectedUserIds;
    });
  }, []);

  const toggleAllVisibleUsers = useCallback(
    (isSelected: boolean) => {
      setSelectedUserIds((current) => {
        const nextSelectedUserIds = new Set(current);

        for (const user of sortedData) {
          if (isSelected) {
            nextSelectedUserIds.add(user.id);
          } else {
            nextSelectedUserIds.delete(user.id);
          }
        }

        return nextSelectedUserIds;
      });
    },
    [sortedData],
  );

  const clearSelectedUsers = useCallback(() => {
    setSelectedUserIds(new Set());
  }, []);

  const tagZhValues = useMemo(() => splitValues(userForm?.tagsZh ?? ""), [userForm?.tagsZh]);
  const tagZhItems = useMemo(() => createTagItems(tagZhValues), [tagZhValues]);
  const tagZhSearchSource = useMemo(() => createStaticSource(tagZhItems), [tagZhItems]);
  const tagEnValues = useMemo(() => splitValues(userForm?.tagsEn ?? ""), [userForm?.tagsEn]);
  const tagEnItems = useMemo(() => createTagItems(tagEnValues), [tagEnValues]);
  const tagEnSearchSource = useMemo(() => createStaticSource(tagEnItems), [tagEnItems]);

  const updateFormField = (field: UserFormField, value: string) => {
    setUserForm((current) => {
      if (current === undefined) {
        return current;
      }

      return { ...current, [field]: value };
    });
  };

  const updateFormTags = (field: "tagsZh" | "tagsEn", items: UserTagItem[]) => {
    updateFormField(field, createTagsText(items));
  };

  const updateRole = (role: string) => {
    setUserForm((current) => {
      if (current === undefined || (role !== "admin" && role !== "user")) {
        return current;
      }

      return { ...current, role };
    });
  };

  const updateSwitch = (field: "commentEmailNotifications" | "newPostEmailNotifications") => {
    setUserForm((current) => {
      if (current === undefined) {
        return current;
      }

      return { ...current, [field]: !current[field] };
    });
  };

  const renderTagItem = (item: UserTagItem) => {
    const createdValue = item.auxiliaryData?.__createdValue;

    if (createdValue) {
      return t("admin.settings.createTag", { tag: createdValue });
    }

    return item.label;
  };

  const validateForm = (form: UserFormState) => {
    const nextErrors: UserFormErrors = {};

    if (form.username.trim().length === 0) {
      nextErrors.username = t("admin.userManagement.validation.usernameRequired");
    }

    if (form.email.trim().length === 0) {
      nextErrors.email = t("admin.userManagement.validation.emailRequired");
    } else if (!EMAIL_PATTERN.test(form.email.trim())) {
      nextErrors.email = t("admin.userManagement.validation.emailInvalid");
    }

    if (form.mode === "create" && form.password.length === 0) {
      nextErrors.password = t("admin.userManagement.validation.passwordRequired");
    } else if (form.password.length > 0 && form.password.length < 8) {
      nextErrors.password = t("admin.userManagement.validation.passwordTooShort");
    }

    if (!isValidMediaAssetUrl(form.avatarUrl)) {
      nextErrors.avatarUrl = t("admin.settings.validation.avatarInvalid");
    }

    if (!isValidUrl(form.blogUrl)) {
      nextErrors.blogUrl = t("admin.settings.validation.blogInvalid");
    }

    return nextErrors;
  };

  const formErrors =
    userForm !== undefined && attemptedSave ? validateForm(userForm) : EMPTY_ERRORS;

  type CreateSaveSuccessBannerParameters = {
    profileTranslation?: AdminProfileTranslation;
    title: string;
  };

  const createSaveSuccessBanner = ({
    profileTranslation,
    title,
  }: CreateSaveSuccessBannerParameters) => {
    if (profileTranslation === undefined || profileTranslation.status === "not-needed") {
      return createAdminFeedbackBanner({
        status: "success",
        title,
      });
    }

    const targetLocales = profileTranslation.targetLocales ?? [profileTranslation.targetLocale];
    const targetLanguage = t(
      targetLocales.length > 1
        ? "admin.settings.translationTarget.both"
        : targetLocales[0] === "en"
          ? "admin.settings.translationTarget.english"
          : "admin.settings.translationTarget.chinese",
    );

    switch (profileTranslation.status) {
      case "completed":
        return createAdminFeedbackBanner({
          description: t("admin.settings.translation.completed", {
            language: targetLanguage,
          }),
          status: "success",
          title,
        });
      case "missing-api-key":
        return createAdminFeedbackBanner({
          description: t("admin.settings.translation.missingApiKey", {
            language: targetLanguage,
          }),
          status: "warning",
          title,
        });
      case "incomplete":
        return createAdminFeedbackBanner({
          description: t("admin.settings.translation.incomplete", {
            language: targetLanguage,
          }),
          status: "warning",
          title,
        });
      default: {
        const exhaustiveStatus: never = profileTranslation.status;
        throw new Error("Unhandled translation status.", { cause: exhaustiveStatus });
      }
    }
  };

  const openCreateForm = () => {
    setAttemptedSave(false);
    setUserForm(createEmptyFormState({ mode: "create" }));
  };

  const closeUserForm = () => {
    setAttemptedSave(false);
    setUserForm(undefined);
  };

  const openEditForm = async (user: ManagedUser) => {
    setIsOpeningForm(true);

    try {
      const details = await getManagedUser({
        locale: language,
        token: authToken,
        userId: user.id,
      });
      setAttemptedSave(false);
      setUserForm(createFormStateFromUser(details));
    } catch (error) {
      setBanner(
        createAdminFeedbackBanner({
          description: getUserManagementErrorMessage(error, t("admin.userManagement.loadFailed")),
          status: "error",
          title: t("admin.userManagement.loadFailed"),
        }),
      );
    } finally {
      setIsOpeningForm(false);
    }
  };

  const saveUser = async () => {
    if (userForm === undefined) {
      return;
    }

    setAttemptedSave(true);
    const nextErrors = validateForm(userForm);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const payload = createPayload({ form: userForm });
    setIsSavingUser(true);

    try {
      const result =
        userForm.mode === "create"
          ? await createManagedUser({
              locale: language,
              payload,
              token: authToken,
            })
          : userForm.id === undefined
            ? undefined
            : await updateManagedUser({
                locale: language,
                payload,
                token: authToken,
                userId: userForm.id,
              });

      if (result === undefined) {
        throw new Error(t("admin.userManagement.updateFailed"));
      }

      setBanner(
        createSaveSuccessBanner({
          profileTranslation: result.profileTranslation,
          title:
            userForm.mode === "create"
              ? t("admin.userManagement.createSuccess")
              : t("admin.userManagement.updateSuccess"),
        }),
      );
      setUserForm(undefined);
      setAttemptedSave(false);
      if (userForm.mode === "create") {
        setPage(1);
      }
      await loadUsers();
    } catch (error) {
      const title =
        userForm.mode === "create"
          ? t("admin.userManagement.createFailed")
          : t("admin.userManagement.updateFailed");
      setBanner(
        createAdminFeedbackBanner({
          description: getUserManagementErrorMessage(error, title),
          status: "error",
          title,
        }),
      );
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (deletingUser === undefined) {
      return;
    }

    setIsDeletingUser(true);

    try {
      await deleteManagedUser({
        token: authToken,
        userId: deletingUser.id,
      });
      setBanner(
        createAdminFeedbackBanner({
          status: "success",
          title: t("admin.userManagement.deleteSuccess"),
        }),
      );
      setDeletingUser(undefined);
      await loadUsers();
    } catch (error) {
      setBanner(
        createAdminFeedbackBanner({
          description: getUserManagementErrorMessage(error, t("admin.userManagement.deleteFailed")),
          status: "error",
          title: t("admin.userManagement.deleteFailed"),
        }),
      );
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleBulkDeleteUsers = async () => {
    if (selectedUsers.length === 0) {
      setIsBulkDeleteOpen(false);
      return;
    }

    setIsDeletingUser(true);

    const results: BulkDeleteResult[] = [];
    for (const user of selectedUsers) {
      try {
        await deleteManagedUser({
          token: authToken,
          userId: user.id,
        });
        results.push({ ok: true });
      } catch (error) {
        results.push({ error, ok: false });
      }
    }

    const deletedCount = results.filter((result) => result.ok).length;
    const failedResults = results.filter(
      (result): result is Extract<BulkDeleteResult, { ok: false }> => !result.ok,
    );

    if (failedResults.length === 0) {
      setBanner(
        createAdminFeedbackBanner({
          description: t("admin.userManagement.bulkDeleteSuccessDescription", {
            count: deletedCount,
          }),
          status: "success",
          title: t("admin.userManagement.bulkDeleteSuccess"),
        }),
      );
      clearSelectedUsers();
    } else {
      const firstFailedResult = failedResults[0];
      const fallbackDescription = t("admin.userManagement.bulkDeletePartialDescription", {
        deleted: deletedCount,
        failed: failedResults.length,
      });

      setBanner(
        createAdminFeedbackBanner({
          description:
            firstFailedResult === undefined
              ? fallbackDescription
              : getUserManagementErrorMessage(firstFailedResult.error, fallbackDescription),
          status: deletedCount > 0 ? "warning" : "error",
          title:
            deletedCount > 0
              ? t("admin.userManagement.bulkDeletePartial")
              : t("admin.userManagement.deleteFailed"),
        }),
      );
      setSelectedUserIds(
        new Set(selectedUsers.filter((_, index) => !results[index]?.ok).map((user) => user.id)),
      );
    }

    setIsBulkDeleteOpen(false);
    setIsDeletingUser(false);
    await loadUsers();
  };

  const columns = useMemo<TableColumn<UserTableRow>[]>(
    () => [
      {
        align: "center",
        header: (
          <CheckboxInput
            label={t("admin.userManagement.selectAll")}
            isLabelHidden
            value={
              isAllVisibleUsersSelected
                ? true
                : isVisibleUserSelectionIndeterminate
                  ? "indeterminate"
                  : false
            }
            isDisabled={sortedData.length === 0 || isDeletingUser}
            onChange={(isSelected) => toggleAllVisibleUsers(isSelected)}
          />
        ),
        key: "selection",
        resizable: false,
        width: pixel(56),
        renderCell: (user) => (
          <CheckboxInput
            label={t("admin.userManagement.selectUser", {
              name: getDisplayName({ language, user }),
            })}
            isLabelHidden
            value={selectedUserIds.has(user.id)}
            isDisabled={isDeletingUser}
            onChange={(isSelected) => toggleUserSelection(user.id, isSelected)}
          />
        ),
      },
      {
        align: "center",
        key: "displayName",
        header: t("admin.userManagement.columns.profile"),
        sortable: true,
        width: columnWidths.displayName,
        renderCell: (user) => {
          const displayName = getDisplayName({ language, user });
          const avatarUrl =
            user.avatarUrl === undefined ? undefined : resolveAdminAssetUrl(user.avatarUrl);

          return (
            <HStack gap={3} hAlign="center" vAlign="center" style={userIdentityStyle}>
              <Avatar src={avatarUrl} name={displayName} size="sm" />
              <VStack gap={0} style={userIdentityTextStyle}>
                <Text type="body" weight="semibold" maxLines={1}>
                  {displayName}
                </Text>
                <Text type="supporting" color="secondary" maxLines={1}>
                  @{user.username} / {user.email}
                </Text>
              </VStack>
            </HStack>
          );
        },
      },
      {
        align: "center",
        key: "role",
        header: t("admin.userManagement.columns.role"),
        sortable: true,
        width: columnWidths.role,
        renderCell: (user) => <RoleBadge role={user.role} />,
      },
      {
        align: "center",
        key: "tags",
        header: t("admin.userManagement.columns.tags"),
        sortable: true,
        width: columnWidths.tags,
        renderCell: (user) => {
          const tags = getLocalizedTags({ language, user });

          return tags.length > 0 ? (
            <Text type="body" maxLines={2}>
              {tags.join(" / ")}
            </Text>
          ) : (
            <Text type="supporting" color="secondary">
              {t("common.notProvided")}
            </Text>
          );
        },
      },
      {
        align: "center",
        key: "notifications",
        header: t("admin.userManagement.columns.notifications"),
        sortable: true,
        width: columnWidths.notifications,
        renderCell: (user) => <NotificationCell user={user} />,
      },
      {
        align: "center",
        key: "createdAt",
        header: t("admin.userManagement.columns.createdAt"),
        sortable: true,
        width: columnWidths.createdAt,
        renderCell: (user) => (
          <Text type="body" maxLines={1}>
            {formatDateTime({ language, timeZone, value: user.createdAt })}
          </Text>
        ),
      },
      {
        align: "center",
        key: "updatedAt",
        header: t("admin.userManagement.columns.updatedAt"),
        sortable: true,
        width: columnWidths.updatedAt,
        renderCell: (user) => (
          <Text type="body" maxLines={1}>
            {formatDateTime({ language, timeZone, value: user.updatedAt })}
          </Text>
        ),
      },
      {
        align: "center",
        key: "actions",
        header: t("admin.userManagement.actions"),
        resizable: false,
        width: pixel(isNarrow ? 72 : 112),
        renderCell: (user) => (
          <UserActionsCell
            isNarrow={isNarrow}
            onDelete={() => setDeletingUser(user)}
            onEdit={() => {
              void openEditForm(user);
            }}
          />
        ),
      },
    ],
    [
      columnWidths,
      isAllVisibleUsersSelected,
      isDeletingUser,
      isNarrow,
      isVisibleUserSelectionIndeterminate,
      language,
      selectedUserIds,
      sortedData.length,
      t,
      timeZone,
      toggleAllVisibleUsers,
      toggleUserSelection,
    ],
  );

  const hasInitialLoadingState = isLoading && usersData.users.length === 0;
  const hasPagination = usersData.pageInfo.totalItems > 0;
  const userFormTitle =
    userForm === undefined
      ? ""
      : userForm.mode === "create"
        ? t("admin.userManagement.createTitle")
        : t("admin.userManagement.editTitle");
  const userFormDescription =
    userForm === undefined
      ? ""
      : userForm.mode === "create"
        ? t("admin.userManagement.createDescription")
        : t("admin.userManagement.editDescription");

  return (
    <VStack gap={4} style={pageStackStyle}>
      <AdminFeedbackBanner banner={banner} onDismiss={() => setBanner(undefined)} />

      <Grid columns={{ minWidth: isNarrow ? 180 : 220, max: 4 }} gap={isNarrow ? 3 : 4}>
        <SummaryCard
          label={t("admin.userManagement.summary.total")}
          value={usersData.summary.total}
          description={t("admin.pageDescriptions.users")}
          icon={<Users size={18} />}
        />
        <SummaryCard
          label={t("admin.userManagement.summary.administrators")}
          value={usersData.summary.administrators}
          description={t("admin.userManagement.roles.admin")}
          icon={<ShieldCheck size={18} />}
        />
        <SummaryCard
          label={t("admin.userManagement.summary.users")}
          value={usersData.summary.users}
          description={t("admin.userManagement.roles.user")}
          icon={<UserCircle size={18} />}
        />
        <SummaryCard
          label={t("admin.userManagement.summary.notificationSubscribers")}
          value={usersData.summary.notificationSubscribers}
          description={t("admin.userManagement.columns.notifications")}
          icon={<BellRing size={18} />}
        />
      </Grid>

      {userForm !== undefined && (
        <Dialog
          isOpen
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              closeUserForm();
            }
          }}
          variant={isNarrow ? "fullscreen" : "standard"}
          width={1040}
          maxHeight="90dvh"
          purpose="form"
          padding={0}
          aria-label={userFormTitle}
        >
          <Layout
            height="fill"
            header={
              <LayoutHeader hasDivider padding={isNarrow ? 3 : 4}>
                <HStack gap={3} hAlign="between" vAlign="start">
                  <VStack gap={0} style={dialogHeaderTitleStyle}>
                    <Heading level={2}>{userFormTitle}</Heading>
                    <Text type="supporting" color="secondary">
                      {userFormDescription}
                    </Text>
                  </VStack>
                  <IconButton
                    label={t("actions.close")}
                    icon={<X size={18} />}
                    variant="ghost"
                    size="sm"
                    onClick={closeUserForm}
                  />
                </HStack>
              </LayoutHeader>
            }
            content={
              <LayoutContent padding={isNarrow ? 3 : 4}>
                <FormLayout defaultOptionality="optional">
                  <Grid columns={{ minWidth: isNarrow ? 220 : 280, max: 3 }} gap={3}>
                    <TextInput
                      label={t("admin.userManagement.fields.nameZh")}
                      value={userForm.nameZh}
                      onChange={(value) => updateFormField("nameZh", value)}
                    />
                    <TextInput
                      label={t("admin.userManagement.fields.nameEn")}
                      value={userForm.nameEn}
                      onChange={(value) => updateFormField("nameEn", value)}
                    />
                    <TextInput
                      label={t("admin.userManagement.fields.username")}
                      value={userForm.username}
                      onChange={(value) => updateFormField("username", value)}
                      isRequired
                      status={
                        formErrors.username
                          ? { type: "error", message: formErrors.username }
                          : undefined
                      }
                    />
                    <TextInput
                      label={t("admin.userManagement.fields.email")}
                      value={userForm.email}
                      onChange={(value) => updateFormField("email", value)}
                      isRequired
                      status={
                        formErrors.email ? { type: "error", message: formErrors.email } : undefined
                      }
                    />
                    <TextInput
                      label={t("admin.userManagement.fields.password")}
                      type="password"
                      value={userForm.password}
                      onChange={(value) => updateFormField("password", value)}
                      placeholder={t("admin.userManagement.fields.passwordPlaceholder")}
                      isRequired={userForm.mode === "create"}
                      status={
                        formErrors.password
                          ? { type: "error", message: formErrors.password }
                          : undefined
                      }
                    />
                    <SegmentedControl
                      label={t("admin.userManagement.roleFilter")}
                      value={userForm.role}
                      onChange={updateRole}
                    >
                      <SegmentedControlItem
                        value="admin"
                        label={t("admin.userManagement.roles.admin")}
                      />
                      <SegmentedControlItem
                        value="user"
                        label={t("admin.userManagement.roles.user")}
                      />
                    </SegmentedControl>
                  </Grid>

                  <Grid columns={{ minWidth: isNarrow ? 220 : 320, max: 2 }} gap={3}>
                    <TextInput
                      label={t("admin.userManagement.fields.avatarUrl")}
                      value={userForm.avatarUrl}
                      onChange={(value) => updateFormField("avatarUrl", value)}
                      status={
                        formErrors.avatarUrl
                          ? { type: "error", message: formErrors.avatarUrl }
                          : undefined
                      }
                    />
                    <TextInput
                      label={t("admin.userManagement.fields.blogUrl")}
                      value={userForm.blogUrl}
                      onChange={(value) => updateFormField("blogUrl", value)}
                      status={
                        formErrors.blogUrl
                          ? { type: "error", message: formErrors.blogUrl }
                          : undefined
                      }
                    />
                    <TextInput
                      label={t("admin.userManagement.fields.bioZh")}
                      value={userForm.bioZh}
                      onChange={(value) => updateFormField("bioZh", value)}
                    />
                    <TextInput
                      label={t("admin.userManagement.fields.bioEn")}
                      value={userForm.bioEn}
                      onChange={(value) => updateFormField("bioEn", value)}
                    />
                  </Grid>

                  <Grid columns={{ minWidth: isNarrow ? 220 : 320, max: 2 }} gap={3}>
                    <Tokenizer
                      label={t("admin.userManagement.fields.tagsZh")}
                      value={tagZhItems}
                      searchSource={tagZhSearchSource}
                      onChange={(items) => updateFormTags("tagsZh", items)}
                      renderItem={renderTagItem}
                      placeholder={t("admin.userManagement.fields.tagsPlaceholder")}
                      hasCreate
                      hasClear
                      hasEntriesOnFocus
                      debounceMs={0}
                    />
                    <Tokenizer
                      label={t("admin.userManagement.fields.tagsEn")}
                      value={tagEnItems}
                      searchSource={tagEnSearchSource}
                      onChange={(items) => updateFormTags("tagsEn", items)}
                      renderItem={renderTagItem}
                      placeholder={t("admin.userManagement.fields.tagsEnPlaceholder")}
                      hasCreate
                      hasClear
                      hasEntriesOnFocus
                      debounceMs={0}
                    />
                  </Grid>

                  <Grid columns={{ minWidth: isNarrow ? 220 : 320, max: 2 }} gap={3}>
                    <Switch
                      label={t("initialSetup.admin.commentEmailNotifications")}
                      description={t("initialSetup.admin.commentEmailNotificationsDescription")}
                      value={userForm.commentEmailNotifications}
                      onChange={() => updateSwitch("commentEmailNotifications")}
                      labelPosition="start"
                      labelSpacing="spread"
                    />
                    <Switch
                      label={t("initialSetup.admin.newPostEmailNotifications")}
                      description={t("initialSetup.admin.newPostEmailNotificationsDescription")}
                      value={userForm.newPostEmailNotifications}
                      onChange={() => updateSwitch("newPostEmailNotifications")}
                      labelPosition="start"
                      labelSpacing="spread"
                    />
                  </Grid>
                </FormLayout>
              </LayoutContent>
            }
            footer={
              <LayoutFooter hasDivider padding={isNarrow ? 3 : 4}>
                <HStack gap={2} hAlign="end" wrap="wrap">
                  <Button label={t("actions.cancel")} variant="ghost" onClick={closeUserForm} />
                  <Button
                    label={isSavingUser ? t("actions.saving") : t("admin.userManagement.save")}
                    icon={<Save size={16} />}
                    variant="primary"
                    isLoading={isSavingUser}
                    onClick={() => {
                      void saveUser();
                    }}
                  />
                </HStack>
              </LayoutFooter>
            }
          />
        </Dialog>
      )}

      <Card padding={isNarrow ? 3 : 4} style={filterCardStyle}>
        <HStack gap={3} vAlign="end" wrap="wrap">
          <StackItem size="fill">
            <TextInput
              label={t("admin.userManagement.search")}
              placeholder={t("admin.userManagement.searchPlaceholder")}
              value={query}
              onChange={(value) => {
                setQuery(value);
                setPage(1);
              }}
            />
          </StackItem>
          <div style={roleFilterStyle}>
            <SegmentedControl
              label={t("admin.userManagement.roleFilter")}
              value={roleFilter}
              onChange={(nextRoleFilter) => {
                setRoleFilter(
                  nextRoleFilter === "admin" || nextRoleFilter === "user" ? nextRoleFilter : "all",
                );
                setPage(1);
              }}
            >
              {USER_ROLE_FILTERS.map((filter) => (
                <SegmentedControlItem
                  key={filter}
                  value={filter}
                  label={
                    filter === "all"
                      ? t("admin.userManagement.roleAll")
                      : t(`admin.userManagement.roles.${filter}`)
                  }
                />
              ))}
            </SegmentedControl>
          </div>
          <Button
            label={t("admin.userManagement.add")}
            icon={<Plus size={16} />}
            variant="primary"
            isLoading={isOpeningForm}
            onClick={openCreateForm}
          />
          <Button
            label={t("admin.userManagement.refresh")}
            icon={<RefreshCw size={16} />}
            variant="secondary"
            isLoading={isLoading && usersData.users.length > 0}
            onClick={() => {
              void loadUsers();
            }}
          />
        </HStack>
      </Card>

      <Card padding={0} style={tableCardStyle}>
        {selectedUserCount > 0 && (
          <HStack
            gap={2}
            hAlign="between"
            vAlign="center"
            wrap="wrap"
            style={selectionToolbarStyle}
          >
            <Text type="body" weight="semibold">
              {t("admin.userManagement.selectedCount", { count: selectedUserCount })}
            </Text>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Button
                label={t("admin.userManagement.clearSelection")}
                variant="ghost"
                onClick={clearSelectedUsers}
              />
              <Button
                label={t("admin.userManagement.bulkDelete")}
                icon={<Trash2 size={16} />}
                variant="destructive"
                onClick={() => setIsBulkDeleteOpen(true)}
              />
            </HStack>
          </HStack>
        )}
        {hasInitialLoadingState ? (
          <HStack gap={2} vAlign="center" style={{ padding: isNarrow ? 16 : 24 }}>
            <Spinner size="sm" />
            <Text type="supporting" color="secondary">
              {t("admin.userManagement.loading")}
            </Text>
          </HStack>
        ) : sortedData.length === 0 ? (
          <EmptyState
            icon={<Search size={32} />}
            title={t("admin.userManagement.emptyTitle")}
            description={t("admin.userManagement.emptyDescription")}
            actions={
              <Button
                label={t("admin.userManagement.add")}
                variant="primary"
                icon={<Plus size={16} />}
                onClick={openCreateForm}
              />
            }
          />
        ) : (
          <div style={tableViewportStyle}>
            <Table<UserTableRow>
              data={sortedData}
              columns={columns}
              idKey="id"
              density={isNarrow ? "compact" : "balanced"}
              dividers="rows"
              hasHover
              style={contentAdaptiveTableStyle}
              textOverflow="wrap"
              verticalAlign="middle"
              plugins={{
                sort: sortablePlugin,
                stickyColumns: stickyColumnsPlugin,
              }}
              rowCount={usersData.pageInfo.totalItems}
            />
          </div>
        )}
        {hasPagination && (
          <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap" style={tableFooterStyle}>
            <Text type="supporting" color="secondary">
              {t("admin.userManagement.pageSummary", {
                count: usersData.pageInfo.totalItems,
              })}
            </Text>
            <Pagination
              label={t("admin.userManagement.paginationLabel")}
              page={usersData.pageInfo.page}
              pageLabel={t("admin.userManagement.pageLabel")}
              pageSize={usersData.pageInfo.pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              totalItems={usersData.pageInfo.totalItems}
              variant={isNarrow ? "compact" : "pages"}
              isDisabled={isLoading}
              onChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
            />
          </HStack>
        )}
      </Card>

      {deletingUser !== undefined && (
        <AlertDialog
          isOpen
          title={t("admin.userManagement.deleteTitle")}
          description={t("admin.userManagement.deleteDescription")}
          cancelLabel={t("actions.cancel")}
          actionLabel={t("admin.userManagement.deleteAction")}
          actionVariant="destructive"
          isActionLoading={isDeletingUser}
          onAction={() => {
            void handleDeleteUser();
          }}
          onOpenChange={(isOpen) => {
            if (!isOpen && !isDeletingUser) {
              setDeletingUser(undefined);
            }
          }}
        />
      )}

      {isBulkDeleteOpen && (
        <AlertDialog
          isOpen
          title={t("admin.userManagement.bulkDeleteTitle")}
          description={t("admin.userManagement.bulkDeleteDescription", {
            count: selectedUserCount,
          })}
          cancelLabel={t("actions.cancel")}
          actionLabel={t("admin.userManagement.bulkDelete")}
          actionVariant="destructive"
          isActionLoading={isDeletingUser}
          onAction={() => {
            void handleBulkDeleteUsers();
          }}
          onOpenChange={(isOpen) => {
            if (!isOpen && !isDeletingUser) {
              setIsBulkDeleteOpen(false);
            }
          }}
        />
      )}
    </VStack>
  );
}
