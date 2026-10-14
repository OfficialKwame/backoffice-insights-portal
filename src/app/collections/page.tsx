"use client";

import { InvoiceCollectionsSection } from "@/components/collections/InvoiceCollectionsSection";
import { CollectionsTabs } from "@/components/collections/CollectionsTabs";
import { DateRangePicker } from "@/components/reporting/DateRangePicker";
import { MerchantDetailModal } from "@/components/collections/MerchantDetailModal";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { PageShell } from "@/components/PageShell";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type PeriodListItem = {
  id: string;
  periodStart: string;
  periodEnd: string;
  daysCovered: number;
  expectedDays: number;
  isComplete: boolean;
  transactionCount: number;
};

type DailyTrendItem = {
  date: string;
  attempts: number;
  successful: number;
  failed: number;
  success_rate: number;
  collected_value: number;
  failed_value: number;
};

type ChannelDailyTrendItem = {
  date: string;
  channel: string;
  attempts: number;
  successful: number;
  failed: number;
  success_rate: number;
  collected_value: number;
  failed_value: number;
};

type ChannelItem = {
  channel: string;
  attempts: number;
  successful: number;
  failed: number;
  success_rate: number;
  failure_rate: number;
  collected_value: number;
  failed_value: number;
  collection_share: number;
};

type FailureAnalysisItem = {
  channel: string;
  clean_reason: string;
  raw_provider_response: string;
  count: number;
  share_of_channel_failures: number;
};

type UnmappedFailureItem = {
  channel: string;
  raw_provider_response: string;
  count: number;
};

type MerchantFailureReason = {
  channel: string;
  clean_reason: string;
  raw_provider_response: string;
  count: number;
  share_of_merchant_failures: number;
};

type MerchantItem = {
  business_id: string;
  business_name: string;
  attempts: number;
  successful: number;
  failed: number;
  success_rate: number;
  collected_value: number;
  failed_value: number;
  collection_share: number;
  failure_reasons?: MerchantFailureReason[];
};

type OverallSummary = {
  total_rows: number;
  eligible_attempts: number;
  successful_transactions: number;
  failed_transactions: number;
  success_rate: number;
  failure_rate: number;
  collected_value: number;
  failed_value: number;
  unrecognized_statuses: number;
};

type CollectionsSummary = {
  overall: OverallSummary;
  daily_trend?: DailyTrendItem[];
  channel_daily_trend?: ChannelDailyTrendItem[];
  channels?: ChannelItem[];
  failure_analysis?: FailureAnalysisItem[];
  unmapped_failure_responses?: UnmappedFailureItem[];

  merchant_activity?: {
    active_businesses: number;
    businesses_that_collected: number;
    new_businesses: number | null;
    top_merchants: MerchantItem[];
  };
};

type ImportResult = {
  success: boolean;

  import: {
    id: string;
    fileName: string;
    rowCount: number;
    importedMinDate: string;
    importedMaxDate: string;
    createdAt: string;
  } | null;

  period: {
    id: string;
    periodStart: string;
    periodEnd: string;
    daysCovered: number;
    expectedDays: number;
    isComplete: boolean;
    transactionCount: number;
  } | null;

  summary: CollectionsSummary | null;

    previousPeriod: {
    id: string;
    periodStart: string;
    periodEnd: string;
    daysCovered: number;
    expectedDays: number;
    isComplete: boolean;
    transactionCount: number;
    summary: CollectionsSummary | null;
  } | null;

  dataCoverage?: {
    calendarDays: number;
    activeDays: number;
    coveragePercent: number;
    coveredDates: string[];
    missingDates: string[];
  };
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatShortDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(
    "en-GB",
    {
      weekday: "short",
      day: "2-digit",
      month: "short",
    }
  );
}

function formatPeriodLabel(period: PeriodListItem) {
  const start = formatDate(period.periodStart);
  const end = formatDate(period.periodEnd);

  const status = period.isComplete
    ? "Complete"
    : `${period.daysCovered}/${period.expectedDays} days`;

  return `${start} — ${end} · ${status}`;
}

function percentChange(
  current: number,
  previous: number
) {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }

  return (
    ((current - previous) / Math.abs(previous)) *
    100
  );
}

function formatPercentChange(
  value: number | null
) {
  if (value === null) return "N/A";

  const prefix = value > 0 ? "+" : "";

  return `${prefix}${value.toFixed(2)}%`;
}

function formatPointChange(value: number) {
  const prefix = value > 0 ? "+" : "";

  return `${prefix}${value.toFixed(2)} pp`;
}

export default function CollectionsPage() {
  /*
   * Direct collections upload
   */
  const [file, setFile] =
    useState<File | null>(null);

  const [uploading, setUploading] =
    useState(false);

  /*
   * Invoice upload
   */
  const [invoiceFile, setInvoiceFile] =
    useState<File | null>(null);

  const [
    uploadingInvoices,
    setUploadingInvoices,
  ] = useState(false);

  const [
    invoiceMessage,
    setInvoiceMessage,
  ] = useState("");

  /*
   * Reporting periods
   */
  const [periods, setPeriods] =
    useState<PeriodListItem[]>([]);

  const [
    selectedPeriodId,
    setSelectedPeriodId,
  ] = useState("");


  const [isCustomRange, setIsCustomRange] =
  useState(false);


  const [
    loadingPeriods,
    setLoadingPeriods,
  ] = useState(true);


const [startDate, setStartDate] = useState<Date | undefined>(
  undefined
);

const [endDate, setEndDate] = useState<Date | undefined>(
  undefined
);

async function handleDateRangeApply(
  start: Date,
  end: Date
) {
  setStartDate(start);
  setEndDate(end);

  const startValue = [
    start.getFullYear(),
    String(start.getMonth() + 1).padStart(2, "0"),
    String(start.getDate()).padStart(2, "0"),
  ].join("-");

  const endValue = [
    end.getFullYear(),
    String(end.getMonth() + 1).padStart(2, "0"),
    String(end.getDate()).padStart(2, "0"),
  ].join("-");

  try {
    setLoadingPeriod(true);
    setError("");

    const response = await fetch(
      `/api/collections/summary?start=${startValue}&end=${endValue}`,
      {
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "Unable to load collections range."
      );
    }

setResult(data);

setIsCustomRange(true);
setSelectedPeriodId("");


  } catch (error) {
    setError(
      error instanceof Error
        ? error.message
        : "Unable to load collections range."
    );
  } finally {
    setLoadingPeriod(false);
  }
}





  const [
    loadingPeriod,
    setLoadingPeriod,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [result, setResult] =
    useState<ImportResult | null>(null);

  async function loadPeriods(
    preferredPeriodId?: string
  ) {
    setLoadingPeriods(true);

    try {
      const res = await fetch(
        "/api/collections/periods",
        {
          cache: "no-store",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error ||
            "Unable to load collections periods."
        );
      }

      const availablePeriods: PeriodListItem[] =
        data.periods ?? [];

      setPeriods(availablePeriods);

      if (
        availablePeriods.length === 0
      ) {
        setSelectedPeriodId("");
        setResult(null);
        return;
      }

      const preferredExists =
        preferredPeriodId &&
        availablePeriods.some(
          (period) =>
            period.id === preferredPeriodId
        );

      const nextPeriodId =
        preferredExists
          ? preferredPeriodId!
          : availablePeriods[0].id;

      setSelectedPeriodId(
        nextPeriodId
      );

      await loadPeriod(
        nextPeriodId
      );
    } catch (err) {
      console.error(
        "Unable to load collections periods:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load collections periods."
      );
    } finally {
      setLoadingPeriods(false);
    }
  }

  async function loadPeriod(
    periodId: string
  ) {
    if (!periodId) return;

    setLoadingPeriod(true);
    setError("");

    try {
      const res = await fetch(
        `/api/collections/periods/${periodId}`,
        {
          cache: "no-store",
        }
      );

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error ||
            "Unable to load collections period."
        );
      }

      setResult(data);
    } catch (err) {
      console.error(
        "Unable to load selected collections period:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load collections period."
      );
    } finally {
      setLoadingPeriod(false);
    }
  }

  useEffect(() => {
    loadPeriods();
  }, []);

async function handlePeriodChange(
  periodId: string
) {
  if (periodId === "custom") {
    return;
  }

  setIsCustomRange(false);
  setSelectedPeriodId(periodId);

  await loadPeriod(periodId);
}

  /*
   * Direct collections import
   */
  async function handleSubmit(
    e: FormEvent
  ) {
    e.preventDefault();

    if (!file) {
      setError(
        "Choose a Metabase CSV or Excel file first."
      );

      return;
    }

    setUploading(true);
    setError("");

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      const res = await fetch(
        "/api/collections/import",
        {
          method: "POST",
          body: formData,
        }
      );

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error ||
            "Unable to import collections file."
        );
      }

   setResult(data);

