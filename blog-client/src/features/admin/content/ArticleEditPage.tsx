import {
  AlertDialog,
  Button,
  Card,
  Chip,
  Input,
  Label,
  Switch,
  TextArea,
  TextField,
} from "@heroui/react";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { AppIcon } from "../../../shared/icons";
import { MdxEditorField } from "../../../shared/mdx/MdxEditorField";
import { allowedMdxJsxComponentNames } from "../../../shared/mdx/mdxWhitelist";
import { useAdminSession } from "../../../shared/routing/adminGuards";
import { showOperationToast } from "../../../shared/toast/operation-toast";
import { adminFetch, uploadAdminMediaFile } from "../shared/admin-api";
import { MediaAssetField } from "../shared/media-asset-field";

type ArticleStatus = "draft" | "offline" | "published";

type AdminArticleDetail = {
  contentMdx: string;
  coverImageUrl: string | null;
  id: string;
  isPinned: boolean;
  slug: string;
  status: ArticleStatus;
  summary: string | null;
  title: string;
  updatedAt: string;
};

type ArticleFormState = {
  contentMdx: string;
  coverImageUrl: string;
  isPinned: boolean;
  slug: string;
  status: ArticleStatus;
  summary: string;
  title: string;
};

const emptyFormState: ArticleFormState = {
  contentMdx: "",
  coverImageUrl: "",
  isPinned: false,
  slug: "",
  status: "draft",
  summary: "",
  title: "",
};

function toOptional(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function toFormState(article: AdminArticleDetail): ArticleFormState {
  return {
    contentMdx: article.contentMdx,
    coverImageUrl: article.coverImageUrl ?? "",
    isPinned: article.isPinned,
    slug: article.slug,
    status: article.status,
    summary: article.summary ?? "",
    title: article.title,
  };
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

  async function saveArticle() {
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
        isPinned: formState.isPinned,
        slug: formState.slug,
        status: formState.status,
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
      updateNotice(isNewArticle ? "文章草稿已保存" : "文章已更新");
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

  return (
    <section className="page-stack admin-page admin-page--wide article-edit-page">
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
                value={formState.title}
              />
            </TextField>
            <TextField fullWidth>
              <Label>Slug</Label>
              <Input
                onChange={(event) => slugInputHandler(event, setFormState)}
                value={formState.slug}
              />
            </TextField>
            <TextField fullWidth>
              <Label>摘要</Label>
              <TextArea
                onChange={(event) => summaryInputHandler(event, setFormState)}
                rows={4}
                value={formState.summary}
              />
            </TextField>
            <MediaAssetField
              folderSlug="article-covers"
              label="封面图片"
              localFile={coverLocalFile}
              onChange={(value) => setFormState((state) => ({ ...state, coverImageUrl: value }))}
              onLocalFileChange={setCoverLocalFile}
              value={formState.coverImageUrl}
            />
            <Switch
              isSelected={formState.isPinned}
              onChange={(isSelected) =>
                setFormState((state) => ({ ...state, isPinned: isSelected }))
              }
            >
              <Switch.Control>
                <Switch.Thumb>
                  <Switch.Icon>
                    <AppIcon name={formState.isPinned ? "checkmarkCircle" : "radioButtonOn"} />
                  </Switch.Icon>
                </Switch.Thumb>
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
