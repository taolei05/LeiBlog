import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { UploadProgressList, useUploadProgress } from "../../../../shared/upload-progress";
import { LoadingStatus } from "../../../../shared/loading-status";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  FolderOpen,
  Globe,
  ImagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";

import { Avatar } from "@astryxdesign/core/Avatar";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Divider } from "@astryxdesign/core/Divider";
import { Grid, GridSpan } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Link } from "@astryxdesign/core/Link";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";

import {
  createNavigationGroup,
  createNavigationItem,
  deleteNavigationGroup,
  deleteNavigationItem,
  getNavigation,
  reorderNavigationGroups,
  reorderNavigationItems,
  resolveAdminAssetUrl,
  updateNavigationGroup,
  updateNavigationItem,
  uploadMediaAsset,
} from "../../../../shared/admin-api";
import type { NavigationGroup, NavigationItem } from "../../../../shared/admin-api";
import {
  AdminFeedbackBanner,
  createAdminFeedbackBanner,
} from "../components/admin-feedback-banner";
import type {
  AdminFeedbackBannerState,
  AdminFeedbackBannerStatus,
} from "../components/admin-feedback-banner";
import { AdminFormDialog } from "../components/admin-form-dialog";
import { MediaAssetField } from "../components/media-asset-field";

type NavigationManagementPageProps = {
  authToken: string;
  isNarrow: boolean;
};

type GroupDialogState =
  | {
      mode: "create";
    }
  | {
      groupId: string;
      mode: "edit";
    };

type ItemDialogState =
  | {
      mode: "create";
    }
  | {
      itemId: string;
      mode: "edit";
    };

type DeleteTarget =
  | {
      group: NavigationGroup;
      type: "group";
    }
  | {
      item: NavigationItem;
      type: "site";
    };

type ItemFormState = {
  groupId: string;
  iconUrl: string;
  name: string;
  note: string;
  url: string;
};

const emptyItemForm: ItemFormState = {
  groupId: "",
  iconUrl: "",
  name: "",
  note: "",
  url: "",
};

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const isEnglishLocale = (language: string) => language.toLowerCase().startsWith("en");

const readGroupDisplayName = ({ group, language }: { group: NavigationGroup; language: string }) =>
  isEnglishLocale(language) && group.nameEn !== null ? group.nameEn : group.name;

const readGroupSecondaryName = ({
  group,
  language,
}: {
  group: NavigationGroup;
  language: string;
}) => (isEnglishLocale(language) && group.nameEn !== null ? group.name : group.nameEn);

const moveOrderedId = ({
  direction,
  ids,
  targetId,
}: {
  direction: "down" | "up";
  ids: readonly string[];
  targetId: string;
}) => {
  const currentIndex = ids.indexOf(targetId);
  if (currentIndex < 0) {
    return ids;
  }

  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (nextIndex < 0 || nextIndex >= ids.length) {
    return ids;
  }

  const nextIds = [...ids];
  const targetValue = nextIds[currentIndex];
  const swapValue = nextIds[nextIndex];
  if (targetValue === undefined || swapValue === undefined) {
    return ids;
  }

  nextIds[currentIndex] = swapValue;
  nextIds[nextIndex] = targetValue;

  return nextIds;
};

