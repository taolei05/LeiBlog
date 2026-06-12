import { Button } from "@heroui/react";
import { useEffect, useState } from "react";

import { AppIcon } from "../../../shared/icons";
import { showOperationToast } from "../../../shared/toast/operation-toast";
import { AdminDataPage } from "../shared/AdminDataPage";
import {
  AdminFormModal,
  AdminInputGroupField,
  AdminSelectGroupField,
  AdminTextAreaGroupField,
} from "../shared/admin-form-modal";
import { adminFetch, uploadAdminMediaFile } from "../shared/admin-api";
import { MediaAssetField } from "../shared/media-asset-field";
import { moveOrderedItem, persistOptimisticOrder, reorderByDrop } from "./navigation-order";

type NavigationItem = {
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

type NavigationGroup = {
  createdAt: string;
  id: string;
  items: NavigationItem[];
  name: string;
  sortOrder: number;
  updatedAt: string;
};

type GroupModalState = { group?: NavigationGroup; mode: "create" | "edit" };
type ItemModalState = { item?: NavigationItem; mode: "create" | "edit" };

const emptyItemForm = {
  groupId: "",
  iconUrl: "",
  name: "",
  note: "",
  url: "",
};

function orderedByIds<T extends { id: string }>(items: T[], ids: string[]) {
  return ids
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is T => Boolean(item));
}

