"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/*
  Merchant detail modal for the Collections page.

  Opens from Merchant Performance and from the four
  week-on-week movement tables. Shows a daily line chart
  of the merchant's successful and failed transactions,
  with a period selector counted back from the end of
  the period being viewed.
*/

export type MerchantFailureReason = {
  channel: string;
  clean_reason: string;
  raw_provider_response: string;
  count: number;
  share_of_merchant_failures: number;
};

export type MerchantSummary = {
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

type TrendRange = "7d" | "14d" | "1m" | "3m";

const RANGE_OPTIONS: { value: TrendRange; label: string }[] = [
  { value: "7d", label: "Past 7 days" },
  { value: "14d", label: "14 days" },
  { value: "1m", label: "1 month" },
  { value: "3m", label: "3 months" },
];

type TrendDay = {
  date: string;
  hasData: boolean;
  attempts: number | null;
  successful: number | null;
  failed: number | null;
  success_rate: number | null;
  collected_value: number | null;
  failed_value: number | null;
};

type TrendResponse = {
  businessName: string | null;
  start: string;
  end: string;
  days: TrendDay[];
  totals: {
    attempts: number;
    successful: number;
    failed: number;
    success_rate: number;
    collected_value: number;
    failed_value: number;
  };
  coverage: {
    calendarDays: number;
    daysWithData: number;
  };
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDay(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2,
  }).format(value);
}

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: TrendDay }[];
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const day = payload[0].payload;

  return (
    <div className="rounded-xl border border-white/10 bg-[#0d1728] px-4 py-3 text-xs shadow-xl">
      <div className="mb-2 font-medium text-white">{formatDay(day.date)}</div>

      {!day.hasData ? (
        <div className="text-slate-500">No collections data imported</div>
      ) : (
        <div className="space-y-1 text-slate-300">
          <Row label="Successful" value={(day.successful ?? 0).toLocaleString()} colour="#34d399" />
          <Row label="Failed" value={(day.failed ?? 0).toLocaleString()} colour="#fb7185" />
          <Row
            label="Success rate"
            value={day.success_rate !== null ? `${day.success_rate.toFixed(1)}%` : "–"}
          />
          <Row label="Collected" value={formatCurrency(day.collected_value ?? 0)} />
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  colour,
}: {
  label: string;
  value: string;
  colour?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="flex items-center gap-1.5">
        {colour && (
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: colour }}
          />
        )}
        {label}
      </span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

export function MerchantDetailModal({
  businessId,
  businessName,
  periodEnd,
  summary,
  onClose,
}: {
  businessId: string;
  businessName: string;
  // End of the period being viewed (YYYY-MM-DD or ISO).
  periodEnd: string;
  // The merchant's figures for the selected period, if
  // available. Shown under the chart.
  summary?: MerchantSummary | null;
  onClose: () => void;
}) {
  const [range, setRange] = useState<TrendRange>("7d");
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const end = periodEnd.slice(0, 10);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      businessId,
      end,
      range,
    });

    fetch(`/api/collections/merchants/trend?${params}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "Unable to load merchant trend.");
        }

        if (!cancelled) {
          setTrend(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Unable to load merchant trend."
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [businessId, end, range]);

  // Close on Escape.
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const days = trend?.days ?? [];
  const totals = trend?.totals;
  const hasAnyData = days.some((day) => day.hasData);
  const hasActivity = (totals?.attempts ?? 0) > 0;
  const showDots = days.length <= 31;
  const failureReasons = summary?.failure_reasons ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close merchant details"
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${businessName} details`}
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#09111f] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
              Merchant
            </div>

            <h2 className="mt-2 truncate text-xl font-semibold text-white">
              {businessName || trend?.businessName || businessId}
            </h2>

            <div className="mt-1 text-sm text-slate-500">
              Business ID: {businessId}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300 transition hover:bg-white/[0.07]"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Trend */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-sm font-medium text-white">
                  Daily Transactions
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  {trend
                    ? `${formatDay(trend.start)} – ${formatDay(trend.end)} · ends with the selected reporting period`
                    : "Successful and failed transactions per day"}
                </div>
              </div>

              <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRange(option.value)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      range === option.value
                        ? "bg-white/[0.10] text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Range totals */}
            <div
              className={`mt-5 grid grid-cols-2 gap-3 transition-opacity md:grid-cols-4 ${
                loading ? "opacity-40" : ""
              }`}
            >
              <Stat label="Attempts" value={totals ? totals.attempts.toLocaleString() : "…"} />
              <Stat
                label="Success Rate"
                value={totals ? (hasActivity ? `${totals.success_rate.toFixed(2)}%` : "–") : "…"}
              />
              <Stat
                label="Collected"
                value={totals ? formatCurrency(totals.collected_value) : "…"}
              />
              <Stat
                label="Failed Value"
                value={totals ? formatCurrency(totals.failed_value) : "…"}
              />
            </div>

            {/* Chart */}
            <div className={`mt-5 h-[300px] transition-opacity ${loading ? "opacity-40" : ""}`}>
              {error ? (
                <div className="flex h-full items-center justify-center rounded-xl border border-red-400/20 bg-red-400/10 px-4 text-sm text-red-300">
                  {error}
                </div>
              ) : !trend && loading ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Loading…
                </div>
              ) : !hasAnyData ? (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-slate-500">
                  No collections data has been imported for this period.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={days}
                    margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />

                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDay}
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={24}
                    />

                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                    />

                    <Tooltip
                      content={<TrendTooltip />}
                      cursor={{ stroke: "rgba(255,255,255,0.15)", strokeDasharray: "3 3" }}
                    />

                    <Legend
                      verticalAlign="top"
                      align="left"
                      height={28}
                      iconType="plainline"
                      wrapperStyle={{ fontSize: 12, color: "#94a3b8" }}
                    />

                    <Line
                      type="linear"
                      dataKey="successful"
                      name="Successful"
                      stroke="#34d399"
                      strokeWidth={2}
                      dot={showDots ? { r: 2.5 } : false}
                      activeDot={{ r: 4 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />

                    <Line
                      type="linear"
                      dataKey="failed"
                      name="Failed"
                      stroke="#fb7185"
                      strokeWidth={2}
                      dot={showDots ? { r: 2.5 } : false}
                      activeDot={{ r: 4 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {trend && hasAnyData && (
              <p className="mt-3 text-xs leading-5 text-slate-500">
                {trend.coverage.daysWithData} of {trend.coverage.calendarDays} days
                have imported collections data. Gaps mark days with no data imported;
                a zero means data was imported but this merchant had no transactions.
              </p>
            )}
          </div>

          {/* Selected period figures */}
          {summary && (
            <div className="mt-6">
              <div className="text-sm font-medium text-white">
                Selected Reporting Period
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
                <Stat label="Attempts" value={summary.attempts.toLocaleString()} />
                <Stat label="Successful" value={summary.successful.toLocaleString()} />
                <Stat label="Failed" value={summary.failed.toLocaleString()} />
                <Stat label="Success Rate" value={`${summary.success_rate.toFixed(2)}%`} />
                <Stat label="Collected Value" value={formatCurrency(summary.collected_value)} />
                <Stat label="Failed Value" value={formatCurrency(summary.failed_value)} />
              </div>
            </div>
          )}

          {/* Failure reasons */}
          {summary && (
            <div className="mt-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-medium text-white">Failure Reasons</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Breakdown of failed transactions for this merchant in the selected period.
                  </p>
                </div>

                <div className="shrink-0 text-xs text-slate-500">
                  {failureReasons.length} reason{failureReasons.length === 1 ? "" : "s"}
                </div>
              </div>

              {failureReasons.length === 0 ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-5 text-sm text-slate-500">
                  No merchant-specific failure breakdown is available for this period.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {failureReasons.map((reason, index) => (
                    <div
                      key={`${reason.channel}-${reason.clean_reason}-${reason.raw_provider_response}-${index}`}
                      className="rounded-xl border border-white/10 bg-white/[0.025] p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white">
                            {reason.clean_reason}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            Channel: <span className="text-slate-300">{reason.channel}</span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <div className="rounded-lg bg-white/[0.05] px-3 py-1.5 text-xs text-slate-300">
                            {reason.count} failure{reason.count === 1 ? "" : "s"}
                          </div>

                          <div className="rounded-lg bg-white/[0.05] px-3 py-1.5 text-xs text-slate-300">
                            {reason.share_of_merchant_failures.toFixed(1)}%
                          </div>
                        </div>
                      </div>

                      {reason.raw_provider_response && (
                        <div className="mt-4 border-t border-white/[0.06] pt-3">
                          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-600">
                            Raw Provider Response
                          </div>

                          <div className="mt-2 break-words rounded-lg bg-black/20 px-3 py-2.5 text-xs leading-5 text-slate-400">
                            {reason.raw_provider_response}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!summary && (
            <p className="mt-6 text-xs text-slate-500">
              This merchant had no transactions in the selected reporting period, so there are no
              period figures or failure reasons to show.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-2 break-words text-base font-semibold text-white sm:text-lg">{value}</div>
    </div>
  );
}
