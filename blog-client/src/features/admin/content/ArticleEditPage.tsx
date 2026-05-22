import {
  AlertDialog,
  Avatar,
  Button,
  Card,
  Chip,
  Description,
  FieldError,
  Input,
  Label,
  ListBox,
  Select,
  Switch,
  Tag,
  TagGroup,
  TextArea,
  TextField,
} from "@heroui/react";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { AppIcon } from "../../../shared/icons";
import { resolveApiAssetUrl } from "../../../shared/api/api-base-url";
import { MdxEditorField } from "../../../shared/mdx/MdxEditorField";
import { allowedMdxJsxComponentNames } from "../../../shared/mdx/mdxWhitelist";
import { useAdminSession } from "../../../shared/routing/adminGuards";
import { showOperationToast } from "../../../shared/toast/operation-toast";
import { adminFetch, uploadAdminMediaFile } from "../shared/admin-api";
import { AdminFormModal, AdminInputGroupField } from "../shared/admin-form-modal";
import { MediaAssetField } from "../shared/media-asset-field";

type ArticleStatus = "draft" | "offline" | "published";

type AdminArticleDetail = {
  contentMdx: string;
  contributors: AdminArticleContributor[];
  coverImageUrl: string | null;
  id: string;
  isPinned: boolean;
  slug: string;
  status: ArticleStatus;
  summary: string | null;
  title: string;
  updatedAt: string;
};

type AdminArticleContributor = {
  avatarUrl?: string | null;
  id: string;
  linkUrl?: string | null;
  name: string;
};

type AdminContributorItem = {
  avatarUrl: string | null;
  createdAt: string;
  id: string;
  linkUrl: string | null;
  name: string;
  updatedAt: string;
};

type ArticleFormState = {
  contentMdx: string;
  contributorIds: string[];
  coverImageUrl: string;
  isPinned: boolean;
  slug: string;
  status: ArticleStatus;
  summary: string;
  title: string;
};

type ContributorFormState = {
  avatarUrl: string;
  linkUrl: string;
  name: string;
};

const emptyFormState: ArticleFormState = {
  contentMdx: "",
  contributorIds: [],
  coverImageUrl: "",
  isPinned: false,
  slug: "",
  status: "draft",
  summary: "",
  title: "",
};

const emptyContributorForm: ContributorFormState = {
  avatarUrl: "",
  linkUrl: "",
  name: "",
};

