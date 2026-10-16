import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Paperclip, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Button } from "@astryxdesign/core/Button";
import { DateInput } from "@astryxdesign/core/DateInput";
import { Divider } from "@astryxdesign/core/Divider";
import { Grid } from "@astryxdesign/core/Grid";
import { IconButton } from "@astryxdesign/core/IconButton";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { Selector } from "@astryxdesign/core/Selector";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import type { ISODateString } from "@astryxdesign/core/utils";
import { normalizeLanguage } from "../../../../shared/i18n";
import {
  formatCurrentMinuteInTimeZone,
  formatDateTimeInTimeZone,
} from "../../../../shared/time-zone";
import { UploadProgressList, useUploadProgress } from "../../../../shared/upload-progress";
import type {
  ExchangeRates,
  Subscription,
  SubscriptionCurrency,
  SubscriptionInput,
  SubscriptionList,
} from "../../../../shared/subscriptions-api";
import {
  deleteSubscription,
  downloadSubscriptionAttachment,
  getSubscriptionRates,
  getSubscriptions,
  removeSubscriptionAttachment,
  saveSubscription,
  subscriptionCategories,
  subscriptionCurrencies,
  subscriptionRenewalTypes,
  uploadSubscriptionAttachment,
} from "../../../../shared/subscriptions-api";
import { AdminFormDialog } from "../components/admin-form-dialog";
import {
  AdminFeedbackBanner,
  createAdminFeedbackBanner,
} from "../components/admin-feedback-banner";
import type { AdminFeedbackBannerState } from "../components/admin-feedback-banner";
import { subscriptionCopy } from "./copy";
import { SubscriptionPriceField } from "./price-field";
import { SubscriptionTable } from "./subscription-table";
import { areReminderTimesValid, ReminderTimesField } from "./reminder-times-field";
import { SubscriptionAttachmentRow } from "./attachment-row";
import { SubscriptionAttachmentPreview } from "./attachment-preview";

type Editor = {
  id?: string;
  form: SubscriptionInput;
  attachments: Subscription["attachments"];
};
const dateValue = (value: string | null): ISODateString | undefined =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? (value as ISODateString) : undefined;