export function NavigationManagementPage({ authToken, isNarrow }: NavigationManagementPageProps) {
  const { i18n, t } = useTranslation();
  const { uploads, onUploadProgress } = useUploadProgress();
  const [groups, setGroups] = useState<NavigationGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groupDialog, setGroupDialog] = useState<GroupDialogState>();
  const [groupName, setGroupName] = useState("");
  const [groupNameEn, setGroupNameEn] = useState("");
  const [itemDialog, setItemDialog] = useState<ItemDialogState>();
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItemForm);
  const [iconFile, setIconFile] = useState<File>();
  const [feedbackBanner, setFeedbackBanner] = useState<AdminFeedbackBannerState>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>();

  const editingGroupId = groupDialog?.mode === "edit" ? groupDialog.groupId : undefined;
  const editingItemId = itemDialog?.mode === "edit" ? itemDialog.itemId : undefined;
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0];
  const totalItemCount = groups.reduce((total, group) => total + group.items.length, 0);
  const iconItemCount = groups.reduce(
    (total, group) => total + group.items.filter((item) => item.iconUrl !== null).length,
    0,
  );
  const canSaveGroup = groupName.trim().length > 0;
  const canSaveItem = itemForm.groupId.trim().length > 0 && itemForm.name.trim().length > 0;
  const selectedGroupName =
    selectedGroup === undefined
      ? t("admin.navigationManagement.sitesFallback")
      : readGroupDisplayName({ group: selectedGroup, language: i18n.language });
  const groupOptions = useMemo(
    () =>
      groups.map((group) => ({
        description: t("admin.navigationManagement.counts.site", { count: group.items.length }),
        label: readGroupDisplayName({ group, language: i18n.language }),
        value: group.id,
      })),
    [groups, i18n.language, t],
  );

  const showNotice = (title: string, status: AdminFeedbackBannerStatus = "success") => {
    setFeedbackBanner(createAdminFeedbackBanner({ status, title }));
  };

  const loadNavigation = async () => {
    try {
      setIsLoading(true);
      const response = await getNavigation(authToken);
      setGroups(response.groups);
      setSelectedGroupId((current) => {
        if (response.groups.some((group) => group.id === current)) {
          return current;
        }

        return response.groups[0]?.id ?? "";
      });
    } catch (error) {
      showNotice(
        getErrorMessage(error, t("admin.navigationManagement.notices.loadFailed")),
        "error",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadNavigation();
  }, [authToken]);

  const resetGroupForm = () => {
    setGroupDialog(undefined);
    setGroupName("");
    setGroupNameEn("");
  };

  const resetItemForm = (groupId = selectedGroup?.id ?? "") => {
    setItemDialog(undefined);
    setIconFile(undefined);
    setItemForm({ ...emptyItemForm, groupId });
  };

  const beginCreateGroup = () => {
    setGroupName("");
    setGroupNameEn("");
    setGroupDialog({ mode: "create" });
  };

  const beginEditGroup = (group: NavigationGroup) => {
    setGroupName(group.name);
    setGroupNameEn(group.nameEn ?? "");
    setGroupDialog({ groupId: group.id, mode: "edit" });
  };

  const saveGroup = async () => {
    const name = groupName.trim();
    const nameEn = groupNameEn.trim();
    if (groupDialog === undefined) {
      return;
    }

    if (name.length === 0) {
      showNotice(t("admin.navigationManagement.notices.groupNameRequired"), "error");
      return;
    }

    try {
      setIsSaving(true);
      if (editingGroupId === undefined) {
        const group = await createNavigationGroup({
          payload: { name, nameEn: nameEn.length > 0 ? nameEn : null },
          token: authToken,
        });
        setSelectedGroupId(group.id);
        showNotice(
          nameEn.length === 0 && group.nameEn === null
            ? t("admin.navigationManagement.notices.groupSavedWithoutTranslation")
            : t("admin.navigationManagement.notices.groupCreated"),
          nameEn.length === 0 && group.nameEn === null ? "warning" : "success",
        );
      } else {
        const group = await updateNavigationGroup({
          groupId: editingGroupId,
          payload: { name, nameEn: nameEn.length > 0 ? nameEn : null },
          token: authToken,
        });
        showNotice(
          nameEn.length === 0 && group.nameEn === null
            ? t("admin.navigationManagement.notices.groupSavedWithoutTranslation")
            : t("admin.navigationManagement.notices.groupUpdated"),
          nameEn.length === 0 && group.nameEn === null ? "warning" : "success",
        );
      }
      resetGroupForm();
      await loadNavigation();
    } catch (error) {
      showNotice(
        getErrorMessage(error, t("admin.navigationManagement.notices.groupSaveFailed")),
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const removeGroup = async () => {
    if (deleteTarget?.type !== "group") {
      return;
    }

    const { group } = deleteTarget;
    if (group.items.length > 0) {
      showNotice(t("admin.navigationManagement.notices.groupNotEmpty"), "error");
      setDeleteTarget(undefined);
      return;
    }

    try {
      setIsDeleting(true);
      await deleteNavigationGroup({ groupId: group.id, token: authToken });
      showNotice(t("admin.navigationManagement.notices.groupDeleted"));
      if (selectedGroupId === group.id) {
        setSelectedGroupId("");
      }
      setDeleteTarget(undefined);
      await loadNavigation();
    } catch (error) {
      showNotice(
        getErrorMessage(error, t("admin.navigationManagement.notices.groupDeleteFailed")),
        "error",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const saveGroupOrder = async ({
    direction,
    groupId,
  }: {
    direction: "down" | "up";
    groupId: string;
  }) => {
    const currentIds = groups.map((group) => group.id);
    const nextIds = moveOrderedId({
      direction,
      ids: currentIds,
      targetId: groupId,
    });
    if (nextIds.join() === currentIds.join()) {
      return;
    }

    const previousGroups = groups;
    setGroups((current) =>
      nextIds
        .map((id) => current.find((group) => group.id === id))
        .filter((group): group is NavigationGroup => group !== undefined),
    );

    try {
      await reorderNavigationGroups({ groupIds: [...nextIds], token: authToken });
      showNotice(t("admin.navigationManagement.notices.groupOrderSaved"));
    } catch (error) {
      setGroups(previousGroups);
      showNotice(
        getErrorMessage(error, t("admin.navigationManagement.notices.groupOrderFailed")),
        "error",
      );
    }
  };

  const beginCreateItem = () => {
    if (selectedGroup === undefined) {
      showNotice(t("admin.navigationManagement.notices.createGroupFirst"), "error");
      return;
    }

    setIconFile(undefined);
    setItemForm({ ...emptyItemForm, groupId: selectedGroup.id });
    setItemDialog({ mode: "create" });
  };

  const beginEditItem = (item: NavigationItem) => {
    setIconFile(undefined);
    setItemForm({
      groupId: item.groupId,
      iconUrl: item.iconUrl ?? "",
      name: item.name,
      note: item.note ?? "",
      url: item.url,
    });
    setItemDialog({ itemId: item.id, mode: "edit" });
  };

  const saveItem = async () => {
    if (itemDialog === undefined) {
      return;
    }

    if (itemForm.groupId.trim().length === 0) {
      showNotice(t("admin.navigationManagement.notices.groupRequired"), "error");
      return;
    }

    if (itemForm.name.trim().length === 0 || itemForm.url.trim().length === 0) {
      showNotice(t("admin.navigationManagement.notices.siteRequired"), "error");
      return;
    }

    try {
      setIsSaving(true);
      const uploadedIconUrl =
        iconFile === undefined
          ? itemForm.iconUrl.trim()
          : (
              await uploadMediaAsset({
                onUploadProgress,
                file: iconFile,
                folderSlug: "website-icons",
                token: authToken,
              })
            ).accessUrl;
      const payload = {
        groupId: itemForm.groupId,
        iconUrl: uploadedIconUrl || null,
        name: itemForm.name,
        note: itemForm.note,
        url: itemForm.url,
      };

      if (editingItemId === undefined) {
        await createNavigationItem({ payload, token: authToken });
        showNotice(t("admin.navigationManagement.notices.siteCreated"));
      } else {
        await updateNavigationItem({ itemId: editingItemId, payload, token: authToken });
        showNotice(t("admin.navigationManagement.notices.siteUpdated"));
      }
      const nextSelectedGroupId = itemForm.groupId;
      resetItemForm(nextSelectedGroupId);
      setSelectedGroupId(nextSelectedGroupId);
      await loadNavigation();
    } catch (error) {
      showNotice(
        getErrorMessage(error, t("admin.navigationManagement.notices.siteSaveFailed")),
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const removeItem = async () => {
    if (deleteTarget?.type !== "site") {
      return;
    }

    const { item } = deleteTarget;
    try {
      setIsDeleting(true);
      await deleteNavigationItem({ itemId: item.id, token: authToken });
      showNotice(t("admin.navigationManagement.notices.siteDeleted"));
      if (editingItemId === item.id) {
        resetItemForm(item.groupId);
      }
      setDeleteTarget(undefined);
      await loadNavigation();
    } catch (error) {
      showNotice(
        getErrorMessage(error, t("admin.navigationManagement.notices.siteDeleteFailed")),
        "error",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const saveItemOrder = async ({
    direction,
    item,
  }: {
    direction: "down" | "up";
    item: NavigationItem;
  }) => {
    const group = groups.find((candidate) => candidate.id === item.groupId);
    if (group === undefined) {
      return;
    }

    const nextIds = moveOrderedId({
      direction,
      ids: group.items.map((entry) => entry.id),
      targetId: item.id,
    });
    const currentIds = group.items.map((entry) => entry.id);
    if (nextIds.join() === currentIds.join()) {
      return;
    }

    const previousGroups = groups;
    setGroups((current) =>
      current.map((candidate) =>
        candidate.id === group.id
          ? {
              ...candidate,
              items: nextIds
                .map((id) => candidate.items.find((entry) => entry.id === id))
                .filter((entry): entry is NavigationItem => entry !== undefined),
            }
          : candidate,
      ),
    );

    try {
      await reorderNavigationItems({ groupId: group.id, itemIds: [...nextIds], token: authToken });
      showNotice(t("admin.navigationManagement.notices.siteOrderSaved"));
    } catch (error) {
      setGroups(previousGroups);
      showNotice(
        getErrorMessage(error, t("admin.navigationManagement.notices.siteOrderFailed")),
        "error",
      );
    }
  };

  return (
    <VStack gap={4}>
      <div className="navigation-admin-summary">
        <Card padding={isNarrow ? 4 : 5}>
          <VStack gap={1}>
            <HStack gap={2} vAlign="center">
              <FolderOpen size={17} />
              <Text type="label">{t("admin.navigationManagement.summary.groups")}</Text>
            </HStack>
            <Heading level={2}>{groups.length}</Heading>
            <Text type="supporting" color="secondary">
              {t("admin.navigationManagement.summary.groupsDescription")}
            </Text>
          </VStack>
        </Card>
        <Card padding={isNarrow ? 4 : 5}>
          <VStack gap={1}>
            <HStack gap={2} vAlign="center">
              <Globe size={17} />
              <Text type="label">{t("admin.navigationManagement.summary.sites")}</Text>
            </HStack>
            <Heading level={2}>{totalItemCount}</Heading>
            <Text type="supporting" color="secondary">
              {t("admin.navigationManagement.summary.sitesDescription")}
            </Text>
          </VStack>
        </Card>
        <Card padding={isNarrow ? 4 : 5}>
          <VStack gap={1}>
            <HStack gap={2} vAlign="center">
              <ImagePlus size={17} />
              <Text type="label">{t("admin.navigationManagement.summary.icons")}</Text>
            </HStack>
            <Heading level={2}>{iconItemCount}</Heading>
            <Text type="supporting" color="secondary">
              {t("admin.navigationManagement.summary.iconsDescription")}
            </Text>
          </VStack>
        </Card>
      </div>

      <AdminFeedbackBanner
        banner={feedbackBanner}
        onDismiss={() => {
          setFeedbackBanner(undefined);
        }}
      />

      <div className="navigation-admin-layout">
        <Card padding={isNarrow ? 4 : 5}>
          <VStack gap={4}>
            <HStack gap={2} hAlign="between" vAlign="center" wrap="wrap">
              <Heading level={2}>{t("admin.navigationManagement.groupsTitle")}</Heading>
              <HStack gap={2} wrap="wrap">
                <Button
                  icon={<Plus size={15} />}
                  label={t("admin.navigationManagement.actions.newGroup")}
                  onClick={beginCreateGroup}
                  size="sm"
                  variant="primary"
                />
                <Button
                  icon={<RefreshCw size={15} />}
                  isDisabled={isLoading}
                  label={t("admin.navigationManagement.actions.refresh")}
                  onClick={() => {
                    void loadNavigation();
                  }}
                  size="sm"
                  variant="secondary"
                />
              </HStack>
            </HStack>

            <Divider />

            <VStack gap={2}>
              {groups.map((group, index) => {
                const displayName = readGroupDisplayName({ group, language: i18n.language });
                const secondaryName = readGroupSecondaryName({ group, language: i18n.language });

                return (
                  <div
                    className={
                      group.id === selectedGroup?.id
                        ? "navigation-admin-group is-selected"
                        : "navigation-admin-group"
                    }
                    key={group.id}
                  >
                    <ClickableCard
                      className="navigation-admin-group__main"
                      label={t("admin.navigationManagement.actions.selectGroup", {
                        name: displayName,
                      })}
                      onClick={() => {
                        setSelectedGroupId(group.id);
                        resetItemForm(group.id);
                      }}
                      padding={3}
                    >
                      <strong>{displayName}</strong>
                      {secondaryName === null ? null : <small>{secondaryName}</small>}
                      <span>
                        {t("admin.navigationManagement.counts.site", {
                          count: group.items.length,
                        })}
                      </span>
                    </ClickableCard>
                    <div className="navigation-admin-group__actions">
                      <Button
                        icon={<ArrowUp size={14} />}
                        isDisabled={index === 0}
                        label={t("actions.moveUp")}
                        onClick={() => {
                          void saveGroupOrder({ direction: "up", groupId: group.id });
                        }}
                        size="sm"
                        variant="ghost"
                      />
                      <Button
                        icon={<ArrowDown size={14} />}
                        isDisabled={index === groups.length - 1}
                        label={t("actions.moveDown")}
                        onClick={() => {
                          void saveGroupOrder({ direction: "down", groupId: group.id });
                        }}
                        size="sm"
                        variant="ghost"
                      />
                      <Button
                        icon={<Pencil size={14} />}
                        label={t("admin.contentManagement.actions.edit")}
                        onClick={() => beginEditGroup(group)}
                        size="sm"
                        variant="ghost"
                      />
                      <Button
                        icon={<Trash2 size={14} />}
                        label={t("admin.contentManagement.actions.delete")}
                        onClick={() => {
                          setDeleteTarget({ group, type: "group" });
                        }}
                        size="sm"
                        variant="ghost"
                      />
                    </div>
                  </div>
                );
              })}
              {!isLoading && groups.length === 0 && (
                <VStack gap={2}>
                  <Text type="supporting" color="secondary">
                    {t("admin.navigationManagement.empty.groups")}
                  </Text>
                  <Button
                    icon={<Plus size={15} />}
                    label={t("admin.navigationManagement.actions.newGroup")}
                    onClick={beginCreateGroup}
                    variant="secondary"
                  />
                </VStack>
              )}
              {isLoading && <LoadingStatus label={t("admin.navigationManagement.loading")} />}
            </VStack>
          </VStack>
        </Card>

        <Card padding={isNarrow ? 4 : 5}>
          <VStack gap={4}>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Heading level={2}>{selectedGroupName}</Heading>
              <Badge
                label={t("admin.navigationManagement.counts.site", {
                  count: selectedGroup?.items.length ?? 0,
                })}
                variant="neutral"
              />
              <Button
                icon={<Plus size={15} />}
                isDisabled={selectedGroup === undefined}
                label={t("admin.navigationManagement.actions.newSite")}
                onClick={beginCreateItem}
                size="sm"
                variant="secondary"
              />
            </HStack>

            <Divider />

            <VStack gap={2}>
              {selectedGroup?.items.map((item, index) => (
                <div className="navigation-admin-item" key={item.id}>
                  <Avatar
                    name={item.name}
                    size="sm"
                    src={item.iconUrl === null ? undefined : resolveAdminAssetUrl(item.iconUrl)}
                  />
                  <div className="navigation-admin-item__content">
                    <strong>{item.name}</strong>
                    <span>{item.note ?? item.url}</span>
                  </div>
                  <div className="navigation-admin-item__actions">
                    <Link
                      className="navigation-admin-item__link"
                      label={t("admin.navigationManagement.actions.openSite", { name: item.name })}
                      href={item.url}
                      isExternalLink
                      isStandalone
                    >
                      <ExternalLink size={15} />
                    </Link>
                    <Button
                      icon={<ArrowUp size={14} />}
                      isDisabled={index === 0}
                      label={t("actions.moveUp")}
                      onClick={() => {
                        void saveItemOrder({ direction: "up", item });
                      }}
                      size="sm"
                      variant="ghost"
                    />
                    <Button
                      icon={<ArrowDown size={14} />}
                      isDisabled={index === selectedGroup.items.length - 1}
                      label={t("actions.moveDown")}
                      onClick={() => {
                        void saveItemOrder({ direction: "down", item });
                      }}
                      size="sm"
                      variant="ghost"
                    />
                    <Button
                      icon={<Pencil size={14} />}
                      label={t("admin.contentManagement.actions.edit")}
                      onClick={() => beginEditItem(item)}
                      size="sm"
                      variant="ghost"
                    />
                    <Button
                      icon={<Trash2 size={14} />}
                      label={t("admin.contentManagement.actions.delete")}
                      onClick={() => {
                        setDeleteTarget({ item, type: "site" });
                      }}
                      size="sm"
                      variant="ghost"
                    />
                  </div>
                </div>
              ))}
              {selectedGroup !== undefined && selectedGroup.items.length === 0 && (
                <Text type="supporting" color="secondary">
                  {t("admin.navigationManagement.empty.sites")}
                </Text>
              )}
              {selectedGroup === undefined && !isLoading && (
                <Text type="supporting" color="secondary">
                  {t("admin.navigationManagement.empty.createGroupFirst")}
                </Text>
              )}
            </VStack>
          </VStack>
        </Card>
      </div>

      {groupDialog !== undefined && (
        <AdminFormDialog
          cancelLabel={t("actions.cancel")}
          closeLabel={t("actions.close")}
          description={t("admin.navigationManagement.dialogs.groupDescription")}
          isNarrow={isNarrow}
          isPrimaryDisabled={!canSaveGroup || isSaving}
          isPrimaryLoading={isSaving}
          onClose={resetGroupForm}
          onSubmit={() => {
            void saveGroup();
          }}
          primaryIcon={groupDialog.mode === "create" ? <Plus size={15} /> : <Save size={15} />}
          primaryLabel={
            groupDialog.mode === "create"
              ? t("admin.navigationManagement.actions.createGroup")
              : t("admin.navigationManagement.actions.saveGroup")
          }
          title={
            groupDialog.mode === "create"
              ? t("admin.navigationManagement.dialogs.newGroup")
              : t("admin.navigationManagement.dialogs.editGroup")
          }
        >
          <Grid
            className="navigation-admin-group-form"
            columns={{ minWidth: 280, repeat: "fit" }}
            gap={3}
          >
            <TextInput
              label={t("admin.navigationManagement.fields.groupNameZh")}
              onChange={setGroupName}
              placeholder={t("admin.navigationManagement.placeholders.groupName")}
              value={groupName}
            />
            <TextInput
              label={t("admin.navigationManagement.fields.groupNameEn")}
              onChange={setGroupNameEn}
              placeholder={t("admin.navigationManagement.placeholders.groupNameEn")}
              value={groupNameEn}
            />
          </Grid>
        </AdminFormDialog>
      )}

      {itemDialog !== undefined && (
        <AdminFormDialog
          cancelLabel={t("actions.cancel")}
          closeLabel={t("actions.close")}
          description={t("admin.navigationManagement.dialogs.siteDescription")}
          isNarrow={isNarrow}
          isPrimaryDisabled={!canSaveItem || isSaving}
          isPrimaryLoading={isSaving}
          onClose={() => resetItemForm(selectedGroup?.id ?? "")}
          onSubmit={() => {
            void saveItem();
          }}
          primaryIcon={itemDialog.mode === "create" ? <Plus size={15} /> : <Save size={15} />}
          primaryLabel={
            itemDialog.mode === "create"
              ? t("admin.navigationManagement.actions.createSite")
              : t("admin.navigationManagement.actions.saveSite")
          }
          title={
            itemDialog.mode === "create"
              ? t("admin.navigationManagement.dialogs.newSite")
              : t("admin.navigationManagement.dialogs.editSite")
          }
        >
          <Grid
            className="navigation-admin-item-form"
            columns={{ minWidth: 280, repeat: "fit" }}
            gap={3}
          >
            <GridSpan columns="full">
              <UploadProgressList
                language={i18n.language.startsWith("en") ? "en" : "zh-CN"}
                uploads={uploads}
              />
            </GridSpan>
            <TextInput
              label={t("admin.navigationManagement.fields.siteName")}
              onChange={(name) => setItemForm((current) => ({ ...current, name }))}
              placeholder={t("admin.navigationManagement.placeholders.siteName")}
              value={itemForm.name}
            />
            <TextInput
              label={t("admin.navigationManagement.fields.url")}
              onChange={(url) => setItemForm((current) => ({ ...current, url }))}
              placeholder="https://example.com"
              value={itemForm.url}
            />
            <Selector
              emptyText={t("admin.navigationManagement.empty.noGroups")}
              hasSearch
              label={t("admin.navigationManagement.fields.group")}
              onChange={(groupId) => setItemForm((current) => ({ ...current, groupId }))}
              options={groupOptions}
              placeholder={t("admin.navigationManagement.placeholders.selectGroup")}
              searchPlaceholder={t("admin.navigationManagement.placeholders.searchGroup")}
              value={itemForm.groupId}
            />
            <GridSpan columns="full">
              <TextArea
                label={t("admin.navigationManagement.fields.note")}
                onChange={(note) => setItemForm((current) => ({ ...current, note }))}
                placeholder={t("admin.navigationManagement.placeholders.note")}
                rows={3}
                value={itemForm.note}
              />
            </GridSpan>
            <GridSpan columns="full">
              <MediaAssetField
                accept="image/*,.ico,.svg"
                folderSlug="website-icons"
                label={t("admin.navigationManagement.fields.iconUrl")}
                localFile={iconFile}
                onChange={(iconUrl) => setItemForm((current) => ({ ...current, iconUrl }))}
                onLocalFileChange={setIconFile}
                placeholder={t("admin.navigationManagement.placeholders.iconUrl")}
                previewVariant="favicon"
                token={authToken}
                value={itemForm.iconUrl}
              />
            </GridSpan>
          </Grid>
        </AdminFormDialog>
      )}

      {deleteTarget !== undefined && (
        <AlertDialog
          actionLabel={t("admin.navigationManagement.delete.action")}
          actionVariant="destructive"
          cancelLabel={t("actions.cancel")}
          description={t("admin.navigationManagement.delete.description", {
            name:
              deleteTarget.type === "group"
                ? readGroupDisplayName({ group: deleteTarget.group, language: i18n.language })
                : deleteTarget.item.name,
            type: t(`admin.navigationManagement.delete.types.${deleteTarget.type}`),
          })}
          isActionLoading={isDeleting}
          isOpen
          onAction={() => {
            if (deleteTarget.type === "group") {
              void removeGroup();
            } else {
              void removeItem();
            }
          }}
          onOpenChange={(isOpen) => {
            if (!isOpen && !isDeleting) {
              setDeleteTarget(undefined);
            }
          }}
          title={t("admin.navigationManagement.delete.title", {
            type: t(`admin.navigationManagement.delete.types.${deleteTarget.type}`),
          })}
        />
      )}
    </VStack>
  );
}
