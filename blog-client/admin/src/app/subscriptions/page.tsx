import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Download,
  ExternalLink,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Button } from "@astryxdesign/core/Button";
import { DateInput } from "@astryxdesign/core/DateInput";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Grid } from "@astryxdesign/core/Grid";
import { IconButton } from "@astryxdesign/core/IconButton";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { Pagination } from "@astryxdesign/core/Pagination";
import { Selector } from "@astryxdesign/core/Selector";
import { Spinner } from "@astryxdesign/core/Spinner";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Switch } from "@astryxdesign/core/Switch";
import { Table, pixel, proportional, useTableStickyColumns } from "@astryxdesign/core/Table";
import type { TableColumn } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TimeInput } from "@astryxdesign/core/TimeInput";
import { createISOTimeString } from "@astryxdesign/core/utils";
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
  SubscriptionInput,
  SubscriptionList,
} from "../../../../shared/subscriptions-api";
import {
  convertSubscriptionPrice,
  deleteSubscription,
  downloadSubscriptionAttachment,
  getSubscriptionRates,
  getSubscriptionServiceUrl,
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

type Editor = {
  id?: string;
  form: SubscriptionInput;
  attachments: Subscription["attachments"];
  recipientEmail: string | null;
};
type Row = Subscription & Record<string, unknown>;
const dateValue = (value: string | null): ISODateString | undefined =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? (value as ISODateString) : undefined;

type SubscriptionsPageProps = {
  authToken: string;
  isNarrow: boolean;
  timeZone: string;
  adminEmail: string;
};
export const SubscriptionsPage = ({
  authToken,
  isNarrow,
  timeZone,
  adminEmail,
}: SubscriptionsPageProps) => {
  const { i18n } = useTranslation();
  const language = normalizeLanguage(i18n.resolvedLanguage);
  const copy = subscriptionCopy[language];
  const [data, setData] = useState<SubscriptionList>();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
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
  const [displayCurrency, setDisplayCurrency] = useState<SubscriptionInput["currency"]>("CNY");
  const [busyFile, setBusyFile] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const { uploads, onUploadProgress } = useUploadProgress();
  const stickyColumns = useTableStickyColumns<Row>({ endKeys: ["actions"] });
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
  }, [authToken, category, page, refresh, search, status]);

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
    setFiles([]);
    setRemoved([]);
    setFeedback(undefined);
    setEditor({
      id: item?.id,
      attachments: item?.attachments ?? [],
      recipientEmail: item?.recipientEmail ?? adminEmail,
      form: item
        ? { ...item, reminderTime: item.reminderTime.slice(0, 5) }
        : {
            name: "",
            serviceUrl: "",
            category: "other",
            details: "",
            startDate: formatCurrentMinuteInTimeZone(timeZone).slice(0, 10),
            expiryDate: null,
            initialPrice: "0",
            renewalPrice: "0",
            currency: "CNY",
            renewalType: "manual",
            notes: "",
            reminderEnabled: true,
            reminderDays: 7,
            reminderTime: "09:00",
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
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.reminderTime)
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
  const money = (value: string | number, currency: SubscriptionInput["currency"]) =>
    new Intl.NumberFormat(language, { style: "currency", currency }).format(Number(value));
  const columns: TableColumn<Row>[] = [
    {
      key: "name",
      header: copy.name,
      width: proportional(2),
      renderCell: (row) => (
        <VStack gap={1}>
          <Text weight="semibold">{row.name}</Text>
          {getSubscriptionServiceUrl(row.serviceUrl) && (
            <a href={row.serviceUrl} target="_blank" rel="noopener noreferrer">
              <HStack gap={1} vAlign="center">
                <ExternalLink size={14} />
                <Text type="supporting">{getSubscriptionServiceUrl(row.serviceUrl)?.hostname}</Text>
              </HStack>
            </a>
          )}
        </VStack>
      ),
    },
    {
      key: "category",
      header: copy.category,
      width: pixel(100),
      renderCell: (row) => copy.categories[row.category],
    },
    {
      key: "expiryDate",
      header: copy.expiryDate,
      width: pixel(130),
      renderCell: (row) => (
        <VStack gap={1}>
          <Text>{row.expiryDate ?? "—"}</Text>
          <Text type="supporting" color="secondary">
            {row.startDate}
          </Text>
        </VStack>
      ),
    },
    {
      key: "status",
      header: copy.status,
      width: pixel(130),
      renderCell: (row) => (
        <HStack gap={2} vAlign="center">
          <StatusDot
            label={copy[row.status]}
            variant={
              row.status === "expired" ? "error" : row.status === "expiring" ? "warning" : "success"
            }
          />
          <Text>{copy[row.status]}</Text>
        </HStack>
      ),
    },
    {
      key: "initialPrice",
      header: copy.initialPrice,
      width: pixel(140),
      renderCell: (row) => (
        <VStack gap={1}>
          <Text>{money(row.initialPrice, row.currency)}</Text>
          {rates && row.currency !== displayCurrency && (
            <Text type="supporting" color="secondary">
              ≈{" "}
              {money(
                convertSubscriptionPrice(row.initialPrice, row.currency, displayCurrency, rates),
                displayCurrency,
              )}
            </Text>
          )}
        </VStack>
      ),
    },
    {
      key: "renewalPrice",
      header: copy.renewalPrice,
      width: pixel(160),
      renderCell: (row) => (
        <VStack gap={1}>
          <Text>{money(row.renewalPrice, row.currency)}</Text>
          {rates && row.currency !== displayCurrency && (
            <Text type="supporting" color="secondary">
              ≈{" "}
              {money(
                convertSubscriptionPrice(row.renewalPrice, row.currency, displayCurrency, rates),
                displayCurrency,
              )}
            </Text>
          )}
        </VStack>
      ),
    },
    {
      key: "renewalType",
      header: copy.renewalType,
      width: pixel(140),
      renderCell: (row) => copy.renewals[row.renewalType],
    },
    {
      key: "reminderTime",
      header: copy.reminder,
      width: pixel(170),
      renderCell: (row) => (
        <VStack gap={1}>
          <Text>
            {row.reminderEnabled
              ? `${row.reminderDays}d · ${row.reminderTime.slice(0, 5)}`
              : copy.off}
          </Text>
          <Text type="supporting" color="secondary">
            {row.deliveryStatus ? copy.deliveries[row.deliveryStatus] : copy.notSent}
          </Text>
        </VStack>
      ),
    },
    {
      key: "attachments",
      header: copy.attachments,
      width: pixel(90),
      renderCell: (row) => (
        <HStack gap={1} vAlign="center">
          <Paperclip size={14} />
          <Text>{row.attachments.length}</Text>
        </HStack>
      ),
    },
    {
      key: "actions",
      header: copy.actions,
      width: pixel(100),
      renderCell: (row) => (
        <HStack gap={1}>
          <IconButton
            label={copy.edit}
            tooltip={copy.edit}
            icon={<Pencil size={16} />}
            variant="ghost"
            onClick={() => open(row)}
          />
          <IconButton
            label={copy.delete}
            tooltip={copy.delete}
            icon={<Trash2 size={16} />}
            variant="ghost"
            onClick={() => setDeleteTarget(row)}
          />
        </HStack>
      ),
    },
  ];
  const feedbackElement = feedback && (
    <AdminFeedbackBanner banner={feedback} onDismiss={() => setFeedback(undefined)} />
  );
  return (
    <VStack gap={4}>
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
      <Divider />
      {loading ? (
        <HStack gap={2} vAlign="center">
          <Spinner size="sm" />
          <Text>{copy.loading}</Text>
        </HStack>
      ) : data?.items.length ? (
        <Table
          data={data.items as Row[]}
          columns={columns}
          idKey="id"
          hasHover
          verticalAlign="middle"
          textOverflow="wrap"
          plugins={{ stickyColumns }}
        />
      ) : (
        <EmptyState title={copy.empty} />
      )}
      {(data?.total ?? 0) > 12 && (
        <Pagination page={page} pageSize={12} totalItems={data?.total ?? 0} onChange={setPage} />
      )}
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
                <NumberInput
                  label={copy.initialPrice}
                  value={Number(form.initialPrice)}
                  onChange={(value) => update("initialPrice", value.toFixed(2))}
                  min={0}
                  max={9999999999.99}
                  step={0.01}
                  isWheelEnabled={false}
                />
                <NumberInput
                  label={copy.renewalPrice}
                  value={Number(form.renewalPrice)}
                  onChange={(value) => update("renewalPrice", value.toFixed(2))}
                  min={0}
                  max={9999999999.99}
                  step={0.01}
                  isWheelEnabled={false}
                />
                <Selector
                  label={copy.currency}
                  value={form.currency}
                  onChange={(value) => {
                    const currency = subscriptionCurrencies.find((v) => v === value);
                    if (currency) update("currency", currency);
                  }}
                  options={subscriptionCurrencies.map((value) => ({
                    value,
                    label: copy.currencies[value],
                  }))}
                />
                <TextInput label={copy.recipient} value={editor.recipientEmail ?? "—"} isReadOnly />
              </Grid>
              <TextArea
                label={copy.details}
                value={form.details}
                onChange={(value) => update("details", value)}
              />
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
                <TimeInput
                  label={copy.reminderTime}
                  value={createISOTimeString(form.reminderTime) ?? undefined}
                  hourFormat="24h"
                  isDisabled={!form.reminderEnabled}
                  onChange={(value) => update("reminderTime", value ?? "")}
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
                  <HStack key={a.id} gap={2} hAlign="between" vAlign="center" wrap="wrap">
                    <Text style={{ overflowWrap: "anywhere" }}>
                      {a.fileName} · {(a.fileSize / 1024).toFixed(1)} KiB
                    </Text>
                    <HStack gap={1}>
                      <IconButton
                        label={copy.download}
                        tooltip={copy.download}
                        icon={<Download size={16} />}
                        isLoading={busyFile === a.id}
                        onClick={() => void download(editor.id!, a)}
                      />
                      <IconButton
                        label={copy.remove}
                        tooltip={copy.remove}
                        icon={<Trash2 size={16} />}
                        onClick={() => setRemoved((current) => [...current, a.id])}
                      />
                    </HStack>
                  </HStack>
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