if (data.period?.periodStart && data.period?.periodEnd) {
  setStartDate(
    new Date(`${data.period.periodStart.slice(0, 10)}T00:00:00`)
  );

  setEndDate(
    new Date(`${data.period.periodEnd.slice(0, 10)}T00:00:00`)
  );
}

      setFile(null);

      await loadPeriods(
        data.period.id
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to import collections file."
      );
    } finally {
      setUploading(false);
    }
  }

  /*
   * Invoice import
   */
  async function handleInvoiceSubmit(
    e: FormEvent
  ) {
    e.preventDefault();

    if (!invoiceFile) {
      setError(
        "Choose an invoice CSV or Excel file first."
      );

      return;
    }

    setUploadingInvoices(true);
    setError("");
    setInvoiceMessage("");

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        invoiceFile
      );

      const res = await fetch(
        "/api/collections/invoices/import",
        {
          method: "POST",
          body: formData,
        }
      );

      const data =
        await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error ||
            "Unable to import invoice file."
        );
      }

      setInvoiceMessage(
        `${Number(
          data.rowsProcessed ?? 0
        ).toLocaleString()} invoices processed successfully.`
      );

      setInvoiceFile(null);
    } catch (err) {
      console.error(
        "Invoice import failed:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to import invoice file."
      );
    } finally {
      setUploadingInvoices(false);
    }
  }

  const overall =
    result?.summary?.overall;

  const merchants =
    result?.summary?.merchant_activity;

  const dailyTrend =
    result?.summary?.daily_trend ?? [];

  const channels =
    result?.summary?.channels ?? [];

  const channelDailyTrend =
    result?.summary?.channel_daily_trend ?? [];

  const failureAnalysis =
    result?.summary
      ?.failure_analysis ?? [];

  const unmappedFailures =
    result?.summary
      ?.unmapped_failure_responses ??
    [];

  const merchantPerformance =
    result?.summary
      ?.merchant_activity
      ?.top_merchants ?? [];

  return (
   <PageShell
  title="Collections Performance"
  description="Review direct collections performance and import invoice data for wider collections tracking."
>
  <div className="space-y-6">
    <CollectionsTabs />
        {/* Direct Collections Upload */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-medium text-white">
                Import Direct Collections Data
              </div>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Upload a raw Metabase CSV or
                Excel export. Transactions are
                merged into the correct
                Monday–Sunday reporting week and
                deduplicated by transaction ID.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex w-full max-w-xl flex-col gap-3 sm:flex-row"
            >
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => {
                  setFile(
                    e.target.files?.[0] ??
                      null
                  );

                  setError("");
                }}
                className="block w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-950"
              />

              <button
                type="submit"
                disabled={uploading}
                className="shrink-0 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {uploading
                  ? "Processing..."
                  : "Upload & Compute"}
              </button>
            </form>
          </div>

          {file && (
            <div className="mt-4 text-xs text-slate-500">
              Selected: {file.name}
            </div>
          )}
        </div>

        {/* Invoice Upload */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-medium text-white">
                Import Invoice Data
              </div>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Upload the invoice CSV or Excel
                export. Existing invoices are
                updated using Invoice ID, so
                re-uploading the same invoice will
                not create duplicates.
              </p>
            </div>

            <form
              onSubmit={
                handleInvoiceSubmit
              }
              className="flex w-full max-w-xl flex-col gap-3 sm:flex-row"
            >
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => {
                  setInvoiceFile(
                    e.target.files?.[0] ??
                      null
                  );

                  setError("");
                  setInvoiceMessage("");
                }}
                className="block w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-950"
              />

              <button
                type="submit"
                disabled={
                  uploadingInvoices
                }
                className="shrink-0 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {uploadingInvoices
                  ? "Processing..."
                  : "Upload Invoices"}
              </button>
            </form>
          </div>

          {invoiceFile && (
            <div className="mt-4 text-xs text-slate-500">
              Selected:{" "}
              {invoiceFile.name}
            </div>
          )}

          {invoiceMessage && (
            <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
              {invoiceMessage}
            </div>
          )}
        </div>

        {/* Global error */}
        {error && (
          <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Week selector */}
                {/* Week selector */}
       {/* Reporting period controls */}
<div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
  <div className="flex flex-col gap-5">
    <div>
      <div className="text-sm font-medium text-white">
        Reporting Period
      </div>

      <div className="mt-1 text-xs text-slate-500">
        Select a custom date range or choose a saved reporting week.
      </div>
    </div>

    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      {/* Calendar */}
      <DateRangePicker
        startDate={startDate}
        endDate={endDate}
        onApply={handleDateRangeApply}
      />

      {/* Saved week + export */}
      <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto">
        <div className="w-full xl:w-80">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Saved Week
          </div>

      <select
  value={
    isCustomRange
      ? "custom"
      : selectedPeriodId
  }
  disabled={
    loadingPeriods ||
    periods.length === 0
  }
  onChange={(e) =>
    handlePeriodChange(
      e.target.value
    )
  }
  className="w-full rounded-xl border border-white/10 bg-[#0d1728] px-4 py-3 text-sm text-white outline-none disabled:opacity-50"
>
  {isCustomRange && (
    <option value="custom">
      Custom Range
    </option>
  )}

  {periods.length === 0 ? (
    <option value="">
      No saved weeks
    </option>
  ) : (
    periods.map((period) => (
      <option
        key={period.id}
        value={period.id}
      >
        {formatPeriodLabel(period)}
      </option>
    ))
  )}
</select>
        </div>

        <button
          type="button"
          disabled={!selectedPeriodId}
          onClick={() => {
            window.open(
              `/api/collections/export-pdf?periodId=${selectedPeriodId}`,
              "_blank"
            );
          }}
          className="shrink-0 self-end rounded-xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Export PDF
        </button>
      </div>
    </div>
  </div>
</div>

        {loadingPeriods ||
        loadingPeriod ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
            <div className="text-sm text-slate-500">
              Loading collections
              data...
            </div>
          </div>
        ) : !result ||
          !result.period ||
          !result.summary ||
          !overall ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
            <div className="text-sm font-medium text-slate-300">
              No collections period
              imported yet
            </div>

            <div className="mt-2 text-sm text-slate-500">
              Upload your direct
              collections Metabase
              export above to populate
              this page.
            </div>
          </div>
        ) : (
          <>
            {/* Period summary */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-medium text-white">
                    {result.import
                      ?.fileName ??
                      "Consolidated period"}
                  </div>

                  {result.import && (
                    <>
                      <div className="mt-1 text-xs text-slate-500">
                        Latest upload
                        contained{" "}
                        {result.import.rowCount.toLocaleString()}{" "}
                        rows
                      </div>

                      {result.import
                        .importedMinDate &&
                        result.import
                          .importedMaxDate && (
                          <div className="mt-1 text-xs text-slate-600">
                            Uploaded data:{" "}
                            {formatDate(
                              result.import
                                .importedMinDate
                            )}{" "}
                            —{" "}
                            {formatDate(
                              result.import
                                .importedMaxDate
                            )}
                          </div>
                        )}
                    </>
                  )}
                </div>

                <div className="text-left md:text-right">
                  <div className="text-sm font-medium text-slate-200">
                    {formatDate(
                      result.period
                        .periodStart
                    )}{" "}
                    —{" "}
                    {formatDate(
                      result.period
                        .periodEnd
                    )}
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    {
                      result.period
                        .daysCovered
                    }
                    /
                    {
                      result.period
                        .expectedDays
                    }{" "}
                    days covered
                    {" · "}
                    {result.period
                      .isComplete
                      ? "Complete week"
                      : "Partial week"}
                  </div>

                  <div className="mt-1 text-xs text-slate-600">
                    {result.period.transactionCount.toLocaleString()}{" "}
                    unique transactions
                  </div>
                </div>
              </div>
            </div>


{result.dataCoverage && (
  <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-sm font-medium text-white">
          Data Coverage
        </div>

        <div className="mt-1 text-xs text-slate-500">
          {result.dataCoverage.activeDays} of{" "}
          {result.dataCoverage.calendarDays} days have data
          {" · "}
          {result.dataCoverage.coveragePercent}% coverage
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {result.dataCoverage.coveredDates.map((date) => (
          <div
            key={date}
            className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300"
          >
            {formatShortDate(date)} ✓
          </div>
        ))}

        {result.dataCoverage.missingDates.map((date) => (
          <div
            key={date}
            className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-300"
          >
            {formatShortDate(date)} —
          </div>
        ))}
      </div>

      {result.dataCoverage.missingDates.length > 0 && (
        <div className="text-xs text-slate-500">
          Missing data:{" "}
          <span className="text-slate-300">
            {result.dataCoverage.missingDates
              .map((date) => formatShortDate(date))
              .join(", ")}
          </span>
        </div>
      )}
    </div>
  </div>
)}









            {/* Core metrics */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Success Rate"
                value={`${overall.success_rate.toFixed(
                  2
                )}%`}
              />

              <MetricCard
                label="Collected Value"
                value={formatCurrency(
                  overall.collected_value
                )}
              />

              <MetricCard
                label="Successful"
                value={overall.successful_transactions.toLocaleString()}
              />

              <MetricCard
                label="Failed"
                value={overall.failed_transactions.toLocaleString()}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Total Attempts"
                value={overall.eligible_attempts.toLocaleString()}
              />

              <MetricCard
                label="Failure Rate"
                value={`${overall.failure_rate.toFixed(
                  2
                )}%`}
              />

              <MetricCard
                label="Failed Value"
                value={formatCurrency(
                  overall.failed_value
                )}
              />

              <MetricCard
                label="Data Quality"
                value={
                  overall.unrecognized_statuses ===
                  0
                    ? "Clean"
                    : `${overall.unrecognized_statuses} issues`
                }
              />
            </div>

            <WeekOnWeekComparison
              currentPeriod={
                result.period
              }
              currentSummary={
                result.summary
              }
              previousPeriod={
                result.previousPeriod
              }
            />

            <ChannelWeekOnWeekComparison
              currentPeriod={
                result.period
              }
              currentSummary={
                result.summary
              }
              previousPeriod={
                result.previousPeriod
              }
            />

            <MerchantWeekOnWeekComparison
              currentPeriod={
                result.period
              }
              currentSummary={
                result.summary
              }
              previousPeriod={
                result.previousPeriod
              }
            />

            {/* Merchant summary */}
            {merchants && (
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard
                  label="Active Businesses"
                  value={merchants.active_businesses.toLocaleString()}
                />

                <MetricCard
                  label="Businesses That Collected"
                  value={merchants.businesses_that_collected.toLocaleString()}
                />

                <MetricCard
                  label="New Businesses"
                  value={
                    merchants.new_businesses ==
                    null
                      ? "Not available"
                      : merchants.new_businesses.toLocaleString()
                  }
                />
              </div>
            )}

            <DailyTrendSection
              data={dailyTrend}
            />

            <ChannelSection
              data={channels}
              dailyTrend={channelDailyTrend}
            />

            <FailureSection
              data={
                failureAnalysis
              }
              unmapped={
                unmappedFailures
              }
            />

            <MerchantSection
              data={
                merchantPerformance
              }
              periodEnd={
                result.period.periodEnd
              }
            />

            <InvoiceCollectionsSection
              periodStart={result.period.periodStart}
              periodEnd={result.period.periodEnd}
            />


          </>
        )}
      </div>
    </PageShell>
  );
}