type SubscriptionsPageProps = {
  authToken: string;
  isNarrow: boolean;
  timeZone: string;
};
export const SubscriptionsPage = ({ authToken, isNarrow, timeZone }: SubscriptionsPageProps) => {
  const { i18n } = useTranslation();
  const language = normalizeLanguage(i18n.resolvedLanguage);
  const copy = subscriptionCopy[language];
  const [data, setData] = useState<SubscriptionList>();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<AdminFeedbackBannerState>();
  const [editor, setEditor] = useState<Editor>();
  const [files, setFiles] = useState<File[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Subscription>();
  const [rates, setRates] = useState<ExchangeRates>();
  const [ratesLoading, setRatesLoading] = useState(false);
  const [rateError, setRateError] = useState<string>();
  const [displayCurrency, setDisplayCurrency] = useState<SubscriptionCurrency>("CNY");
  const [busyFile, setBusyFile] = useState<string>();
  const [previewAttachment, setPreviewAttachment] = useState<Subscription["attachments"][number]>();
  const previewSubscriptionId = editor?.id;
  const fileInput = useRef<HTMLInputElement>(null);
  const { uploads, onUploadProgress } = useUploadProgress();
  const form = editor?.form;
  const error = (value: unknown) => (value instanceof Error ? value.message : copy.failed);
  const update = <Key extends keyof SubscriptionInput>(key: Key, value: SubscriptionInput[Key]) =>
    setEditor((current) =>
      current ? { ...current, form: { ...current.form, [key]: value } } : current,
    );

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      void getSubscriptions({
        token: authToken,
        search,
        category,
        status,
        page,
        pageSize,
        signal: controller.signal,
      })
        .then((result) => {
          if (controller.signal.aborted) return;
          if (result.total > 0 && result.items.length === 0 && page > 1) {
            setPage(page - 1);
            return;
          }
          setData(result);
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted)
            setFeedback(
              createAdminFeedbackBanner({
                status: "error",
                title: reason instanceof Error ? reason.message : "Request failed.",
              }),
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [authToken, category, page, pageSize, refresh, search, status]);

  const loadRates = useCallback(async () => {
    setRatesLoading(true);
    setRateError(undefined);
    try {
      setRates(await getSubscriptionRates(authToken));
    } catch (reason) {
      setRates(undefined);
      setRateError(reason instanceof Error ? reason.message : "ExchangeRate unavailable.");
    } finally {
      setRatesLoading(false);
    }
  }, [authToken]);
  useEffect(() => {
    void loadRates();
  }, [loadRates]);

  const open = (item?: Subscription) => {
    setPreviewAttachment(undefined);
    setFiles([]);
    setRemoved([]);
    setFeedback(undefined);
    setEditor({
      id: item?.id,
      attachments: item?.attachments ?? [],
      form: item
        ? { ...item }
        : {
            name: "",
            serviceUrl: "",
            category: "other",
            details: "",
            startDate: formatCurrentMinuteInTimeZone(timeZone).slice(0, 10),
            expiryDate: null,
            initialPrice: "0",
            renewalPrice: "0",
            initialCurrency: "CNY",
            renewalCurrency: "CNY",
            renewalType: "manual",
            notes: "",
            reminderEnabled: true,
            reminderDays: 7,
            reminderTimes: ["09:00"],
          },
    });
  };
  const submit = async () => {
    if (!editor || saving) return;
    const input = editor.form;
    if (
      !input.name.trim() ||
      !input.startDate ||
      (input.renewalType !== "perpetual" &&
        (!input.expiryDate || input.expiryDate < input.startDate)) ||
      !/^\d{1,10}(\.\d{1,2})?$/.test(input.initialPrice) ||
      !/^\d{1,10}(\.\d{1,2})?$/.test(input.renewalPrice) ||
      !areReminderTimesValid(input.reminderTimes)
    ) {
      setFeedback(createAdminFeedbackBanner({ status: "error", title: copy.invalid }));
      return;
    }
    setSaving(true);
    setFeedback(undefined);
    let saved = false;
    try {
      const id = await saveSubscription({
        id: editor.id,
        token: authToken,
        input: {
          ...input,
          expiryDate: input.renewalType === "perpetual" ? null : input.expiryDate,
          reminderEnabled: input.renewalType !== "perpetual" && input.reminderEnabled,
        },
      });
      saved = true;
      setEditor((current) => (current ? { ...current, id } : current));
      for (const attachmentId of removed) {
        await removeSubscriptionAttachment({ id, attachmentId, token: authToken });
        setRemoved((current) => current.filter((value) => value !== attachmentId));
        setEditor((current) =>
          current
            ? { ...current, attachments: current.attachments.filter((a) => a.id !== attachmentId) }
            : current,
        );
      }
      for (const file of files) {
        const attachment = await uploadSubscriptionAttachment({
          id,
          token: authToken,
          file,
          onProgress: onUploadProgress,
        });
        setEditor((current) =>
          current ? { ...current, attachments: [...current.attachments, attachment] } : current,
        );
        setFiles((current) => current.filter((value) => value !== file));
      }
      setEditor(undefined);
      setFeedback(createAdminFeedbackBanner({ status: "success", title: copy.saved }));
    } catch (reason) {
      setFeedback(
        createAdminFeedbackBanner({
          status: "error",
          title: saved ? copy.uploadFailed : error(reason),
          description: saved ? error(reason) : undefined,
        }),
      );
    } finally {
      setSaving(false);
      setRefresh((value) => value + 1);
    }
  };
  const removeSubscription = async () => {
    if (!deleteTarget || saving) return;
    setSaving(true);
    try {
      await deleteSubscription({ id: deleteTarget.id, token: authToken });
      setDeleteTarget(undefined);
      setRefresh((value) => value + 1);
      setFeedback(createAdminFeedbackBanner({ status: "success", title: copy.deleted }));
    } catch (reason) {
      setFeedback(createAdminFeedbackBanner({ status: "error", title: error(reason) }));
    } finally {
      setSaving(false);
    }
  };
  const download = async (id: string, attachment: Subscription["attachments"][number]) => {
    setBusyFile(attachment.id);
    try {
      const blob = await downloadSubscriptionAttachment({
        id,
        attachmentId: attachment.id,
        token: authToken,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (reason) {
      setFeedback(createAdminFeedbackBanner({ status: "error", title: error(reason) }));
    } finally {
      setBusyFile(undefined);
    }
  };
  const feedbackElement = feedback && (
    <AdminFeedbackBanner banner={feedback} onDismiss={() => setFeedback(undefined)} />
  );
  return (
    <VStack gap={4} style={{ width: "100%", minWidth: 0 }}>
      {!editor && feedbackElement}
      <HStack gap={3} hAlign="between" vAlign="end" wrap="wrap">
        <Text>{copy.total.replace("{{count}}", String(data?.total ?? 0))}</Text>
        <HStack gap={2}>
          <IconButton
            label={copy.refresh}
            tooltip={copy.refresh}
            icon={<RefreshCw size={16} />}
            isLoading={loading}
            onClick={() => setRefresh((value) => value + 1)}
          />
          <Button
            icon={<Plus size={16} />}
            label={copy.create}
            variant="primary"
            onClick={() => open()}
          />
        </HStack>
      </HStack>
      <Grid columns={isNarrow ? 1 : 3} gap={3}>
        <TextInput
          label={copy.search}
          value={search}
          hasClear
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        <Selector
          label={copy.category}
          value={category}
          onChange={(value) => {
            setCategory(value);
            setPage(1);
          }}
          options={[
            { value: "all", label: copy.all },
            ...subscriptionCategories.map((value) => ({ value, label: copy.categories[value] })),
          ]}
        />
        <Selector
          label={copy.status}
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          options={[
            { value: "all", label: copy.all },
            ...(["normal", "expiring", "expired"] as const).map((value) => ({
              value,
              label: copy[value],
            })),
          ]}
        />
      </Grid>
      <HStack gap={3} vAlign="end" wrap="wrap">
        <Selector
          label={copy.convert}
          value={displayCurrency}
          onChange={(value) => {
            const currency = subscriptionCurrencies.find((v) => v === value);
            if (currency) setDisplayCurrency(currency);
          }}
          options={subscriptionCurrencies.map((value) => ({
            value,
            label: copy.currencies[value],
          }))}
        />
        <Button
          icon={<RefreshCw size={16} />}
          label={copy.rates}
          isLoading={ratesLoading}
          onClick={() => void loadRates()}
        />
        {rates && (
          <Text type="supporting" color="secondary">
            {copy.estimated} · {copy.ratesUpdated}:{" "}
            {formatDateTimeInTimeZone({ value: rates.updatedAt, language, timeZone })} ·{" "}
            {copy.ratesNext}:{" "}
            {formatDateTimeInTimeZone({ value: rates.nextUpdateAt, language, timeZone })}
          </Text>
        )}
      </HStack>
      {rateError && (
        <Text type="supporting" color="secondary">
          {rateError}
        </Text>
      )}
      <SubscriptionTable
        items={data?.items ?? []}
        total={data?.total ?? 0}
        page={data?.page ?? page}
        pageSize={data?.pageSize ?? pageSize}
        isLoading={loading}
        isNarrow={isNarrow}
        language={language}
        displayCurrency={displayCurrency}
        rates={rates}
        onEdit={open}
        onDelete={setDeleteTarget}
        onPageChange={setPage}
        onPageSizeChange={(value) => {
          setPageSize(value);
          setPage(1);
        }}
      />
      {editor && form && (
        <AdminFormDialog
          isNarrow={isNarrow}
          title={editor.id ? copy.edit : copy.create}
          description=""
          primaryLabel={copy.save}
          primaryIcon={<Save size={16} />}
          isPrimaryLoading={saving}
          isPrimaryDisabled={saving}
          cancelLabel={copy.cancel}
          closeLabel={copy.close}
          onClose={() => {
            if (!saving) setEditor(undefined);
          }}
          onSubmit={() => void submit()}
        >
          {feedbackElement}
          <fieldset disabled={saving} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
            <VStack gap={4}>
              <Grid columns={isNarrow ? 1 : 2} gap={3}>
                <TextInput
                  label={copy.name}
                  isRequired
                  value={form.name}
                  onChange={(value) => update("name", value)}
                />
                <TextInput
                  label={copy.serviceUrl}
                  value={form.serviceUrl}
                  onChange={(value) => update("serviceUrl", value)}
                />
                <Selector
                  label={copy.category}
                  value={form.category}
                  onChange={(value) => {
                    const category = subscriptionCategories.find((v) => v === value);
                    if (category) update("category", category);
                  }}
                  options={subscriptionCategories.map((value) => ({
                    value,
                    label: copy.categories[value],
                  }))}
                />
                <Selector
                  label={copy.renewalType}
                  value={form.renewalType}
                  onChange={(value) => {
                    const renewal = subscriptionRenewalTypes.find((v) => v === value);
                    if (renewal) update("renewalType", renewal);
                    if (value === "perpetual") {
                      update("expiryDate", null);
                      update("reminderEnabled", false);
                    }
                  }}
                  options={subscriptionRenewalTypes.map((value) => ({
                    value,
                    label: copy.renewals[value],
                  }))}
                />
              </Grid>
              <TextArea
                label={copy.details}
                value={form.details}
                onChange={(value) => update("details", value)}
              />
              <Grid columns={isNarrow ? 1 : 2} gap={3}>
                <DateInput
                  label={copy.startDate}
                  value={dateValue(form.startDate)}
                  onChange={(value) => update("startDate", value ?? "")}
                  format="system_date"
                />
                <DateInput
                  label={copy.expiryDate}
                  value={dateValue(form.expiryDate)}
                  isDisabled={form.renewalType === "perpetual"}
                  min={dateValue(form.startDate)}
                  onChange={(value) => update("expiryDate", value ?? null)}
                  format="system_date"
                />
                <SubscriptionPriceField
                  language={language}
                  kind="initial"
                  price={form.initialPrice}
                  currency={form.initialCurrency}
                  onPriceChange={(value) => update("initialPrice", value)}
                  onCurrencyChange={(value) => update("initialCurrency", value)}
                />
                <SubscriptionPriceField
                  language={language}
                  kind="renewal"
                  price={form.renewalPrice}
                  currency={form.renewalCurrency}
                  onPriceChange={(value) => update("renewalPrice", value)}
                  onCurrencyChange={(value) => update("renewalCurrency", value)}
                />
              </Grid>
              <TextArea
                label={copy.notes}
                value={form.notes}
                onChange={(value) => update("notes", value)}
              />
              <Divider />
              <Switch
                label={copy.reminderEnabled}
                value={form.reminderEnabled}
                isDisabled={form.renewalType === "perpetual"}
                onChange={(value) => update("reminderEnabled", value)}
              />
              <Grid columns={isNarrow ? 1 : 2} gap={3}>
                <NumberInput
                  label={copy.reminderDays}
                  value={form.reminderDays}
                  min={0}
                  max={365}
                  isIntegerOnly
                  isDisabled={!form.reminderEnabled}
                  isWheelEnabled={false}
                  onChange={(value) => update("reminderDays", value)}
                />
                <ReminderTimesField
                  language={language}
                  value={form.reminderTimes}
                  isDisabled={!form.reminderEnabled}
                  onChange={(values) => update("reminderTimes", values)}
                />
              </Grid>
              <Text type="supporting" color="secondary">
                {copy.timeZone}: {data?.timeZone ?? timeZone}
              </Text>
              <Divider />
              <Text weight="semibold">{copy.attachments}</Text>
              <Text type="supporting" color="secondary">
                {copy.filesLimit}
              </Text>
              {editor.attachments
                .filter((a) => !removed.includes(a.id))
                .map((a) => (
                  <SubscriptionAttachmentRow
                    key={a.id}
                    attachment={a}
                    language={language}
                    isDownloading={busyFile === a.id}
                    onPreview={() => setPreviewAttachment(a)}
                    onDownload={() => {
                      if (editor.id) void download(editor.id, a);
                    }}
                    onRemove={() => setRemoved((current) => [...current, a.id])}
                  />
                ))}
              {files.map((file, index) => (
                <HStack key={`${file.name}-${index}`} gap={2} hAlign="between">
                  <Text style={{ overflowWrap: "anywhere" }}>
                    {file.name} · {copy.pendingFile}
                  </Text>
                  <IconButton
                    label={copy.remove}
                    tooltip={copy.remove}
                    icon={<Trash2 size={16} />}
                    onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                  />
                </HStack>
              ))}
              <Button
                icon={<Paperclip size={16} />}
                label={copy.attach}
                isDisabled={files.length + editor.attachments.length - removed.length >= 10}
                onClick={() => fileInput.current?.click()}
              />
              <input
                ref={fileInput}
                type="file"
                hidden
                multiple
                accept=".pdf,.doc,.docx,.txt,.md,.jpg,.jpeg,.png,.gif,.webp,.ico"
                onChange={(event) => {
                  const added = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  if (
                    files.length + editor.attachments.length - removed.length + added.length > 10 ||
                    added.some((f) => f.size < 1 || f.size > 5 * 1024 * 1024)
                  ) {
                    setFeedback(
                      createAdminFeedbackBanner({ status: "error", title: copy.filesLimit }),
                    );
                    return;
                  }
                  setFiles((current) => [...current, ...added]);
                }}
              />
              <UploadProgressList language={language} uploads={uploads} />
            </VStack>
          </fieldset>
        </AdminFormDialog>
      )}
      {previewSubscriptionId && previewAttachment && (
        <SubscriptionAttachmentPreview
          key={`${previewSubscriptionId}/${previewAttachment.id}`}
          subscriptionId={previewSubscriptionId}
          attachment={previewAttachment}
          token={authToken}
          isNarrow={isNarrow}
          onClose={() => setPreviewAttachment(undefined)}
          onDownload={() => download(previewSubscriptionId, previewAttachment)}
        />
      )}
      {deleteTarget && (
        <AlertDialog
          isOpen
          title={copy.deleteTitle}
          description={`${deleteTarget.name} · ${copy.deleteMessage}`}
          actionLabel={copy.delete}
          cancelLabel={copy.cancel}
          isActionLoading={saving}
          onAction={() => void removeSubscription()}
          onOpenChange={(isOpen) => {
            if (!isOpen && !saving) setDeleteTarget(undefined);
          }}
        />
      )}
    </VStack>
  );
};