function toOptional(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function toFormState(article: AdminArticleDetail): ArticleFormState {
  return {
    contentMdx: article.contentMdx,
    contributorIds: article.contributors.map((contributor) => contributor.id),
    coverImageUrl: article.coverImageUrl ?? "",
    isPinned: article.isPinned,
    slug: article.slug,
    status: article.status,
    summary: article.summary ?? "",
    title: article.title,
  };
}

function contributorOptionalValue(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function mergeContributors(
  currentItems: AdminContributorItem[],
  relationItems: AdminArticleContributor[],
) {
  const items = new Map(currentItems.map((contributor) => [contributor.id, contributor]));

  for (const contributor of relationItems) {
    if (items.has(contributor.id)) continue;

    items.set(contributor.id, {
      avatarUrl: contributor.avatarUrl ?? null,
      createdAt: "",
      id: contributor.id,
      linkUrl: contributor.linkUrl ?? null,
      name: contributor.name,
      updatedAt: "",
    });
  }

  return [...items.values()];
}

function createInputHandler(
  key: keyof Pick<ArticleFormState, "coverImageUrl" | "slug" | "summary" | "title">,
) {
  return (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    setForm: Dispatch<SetStateAction<ArticleFormState>>,
  ) => {
    setForm((state) => ({ ...state, [key]: event.target.value }));
  };
}

export function ArticleEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = useAdminSession();
  const isNewArticle = !id;
  const [formState, setFormState] = useState<ArticleFormState>(emptyFormState);
  const [contributors, setContributors] = useState<AdminContributorItem[]>([]);
  const [contributorPickerId, setContributorPickerId] = useState("");
  const [contributorForm, setContributorForm] =
    useState<ContributorFormState>(emptyContributorForm);
  const [isContributorModalOpen, setIsContributorModalOpen] = useState(false);
  const [isCreatingContributor, setIsCreatingContributor] = useState(false);
  const [coverLocalFile, setCoverLocalFile] = useState<File | null>(null);
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(!isNewArticle);
  const [isSaving, setIsSaving] = useState(false);

  const updateNotice = useCallback((message: string) => {
    setNotice(message);
    showOperationToast(message);
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadArticle() {
      if (isNewArticle) {
        setFormState(emptyFormState);
        setCoverLocalFile(null);
        setNotice("");
        setIsLoading(false);
        return;
      }

      if (!id) {
        updateNotice("文章 ID 缺失");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await adminFetch<{ item: AdminArticleDetail }>(
          `/admin/content/articles/${id}`,
        );
        if (!isActive) return;
        setFormState(toFormState(response.item));
        setContributors((currentItems) =>
          mergeContributors(currentItems, response.item.contributors),
        );
        setNotice("");
      } catch (error) {
        if (!isActive) return;
        updateNotice(error instanceof Error ? error.message : "文章读取失败");
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void loadArticle();

    return () => {
      isActive = false;
    };
  }, [id, isNewArticle, updateNotice]);

  useEffect(() => {
    let isActive = true;

    async function loadContributors() {
      try {
        const response = await adminFetch<{ items: AdminContributorItem[] }>(
          "/admin/content/contributors?pageSize=100",
        );
        if (!isActive) return;
        setContributors((currentItems) => mergeContributors(response.items, currentItems));
      } catch (error) {
        if (!isActive) return;
        updateNotice(error instanceof Error ? error.message : "贡献者读取失败");
      }
    }

    void loadContributors();

    return () => {
      isActive = false;
    };
  }, [updateNotice]);

  async function saveArticle(statusOverride?: ArticleStatus) {
    if (session.isReadOnly) return;
    if (!formState.title.trim()) {
      updateNotice("文章标题不能为空");
      return;
    }

    try {
      setIsSaving(true);
      let coverImageUrl = formState.coverImageUrl;

      if (coverLocalFile) {
        const upload = await uploadAdminMediaFile({
          file: coverLocalFile,
          folderSlug: "article-covers",
        });
        coverImageUrl = upload.item.accessUrl;
      }

      const body = {
        contentMdx: formState.contentMdx,
        coverImageUrl: toOptional(coverImageUrl),
        contributorIds: formState.contributorIds,
        isPinned: formState.isPinned,
        slug: formState.slug,
        status: statusOverride ?? formState.status,
        summary: toOptional(formState.summary),
        title: formState.title.trim(),
      };
      const response = await adminFetch<{ item: AdminArticleDetail }>(
        isNewArticle ? "/admin/content/articles" : `/admin/content/articles/${id}`,
        {
          body,
          method: isNewArticle ? "POST" : "PATCH",
        },
      );

      setFormState(toFormState(response.item));
      setCoverLocalFile(null);
      updateNotice(
        isNewArticle && response.item.status === "published"
          ? "文章已发布"
          : isNewArticle
            ? "文章草稿已保存"
            : "文章已更新",
      );
      if (isNewArticle) {
        void navigate(`/admin/content/articles/${response.item.id}/edit`, { replace: true });
      }
    } catch (error) {
      updateNotice(error instanceof Error ? error.message : "文章更新失败");
    } finally {
      setIsSaving(false);
    }
  }

  const titleInputHandler = createInputHandler("title");
  const slugInputHandler = createInputHandler("slug");
  const summaryInputHandler = createInputHandler("summary");
  const selectedContributors = contributors.filter((contributor) =>
    formState.contributorIds.includes(contributor.id),
  );

  function addContributor(contributorId: string) {
    setContributorPickerId("");
    setFormState((state) =>
      state.contributorIds.includes(contributorId)
        ? state
        : { ...state, contributorIds: [...state.contributorIds, contributorId] },
    );
  }

  function updateContributorForm(key: keyof ContributorFormState, value: string) {
    setContributorForm((state) => ({ ...state, [key]: value }));
  }

  async function createContributor() {
    const name = contributorForm.name.trim();

    if (!name) {
      updateNotice("贡献者名字不能为空");
      return;
    }

    try {
      setIsCreatingContributor(true);
      const response = await adminFetch<{ item: AdminContributorItem }>(
        "/admin/content/contributors",
        {
          body: {
            avatarUrl: contributorOptionalValue(contributorForm.avatarUrl),
            linkUrl: contributorOptionalValue(contributorForm.linkUrl),
            name,
          },
          method: "POST",
        },
      );

      setContributors((items) => [...items, response.item]);
      addContributor(response.item.id);
      setContributorForm(emptyContributorForm);
      setIsContributorModalOpen(false);
      updateNotice("贡献者已创建并关联");
    } catch (error) {
      updateNotice(error instanceof Error ? error.message : "贡献者创建失败");
    } finally {
      setIsCreatingContributor(false);
    }
  }

  return (
    <section className="page-stack admin-page admin-page--wide article-edit-page">
      <AdminFormModal
        confirmDescription="创建后会立即关联到当前文章草稿。"
        description="贡献者可以复用于多篇文章。"
        icon="personAdd"
        isOpen={isContributorModalOpen}
        isSubmitting={isCreatingContributor}
        onOpenChange={(isOpen) => {
          setIsContributorModalOpen(isOpen);
          if (!isOpen) setContributorForm(emptyContributorForm);
        }}
        onSubmit={createContributor}
        submitLabel="创建并关联"
        title="新建贡献者"
      >
        <AdminInputGroupField
          icon="personCircle"
          isRequired
          label="名字"
          onChange={(value) => updateContributorForm("name", value)}
          placeholder="输入贡献者名字"
          value={contributorForm.name}
        />
        <AdminInputGroupField
          icon="image"
          label="头像链接"
          onChange={(value) => updateContributorForm("avatarUrl", value)}
          placeholder="https://..."
          type="url"
          value={contributorForm.avatarUrl}
        />
        <AdminInputGroupField
          icon="link"
          label="关联链接"
          onChange={(value) => updateContributorForm("linkUrl", value)}
          placeholder="GitHub、GitLab 或个人主页"
          type="url"
          value={contributorForm.linkUrl}
        />
      </AdminFormModal>
      <div className="admin-page__heading">
        <div className="page-heading page-heading--compact">
          <p className="eyebrow">内容管理</p>
          <h2>
            <AppIcon name="pencil" />
            {isNewArticle ? "新建文章" : "编辑文章"}
          </h2>
          <p>
            {isLoading
              ? "正在读取文章正文。"
              : isNewArticle
                ? "新文章会在首次保存时创建。"
                : `正在编辑《${formState.title || "未命名文章"}》。`}
          </p>
        </div>
        <div className="action-row">
          {notice ? (
            <Chip
              color={notice.includes("失败") || notice.includes("缺失") ? "danger" : "success"}
              variant="soft"
            >
              <Chip.Label>{notice}</Chip.Label>
            </Chip>
          ) : null}
          <Button onPress={() => void navigate("/admin/content/articles")} variant="tertiary">
            <AppIcon name="chevronBack" />
            返回列表
          </Button>
          <AlertDialog>
            <Button
              isDisabled={session.isReadOnly || isLoading || isSaving}
              type="button"
              variant="primary"
            >
              <AppIcon name="save" />
              {isNewArticle ? "保存草稿" : "更新文章"}
            </Button>
            <AlertDialog.Backdrop>
              <AlertDialog.Container placement="center" size="sm">
                <AlertDialog.Dialog>
                  <AlertDialog.CloseTrigger />
                  <AlertDialog.Header>
                    <AlertDialog.Icon status="warning" />
                    <AlertDialog.Heading>
                      确认{isNewArticle ? "保存草稿" : "更新文章"}？
                    </AlertDialog.Heading>
                  </AlertDialog.Header>
                  <AlertDialog.Body>
                    <p>将保存标题、摘要、封面、置顶状态和 MDX 正文。</p>
                  </AlertDialog.Body>
                  <AlertDialog.Footer>
                    <Button slot="close" variant="tertiary">
                      取消
                    </Button>
                    <Button
                      onPress={() => {
                        void saveArticle();
                      }}
                      slot="close"
                      variant="primary"
                    >
                      确认{isNewArticle ? "保存草稿" : "更新文章"}
                    </Button>
                  </AlertDialog.Footer>
                </AlertDialog.Dialog>
              </AlertDialog.Container>
            </AlertDialog.Backdrop>
          </AlertDialog>
          {isNewArticle ? (
            <AlertDialog>
              <Button
                isDisabled={session.isReadOnly || isLoading || isSaving}
                type="button"
                variant="tertiary"
              >
                <AppIcon name="send" />
                发布
              </Button>
              <AlertDialog.Backdrop>
                <AlertDialog.Container placement="center" size="sm">
                  <AlertDialog.Dialog>
                    <AlertDialog.CloseTrigger />
                    <AlertDialog.Header>
                      <AlertDialog.Icon status="warning" />
                      <AlertDialog.Heading>确认发布文章？</AlertDialog.Heading>
                    </AlertDialog.Header>
                    <AlertDialog.Body>
                      <p>将创建文章并立即发布到前台。</p>
                    </AlertDialog.Body>
                    <AlertDialog.Footer>
                      <Button slot="close" variant="tertiary">
                        取消
                      </Button>
                      <Button
                        onPress={() => {
                          void saveArticle("published");
                        }}
                        slot="close"
                        variant="primary"
                      >
                        确认发布
                      </Button>
                    </AlertDialog.Footer>
                  </AlertDialog.Dialog>
                </AlertDialog.Container>
              </AlertDialog.Backdrop>
            </AlertDialog>
          ) : null}
        </div>
      </div>

      <div className="article-edit-layout">
        <Card className="site-settings-card article-edit-card">
          <Card.Header>
            <Card.Title>
              <AppIcon name="documentText" />
              基本信息
            </Card.Title>
          </Card.Header>
          <div className="settings-form">
            <TextField fullWidth isRequired>
              <Label>标题</Label>
              <Input
                onChange={(event) => titleInputHandler(event, setFormState)}
                type="text"
                value={formState.title}
              />
              <Description>用于文章列表、详情页标题和 SEO 标题。</Description>
              <FieldError>文章标题不能为空</FieldError>
            </TextField>
            <TextField fullWidth>
              <Label>Slug</Label>
              <Input
                onChange={(event) => slugInputHandler(event, setFormState)}
                type="text"
                value={formState.slug}
              />
              <Description>留空时后端会按标题自动生成。</Description>
              <FieldError>Slug 只能包含 URL 友好的字符</FieldError>
            </TextField>
            <TextField fullWidth>
              <Label>摘要</Label>
              <TextArea
                onChange={(event) => summaryInputHandler(event, setFormState)}
                rows={4}
                value={formState.summary}
              />
              <Description>用于文章列表简介和 SEO 描述，建议不超过 500 字。</Description>
              <FieldError>摘要长度或格式不正确</FieldError>
            </TextField>
            <MediaAssetField
              folderSlug="article-covers"
              label="封面图片"
              localFile={coverLocalFile}
              onChange={(value) => setFormState((state) => ({ ...state, coverImageUrl: value }))}
              onLocalFileChange={setCoverLocalFile}
              value={formState.coverImageUrl}
            />
            <div className="article-contributor-field">
              <Select
                fullWidth
                onChange={(nextValue) => {
                  if (nextValue === null) return;
                  addContributor(String(nextValue));
                }}
                value={contributorPickerId}
                variant="secondary"
              >
                <Label>选择已存在的贡献者</Label>
                <Select.Trigger>
                  <AppIcon name="people" size={16} />
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox aria-label="选择贡献者">
                    {contributors.map((contributor) => (
                      <ListBox.Item
                        id={contributor.id}
                        key={contributor.id}
                        textValue={contributor.name}
                      >
                        {contributor.name}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              <Button
                isDisabled={session.isReadOnly}
                onPress={() => setIsContributorModalOpen(true)}
                size="sm"
                type="button"
                variant="tertiary"
              >
                <AppIcon name="personAdd" />
                新建贡献者
              </Button>
              <TagGroup
                aria-label="已关联贡献者"
                onRemove={(keys) =>
                  setFormState((state) => ({
                    ...state,
                    contributorIds: state.contributorIds.filter((item) => !keys.has(item)),
                  }))
                }
                size="lg"
                variant="surface"
              >
                <Label>已关联贡献者</Label>
                <TagGroup.List items={selectedContributors}>
                  {(contributor) => (
                    <Tag id={contributor.id} key={contributor.id} textValue={contributor.name}>
                      {(renderProps) => (
                        <>
                          <Avatar size="sm">
                            {contributor.avatarUrl ? (
                              <Avatar.Image
                                src={resolveApiAssetUrl(contributor.avatarUrl) ?? undefined}
                              />
                            ) : null}
                            <Avatar.Fallback>{contributor.name.slice(0, 1)}</Avatar.Fallback>
                          </Avatar>
                          <span>{contributor.name}</span>
                          {renderProps.allowsRemoving ? (
                            <Tag.RemoveButton aria-label={`移除${contributor.name}`}>
                              <AppIcon name="close" size={18} />
                            </Tag.RemoveButton>
                          ) : null}
                        </>
                      )}
                    </Tag>
                  )}
                </TagGroup.List>
                <Description>会显示在前台文章评论区上方。</Description>
              </TagGroup>
            </div>
            <Switch
              isSelected={formState.isPinned}
              onChange={(isSelected) =>
                setFormState((state) => ({ ...state, isPinned: isSelected }))
              }
            >
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Switch.Content>
                <strong>置顶文章</strong>
                <span>开启后文章会在列表中优先展示。</span>
              </Switch.Content>
            </Switch>
          </div>
        </Card>

        <Card className="admin-mdx-card article-edit-mdx-card">
          <Card.Header>
            <Card.Title>
              <AppIcon name="codeSlash" />
              MDX 正文
            </Card.Title>
            <Card.Description>
              编辑器已使用中文界面，支持 Markdown、代码块、图片和白名单组件。
            </Card.Description>
          </Card.Header>
          <div className="admin-mdx-card__toolbar">
            {allowedMdxJsxComponentNames.map((name) => (
              <Chip key={name} size="sm" variant="soft">
                <Chip.Label>{name}</Chip.Label>
              </Chip>
            ))}
          </div>
          <MdxEditorField
            aria-label="文章 MDX 编辑器"
            onChange={(markdown) =>
              setFormState((state) => ({
                ...state,
                contentMdx: markdown,
              }))
            }
            readOnly={session.isReadOnly || isLoading}
            value={formState.contentMdx}
          />
        </Card>
      </div>
    </section>
  );
}