function WeekOnWeekComparison({
  currentPeriod,
  currentSummary,
  previousPeriod,
}: {
  currentPeriod: NonNullable<
    ImportResult["period"]
  >;
  currentSummary: CollectionsSummary;
  previousPeriod: ImportResult["previousPeriod"];
}) {
  if (
    !previousPeriod ||
    !previousPeriod.summary
  ) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
        <div className="text-sm font-medium text-white">
          Week-on-Week Comparison
        </div>

        <div className="mt-2 text-sm text-slate-500">
          No earlier saved reporting
          week is available for
          comparison.
        </div>
      </div>
    );
  }

  const current =
    currentSummary.overall;

  const previous =
    previousPeriod.summary
      .overall;

  const successRateChange =
    current.success_rate -
    previous.success_rate;

  const comparisons = [
    {
      label: "Success Rate",
      current: `${current.success_rate.toFixed(
        2
      )}%`,
      previous: `${previous.success_rate.toFixed(
        2
      )}%`,
      change: successRateChange,
      changeLabel:
        formatPointChange(
          successRateChange
        ),
      higherIsBetter:
        true as boolean | null,
    },
    {
      label: "Collected Value",
      current: formatCurrency(
        current.collected_value
      ),
      previous: formatCurrency(
        previous.collected_value
      ),
      change: percentChange(
        current.collected_value,
        previous.collected_value
      ),
      changeLabel:
        formatPercentChange(
          percentChange(
            current.collected_value,
            previous.collected_value
          )
        ),
      higherIsBetter:
        true as boolean | null,
    },
    {
      label: "Total Attempts",
      current:
        current.eligible_attempts.toLocaleString(),
      previous:
        previous.eligible_attempts.toLocaleString(),
      change: percentChange(
        current.eligible_attempts,
        previous.eligible_attempts
      ),
      changeLabel:
        formatPercentChange(
          percentChange(
            current.eligible_attempts,
            previous.eligible_attempts
          )
        ),
      higherIsBetter:
        null as boolean | null,
    },
    {
      label:
        "Successful Transactions",
      current:
        current.successful_transactions.toLocaleString(),
      previous:
        previous.successful_transactions.toLocaleString(),
      change: percentChange(
        current.successful_transactions,
        previous.successful_transactions
      ),
      changeLabel:
        formatPercentChange(
          percentChange(
            current.successful_transactions,
            previous.successful_transactions
          )
        ),
      higherIsBetter:
        true as boolean | null,
    },
    {
      label: "Failed Transactions",
      current:
        current.failed_transactions.toLocaleString(),
      previous:
        previous.failed_transactions.toLocaleString(),
      change: percentChange(
        current.failed_transactions,
        previous.failed_transactions
      ),
      changeLabel:
        formatPercentChange(
          percentChange(
            current.failed_transactions,
            previous.failed_transactions
          )
        ),
      higherIsBetter:
        false as boolean | null,
    },
    {
      label: "Failed Value",
      current: formatCurrency(
        current.failed_value
      ),
      previous: formatCurrency(
        previous.failed_value
      ),
      change: percentChange(
        current.failed_value,
        previous.failed_value
      ),
      changeLabel:
        formatPercentChange(
          percentChange(
            current.failed_value,
            previous.failed_value
          )
        ),
      higherIsBetter:
        false as boolean | null,
    },
  ];

  const differentCoverage =
    currentPeriod.daysCovered !==
    previousPeriod.daysCovered;

  const partialComparison =
    !currentPeriod.isComplete ||
    !previousPeriod.isComplete;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025]">
      <div className="border-b border-white/[0.06] px-6 py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm font-medium text-white">
              Week-on-Week Comparison
            </div>

            <div className="mt-1 text-xs text-slate-500">
              Selected reporting week
              compared with the
              immediately preceding
              saved week.
            </div>
          </div>

          <div className="text-left text-xs text-slate-500 md:text-right">
            <div>
              Current:{" "}
              <span className="text-slate-300">
                {formatDate(
                  currentPeriod.periodStart
                )}{" "}
                —{" "}
                {formatDate(
                  currentPeriod.periodEnd
                )}
              </span>
            </div>

            <div className="mt-1">
              Previous:{" "}
              <span className="text-slate-300">
                {formatDate(
                  previousPeriod.periodStart
                )}{" "}
                —{" "}
                {formatDate(
                  previousPeriod.periodEnd
                )}
              </span>
            </div>
          </div>
        </div>

        {partialComparison && (
          <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-xs leading-5 text-amber-200">
            At least one reporting
            period is partial.
            {differentCoverage
              ? " The periods also contain different numbers of covered days, so changes should be treated as directional rather than like-for-like."
              : " Both periods have the same number of covered days, but the comparison is still based on partial-week data."}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500">
                Metric
              </th>

              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                Previous Week
              </th>

              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                Current Week
              </th>

              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500">
                Change
              </th>
            </tr>
          </thead>

          <tbody>
            {comparisons.map(
              (item) => {
                const change =
                  item.change;

                const direction =
                  change === null ||
                  change === 0
                    ? "flat"
                    : change > 0
                      ? "up"
                      : "down";

                let changeClass =
                  "text-slate-400";

                if (
                  change !== null &&
                  change !== 0 &&
                  item.higherIsBetter !==
                    null
                ) {
                  const isGood =
                    item.higherIsBetter
                      ? change > 0
                      : change < 0;

                  changeClass =
                    isGood
                      ? "text-emerald-400"
                      : "text-red-400";
                }

                const arrow =
                  direction === "up"
                    ? "↑"
                    : direction ===
                        "down"
                      ? "↓"
                      : "—";

                return (
                  <tr
                    key={
                      item.label
                    }
                    className="border-b border-white/[0.04] last:border-0"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-white">
                      {item.label}
                    </td>

                    <td className="px-4 py-4 text-right text-sm text-slate-500">
                      {
                        item.previous
                      }
                    </td>

                    <td className="px-4 py-4 text-right text-sm text-slate-200">
                      {
                        item.current
                      }
                    </td>

                    <td
                      className={`px-6 py-4 text-right text-sm font-medium ${changeClass}`}
                    >
                      <span className="mr-1.5">
                        {arrow}
                      </span>

                      {
                        item.changeLabel
                      }
                    </td>
                  </tr>
                );
              }
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChannelWeekOnWeekComparison({
  currentPeriod,
  currentSummary,
  previousPeriod,
}: {
  currentPeriod: NonNullable<
    ImportResult["period"]
  >;
  currentSummary: CollectionsSummary;
  previousPeriod: ImportResult["previousPeriod"];
}) {
  if (
    !previousPeriod ||
    !previousPeriod.summary
  ) {
    return null;
  }

  const currentChannels =
    currentSummary.channels ??
    [];

  const previousChannels =
    previousPeriod.summary
      .channels ?? [];

  if (
    currentChannels.length ===
      0 &&
    previousChannels.length ===
      0
  ) {
    return null;
  }

  const currentByChannel =
    new Map(
      currentChannels.map(
        (item) => [
          item.channel,
          item,
        ]
      )
    );

  const previousByChannel =
    new Map(
      previousChannels.map(
        (item) => [
          item.channel,
          item,
        ]
      )
    );

  const channelNames =
    Array.from(
      new Set([
        ...currentChannels.map(
          (item) =>
            item.channel
        ),
        ...previousChannels.map(
          (item) =>
            item.channel
        ),
      ])
    );

  const comparisonRows =
    channelNames
      .map((channel) => {
        const current =
          currentByChannel.get(
            channel
          );

        const previous =
          previousByChannel.get(
            channel
          );

        const currentSuccessRate =
          current?.success_rate ??
          0;

        const previousSuccessRate =
          previous?.success_rate ??
          0;

        const successRateChange =
          current && previous
            ? currentSuccessRate -
              previousSuccessRate
            : null;

        const collectedValueChange =
          current && previous
            ? percentChange(
                current.collected_value,
                previous.collected_value
              )
            : null;

        const failedChange =
          current && previous
            ? percentChange(
                current.failed,
                previous.failed
              )
            : null;

        return {
          channel,
          current,
          previous,
          successRateChange,
          collectedValueChange,
          failedChange,
        };
      })
      .sort(
        (a, b) =>
          (b.current
            ?.collected_value ??
            0) -
          (a.current
            ?.collected_value ??
            0)
      );

  const differentCoverage =
    currentPeriod.daysCovered !==
    previousPeriod.daysCovered;

  const partialComparison =
    !currentPeriod.isComplete ||
    !previousPeriod.isComplete;

  function renderChange(
    change: number | null,
    label: string,
    higherIsBetter:
      | boolean
      | null
  ) {
    if (change === null) {
      return (
        <span className="text-slate-500">
          N/A
        </span>
      );
    }

    const direction =
      change === 0
        ? "flat"
        : change > 0
          ? "up"
          : "down";

    const arrow =
      direction === "up"
        ? "↑"
        : direction ===
            "down"
          ? "↓"
          : "—";

    let changeClass =
      "text-slate-400";

    if (
      change !== 0 &&
      higherIsBetter !== null
    ) {
      const isGood =
        higherIsBetter
          ? change > 0
          : change < 0;

      changeClass =
        isGood
          ? "text-emerald-400"
          : "text-red-400";
    }

    return (
      <span
        className={
          changeClass
        }
      >
        <span className="mr-1.5">
          {arrow}
        </span>

        {label}
      </span>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025]">
      <div className="border-b border-white/[0.06] px-6 py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm font-medium text-white">
              Channel Week-on-Week
              Comparison
            </div>

            <div className="mt-1 text-xs text-slate-500">
              See which payment
              channels drove the
              movement between the
              selected week and the
              immediately preceding
              saved week.
            </div>
          </div>

          <div className="text-left text-xs text-slate-500 md:text-right">
            <div>
              Current:{" "}
              <span className="text-slate-300">
                {formatDate(
                  currentPeriod.periodStart
                )}{" "}
                —{" "}
                {formatDate(
                  currentPeriod.periodEnd
                )}
              </span>
            </div>

            <div className="mt-1">
              Previous:{" "}
              <span className="text-slate-300">
                {formatDate(
                  previousPeriod.periodStart
                )}{" "}
                —{" "}
                {formatDate(
                  previousPeriod.periodEnd
                )}
              </span>
            </div>
          </div>
        </div>

        {partialComparison && (
          <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-xs leading-5 text-amber-200">
            At least one reporting
            period is partial.
            {differentCoverage
              ? " The periods contain different numbers of covered days, so channel changes should be treated as directional rather than like-for-like."
              : " Both periods have the same number of covered days, but the comparison is still based on partial-week data."}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1300px]">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500">
                Channel
              </th>

              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                Previous Success
                Rate
              </th>

              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                Current Success Rate
              </th>

              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                SR Change
              </th>

              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                Previous Collected
              </th>

              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                Current Collected
              </th>

              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                Value Change
              </th>

              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                Previous Failures
              </th>

              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                Current Failures
              </th>

              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500">
                Failure Change
              </th>
            </tr>
          </thead>

          <tbody>
            {comparisonRows.map(
              (row) => (
                <tr
                  key={
                    row.channel
                  }
                  className="border-b border-white/[0.04] last:border-0"
                >
                  <td className="px-6 py-4 text-sm font-medium text-white">
                    {row.channel}
                  </td>

                  <td className="px-4 py-4 text-right text-sm text-slate-500">
                    {row.previous
                      ? `${row.previous.success_rate.toFixed(
                          2
                        )}%`
                      : "—"}
                  </td>

                  <td className="px-4 py-4 text-right text-sm text-slate-200">
                    {row.current
                      ? `${row.current.success_rate.toFixed(
                          2
                        )}%`
                      : "—"}
                  </td>

                  <td className="px-4 py-4 text-right text-sm font-medium">
                    {renderChange(
                      row.successRateChange,
                      row.successRateChange ===
                        null
                        ? "N/A"
                        : formatPointChange(
                            row.successRateChange
                          ),
                      true
                    )}
                  </td>

                  <td className="px-4 py-4 text-right text-sm text-slate-500">
                    {row.previous
                      ? formatCurrency(
                          row.previous
                            .collected_value
                        )
                      : "—"}
                  </td>

                  <td className="px-4 py-4 text-right text-sm text-slate-200">
                    {row.current
                      ? formatCurrency(
                          row.current
                            .collected_value
                        )
                      : "—"}
                  </td>

                  <td className="px-4 py-4 text-right text-sm font-medium">
                    {renderChange(
                      row.collectedValueChange,
                      formatPercentChange(
                        row.collectedValueChange
                      ),
                      true
                    )}
                  </td>

                  <td className="px-4 py-4 text-right text-sm text-slate-500">
                    {row.previous
                      ? row.previous.failed.toLocaleString()
                      : "—"}
                  </td>

                  <td className="px-4 py-4 text-right text-sm text-slate-200">
                    {row.current
                      ? row.current.failed.toLocaleString()
                      : "—"}
                  </td>

                  <td className="px-6 py-4 text-right text-sm font-medium">
                    {renderChange(
                      row.failedChange,
                      formatPercentChange(
                        row.failedChange
                      ),
                      false
                    )}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MerchantWeekOnWeekComparison({
  currentPeriod,
  currentSummary,
  previousPeriod,
}: {
  currentPeriod: NonNullable<
    ImportResult["period"]
  >;
  currentSummary: CollectionsSummary;
  previousPeriod: ImportResult["previousPeriod"];
}) {
  // Merchant opened in the detail modal. Declared before
  // the early returns below so hook order never changes.
  const [
    selectedMovement,
    setSelectedMovement,
  ] = useState<{
    businessId: string;
    businessName: string;
    current?: MerchantItem;
  } | null>(null);

  if (
    !previousPeriod ||
    !previousPeriod.summary
  ) {
    return null;
  }

  const currentMerchants =
    currentSummary
      .merchant_activity
      ?.top_merchants ?? [];

  const previousMerchants =
    previousPeriod.summary
      .merchant_activity
      ?.top_merchants ?? [];

  if (
    currentMerchants.length ===
      0 &&
    previousMerchants.length ===
      0
  ) {
    return null;
  }

  const currentById =
    new Map(
      currentMerchants.map(
        (merchant) => [
          merchant.business_id,
          merchant,
        ]
      )
    );

  const previousById =
    new Map(
      previousMerchants.map(
        (merchant) => [
          merchant.business_id,
          merchant,
        ]
      )
    );

  const businessIds =
    Array.from(
      new Set([
        ...currentMerchants.map(
          (merchant) =>
            merchant.business_id
        ),
        ...previousMerchants.map(
          (merchant) =>
            merchant.business_id
        ),
      ])
    );

  const movements =
    businessIds.map(
      (businessId) => {
        const current =
          currentById.get(
            businessId
          );

        const previous =
          previousById.get(
            businessId
          );

        return {
          businessId,

          businessName:
            current?.business_name ||
            previous?.business_name ||
            businessId,

          current,

          previous,

          collectionDelta:
            (current?.collected_value ??
              0) -
            (previous
              ?.collected_value ??
              0),

          successRateDelta:
            current && previous
              ? current.success_rate -
                previous.success_rate
              : null,

          failureDelta:
            (current?.failed ??
              0) -
            (previous?.failed ??
              0),
        };
      }
    );

  const collectionIncreases =
    [...movements]
      .filter(
        (item) =>
          item.collectionDelta >
          0
      )
      .sort(
        (a, b) =>
          b.collectionDelta -
          a.collectionDelta
      )
      .slice(0, 10);

  const collectionDecreases =
    [...movements]
      .filter(
        (item) =>
          item.collectionDelta <
          0
      )
      .sort(
        (a, b) =>
          a.collectionDelta -
          b.collectionDelta
      )
      .slice(0, 10);

  const successRateDrops =
    [...movements]
      .filter(
        (item) =>
          item.current &&
          item.previous &&
          item.successRateDelta !==
            null &&
          item.successRateDelta <
            0
      )
      .sort(
        (a, b) =>
          (a.successRateDelta ??
            0) -
          (b.successRateDelta ??
            0)
      )
      .slice(0, 10);

  const failureIncreases =
    [...movements]
      .filter(
        (item) =>
          item.failureDelta >
          0
      )
      .sort(
        (a, b) =>
          b.failureDelta -
          a.failureDelta
      )
      .slice(0, 10);

  const differentCoverage =
    currentPeriod.daysCovered !==
    previousPeriod.daysCovered;

  const partialComparison =
    !currentPeriod.isComplete ||
    !previousPeriod.isComplete;

  type MovementItem =
    (typeof movements)[number];

  function MerchantCell({
    item,
  }: {
    item: MovementItem;
  }) {
    return (
      <div>
        <div className="text-sm font-medium text-white">
          {item.businessName}
        </div>

        <div className="mt-1 text-xs text-slate-600">
          {item.businessId}
        </div>
      </div>
    );
  }

  function EmptyState({
    children,
  }: {
    children: string;
  }) {
    return (
      <div className="px-6 py-8 text-sm text-slate-500">
        {children}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.025]">
        <div className="border-b border-white/[0.06] px-6 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-sm font-medium text-white">
                Merchant Week-on-Week
                Movement
              </div>

              <div className="mt-1 text-xs text-slate-500">
                Merchants driving
                collection growth,
                collection decline,
                success-rate
                deterioration, and
                higher failure counts.
                Click a merchant to see
                its daily transactions.
              </div>
            </div>

            <div className="text-left text-xs text-slate-500 md:text-right">
              <div>
                Current:{" "}
                <span className="text-slate-300">
                  {formatDate(
                    currentPeriod.periodStart
                  )}{" "}
                  —{" "}
                  {formatDate(
                    currentPeriod.periodEnd
                  )}
                </span>
              </div>

              <div className="mt-1">
                Previous:{" "}
                <span className="text-slate-300">
                  {formatDate(
                    previousPeriod.periodStart
                  )}{" "}
                  —{" "}
                  {formatDate(
                    previousPeriod.periodEnd
                  )}
                </span>
              </div>
            </div>
          </div>

          {partialComparison && (
            <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-xs leading-5 text-amber-200">
              At least one reporting
              period is partial.
              {differentCoverage
                ? " The periods contain different numbers of covered days, so merchant movements should be treated as directional rather than like-for-like."
                : " Both periods have the same number of covered days, but the comparison is still based on partial-week data."}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <MerchantMovementTable
          title="Biggest Collection Increases"
          description="Merchants contributing the largest positive change in collected value."
          items={
            collectionIncreases
          }
          emptyText="No merchants recorded an increase in collected value."
          renderValues={(
            item
          ) => ({
            current:
              formatCurrency(
                item.current
                  ?.collected_value ??
                  0
              ),

            previous:
              formatCurrency(
                item.previous
                  ?.collected_value ??
                  0
              ),

            change: `↑ ${formatCurrency(
              item.collectionDelta
            )}`,

            changeClass:
              "text-emerald-400",
          })}
          MerchantCell={
            MerchantCell
          }
          EmptyState={
            EmptyState
          }
          onSelect={(item) =>
            setSelectedMovement(item)
          }
        />

        <MerchantMovementTable
          title="Biggest Collection Decreases"
          description="Merchants contributing the largest negative change in collected value."
          items={
            collectionDecreases
          }
          emptyText="No merchants recorded a decrease in collected value."
          renderValues={(
            item
          ) => ({
            current:
              formatCurrency(
                item.current
                  ?.collected_value ??
                  0
              ),

            previous:
              formatCurrency(
                item.previous
                  ?.collected_value ??
                  0
              ),

            change: `↓ ${formatCurrency(
              Math.abs(
                item.collectionDelta
              )
            )}`,

            changeClass:
              "text-red-400",
          })}
          MerchantCell={
            MerchantCell
          }
          EmptyState={
            EmptyState
          }
          onSelect={(item) =>
            setSelectedMovement(item)
          }
        />

        <MerchantMovementTable
          title="Biggest Success-Rate Drops"
          description="Merchants whose transaction success rate deteriorated the most."
          items={
            successRateDrops
          }
          emptyText="No merchants recorded a success-rate drop."
          renderValues={(
            item
          ) => ({
            current:
              item.current
                ? `${item.current.success_rate.toFixed(
                    2
                  )}%`
                : "—",

            previous:
              item.previous
                ? `${item.previous.success_rate.toFixed(
                    2
                  )}%`
                : "—",

            change: `↓ ${Math.abs(
              item.successRateDelta ??
                0
            ).toFixed(2)} pp`,

            changeClass:
              "text-red-400",
          })}
          MerchantCell={
            MerchantCell
          }
          EmptyState={
            EmptyState
          }
          onSelect={(item) =>
            setSelectedMovement(item)
          }
        />

        <MerchantMovementTable
          title="Biggest Failure Increases"
          description="Merchants with the largest increase in failed transaction count."
          items={
            failureIncreases
          }
          emptyText="No merchants recorded an increase in failures."
          renderValues={(
            item
          ) => ({
            current: (
              item.current
                ?.failed ?? 0
            ).toLocaleString(),

            previous: (
              item.previous
                ?.failed ?? 0
            ).toLocaleString(),

            change: `↑ ${item.failureDelta.toLocaleString()}`,

            changeClass:
              "text-red-400",
          })}
          MerchantCell={
            MerchantCell
          }
          EmptyState={
            EmptyState
          }
          onSelect={(item) =>
            setSelectedMovement(item)
          }
        />
      </div>

      {selectedMovement && (
        <MerchantDetailModal
          businessId={
            selectedMovement.businessId
          }
          businessName={
            selectedMovement.businessName
          }
          periodEnd={
            currentPeriod.periodEnd
          }
          summary={
            selectedMovement.current ??
            null
          }
          onClose={() =>
            setSelectedMovement(null)
          }
        />
      )}
    </div>
  );
}

function MerchantMovementTable<T>({
  title,
  description,
  items,
  emptyText,
  renderValues,
  MerchantCell,
  EmptyState,
  onSelect,
}: {
  title: string;
  description: string;
  items: T[];
  emptyText: string;

  renderValues: (
    item: T
  ) => {
    current: string;
    previous: string;
    change: string;
    changeClass: string;
  };

  MerchantCell: (
    props: {
      item: T;
    }
  ) => any;

  EmptyState: (
    props: {
      children: string;
    }
  ) => any;

  // Called when a merchant row is clicked.
  onSelect?: (item: T) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
      <div className="border-b border-white/[0.06] px-6 py-5">
        <div className="text-sm font-medium text-white">
          {title}
        </div>

        <div className="mt-1 text-xs text-slate-500">
          {description}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState>
          {emptyText}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500">
                  Merchant
                </th>

                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                  Previous
                </th>

                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                  Current
                </th>

                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500">
                  Change
                </th>
              </tr>
            </thead>

            <tbody>
              {items.map(
                (
                  item,
                  index
                ) => {
                  const values =
                    renderValues(
                      item
                    );

                  return (
                    <tr
                      key={
                        index
                      }
                      onClick={
                        onSelect
                          ? () =>
                              onSelect(
                                item
                              )
                          : undefined
                      }
                      className={`border-b border-white/[0.04] last:border-0 ${
                        onSelect
                          ? "cursor-pointer transition hover:bg-white/[0.04]"
                          : ""
                      }`}
                    >
                      <td className="px-6 py-4">
                        <MerchantCell
                          item={
                            item
                          }
                        />
                      </td>

                      <td className="px-4 py-4 text-right text-sm text-slate-500">
                        {
                          values.previous
                        }
                      </td>

                      <td className="px-4 py-4 text-right text-sm text-slate-300">
                        {
                          values.current
                        }
                      </td>

                      <td
                        className={`px-6 py-4 text-right text-sm font-medium ${values.changeClass}`}
                      >
                        {
                          values.change
                        }
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>

      <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
        {value}
      </div>
    </div>
  );
}

function DailyTrendSection({
  data,
}: {
  data: DailyTrendItem[];
}) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
        <div className="text-sm font-medium text-white">
          Daily Trend
        </div>

        <div className="mt-2 text-sm text-slate-500">
          No daily trend data is
          available for this reporting
          period.
        </div>
      </div>
    );
  }

  const chartData =
    data.map((item) => ({
      ...item,

      displayDate:
        formatShortDate(
          item.date
        ),
    }));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
        <div>
          <div className="text-sm font-medium text-white">
            Daily Trend
          </div>

          <div className="mt-1 text-xs text-slate-500">
            Success rate across the
            selected reporting week.
          </div>
        </div>

        <div className="mt-6 h-72 w-full">
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <LineChart
              data={
                chartData
              }
            >
              <CartesianGrid
                stroke="rgba(255,255,255,0.06)"
                vertical={
                  false
                }
              />

              <XAxis
                dataKey="displayDate"
                tick={{
                  fill: "#64748b",
                  fontSize: 11,
                }}
                axisLine={
                  false
                }
                tickLine={
                  false
                }
              />

              <YAxis
                domain={[
                  "dataMin - 2",
                  "dataMax + 2",
                ]}
                tickFormatter={(
                  value
                ) =>
                  `${value}%`
                }
                tick={{
                  fill: "#64748b",
                  fontSize: 11,
                }}
                axisLine={
                  false
                }
                tickLine={
                  false
                }
              />

              <Tooltip
                contentStyle={{
                  backgroundColor:
                    "#0d1728",

                  border:
                    "1px solid rgba(255,255,255,0.1)",

                  borderRadius:
                    "12px",

                  color:
                    "#ffffff",
                }}
                formatter={(
                  value
                ) => [
                  `${Number(
                    value
                  ).toFixed(
                    2
                  )}%`,

                  "Success Rate",
                ]}
              />

              <Line
                type="monotone"
                dataKey="success_rate"
                stroke="#34d399"
                strokeWidth={
                  2.5
                }
                dot={{
                  r: 4,
                  fill:
                    "#34d399",
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
        <div className="border-b border-white/[0.06] px-6 py-5">
          <div className="text-sm font-medium text-white">
            Daily Performance
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-6 py-3 text-left text-xs text-slate-500">
                  Date
                </th>

                <th className="px-4 py-3 text-right text-xs text-slate-500">
                  Attempts
                </th>

                <th className="px-4 py-3 text-right text-xs text-slate-500">
                  Successful
                </th>

                <th className="px-4 py-3 text-right text-xs text-slate-500">
                  Failed
                </th>

                <th className="px-4 py-3 text-right text-xs text-slate-500">
                  Success Rate
                </th>

                <th className="px-4 py-3 text-right text-xs text-slate-500">
                  Collected Value
                </th>

                <th className="px-6 py-3 text-right text-xs text-slate-500">
                  Failed Value
                </th>
              </tr>
            </thead>

            <tbody>
              {data.map(
                (item) => (
                  <tr
                    key={
                      item.date
                    }
                    className="border-b border-white/[0.04] last:border-0"
                  >
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {formatShortDate(
                        item.date
                      )}
                    </td>

                    <td className="px-4 py-4 text-right text-sm text-slate-400">
                      {item.attempts.toLocaleString()}
                    </td>

                    <td className="px-4 py-4 text-right text-sm text-slate-400">
                      {item.successful.toLocaleString()}
                    </td>

                    <td className="px-4 py-4 text-right text-sm text-slate-400">
                      {item.failed.toLocaleString()}
                    </td>

                    <td className="px-4 py-4 text-right text-sm text-white">
                      {item.success_rate.toFixed(
                        2
                      )}
                      %
                    </td>

                    <td className="px-4 py-4 text-right text-sm text-slate-300">
                      {formatCurrency(
                        item.collected_value
                      )}
                    </td>

                    <td className="px-6 py-4 text-right text-sm text-slate-400">
                      {formatCurrency(
                        item.failed_value
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ChannelSection({
  data,
  dailyTrend,
}: {
  data: ChannelItem[];
  dailyTrend: ChannelDailyTrendItem[];
}) {
  if (data.length === 0) {
    return null;
  }

  const preferredChannelOrder = [
    "MTN MoMo",
    "Telecel Cash",
    "AT Money",
    "Card",
    "Pay Small Small",
  ];

  const channels = Array.from(
    new Set(
      dailyTrend
        .map((item) => item.channel)
        .filter((channel) => channel !== "Unknown")
    )
  ).sort((a, b) => {
    const aIndex = preferredChannelOrder.indexOf(a);
    const bIndex = preferredChannelOrder.indexOf(b);

    return (
      (aIndex === -1 ? preferredChannelOrder.length : aIndex) -
      (bIndex === -1 ? preferredChannelOrder.length : bIndex)
    );
  });

  const dates = Array.from(
    new Set(dailyTrend.map((item) => item.date))
  ).sort();

  const dailyChartData = dates.map((date) => {
    const row: Record<string, string | number | null> = {
      date,
      displayDate: formatShortDate(date),
    };

    channels.forEach((channel) => {
      const item = dailyTrend.find(
        (entry) =>
          entry.date === date &&
          entry.channel === channel
      );

      row[channel] = item?.success_rate ?? null;
    });

    return row;
  });

  const channelColors: Record<string, string> = {
    "MTN MoMo": "#facc15",
    "Telecel Cash": "#ef4444",
    "AT Money": "#60a5fa",
    Card: "#a78bfa",
    "Pay Small Small": "#34d399",
  };

  return (
    <div className="space-y-4">
      {/* Weekly channel performance */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
        <div>
          <div className="text-sm font-medium text-white">
            Channel Performance
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Success rate by channel for the selected reporting week.
          </div>
        </div>

        <div className="mt-6 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid
                stroke="rgba(255,255,255,0.06)"
                vertical={false}
              />
              <XAxis
                dataKey="channel"
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0d1728",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  color: "#ffffff",
                }}
                formatter={(value) => [
                  `${Number(value).toFixed(2)}%`,
                  "Success Rate",
                ]}
              />
              <Bar
                dataKey="success_rate"
                fill="#60a5fa"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily channel success-rate trend */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
        <div>
          <div className="text-sm font-medium text-white">
            Daily Success Rate by Channel
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Daily success-rate movement across each collection channel.
          </div>
        </div>

        {dailyChartData.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-10 text-center">
            <div className="text-sm text-slate-500">
              Daily channel trend data is not available for this saved period.
              Re-import the collections data for this week to calculate it.
            </div>
          </div>
        ) : (
          <div className="mt-6 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyChartData}>
                <CartesianGrid
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0d1728",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    color: "#ffffff",
                  }}
                  labelStyle={{ color: "#94a3b8" }}
                  formatter={(value, name) => [
                    value == null
                      ? "—"
                      : `${Number(value).toFixed(2)}%`,
                    String(name),
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />

                {channels.map((channel) => (
                  <Line
                    key={channel}
                    type="monotone"
                    dataKey={channel}
                    name={channel}
                    stroke={channelColors[channel] ?? "#94a3b8"}
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Channel performance table */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.025]">
        <table className="w-full min-w-[1050px]">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-6 py-3 text-left text-xs text-slate-500">Channel</th>
              <th className="px-4 py-3 text-right text-xs text-slate-500">Attempts</th>
              <th className="px-4 py-3 text-right text-xs text-slate-500">Successful</th>
              <th className="px-4 py-3 text-right text-xs text-slate-500">Failed</th>
              <th className="px-4 py-3 text-right text-xs text-slate-500">Success Rate</th>
              <th className="px-4 py-3 text-right text-xs text-slate-500">Failure Rate</th>
              <th className="px-4 py-3 text-right text-xs text-slate-500">Collected Value</th>
              <th className="px-4 py-3 text-right text-xs text-slate-500">Failed Value</th>
              <th className="px-6 py-3 text-right text-xs text-slate-500">Collection Share</th>
            </tr>
          </thead>

          <tbody>
            {data.map((item) => (
              <tr
                key={item.channel}
                className="border-b border-white/[0.04] last:border-0"
              >
                <td className="px-6 py-4 text-sm font-medium text-white">
                  {item.channel}
                </td>
                <td className="px-4 py-4 text-right text-sm text-slate-400">
                  {item.attempts.toLocaleString()}
                </td>
                <td className="px-4 py-4 text-right text-sm text-slate-400">
                  {item.successful.toLocaleString()}
                </td>
                <td className="px-4 py-4 text-right text-sm text-slate-400">
                  {item.failed.toLocaleString()}
                </td>
                <td className="px-4 py-4 text-right text-sm text-white">
                  {item.success_rate.toFixed(2)}%
                </td>
                <td className="px-4 py-4 text-right text-sm text-slate-400">
                  {item.failure_rate.toFixed(2)}%
                </td>
                <td className="px-4 py-4 text-right text-sm text-slate-300">
                  {formatCurrency(item.collected_value)}
                </td>
                <td className="px-4 py-4 text-right text-sm text-slate-400">
                  {formatCurrency(item.failed_value)}
                </td>
                <td className="px-6 py-4 text-right text-sm text-slate-300">
                  {item.collection_share.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FailureSection({
  data,
  unmapped,
}: {
  data: FailureAnalysisItem[];
  unmapped: UnmappedFailureItem[];
}) {
  if (data.length === 0) {
    return null;
  }

  const groupedReasons =
    data.reduce<
      Record<string, number>
    >((acc, item) => {
      acc[item.clean_reason] =
        (acc[
          item.clean_reason
        ] ?? 0) +
        item.count;

      return acc;
    }, {});

  const chartData =
    Object.entries(
      groupedReasons
    )
      .map(
        ([
          reason,
          count,
        ]) => ({
          reason,
          count,
        })
      )
      .sort(
        (a, b) =>
          b.count -
          a.count
      )
      .slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
        <div className="text-sm font-medium text-white">
          Top Failure Reasons
        </div>

        <div className="mt-6 h-96">
          <ResponsiveContainer>
            <BarChart
              data={
                chartData
              }
              layout="vertical"
            >
              <CartesianGrid
                stroke="rgba(255,255,255,0.06)"
                horizontal={
                  false
                }
              />

              <XAxis
                type="number"
                tick={{
                  fill: "#64748b",
                  fontSize: 11,
                }}
                axisLine={
                  false
                }
                tickLine={
                  false
                }
              />

              <YAxis
                type="category"
                dataKey="reason"
                width={220}
                tick={{
                  fill: "#94a3b8",
                  fontSize: 11,
                }}
                axisLine={
                  false
                }
                tickLine={
                  false
                }
              />

              <Tooltip />

              <Bar
                dataKey="count"
                fill="#f87171"
                radius={[
                  0,
                  6,
                  6,
                  0,
                ]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {unmapped.length >
        0 && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-5">
          <div className="text-sm font-medium text-amber-200">
            Unmapped Provider
            Responses
          </div>

          <div className="mt-4 space-y-3">
            {unmapped.map(
              (
                item,
                index
              ) => (
                <div
                  key={`${item.channel}-${index}`}
                  className="rounded-xl border border-amber-400/10 p-4"
                >
                  <div className="text-sm text-amber-100">
                    {
                      item.raw_provider_response
                    }
                  </div>

                  <div className="mt-1 text-xs text-amber-200/60">
                    {
                      item.channel
                    }{" "}
                    ·{" "}
                    {item.count.toLocaleString()}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.025]">
        <table className="w-full min-w-[1000px]">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-6 py-3 text-left text-xs text-slate-500">
                Channel
              </th>

              <th className="px-4 py-3 text-left text-xs text-slate-500">
                Clean Reason
              </th>

              <th className="px-4 py-3 text-left text-xs text-slate-500">
                Raw Provider Response
              </th>

              <th className="px-4 py-3 text-right text-xs text-slate-500">
                Count
              </th>

              <th className="px-6 py-3 text-right text-xs text-slate-500">
                Share of Channel
                Failures
              </th>
            </tr>
          </thead>

          <tbody>
            {data.map(
              (
                item,
                index
              ) => (
                <tr
                  key={`${item.channel}-${index}`}
                  className="border-b border-white/[0.04] last:border-0"
                >
                  <td className="px-6 py-4 text-sm text-white">
                    {
                      item.channel
                    }
                  </td>

                  <td className="px-4 py-4 text-sm text-slate-300">
                    {
                      item.clean_reason
                    }
                  </td>

                  <td className="px-4 py-4 text-sm text-slate-500">
                    {
                      item.raw_provider_response
                    }
                  </td>

                  <td className="px-4 py-4 text-right text-sm text-slate-300">
                    {item.count.toLocaleString()}
                  </td>

                  <td className="px-6 py-4 text-right text-sm text-slate-300">
                    {item.share_of_channel_failures.toFixed(
                      2
                    )}
                    %
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MerchantSection({
  data,
  periodEnd,
}: {
  data: MerchantItem[];
  // End of the reporting period being viewed.
  periodEnd: string;
}) {
  const [search, setSearch] =
    useState("");

  const [sortBy, setSortBy] =
    useState<
      | "collections"
      | "success-rate"
      | "failed-value"
      | "attempts"
    >("collections");

  const [
    pageSize,
    setPageSize,
  ] = useState(25);

  const [
    currentPage,
    setCurrentPage,
  ] = useState(1);

  const [
    selectedMerchant,
    setSelectedMerchant,
  ] =
    useState<MerchantItem | null>(
      null
    );

  const filteredAndSorted =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      let merchants =
        data.filter(
          (merchant) => {
            if (!term) {
              return true;
            }

            const businessName =
              merchant.business_name
                ?.toLowerCase() ??
              "";

            const businessId =
              merchant.business_id
                ?.toLowerCase() ??
              "";

            return (
              businessName.includes(
                term
              ) ||
              businessId.includes(
                term
              )
            );
          }
        );

      merchants = [
        ...merchants,
      ].sort((a, b) => {
        switch (sortBy) {
          case "success-rate":
            return (
              a.success_rate -
              b.success_rate
            );

          case "failed-value":
            return (
              b.failed_value -
              a.failed_value
            );

          case "attempts":
            return (
              b.attempts -
              a.attempts
            );

          case "collections":
          default:
            return (
              b.collected_value -
              a.collected_value
            );
        }
      });

      return merchants;
    }, [
      data,
      search,
      sortBy,
    ]);

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredAndSorted.length /
          pageSize
      )
    );

  const safeCurrentPage =
    Math.min(
      currentPage,
      totalPages
    );

  const startIndex =
    (safeCurrentPage -
      1) *
    pageSize;

  const endIndex =
    startIndex +
    pageSize;

  const paginatedMerchants =
    filteredAndSorted.slice(
      startIndex,
      endIndex
    );

  const chartData =
    useMemo(() => {
      return [...data]
        .sort(
          (a, b) =>
            b.collected_value -
            a.collected_value
        )
        .slice(0, 10);
    }, [data]);

  function handleSearchChange(
    value: string
  ) {
    setSearch(value);
    setCurrentPage(1);
  }

  function handleSortChange(
    value:
      | "collections"
      | "success-rate"
      | "failed-value"
      | "attempts"
  ) {
    setSortBy(value);
    setCurrentPage(1);
  }

  function handlePageSizeChange(
    value: number
  ) {
    setPageSize(value);
    setCurrentPage(1);
  }

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
        <div className="text-sm font-medium text-white">
          Merchant Performance
        </div>

        <div className="mt-2 text-sm text-slate-500">
          No merchant data is
          available for this period.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Top 10 chart */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <div>
            <div className="text-sm font-medium text-white">
              Top 10 Merchants by
              Collected Value
            </div>

            <div className="mt-1 text-xs text-slate-500">
              Highest contributing
              merchants in the
              selected reporting week.
            </div>
          </div>

          <div className="mt-6 h-[420px]">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={
                  chartData
                }
                layout="vertical"
                margin={{
                  top: 10,
                  right: 20,
                  left: 50,
                  bottom: 10,
                }}
              >
                <CartesianGrid
                  stroke="rgba(255,255,255,0.06)"
                  horizontal={
                    false
                  }
                />

                <XAxis
                  type="number"
                  tick={{
                    fill: "#64748b",
                    fontSize: 11,
                  }}
                  tickFormatter={(
                    value
                  ) =>
                    new Intl.NumberFormat(
                      "en",
                      {
                        notation:
                          "compact",
                      }
                    ).format(
                      value
                    )
                  }
                  axisLine={
                    false
                  }
                  tickLine={
                    false
                  }
                />

                <YAxis
                  type="category"
                  dataKey="business_name"
                  width={220}
                  tick={{
                    fill: "#94a3b8",
                    fontSize: 11,
                  }}
                  axisLine={
                    false
                  }
                  tickLine={
                    false
                  }
                />

                <Tooltip
                  contentStyle={{
                    backgroundColor:
                      "#0d1728",

                    border:
                      "1px solid rgba(255,255,255,0.1)",

                    borderRadius:
                      "12px",

                    color:
                      "#ffffff",
                  }}
                  labelStyle={{
                    color:
                      "#94a3b8",
                  }}
                  formatter={(
                    value
                  ) => [
                    formatCurrency(
                      Number(
                        value
                      )
                    ),

                    "Collected Value",
                  ]}
                />

                <Bar
                  dataKey="collected_value"
                  fill="#a78bfa"
                  radius={[
                    0,
                    6,
                    6,
                    0,
                  ]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Merchant table */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.025]">
          <div className="border-b border-white/[0.06] px-6 py-5">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="text-sm font-medium text-white">
                  Merchant
                  Performance
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  Click a merchant row
                  to see its daily
                  transactions, failure
                  reasons and provider
                  responses.
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div>
                  <div className="mb-1.5 text-xs text-slate-500">
                    Search
                  </div>

                  <input
                    value={
                      search
                    }
                    onChange={(
                      e
                    ) =>
                      handleSearchChange(
                        e.target
                          .value
                      )
                    }
                    placeholder="Merchant or Business ID..."
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 sm:w-64"
                  />
                </div>

                <div>
                  <div className="mb-1.5 text-xs text-slate-500">
                    Sort by
                  </div>

                  <select
                    value={
                      sortBy
                    }
                    onChange={(
                      e
                    ) =>
                      handleSortChange(
                        e.target
                          .value as
                          | "collections"
                          | "success-rate"
                          | "failed-value"
                          | "attempts"
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#0d1728] px-4 py-2.5 text-sm text-white outline-none sm:w-52"
                  >
                    <option value="collections">
                      Highest
                      Collections
                    </option>

                    <option value="success-rate">
                      Lowest Success
                      Rate
                    </option>

                    <option value="failed-value">
                      Highest Failed
                      Value
                    </option>

                    <option value="attempts">
                      Most Attempts
                    </option>
                  </select>
                </div>

                <div>
                  <div className="mb-1.5 text-xs text-slate-500">
                    Rows
                  </div>

                  <select
                    value={
                      pageSize
                    }
                    onChange={(
                      e
                    ) =>
                      handlePageSizeChange(
                        Number(
                          e.target
                            .value
                        )
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#0d1728] px-4 py-2.5 text-sm text-white outline-none sm:w-24"
                  >
                    <option
                      value={10}
                    >
                      10
                    </option>

                    <option
                      value={25}
                    >
                      25
                    </option>

                    <option
                      value={50}
                    >
                      50
                    </option>

                    <option
                      value={100}
                    >
                      100
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[1150px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky top-0 z-30 bg-[#0d1728] px-6 py-3 text-left text-xs font-medium text-slate-500 shadow-[0_1px_0_rgba(255,255,255,0.08)]">
                    Business
                  </th>

                  <th className="sticky top-0 z-30 bg-[#0d1728] px-4 py-3 text-right text-xs font-medium text-slate-500 shadow-[0_1px_0_rgba(255,255,255,0.08)]">
                    Attempts
                  </th>

                  <th className="sticky top-0 z-30 bg-[#0d1728] px-4 py-3 text-right text-xs font-medium text-slate-500 shadow-[0_1px_0_rgba(255,255,255,0.08)]">
                    Successful
                  </th>

                  <th className="sticky top-0 z-30 bg-[#0d1728] px-4 py-3 text-right text-xs font-medium text-slate-500 shadow-[0_1px_0_rgba(255,255,255,0.08)]">
                    Failed
                  </th>

                  <th className="sticky top-0 z-30 bg-[#0d1728] px-4 py-3 text-right text-xs font-medium text-slate-500 shadow-[0_1px_0_rgba(255,255,255,0.08)]">
                    Success Rate
                  </th>

                  <th className="sticky top-0 z-30 bg-[#0d1728] px-4 py-3 text-right text-xs font-medium text-slate-500 shadow-[0_1px_0_rgba(255,255,255,0.08)]">
                    Collected Value
                  </th>

                  <th className="sticky top-0 z-30 bg-[#0d1728] px-4 py-3 text-right text-xs font-medium text-slate-500 shadow-[0_1px_0_rgba(255,255,255,0.08)]">
                    Failed Value
                  </th>

                  <th className="sticky top-0 z-30 bg-[#0d1728] px-6 py-3 text-right text-xs font-medium text-slate-500 shadow-[0_1px_0_rgba(255,255,255,0.08)]">
                    Collection Share
                  </th>
                </tr>
              </thead>

              <tbody>
                {paginatedMerchants.map(
                  (
                    merchant
                  ) => (
                    <tr
                      key={
                        merchant.business_id
                      }
                      onClick={() =>
                        setSelectedMerchant(
                          merchant
                        )
                      }
                      className="cursor-pointer border-b border-white/[0.04] transition hover:bg-white/[0.04] last:border-0"
                    >
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-white">
                          {
                            merchant.business_name
                          }
                        </div>

                        <div className="mt-1 text-xs text-slate-600">
                          {
                            merchant.business_id
                          }
                        </div>
                      </td>

                      <td className="px-4 py-4 text-right text-sm text-slate-400">
                        {merchant.attempts.toLocaleString()}
                      </td>

                      <td className="px-4 py-4 text-right text-sm text-slate-400">
                        {merchant.successful.toLocaleString()}
                      </td>

                      <td className="px-4 py-4 text-right text-sm text-slate-400">
                        {merchant.failed.toLocaleString()}
                      </td>

                      <td className="px-4 py-4 text-right text-sm font-medium text-white">
                        {merchant.success_rate.toFixed(
                          2
                        )}
                        %
                      </td>

                      <td className="px-4 py-4 text-right text-sm text-slate-300">
                        {formatCurrency(
                          merchant.collected_value
                        )}
                      </td>

                      <td className="px-4 py-4 text-right text-sm text-slate-400">
                        {formatCurrency(
                          merchant.failed_value
                        )}
                      </td>

                      <td className="px-6 py-4 text-right text-sm text-slate-300">
                        {merchant.collection_share.toFixed(
                          2
                        )}
                        %
                      </td>
                    </tr>
                  )
                )}

                {paginatedMerchants.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        8
                      }
                      className="px-6 py-12 text-center text-sm text-slate-500"
                    >
                      No merchants
                      match your
                      search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredAndSorted.length >
            0 && (
            <div className="flex flex-col gap-4 border-t border-white/[0.06] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-500">
                Showing{" "}
                <span className="text-slate-300">
                  {startIndex +
                    1}
                </span>
                {" — "}
                <span className="text-slate-300">
                  {Math.min(
                    endIndex,
                    filteredAndSorted.length
                  )}
                </span>
                {" of "}
                <span className="text-slate-300">
                  {filteredAndSorted.length.toLocaleString()}
                </span>{" "}
                merchants
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={
                    safeCurrentPage ===
                    1
                  }
                  onClick={() =>
                    setCurrentPage(
                      (page) =>
                        Math.max(
                          1,
                          page -
                            1
                        )
                    )
                  }
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Previous
                </button>

                <div className="px-2 text-xs text-slate-500">
                  Page{" "}
                  <span className="font-medium text-white">
                    {
                      safeCurrentPage
                    }
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-white">
                    {totalPages}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={
                    safeCurrentPage ===
                    totalPages
                  }
                  onClick={() =>
                    setCurrentPage(
                      (page) =>
                        Math.min(
                          totalPages,
                          page +
                            1
                        )
                    )
                  }
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Merchant detail modal: daily trend, figures and failure reasons */}
      {selectedMerchant && (
        <MerchantDetailModal
          businessId={
            selectedMerchant.business_id
          }
          businessName={
            selectedMerchant.business_name
          }
          periodEnd={periodEnd}
          summary={selectedMerchant}
          onClose={() =>
            setSelectedMerchant(
              null
            )
          }
        />
      )}
    </>
  );
}