export function NavigationPage() {
  const [groups, setGroups] = useState<NavigationGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groupModal, setGroupModal] = useState<GroupModalState | null>(null);
  const [groupName, setGroupName] = useState("");
  const [itemModal, setItemModal] = useState<ItemModalState | null>(null);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [iconLocalFile, setIconLocalFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNoticeState] = useState("");

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null;
  const itemCount = groups.reduce((total, group) => total + group.items.length, 0);
  const iconCount = groups.reduce(
    (total, group) => total + group.items.filter((item) => item.iconUrl).length,
    0,
  );

  function setNotice(message: string, tone: "success" | "warning" | "danger" = "success") {
    setNoticeState(message);
    showOperationToast(message, tone);
  }

  async function loadNavigation() {
    try {
      const response = await adminFetch<{ groups: NavigationGroup[] }>("/admin/navigation");
      setGroups(response.groups);
      setSelectedGroupId((current) =>
        response.groups.some((group) => group.id === current)
          ? current
          : (response.groups[0]?.id ?? ""),
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "导航数据加载失败", "danger");
    }
  }

  useEffect(() => {
    void loadNavigation();
  }, []);

  async function saveGroup() {
    const name = groupName.trim();
    if (!name) {
      setNotice("导航分组名称不能为空", "warning");
      return;
    }

    try {
      setIsSaving(true);
      if (groupModal?.mode === "edit" && groupModal.group) {
        await adminFetch(`/admin/navigation/groups/${groupModal.group.id}`, {
          body: { name },
          method: "PATCH",
        });
        setNotice("导航分组已更新");
      } else {
        await adminFetch("/admin/navigation/groups", { body: { name }, method: "POST" });
        setNotice("导航分组已创建");
      }
      setGroupModal(null);
      setGroupName("");
      await loadNavigation();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "导航分组保存失败", "danger");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveItem() {
    if (!itemModal) return;
    const groupId = itemForm.groupId || selectedGroup?.id;
    if (!groupId || !itemForm.name.trim() || !itemForm.url.trim()) {
      setNotice("分组、网站名称和网址为必填项", "warning");
      return;
    }

    try {
      setIsSaving(true);
      const iconUrl = iconLocalFile
        ? (
            await uploadAdminMediaFile({
              file: iconLocalFile,
              folderSlug: "website-icons",
            })
          ).item.accessUrl
        : itemForm.iconUrl.trim() || null;
      const body = {
        groupId,
        iconUrl,
        name: itemForm.name.trim(),
        note: itemForm.note.trim() || null,
        url: itemForm.url.trim(),
      };

      if (itemModal.mode === "edit" && itemModal.item) {
        await adminFetch(`/admin/navigation/items/${itemModal.item.id}`, { body, method: "PATCH" });
        setNotice("网站已更新");
      } else {
        await adminFetch("/admin/navigation/items", { body, method: "POST" });
        setNotice("网站已创建");
      }
      setItemModal(null);
      setItemForm(emptyItemForm);
      setIconLocalFile(null);
      setSelectedGroupId(groupId);
      await loadNavigation();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "网站保存失败", "danger");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteGroup(group: NavigationGroup) {
    if (group.items.length > 0) {
      setNotice("请先移动或删除组内网站", "warning");
      return;
    }
    if (!window.confirm(`确认删除分组「${group.name}」？`)) return;

    try {
      await adminFetch(`/admin/navigation/groups/${group.id}`, { method: "DELETE" });
      setNotice("导航分组已删除");
      await loadNavigation();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "导航分组删除失败", "danger");
    }
  }

  async function deleteItem(item: NavigationItem) {
    if (!window.confirm(`确认删除网站「${item.name}」？`)) return;

    try {
      await adminFetch(`/admin/navigation/items/${item.id}`, { method: "DELETE" });
      setNotice("网站已删除");
      await loadNavigation();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "网站删除失败", "danger");
    }
  }

  async function saveGroupOrder(nextIds: string[]) {
    const previousIds = groups.map((group) => group.id);
    if (previousIds.join() === nextIds.join()) return;

    try {
      await persistOptimisticOrder(
        previousIds,
        nextIds,
        (ids) => setGroups((current) => orderedByIds(current, ids)),
        (ids) => adminFetch("/admin/navigation/groups/reorder", { body: { ids }, method: "POST" }),
      );
      setNotice("分组排序已保存");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "分组排序保存失败，已恢复原顺序",
        "danger",
      );
    }
  }

  async function saveItemOrder(nextIds: string[]) {
    if (!selectedGroup) return;
    const previousIds = selectedGroup.items.map((item) => item.id);
    if (previousIds.join() === nextIds.join()) return;

    try {
      await persistOptimisticOrder(
        previousIds,
        nextIds,
        (ids) =>
          setGroups((current) =>
            current.map((group) =>
              group.id === selectedGroup.id
                ? { ...group, items: orderedByIds(group.items, ids) }
                : group,
            ),
          ),
        (ids) =>
          adminFetch("/admin/navigation/items/reorder", {
            body: { groupId: selectedGroup.id, ids },
            method: "POST",
          }),
      );
      setNotice("网站排序已保存");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "网站排序保存失败，已恢复原顺序",
        "danger",
      );
    }
  }

  function openCreateItem() {
    setItemForm({ ...emptyItemForm, groupId: selectedGroup?.id ?? "" });
    setIconLocalFile(null);
    setItemModal({ mode: "create" });
  }

  function openEditItem(item: NavigationItem) {
    setItemForm({
      groupId: item.groupId,
      iconUrl: item.iconUrl ?? "",
      name: item.name,
      note: item.note ?? "",
      url: item.url,
    });
    setIconLocalFile(null);
    setItemModal({ item, mode: "edit" });
  }

  return (
    <AdminDataPage
      description="维护公开导航页的分组、网站、说明与图标；拖拽或上下移动后会立即保存。"
      eyebrow="内容管理"
      icon="map"
      metrics={[
        { label: "导航分组", value: String(groups.length) },
        { label: "网站", value: String(itemCount) },
        { label: "已配图标", value: String(iconCount) },
      ]}
      title="导航页管理"
      wide
    >
      {notice ? (
        <p className="navigation-admin-notice" role="status">
          {notice}
        </p>
      ) : null}
      <AdminFormModal
        description="分组名称会显示在公开导航页和右侧目录中。"
        icon="folderOpen"
        isOpen={groupModal !== null}
        isSubmitting={isSaving}
        onOpenChange={(isOpen) => {
          if (!isOpen) setGroupModal(null);
        }}
        onSubmit={saveGroup}
        submitLabel={groupModal?.mode === "edit" ? "保存分组" : "创建分组"}
        title={groupModal?.mode === "edit" ? "编辑导航分组" : "新建导航分组"}
      >
        <AdminInputGroupField
          icon="folderOpen"
          isRequired
          label="分组名称"
          onChange={setGroupName}
          placeholder="例如：常用工具"
          value={groupName}
        />
      </AdminFormModal>
      <AdminFormModal
        description="网站可在编辑时移动到其它分组，移动后会放在目标分组末尾。"
        icon="link"
        isBodyScrollable
        isOpen={itemModal !== null}
        isSubmitting={isSaving}
        onOpenChange={(isOpen) => {
          if (!isOpen) setItemModal(null);
        }}
        onSubmit={saveItem}
        size="lg"
        submitLabel={itemModal?.mode === "edit" ? "保存网站" : "创建网站"}
        title={itemModal?.mode === "edit" ? "编辑网站" : "新建网站"}
      >
        <AdminSelectGroupField
          icon="folderOpen"
          label="所属分组"
          onChange={(groupId) => setItemForm((current) => ({ ...current, groupId }))}
          options={groups.map((group) => ({ label: group.name, value: group.id }))}
          value={itemForm.groupId}
        />
        <AdminInputGroupField
          icon="link"
          isRequired
          label="网站名称"
          onChange={(name) => setItemForm((current) => ({ ...current, name }))}
          placeholder="例如：Can I use"
          value={itemForm.name}
        />
        <AdminInputGroupField
          icon="globe"
          isRequired
          label="网址"
          onChange={(url) => setItemForm((current) => ({ ...current, url }))}
          placeholder="https://example.com"
          type="url"
          value={itemForm.url}
        />
        <AdminTextAreaGroupField
          icon="documentText"
          label="备注"
          onChange={(note) => setItemForm((current) => ({ ...current, note }))}
          placeholder="简短说明网站用途"
          rows={3}
          value={itemForm.note}
        />
        <MediaAssetField
          canRemoveValue
          folderSlug="website-icons"
          label="网址图标"
          localFile={iconLocalFile}
          onChange={(iconUrl) => setItemForm((current) => ({ ...current, iconUrl }))}
          onLocalFileChange={setIconLocalFile}
          value={itemForm.iconUrl}
        />
      </AdminFormModal>

      <div className="navigation-admin-layout">
        <section className="navigation-admin-panel">
          <header className="navigation-admin-panel__header">
            <div>
              <h3>分组</h3>
              <p>拖拽或使用上下移动调整公开顺序。</p>
            </div>
            <Button
              onPress={() => {
                setGroupName("");
                setGroupModal({ mode: "create" });
              }}
              variant="primary"
            >
              <AppIcon name="create" />
              新建分组
            </Button>
          </header>
          <div className="navigation-admin-list">
            {groups.map((group, index) => (
              <div
                className={
                  group.id === selectedGroup?.id
                    ? "navigation-admin-row navigation-admin-row--active"
                    : "navigation-admin-row"
                }
                draggable
                key={group.id}
                onDragOver={(event) => event.preventDefault()}
                onDragStart={(event) => event.dataTransfer.setData("text/plain", group.id)}
                onDrop={(event) => {
                  event.preventDefault();
                  void saveGroupOrder(
                    reorderByDrop(
                      groups.map((item) => item.id),
                      event.dataTransfer.getData("text/plain"),
                      group.id,
                    ),
                  );
                }}
              >
                <button
                  className="navigation-admin-row__main"
                  onClick={() => setSelectedGroupId(group.id)}
                  type="button"
                >
                  <AppIcon name="swapVertical" />
                  <span>
                    <strong>{group.name}</strong>
                    <small>{group.items.length} 个网站</small>
                  </span>
                </button>
                <div className="navigation-admin-row__actions">
                  <Button
                    isDisabled={index === 0}
                    onPress={() =>
                      void saveGroupOrder(
                        moveOrderedItem(
                          groups.map((item) => item.id),
                          group.id,
                          -1,
                        ),
                      )
                    }
                    size="sm"
                    variant="tertiary"
                  >
                    <AppIcon name="arrowUp" />
                    上移
                  </Button>
                  <Button
                    isDisabled={index === groups.length - 1}
                    onPress={() =>
                      void saveGroupOrder(
                        moveOrderedItem(
                          groups.map((item) => item.id),
                          group.id,
                          1,
                        ),
                      )
                    }
                    size="sm"
                    variant="tertiary"
                  >
                    <AppIcon name="arrowDown" />
                    下移
                  </Button>
                  <Button
                    onPress={() => {
                      setGroupName(group.name);
                      setGroupModal({ group, mode: "edit" });
                    }}
                    size="sm"
                    variant="tertiary"
                  >
                    <AppIcon name="pencil" />
                    编辑
                  </Button>
                  <Button onPress={() => void deleteGroup(group)} size="sm" variant="danger-soft">
                    <AppIcon name="trash" />
                    删除
                  </Button>
                </div>
              </div>
            ))}
            {groups.length === 0 ? <p className="navigation-admin-empty">暂无导航分组</p> : null}
          </div>
        </section>

        <section className="navigation-admin-panel">
          <header className="navigation-admin-panel__header">
            <div>
              <h3>{selectedGroup?.name ?? "网站"}</h3>
              <p>网站会在新标签页打开，图标可以不填写。</p>
            </div>
            <Button isDisabled={!selectedGroup} onPress={openCreateItem} variant="primary">
              <AppIcon name="create" />
              新建网站
            </Button>
          </header>
          <div className="navigation-admin-list">
            {selectedGroup?.items.map((item, index) => (
              <div
                className="navigation-admin-row navigation-admin-row--item"
                draggable
                key={item.id}
                onDragOver={(event) => event.preventDefault()}
                onDragStart={(event) => event.dataTransfer.setData("text/plain", item.id)}
                onDrop={(event) => {
                  event.preventDefault();
                  void saveItemOrder(
                    reorderByDrop(
                      selectedGroup.items.map((entry) => entry.id),
                      event.dataTransfer.getData("text/plain"),
                      item.id,
                    ),
                  );
                }}
              >
                <div className="navigation-admin-row__main">
                  <AppIcon name="swapVertical" />
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.note || item.url}</small>
                  </span>
                </div>
                <div className="navigation-admin-row__actions">
                  <Button
                    isDisabled={index === 0}
                    onPress={() =>
                      void saveItemOrder(
                        moveOrderedItem(
                          selectedGroup.items.map((entry) => entry.id),
                          item.id,
                          -1,
                        ),
                      )
                    }
                    size="sm"
                    variant="tertiary"
                  >
                    <AppIcon name="arrowUp" />
                    上移
                  </Button>
                  <Button
                    isDisabled={index === selectedGroup.items.length - 1}
                    onPress={() =>
                      void saveItemOrder(
                        moveOrderedItem(
                          selectedGroup.items.map((entry) => entry.id),
                          item.id,
                          1,
                        ),
                      )
                    }
                    size="sm"
                    variant="tertiary"
                  >
                    <AppIcon name="arrowDown" />
                    下移
                  </Button>
                  <Button onPress={() => openEditItem(item)} size="sm" variant="tertiary">
                    <AppIcon name="pencil" />
                    编辑
                  </Button>
                  <Button onPress={() => void deleteItem(item)} size="sm" variant="danger-soft">
                    <AppIcon name="trash" />
                    删除
                  </Button>
                </div>
              </div>
            ))}
            {selectedGroup && selectedGroup.items.length === 0 ? (
              <p className="navigation-admin-empty">这个分组还没有网站</p>
            ) : null}
          </div>
        </section>
      </div>
    </AdminDataPage>
  );
}
