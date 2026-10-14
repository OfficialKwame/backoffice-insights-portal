"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { PageShell } from "@/components/PageShell";
import {
  getEmbeddedStyles,
  printReportAsPdf,
} from "@/lib/reports/print-report";

/* ------------------------------------------------------------------
 * Types (mirror src/lib/usage/ussd-summary.ts)
 * ------------------------------------------------------------------ */

type ActivityBucket = {
  key: string;
  sessions: number | null;
  customers: number | null;
  completed: number | null;
};

type FlowStep = {
  key: string;
  label: string;
  sessions: number;
  ofStart: number;
  fromPrevious: number;
};

type FlowSummary = {
  key: string;
  label: string;
  description: string;
  sessions: number;
  completed: number;
  failed: number;
  paymentSuccessRate: number;
  completionRate: number;
  steps: FlowStep[];
  biggestDrop: {
    from: string;
    to: string;
    lost: number;
    rate: number;
  } | null;
};

type FlowDailyCell = {
  date: string;
  completed: number;
  failed: number;
  successRate: number | null;
};

type FlowDailyRow = {
  key: string;
  label: string;
  days: FlowDailyCell[];
  total: Omit<FlowDailyCell, "date">;
};

type UssdSummary = {
  period: {
    start: string | null;
    end: string | null;
  };
  overview: {
    sessions: number;
    customers: number;
    merchants: number;
    requested: number;
    completed: number;
    failed: number;
    noOutcome: number;
    pendingRecent: number;
    paymentSuccessRate: number;
    sessionCompletionRate: number;
    valueCompleted: number;
    averagePayment: number;
    medianPayment: number | null;
    medianSecondsToComplete: number | null;
    medianMinutesToFail: number | null;
  };
  outcomes: {
    key: string;
    label: string;
    sessions: number;
    share: number;
  }[];
  flows: FlowSummary[];
  menuOnly: number;
  flowDaily: FlowDailyRow[];
  networks: {
    name: string;
    completed: number;
    failed: number;
    total: number;
    successRate: number;
  }[];
  failureReasons: {
    reason: string;
    sessions: number;
    share: number;
  }[];
  topMerchants: {
    name: string;
    sessions: number;
    completed: number;
    failed: number;
    value: number;
    paymentSuccessRate: number;
  }[];
  dataCoverage: {
    earliestEvent: string | null;
    latestEvent: string | null;
    activeDays: number;
    calendarDays: number;
    coveragePercent: number;
    days: {
      date: string;
      sessions: number;
      hasData: boolean;
    }[];
    coveredDates: string[];
    missingDates: string[];
    logGaps: {
      from: string;
      to: string;
      minutes: number;
    }[];
    logGapCount: number;
  };
  activity: {
    granularity: "hour" | "day";
    buckets: ActivityBucket[];
  };
};

type SkipReportItem = {
  reason: string;
  label: string;
  count: number;
  examples: { row: number; detail: string }[];
};

type ImportReport = {
  expectedColumns: string[];
  columnsFound: string[];
  skipReport: SkipReportItem[];
};

/* ------------------------------------------------------------------
 * Formatting helpers
 * ------------------------------------------------------------------ */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatReportDate(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.getUTCDate()} ${
    MONTHS[date.getUTCMonth()]
  } ${date.getUTCFullYear()}`;
}

function formatTime(value: string) {
  const date = new Date(value);

  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(
    date.getUTCMinutes()
  ).padStart(2, "0")}`;
}

function formatGhs(value: number) {
  return `GHS ${value.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatGhsCompact(value: number) {
  if (value >= 1_000_000) {
    return `GHS ${(value / 1_000_000).toFixed(2)}m`;
  }

  if (value >= 10_000) {
    return `GHS ${(value / 1_000).toFixed(1)}k`;
  }

  return formatGhs(value);
}

function formatDuration(seconds: number | null) {
  if (seconds === null) {
    return "–";
  }

  if (seconds < 90) {
    return `${Math.round(seconds)}s`;
  }

  return `${(seconds / 60).toFixed(1)} min`;
}

function percentage(value: number, total: number) {
  return total ? (value / total) * 100 : 0;
}

function getWeekRange(value: string) {
  const [yearString, weekString] = value.split("-W");
  const year = Number(yearString);
  const week = Number(weekString);

  if (!year || !week) {
    return null;
  }

  const january4 = new Date(year, 0, 4);
  const january4Day = january4.getDay() || 7;

  const monday = new Date(january4);
  monday.setDate(
    january4.getDate() - january4Day + 1 + (week - 1) * 7
  );

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: formatDateInput(monday),
    end: formatDateInput(sunday),
  };
}


// The "periods with no USSD events" warning. Hidden for
// now; set to true to show it again.
const SHOW_LOG_GAPS = false;

/* ------------------------------------------------------------------
 * Page
 * ------------------------------------------------------------------ */

export default function UssdUsagePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [importing, setImporting] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [importReport, setImportReport] =
    useState<ImportReport | null>(null);

  const [summary, setSummary] = useState<UssdSummary | null>(null);

  const [selectedWeek, setSelectedWeek] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadSummary = useCallback(
    async (start?: string, end?: string) => {
      try {
        setLoadingSummary(true);
        setError("");

        const params = new URLSearchParams();

        if (start) params.set("start", start);
        if (end) params.set("end", end);

        const query = params.toString();

        const response = await fetch(
          `/api/usage/ussd/summary${query ? `?${query}` : ""}`,
          { cache: "no-store" }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error || "Failed to load USSD summary."
          );
        }

        setSummary(data);
      } catch (error) {
        console.error(error);

        setError(
          error instanceof Error
            ? error.message
            : "Couldn't load the USSD summary."
        );
      } finally {
        setLoadingSummary(false);
      }
    },
    []
  );

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setImporting(true);
      setMessage("");
      setError("");
      setImportReport(null);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/usage/ussd/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Failed to import USSD data."
        );
      }

      setMessage(
        `Imported ${data.imported.toLocaleString()} events. ${data.skipped.toLocaleString()} rows skipped. ${data.duplicates.toLocaleString()} duplicates ignored.`
      );

      if (data.skipped > 0) {
        setImportReport({
          expectedColumns: data.expectedColumns ?? [],
          columnsFound: data.columnsFound ?? [],
          skipReport: data.skipReport ?? [],
        });
      }

      await loadSummary(
        startDate || undefined,
        endDate || undefined
      );
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "Couldn't import the USSD data."
      );
    } finally {
      setImporting(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleWeekChange(value: string) {
    setSelectedWeek(value);

    const range = value ? getWeekRange(value) : null;

    if (!range) {
      return;
    }

    setStartDate(range.start);
    setEndDate(range.end);
    loadSummary(range.start, range.end);
  }

  function handleApplyPeriod() {
    if (startDate && endDate && startDate > endDate) {
      setError("Start date must be before end date.");
      return;
    }

    loadSummary(startDate || undefined, endDate || undefined);
  }

  function handleClearPeriod() {
    setSelectedWeek("");
    setStartDate("");
    setEndDate("");
    loadSummary();
  }

  function handleLast7Days() {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);

    const formattedStart = formatDateInput(start);
    const formattedEnd = formatDateInput(end);

    setSelectedWeek("");
    setStartDate(formattedStart);
    setEndDate(formattedEnd);
    loadSummary(formattedStart, formattedEnd);
  }

  // mode "html" downloads the report; "pdf" opens the
  // print dialog to save it as a PDF.
  async function handleExportHtml(mode: "html" | "pdf" = "html") {
    if (!summary) {
      setError("There is no USSD data to export.");
      return;
    }

    const report = document.querySelector(
      "[data-html-report='true']"
    );

    if (!report) {
      setError("Couldn't find the report content to export.");
      return;
    }

    setError("");

    const reportClone = report.cloneNode(true) as HTMLElement;

    reportClone
      .querySelectorAll("[data-export-hide='true']")
      .forEach((element) => element.remove());

    const reportHeader = reportClone.querySelector(
      ".html-report-header"
    ) as HTMLElement | null;

    if (reportHeader) {
      reportHeader.classList.remove("hidden");
      reportHeader.style.display = "block";
    }

    reportClone
      .querySelectorAll(".pdf-expand")
      .forEach((element) => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.maxHeight = "none";
        htmlElement.style.height = "auto";
        htmlElement.style.overflow = "visible";
      });

    reportClone.querySelectorAll("thead").forEach((element) => {
      (element as HTMLElement).style.position = "static";
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>USSD Usage Analysis</title>
  <style>
    ${getEmbeddedStyles(mode === "pdf")}

    html { color-scheme: dark; background: #020617; }

    body {
      margin: 0 !important;
      padding: 40px !important;
      min-height: 100vh;
      background: #020617 !important;
      color: #e2e8f0 !important;
      font-family: Arial, Helvetica, sans-serif;
    }

    .html-report-container { width: 100%; max-width: 1600px; margin: 0 auto; }
    .html-report-header { display: block !important; }
    .html-report-container .pdf-expand { max-height: none !important; height: auto !important; overflow: visible !important; }
    .html-report-container thead { position: static !important; }

    @media (max-width: 900px) { body { padding: 20px !important; } }
  </style>
</head>
<body>
  <main class="html-report-container">
    ${reportClone.outerHTML}
  </main>
</body>
</html>`;

    const blob = new Blob([html], {
      type: "text/html;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    // Name the file after the period actually loaded,
    // not dates typed into the filters but not applied.
    const selectedStart = summary.period.start;
    const selectedEnd = summary.period.end;

    const fileName =
      selectedStart && selectedEnd
        ? `ussd-usage-${selectedStart}-to-${selectedEnd}.html`
        : "ussd-usage-all-available-data.html";

    if (mode === "pdf") {
      URL.revokeObjectURL(url);

      try {
        await printReportAsPdf(html, fileName.replace(/\.html$/, ""));
      } catch (error) {
        console.error(error);
        setError("Couldn't prepare the PDF. Try Export HTML instead.");
      }

      return;
    }

    link.href = url;
    link.download = fileName;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  /* ---------------------------------------------------------------
   * Derived values and insights
   * --------------------------------------------------------------- */

  const overview = summary?.overview;
  const flows = summary?.flows ?? [];
  const networks = summary?.networks ?? [];
  const failureReasons = summary?.failureReasons ?? [];
  const merchants = summary?.topMerchants ?? [];
  const coverage = summary?.dataCoverage;

  const outcomes = (summary?.outcomes ?? []).filter(
    (item) => item.sessions > 0
  );

  const maxOutcome = Math.max(
    ...outcomes.map((item) => item.sessions),
    1
  );

  /*
   * Failure reasons: top 5, with the rest grouped into
   * one "Other reasons" row so the counts still add up.
   */
  const TOP_FAILURE_REASONS = 5;

  const topReasons = failureReasons.slice(0, TOP_FAILURE_REASONS);
  const otherReasons = failureReasons.slice(TOP_FAILURE_REASONS);

  const shownReasons =
    otherReasons.length > 0
      ? [
          ...topReasons,
          {
            reason: `Other reasons (${otherReasons.length})`,
            sessions: otherReasons.reduce(
              (total, item) => total + item.sessions,
              0
            ),
            share: otherReasons.reduce(
              (total, item) => total + item.share,
              0
            ),
          },
        ]
      : topReasons;

  const maxReason = Math.max(
    ...shownReasons.map((item) => item.sessions),
    1
  );

  const hasData = !!overview && overview.sessions > 0;

  const overviewInsight = (() => {
    if (!overview || !hasData) {
      return "There is not enough USSD data in this period to generate an insight.";
    }

    let insight =
      `${overview.customers.toLocaleString()} customers started ` +
      `${overview.sessions.toLocaleString()} USSD sessions across ` +
      `${overview.merchants.toLocaleString()} merchants. ` +
      `${overview.completed.toLocaleString()} ended in a completed payment ` +
      `(${overview.sessionCompletionRate.toFixed(1)}% of sessions), worth ` +
      `${formatGhs(overview.valueCompleted)}.`;

    if (overview.completed + overview.failed > 0) {
      insight +=
        ` Of sessions that got a payment result, ` +
        `${overview.paymentSuccessRate.toFixed(1)}% succeeded.`;
    }

    return insight;
  })();

  const outcomeInsight = (() => {
    if (!overview || !hasData) {
      return "No sessions in this period.";
    }

    const menu = summary!.outcomes.find(
      (item) => item.key === "left_at_menu"
    );

    let insight = "";

    if (menu && menu.sessions > 0) {
      insight +=
        `${menu.share.toFixed(1)}% of sessions ended at the menu, ` +
        `before a flow was chosen. `;
    }

    insight +=
      `${overview.failed.toLocaleString()} sessions reached a payment request ` +
      `and were unsuccessful.`;

    if (overview.pendingRecent > 0) {
      insight +=
        ` ${overview.pendingRecent.toLocaleString()} of the ` +
        `${overview.noOutcome.toLocaleString()} sessions with no outcome yet ` +
        `were requested in the last 20 minutes of the data and may still ` +
        `receive a callback.`;
    }

    return insight;
  })();

  const flowInsight = (() => {
    const active = flows.filter((flow) => flow.sessions > 0);

    if (active.length === 0) {
      return "No flow activity in this period.";
    }

    const main = [...active].sort(
      (a, b) => b.sessions - a.sessions
    )[0];

    const weakest = [...active]
      .filter((flow) => flow.sessions >= 30)
      .sort((a, b) => a.completionRate - b.completionRate)[0];

    let insight =
      `${main.label} carries ${percentage(
        main.sessions,
        active.reduce((total, flow) => total + flow.sessions, 0)
      ).toFixed(1)}% of sessions that chose a flow.`;

    if (weakest && weakest.key !== main.key) {
      insight +=
        ` ${weakest.label} has the lowest completion rate at ` +
        `${weakest.completionRate.toFixed(1)}%`;

      if (weakest.biggestDrop) {
        insight +=
          `, with its biggest loss between ` +
          `${weakest.biggestDrop.from.toLowerCase()} and ` +
          `${weakest.biggestDrop.to.toLowerCase()} ` +
          `(${weakest.biggestDrop.rate.toFixed(1)}% of sessions lost)`;
      }

      insight += ".";
    }

    insight +=
      " Step counts are sessions, so a customer repeating a step is only counted once.";

    return insight;
  })();

  const networkInsight = (() => {
    if (networks.length === 0 || !overview) {
      return "No payment results in this period.";
    }

    const main = networks[0];
    const top = failureReasons[0];

    let insight =
      `${main.name} handles ${percentage(
        main.total,
        networks.reduce((total, item) => total + item.total, 0)
      ).toFixed(1)}% of payment results, with a ` +
      `${main.successRate.toFixed(1)}% success rate.`;

    const lowest = [...networks]
      .filter((item) => item.total >= 30)
      .sort((a, b) => a.successRate - b.successRate)[0];

    if (lowest && lowest.name !== main.name) {
      insight +=
        ` ${lowest.name} is lowest at ${lowest.successRate.toFixed(1)}%.`;
    }

    if (top) {
      insight +=
        ` The most common failure reason is "${top.reason}" ` +
        `(${top.share.toFixed(1)}% of failures).`;
    }

    if (overview.medianMinutesToFail !== null) {
      insight +=
        ` Failures arrive a median of ` +
        `${overview.medianMinutesToFail.toFixed(1)} minutes after the payment ` +
        `request, compared with ${formatDuration(
          overview.medianSecondsToComplete
        )} for completions.`;
    }

    return insight;
  })();

  const reportPeriodLabel =
    summary?.period.start && summary?.period.end
      ? `${formatReportDate(summary.period.start)} - ${formatReportDate(
          summary.period.end
        )}`
      : "All available data";

  const generatedDate = formatReportDate(
    new Date().toISOString()
  );

  /* ---------------------------------------------------------------
   * Render
   * --------------------------------------------------------------- */

  return (
    <PageShell
      title="USSD Usage"
      description="Analyse how merchants' customers pay through USSD: which flows they use, where sessions end, and why payments fail."
    >
      <div data-html-report="true" className="pdf-report space-y-6">
        {/* Report header (export only) */}
        <div className="html-report-header hidden print:block">
          <div className="border-b border-white/[0.10] pb-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Usage Analysis
            </div>

            <h1 className="mt-2 text-2xl font-semibold text-white">
              USSD Usage Analysis
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-400">
              <div>
                <span className="text-slate-500">Reporting Period:</span>{" "}
                {reportPeriodLabel}
              </div>

              <div>
                <span className="text-slate-500">Data Source:</span>{" "}
                Datadog (PosUssd)
              </div>

              <div>
                <span className="text-slate-500">Generated:</span>{" "}
                {generatedDate}
              </div>
            </div>
          </div>
        </div>

        {/* Product tabs */}
        <div
          data-export-hide="true"
          className="print:hidden flex items-center gap-2 border-b border-white/[0.08] pb-4"
        >
          <Link
            href="/usage/backoffice-app"
            className="rounded-lg px-4 py-2 text-sm text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
          >
            BackOffice App
          </Link>

          <Link
            href="/usage/ussd"
            className="rounded-lg bg-white/[0.08] px-4 py-2 text-sm font-medium text-white"
          >
            USSD
          </Link>
        </div>

        {/* Dataset */}
        <div
          data-export-hide="true"
          className="print:hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-white">
                USSD dataset
              </div>

              <p className="mt-1 text-sm text-slate-400">
                Import the raw PosUssd log export from Datadog as CSV, with the Content column included.
              </p>
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileChange}
              />

              <button
                type="button"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importing ? "Importing..." : "Import USSD Data"}
              </button>
            </div>
          </div>

          {message && (
            <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              {message}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {importReport && (
            <ImportSkipReport
              report={importReport}
              onClose={() => setImportReport(null)}
            />
          )}
        </div>

        {/* Reporting period */}
        <div
          data-export-hide="true"
          className="print:hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"
        >
          <div className="flex flex-wrap items-end gap-4">
            <DateField label="Week">
              <input
                type="week"
                value={selectedWeek}
                onChange={(event) =>
                  handleWeekChange(event.target.value)
                }
                className="rounded-xl border border-white/[0.08] bg-slate-950 px-4 py-2.5 text-sm text-white outline-none"
              />
            </DateField>

            <DateField label="Start Date">
              <input
                type="date"
                value={startDate}
                onChange={(event) => {
                  setSelectedWeek("");
                  setStartDate(event.target.value);
                }}
                className="rounded-xl border border-white/[0.08] bg-slate-950 px-4 py-2.5 text-sm text-white outline-none"
              />
            </DateField>

            <DateField label="End Date">
              <input
                type="date"
                value={endDate}
                onChange={(event) => {
                  setSelectedWeek("");
                  setEndDate(event.target.value);
                }}
                className="rounded-xl border border-white/[0.08] bg-slate-950 px-4 py-2.5 text-sm text-white outline-none"
              />
            </DateField>

            <button
              type="button"
              onClick={handleApplyPeriod}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-200"
            >
              Apply
            </button>

            <button
              type="button"
              onClick={handleLast7Days}
              className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.07]"
            >
              Last 7 Days
            </button>

            <button
              type="button"
              onClick={handleClearPeriod}
              className="rounded-xl px-4 py-2.5 text-sm text-slate-400 hover:text-white"
            >
              All Data
            </button>

            <button
              type="button"
              onClick={() => handleExportHtml("html")}
              disabled={loadingSummary || !summary}
              className="rounded-xl border border-indigo-400/20 bg-indigo-400/10 px-4 py-2.5 text-sm font-semibold text-indigo-200 transition hover:bg-indigo-400/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Export HTML
            </button>

            <button
              type="button"
              onClick={() => handleExportHtml("pdf")}
              disabled={loadingSummary || !summary}
              title="Opens the print dialog. Choose Save as PDF."
              className="rounded-xl border border-indigo-400/20 bg-indigo-400/10 px-4 py-2.5 text-sm font-semibold text-indigo-200 transition hover:bg-indigo-400/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Export PDF
            </button>
          </div>

          {coverage?.earliestEvent && coverage.latestEvent && (
            <div className="mt-4 text-xs leading-5 text-slate-500">
              <div>
                Recorded events in this view:{" "}
                {formatReportDate(coverage.earliestEvent)}{" "}
                {formatTime(coverage.earliestEvent)} to{" "}
                {formatReportDate(coverage.latestEvent)}{" "}
                {formatTime(coverage.latestEvent)} (UTC)
              </div>

              <div>
                Sessions exist on {coverage.activeDays.toLocaleString()} calendar{" "}
                {coverage.activeDays === 1 ? "day" : "days"} within this range.
              </div>

              <div>
                This reflects records currently available in Datadog and does not imply continuous historical coverage.
              </div>
            </div>
          )}
        </div>

        {/* Data coverage (same as the Collections page) */}
        {coverage && coverage.calendarDays > 0 && (
          <DataCoverageCard
            days={coverage.days.map((day) => ({
              date: day.date,
              hasData: day.hasData,
              detail: day.hasData
                ? `${day.sessions.toLocaleString()} sessions`
                : undefined,
            }))}
          />
        )}

        {/* Logging gaps */}
        {SHOW_LOG_GAPS && coverage && coverage.logGapCount > 0 && (
          <div className="pdf-card rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-5">
            <div className="text-sm font-medium text-amber-200">
              {coverage.logGapCount === 1
                ? "1 period with no USSD events"
                : `${coverage.logGapCount} periods with no USSD events`}
            </div>

            <p className="mt-1 text-xs leading-5 text-slate-400">
              No events were logged for 15 minutes or more. Overnight quiet periods stay under 10 minutes, so these usually mean logging or the USSD service stopped. The logs alone cannot tell which, so check transactions for the same window.
            </p>

            <ul className="mt-3 space-y-1 text-xs text-slate-300">
              {coverage.logGaps.map((gap) => (
                <li key={gap.from}>
                  {formatReportDate(gap.from)}, {formatTime(gap.from)} to{" "}
                  {formatTime(gap.to)} UTC ({gap.minutes} min)
                </li>
              ))}
            </ul>

            {coverage.logGapCount > coverage.logGaps.length && (
              <p className="mt-2 text-xs text-slate-500">
                Showing the latest {coverage.logGaps.length}.
              </p>
            )}
          </div>
        )}

        {/* Overview */}
        <section className="pdf-page-first">
          <SectionHeading
            title="Overview"
            description="Sessions, customers and payment results for the selected period. A session is one USSD dial, grouped by its trace ID."
          />

          <div className="pdf-overview-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Sessions"
              value={loadingSummary ? "..." : (overview?.sessions ?? 0).toLocaleString()}
              note={
                overview
                  ? `${overview.requested.toLocaleString()} reached a payment request`
                  : undefined
              }
            />

            <MetricCard
              label="Customers"
              value={loadingSummary ? "..." : (overview?.customers ?? 0).toLocaleString()}
              note={
                overview
                  ? `Across ${overview.merchants.toLocaleString()} merchants`
                  : undefined
              }
            />

            <MetricCard
              label="Completed Payments"
              value={loadingSummary ? "..." : (overview?.completed ?? 0).toLocaleString()}
              note={
                overview
                  ? `${overview.sessionCompletionRate.toFixed(1)}% of sessions`
                  : undefined
              }
            />

            <MetricCard
              label="Payment Success Rate"
              value={
                loadingSummary
                  ? "..."
                  : `${(overview?.paymentSuccessRate ?? 0).toFixed(1)}%`
              }
              note="Completed ÷ (completed + unsuccessful)"
            />

            <MetricCard
              label="Value Collected"
              value={
                loadingSummary
                  ? "..."
                  : formatGhsCompact(overview?.valueCompleted ?? 0)
              }
              note="Completed payments, excluding charges"
            />

            <MetricCard
              label="Typical Payment"
              value={
                loadingSummary
                  ? "..."
                  : overview?.medianPayment != null
                    ? formatGhs(overview.medianPayment)
                    : "–"
              }
              note={
                overview && overview.completed > 0
                  ? `Median. Average is ${formatGhs(overview.averagePayment)}, pulled up by large payments`
                  : "Median completed payment"
              }
            />

            <MetricCard
              label="Time to Complete"
              value={
                loadingSummary
                  ? "..."
                  : formatDuration(overview?.medianSecondsToComplete ?? null)
              }
              note="Median, payment request to completion"
            />

            <MetricCard
              label="Time to Failure"
              value={
                loadingSummary
                  ? "..."
                  : overview?.medianMinutesToFail != null
                    ? `${overview.medianMinutesToFail.toFixed(1)} min`
                    : "–"
              }
              note="Median, payment request to failure callback"
            />
          </div>

          {summary && (
            <div className="mt-4">
              <UssdTrendCard reportActivity={summary.activity} />
            </div>
          )}

          <InsightBox>{overviewInsight}</InsightBox>
        </section>

        {/* Session outcomes */}
        <section className="pdf-page">
          <SectionHeading
            title="Session Outcomes"
            description="Where each USSD session ended."
          />

          <AnalysisCard
            title="How sessions ended"
            description="Each session is counted once, at the furthest point it reached."
          >
            {outcomes.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="space-y-5">
                {outcomes.map((item) => (
                  <BarRow
                    key={item.key}
                    label={item.label}
                    value={`${item.sessions.toLocaleString()} · ${item.share.toFixed(1)}%`}
                    width={percentage(item.sessions, maxOutcome)}
                    tone={
                      item.key === "completed"
                        ? "good"
                        : item.key === "failed"
                          ? "bad"
                          : "neutral"
                    }
                  />
                ))}
              </div>
            )}
          </AnalysisCard>

          <InsightBox>{outcomeInsight}</InsightBox>
        </section>

        {/* Flows */}
        <section className="pdf-page">
          <SectionHeading
            title="Payment Flows"
            description="Session-level funnels for each USSD flow. Percentages show the share of sessions that moved on from the previous step."
          />

          <div className="pdf-journey-grid grid gap-5 xl:grid-cols-3">
            {flows.map((flow) => (
              <FlowCard key={flow.key} flow={flow} />
            ))}
          </div>

          {summary && summary.menuOnly > 0 && (
            <p className="mt-4 text-xs leading-5 text-slate-500">
              {summary.menuOnly.toLocaleString()} sessions ended before a flow was chosen and are not included in these funnels.
            </p>
          )}

          <InsightBox>{flowInsight}</InsightBox>
        </section>

        {/* Daily success rate by flow */}
        <section className="pdf-page">
          <SectionHeading
            title="Daily Success Rate by Flow"
            description="Payment success rate for each USSD flow, day by day. Completed ÷ (completed + unsuccessful), counted on the day the session started."
          />

          <FlowDailyTable rows={summary?.flowDaily ?? []} />
        </section>

        {/* Networks and failures */}
        <section className="pdf-page">
          <SectionHeading
            title="Networks & Failures"
            description="Payment results by mobile money network, and the reasons providers gave for failures."
          />

          <div className="pdf-two-column grid gap-5 xl:grid-cols-2">
            <AnalysisCard
              title="Success rate by network"
              description="Sessions with a payment result, grouped by the network on the callback."
            >
              {networks.length === 0 ? (
                <EmptyState />
              ) : (
                <SimpleTable
                  headers={["Network", "Completed", "Unsuccessful", "Success"]}
                  rows={networks.map((item) => [
                    item.name,
                    item.completed.toLocaleString(),
                    item.failed.toLocaleString(),
                    `${item.successRate.toFixed(1)}%`,
                  ])}
                />
              )}

              <p className="mt-4 text-xs leading-5 text-slate-500">
                Datadog channel names are grouped: vodafone channels as Telecel, tigo and airtel as AT.
              </p>
            </AnalysisCard>

            <AnalysisCard
              title="Failure reasons"
              description="Top 5 reasons reported by the provider on the failure callback."
            >
              {failureReasons.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-5">
                  {shownReasons.map((item) => (
                    <BarRow
                      key={item.reason}
                      label={item.reason}
                      value={`${item.sessions.toLocaleString()} · ${item.share.toFixed(1)}%`}
                      width={percentage(item.sessions, maxReason)}
                      tone="bad"
                    />
                  ))}
                </div>
              )}
            </AnalysisCard>
          </div>

          <InsightBox>{networkInsight}</InsightBox>
        </section>

        {/* Merchants */}
        <section className="pdf-page">
          <SectionHeading
            title="Top Merchants"
            description="The 10 merchants with the most completed USSD payments in this period."
          />

          <AnalysisCard
            title="Merchants by completed payments"
            description="Value excludes charges."
          >
            {merchants.length === 0 ? (
              <EmptyState />
            ) : (
              <SimpleTable
                headers={[
                  "Merchant",
                  "Sessions",
                  "Completed",
                  "Success",
                  "Value",
                ]}
                rows={merchants.map((item) => [
                  item.name,
                  item.sessions.toLocaleString(),
                  item.completed.toLocaleString(),
                  `${item.paymentSuccessRate.toFixed(1)}%`,
                  formatGhs(item.value),
                ])}
              />
            )}
          </AnalysisCard>
        </section>
      </div>
    </PageShell>
  );
}

/* ------------------------------------------------------------------
 * Trend card with its own range filter
 * ------------------------------------------------------------------ */

type TrendRange = "report" | "7d" | "1m" | "3m" | "6m" | "12m";

const TREND_RANGES: { value: TrendRange; label: string }[] = [
  { value: "report", label: "Selected period" },
  { value: "7d", label: "Past week" },
  { value: "1m", label: "1 month" },
  { value: "3m", label: "3 months" },
  { value: "6m", label: "6 months" },
  { value: "12m", label: "12 months" },
];

// Ranges end today (UTC) and include today.
function getTrendRange(range: TrendRange) {
  const end = new Date();
  const start = new Date(end);

  if (range === "7d") {
    start.setUTCDate(start.getUTCDate() - 6);
  } else {
    const months =
      range === "1m" ? 1 : range === "3m" ? 3 : range === "6m" ? 6 : 12;

    start.setUTCMonth(start.getUTCMonth() - months);
    start.setUTCDate(start.getUTCDate() + 1);
  }

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function UssdTrendCard({
  reportActivity,
}: {
  reportActivity: UssdSummary["activity"];
}) {
  const [range, setRange] = useState<TrendRange>("report");
  const [rangeActivity, setRangeActivity] =
    useState<UssdSummary["activity"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (range === "report") {
      setRangeActivity(null);
      setError("");
      return;
    }

    let cancelled = false;
    const { start, end } = getTrendRange(range);

    setLoading(true);
    setError("");

    fetch(`/api/usage/ussd/summary?start=${start}&end=${end}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "Failed to load trend data.");
        }

        if (!cancelled) {
          setRangeActivity(data.activity);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setError(
            error instanceof Error
              ? error.message
              : "Couldn't load trend data."
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

    // reportActivity changes after an import or a page
    // filter change, so the chosen range refreshes too.
  }, [range, reportActivity]);

  const activity =
    range === "report" ? reportActivity : rangeActivity;

  const buckets = activity?.buckets ?? [];

  const hasChart =
    buckets.length >= 2 &&
    buckets.some((item) => item.sessions !== null);

  const rangeLabel =
    range === "report"
      ? null
      : (() => {
          const { start, end } = getTrendRange(range);
          return `${formatReportDate(start)} - ${formatReportDate(end)}`;
        })();

  return (
    <div className="pdf-card rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">
            Sessions, Customers &amp; Completed Payments
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-400">
            {activity?.granularity === "hour" ? "Per hour" : "Per day"}, by session start time (UTC).
            {rangeLabel && (
              <span className="text-slate-500"> · {rangeLabel}</span>
            )}
          </p>
        </div>

        <div
          data-export-hide="true"
          className="flex flex-wrap items-center gap-1 rounded-xl border border-white/[0.08] bg-slate-950/40 p-1"
        >
          {TREND_RANGES.map((option) => (
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

      <div className={`mt-6 transition-opacity ${loading ? "opacity-40" : ""}`}>
        {error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : hasChart && activity ? (
          <UssdTrendChart
            data={buckets}
            granularity={activity.granularity}
          />
        ) : loading ? (
          <div className="px-4 py-16 text-center text-sm text-slate-500">
            Loading...
          </div>
        ) : (
          <EmptyState />
        )}
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Customers are unique per {activity?.granularity === "hour" ? "hour" : "day"}, so they will not add up to the period total. Gaps mark times with no records in the imported Datadog data.
      </p>
    </div>
  );
}

function niceMax(value: number) {
  if (value <= 0) {
    return 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;

  const nice =
    normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;

  return nice * magnitude;
}

// Bucket keys are "YYYY-MM-DD" (day) or "YYYY-MM-DDTHH" (hour).
function bucketDate(key: string) {
  const [date] = key.split("T");
  const [, month, day] = date.split("-");

  return `${Number(day)} ${MONTHS[Number(month) - 1]}`;
}

function bucketHour(key: string) {
  const hour = key.split("T")[1];
  return hour ? `${hour}:00` : "";
}

function UssdTrendChart({
  data,
  granularity,
}: {
  data: ActivityBucket[];
  granularity: "hour" | "day";
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(800);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Render at the container's real pixel width so text
  // and lines never scale up on wide screens.
  useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return;
    }

    const update = () =>
      setWidth(Math.max(element.clientWidth, 320));

    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const height = 240;
  const pad = { top: 12, right: 12, bottom: 28, left: 40 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;

  const series = [
    { key: "sessions" as const, name: "Sessions", color: "#818cf8" },
    { key: "customers" as const, name: "Customers", color: "#2dd4bf" },
    { key: "completed" as const, name: "Completed", color: "#fbbf24" },
  ];

  const values = data
    .flatMap((item) => series.map((line) => item[line.key]))
    .filter((value): value is number => value !== null);

  const yMax = niceMax(Math.max(...values, 1));

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) =>
    Math.round(yMax * fraction)
  );

  const lastIndex = data.length - 1;

  const x = (index: number) =>
    pad.left + (index / Math.max(lastIndex, 1)) * innerWidth;

  const y = (value: number) =>
    pad.top + innerHeight - (value / yMax) * innerHeight;

  const axisLabel = (index: number) => {
    const key = data[index].key;

    if (granularity === "day") {
      return bucketDate(key);
    }

    // Hourly: show the date at midnight and at the start.
    return index === 0 || key.endsWith("T00")
      ? `${bucketDate(key)} ${bucketHour(key)}`
      : bucketHour(key);
  };

  const tooltipLabel = (key: string) =>
    granularity === "day"
      ? bucketDate(key)
      : `${bucketDate(key)}, ${bucketHour(key)}`;

  const maxLabels = Math.max(2, Math.floor(innerWidth / 90));
  const labelEvery = Math.max(1, Math.ceil(data.length / maxLabels));

  const labelIndexes = data
    .map((_, index) => index)
    .filter((index) => index % labelEvery === 0);

  if (
    lastIndex > 0 &&
    !labelIndexes.includes(lastIndex) &&
    lastIndex - labelIndexes[labelIndexes.length - 1] >= labelEvery / 2
  ) {
    labelIndexes.push(lastIndex);
  }

  const showAllDots = data.length <= 31;

  // Split each line at null buckets so gaps stay visible.
  const buildPaths = (key: (typeof series)[number]["key"]) => {
    const paths: string[] = [];
    let current = "";

    data.forEach((item, index) => {
      const value = item[key];

      if (value === null) {
        if (current) paths.push(current);
        current = "";
        return;
      }

      current += `${current ? "L" : "M"}${x(index)},${y(value)} `;
    });

    if (current) paths.push(current);

    return paths;
  };

  const isIsolated = (index: number) =>
    data[index].sessions !== null &&
    (index === 0 || data[index - 1].sessions === null) &&
    (index === lastIndex || data[index + 1].sessions === null);

  function handleMouseMove(event: React.MouseEvent<SVGRectElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - bounds.left) / bounds.width;
    const index = Math.round(ratio * lastIndex);

    setHoverIndex(Math.min(Math.max(index, 0), lastIndex));
  }

  const hovered = hoverIndex !== null ? data[hoverIndex] : null;

  const tooltipLeft =
    hoverIndex !== null
      ? Math.min(Math.max(x(hoverIndex), 80), width - 80)
      : 0;

  return (
    <div>
      <div className="mb-3 flex items-center gap-5 text-xs text-slate-400">
        {series.map((line) => (
          <div key={line.key} className="flex items-center gap-2">
            <span
              className="inline-block h-0.5 w-4 rounded-full"
              style={{ backgroundColor: line.color }}
            />
            {line.name}
          </div>
        ))}
      </div>

      <div ref={containerRef} className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="block h-auto w-full"
          role="img"
          aria-label="USSD sessions, customers and completed payments over time"
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="rgba(255,255,255,0.06)"
              />
              <text
                x={pad.left - 8}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="11"
                fill="#64748b"
              >
                {tick.toLocaleString()}
              </text>
            </g>
          ))}

          {labelIndexes.map((index) => (
            <text
              key={data[index].key}
              x={x(index)}
              y={height - 8}
              textAnchor={
                index === 0 ? "start" : index === lastIndex ? "end" : "middle"
              }
              fontSize="11"
              fill="#64748b"
            >
              {axisLabel(index)}
            </text>
          ))}

          {hoverIndex !== null && (
            <line
              x1={x(hoverIndex)}
              x2={x(hoverIndex)}
              y1={pad.top}
              y2={pad.top + innerHeight}
              stroke="rgba(255,255,255,0.15)"
              strokeDasharray="3 3"
            />
          )}

          {series.map((line) =>
            buildPaths(line.key).map((path, index) => (
              <path
                key={`${line.key}-${index}`}
                d={path}
                fill="none"
                stroke={line.color}
                strokeWidth="1.75"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))
          )}

          {series.map((line) =>
            data.map((item, index) => {
              const value = item[line.key];

              if (value === null) {
                return null;
              }

              const isHovered = index === hoverIndex;

              if (!showAllDots && !isHovered && !isIsolated(index)) {
                return null;
              }

              return (
                <circle
                  key={`${line.key}-${item.key}`}
                  cx={x(index)}
                  cy={y(value)}
                  r={isHovered ? 4 : 2.5}
                  fill={isHovered ? line.color : "#020617"}
                  stroke={line.color}
                  strokeWidth="1.5"
                />
              );
            })
          )}

          <rect
            x={pad.left}
            y={pad.top}
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverIndex(null)}
          />
        </svg>

        {hovered && (
          <div
            data-export-hide="true"
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-white/[0.10] bg-slate-950/95 px-3 py-2 text-xs shadow-lg"
            style={{ left: tooltipLeft }}
          >
            <div className="mb-1 font-medium text-white">
              {tooltipLabel(hovered.key)}
            </div>

            {hovered.sessions === null ? (
              <div className="text-slate-500">No records</div>
            ) : (
              series.map((line) => (
                <div
                  key={line.key}
                  className="flex items-center justify-between gap-4 text-slate-300"
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: line.color }}
                    />
                    {line.name}
                  </span>

                  <span className="font-semibold text-white">
                    {(hovered[line.key] ?? 0).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
 * Flow card
 * ------------------------------------------------------------------ */

function FlowCard({ flow }: { flow: FlowSummary }) {
  return (
    <div className="pdf-card flex h-full flex-col rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">
            {flow.label}
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-400">
            {flow.description}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-2xl font-semibold text-white">
            {flow.completionRate.toFixed(1)}%
          </div>

          <div className="text-xs text-slate-500">completed</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <MiniStat label="Sessions" value={flow.sessions.toLocaleString()} />
        <MiniStat label="Completed" value={flow.completed.toLocaleString()} />
        <MiniStat
          label="Pay success"
          value={`${flow.paymentSuccessRate.toFixed(1)}%`}
        />
      </div>

      {flow.sessions === 0 ? (
        <div className="mt-5">
          <EmptyState />
        </div>
      ) : (
        <ol className="mt-5 space-y-4">
          {flow.steps.map((step, index) => {
            const isFinal = index === flow.steps.length - 1;
            const isDrop =
              flow.biggestDrop?.to === step.label && index > 0;

            return (
              <li key={step.key}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 text-slate-200">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        isFinal
                          ? "bg-emerald-400 text-emerald-950"
                          : "bg-indigo-400/15 text-indigo-200"
                      }`}
                    >
                      {index + 1}
                    </span>
                    {step.label}
                  </span>

                  <span className="font-semibold text-white">
                    {step.sessions.toLocaleString()}
                  </span>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full ${
                      isFinal ? "bg-emerald-400/80" : "bg-indigo-300/70"
                    }`}
                    style={{ width: `${Math.min(step.ofStart, 100)}%` }}
                  />
                </div>

                {index > 0 && (
                  <div
                    className={`mt-1 text-xs ${
                      isDrop ? "text-amber-300" : "text-slate-500"
                    }`}
                  >
                    {step.fromPrevious.toFixed(1)}% from previous step
                    {isDrop && " · biggest loss"}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
 * Data coverage (matches the Collections page)
 *
 * Short periods show a chip per day. Long periods show a
 * compact calendar: one row per month, one square per day.
 * ------------------------------------------------------------------ */

type CoverageDay = {
  date: string; // YYYY-MM-DD
  hasData: boolean;
  detail?: string;
};

const COVERAGE_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const COVERAGE_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function coverageDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

// "Mon, 28 Sep", read in UTC so the day never shifts.
function formatCoverageDate(value: string) {
  const date = coverageDate(value);

  return `${COVERAGE_WEEKDAYS[date.getUTCDay()]}, ${String(
    date.getUTCDate()
  ).padStart(2, "0")} ${COVERAGE_MONTHS[date.getUTCMonth()]}`;
}

function formatCoverageDay(value: string) {
  const date = coverageDate(value);
  return `${date.getUTCDate()} ${COVERAGE_MONTHS[date.getUTCMonth()]}`;
}

// Groups consecutive missing days: "3–9 Apr", "12 Apr",
// "28 Apr – 2 May".
function missingRanges(days: CoverageDay[]) {
  const ranges: { from: string; to: string; count: number }[] = [];

  for (const day of days) {
    if (day.hasData) continue;

    const last = ranges[ranges.length - 1];
    const previous = last ? coverageDate(last.to) : null;

    if (
      previous &&
      coverageDate(day.date).getTime() - previous.getTime() ===
        86400000
    ) {
      last.to = day.date;
      last.count += 1;
    } else {
      ranges.push({ from: day.date, to: day.date, count: 1 });
    }
  }

  return ranges.map((range) => {
    if (range.from === range.to) {
      return formatCoverageDay(range.from);
    }

    const from = coverageDate(range.from);
    const to = coverageDate(range.to);

    return from.getUTCMonth() === to.getUTCMonth()
      ? `${from.getUTCDate()}–${formatCoverageDay(range.to)}`
      : `${formatCoverageDay(range.from)} – ${formatCoverageDay(range.to)}`;
  });
}

// Up to this many days, show one chip per day.
const MAX_DAY_CHIPS = 31;

const MAX_MISSING_RANGES = 12;

function DataCoverageCard({ days }: { days: CoverageDay[] }) {
  const covered = days.filter((day) => day.hasData).length;

  const coveragePercent =
    days.length > 0
      ? Math.round((covered / days.length) * 1000) / 10
      : 0;

  const ranges = missingRanges(days);

  // Group by month for the calendar view.
  const months: { key: string; label: string; days: CoverageDay[] }[] = [];

  for (const day of days) {
    const key = day.date.slice(0, 7);
    let month = months[months.length - 1];

    if (!month || month.key !== key) {
      const date = coverageDate(day.date);

      month = {
        key,
        label: `${COVERAGE_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`,
        days: [],
      };

      months.push(month);
    }

    month.days.push(day);
  }

  return (
    <div className="pdf-card rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <div className="flex flex-col gap-4">
        <div>
          <div className="text-sm font-medium text-white">
            Data Coverage
          </div>

          <div className="mt-1 text-xs text-slate-500">
            {covered} of {days.length} days have data
            {" · "}
            {coveragePercent}% coverage
          </div>
        </div>

        {days.length <= MAX_DAY_CHIPS ? (
          <div className="flex flex-wrap gap-2">
            {days.map((day) =>
              day.hasData ? (
                <div
                  key={day.date}
                  title={day.detail}
                  className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300"
                >
                  {formatCoverageDate(day.date)} ✓
                </div>
              ) : (
                <div
                  key={day.date}
                  title="No records in the imported Datadog data"
                  className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-300"
                >
                  {formatCoverageDate(day.date)} —
                </div>
              )
            )}
          </div>
        ) : (
          <div className="space-y-2 overflow-x-auto pb-1">
            {months.map((month) => {
              // Offset the first row so days line up by date.
              const firstDay = coverageDate(month.days[0].date).getUTCDate();

              return (
                <div key={month.key} className="flex items-center gap-3">
                  <div className="w-20 shrink-0 text-xs text-slate-500">
                    {month.label}
                  </div>

                  <div className="flex gap-[3px]">
                    {Array.from({ length: firstDay - 1 }).map((_, index) => (
                      <div key={`pad-${index}`} className="h-3.5 w-3.5" />
                    ))}

                    {month.days.map((day) => (
                      <div
                        key={day.date}
                        title={`${formatCoverageDate(day.date)}: ${
                          day.hasData
                            ? day.detail ?? "has data"
                            : "no records"
                        }`}
                        className={`h-3.5 w-3.5 rounded-[3px] border ${
                          day.hasData
                            ? "border-emerald-400/40 bg-emerald-400/60"
                            : "border-amber-400/25 bg-amber-400/10"
                        }`}
                      />
                    ))}
                  </div>

                  <div className="text-xs text-slate-600">
                    {month.days.filter((day) => day.hasData).length}/
                    {month.days.length}
                  </div>
                </div>
              );
            })}

            <div className="flex items-center gap-4 pt-1 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-emerald-400/60" />
                Has data
              </span>

              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-[2px] border border-amber-400/25 bg-amber-400/10" />
                No records
              </span>
            </div>
          </div>
        )}

        {ranges.length > 0 && (
          <div className="text-xs leading-5 text-slate-500">
            Missing data:{" "}
            <span className="text-slate-300">
              {ranges.slice(-MAX_MISSING_RANGES).join(", ")}
            </span>
            {ranges.length > MAX_MISSING_RANGES && (
              <span>
                {" "}
                (latest {MAX_MISSING_RANGES} of {ranges.length} gaps shown)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
 * Daily success rate by flow
 * ------------------------------------------------------------------ */

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];

// Above this, a column per day no longer fits.
const MAX_DAILY_COLUMNS = 14;

// Rates from fewer payments than this are dimmed.
const LOW_VOLUME = 30;

function FlowDailyTable({ rows }: { rows: FlowDailyRow[] }) {
  const days = rows[0]?.days ?? [];

  if (days.length === 0) {
    return <EmptyState />;
  }

  if (days.length > MAX_DAILY_COLUMNS) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.08] px-4 py-8 text-center text-sm text-slate-500">
        Select a period of up to {MAX_DAILY_COLUMNS} days (e.g. a week) to see the daily breakdown.
      </div>
    );
  }

  // Weekday names for a week or less, dates for longer.
  const useWeekdays = days.length <= 7;

  const heading = (date: string) => {
    const value = new Date(`${date}T00:00:00.000Z`);

    return useWeekdays
      ? DAY_NAMES[value.getUTCDay()]
      : `${value.getUTCDate()} ${MONTHS[value.getUTCMonth()]}`;
  };

  const cell = (
    item: Omit<FlowDailyCell, "date">,
    key: string,
    bold = false
  ) => {
    const results = item.completed + item.failed;
    const low = results > 0 && results < LOW_VOLUME;

    return (
      <td
        key={key}
        title={
          results > 0
            ? `${item.completed.toLocaleString()} completed · ${item.failed.toLocaleString()} unsuccessful`
            : "No payment results"
        }
        className={`whitespace-nowrap px-4 py-3 text-right text-sm ${
          bold ? "font-semibold text-white" : low ? "text-slate-500" : "text-slate-200"
        }`}
      >
        {item.successRate !== null ? `${item.successRate.toFixed(2)}%` : "–"}
      </td>
    );
  };

  return (
    <div className="pdf-card rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6">
      <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
        <table className="w-full text-left">
          <thead className="bg-slate-950">
            <tr>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                USSD Flow
              </th>

              {days.map((day) => (
                <th
                  key={day.date}
                  className="whitespace-nowrap px-4 py-3 text-right text-xs font-medium uppercase tracking-[0.12em] text-slate-500"
                >
                  {heading(day.date)}
                </th>
              ))}

              <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-medium uppercase tracking-[0.12em] text-slate-300">
                {days.length === 7 ? "Week" : "Period"}
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-white/[0.06]">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-white">
                  {row.label}
                </td>

                {row.days.map((day) => cell(day, day.date))}

                {cell(row.total, "total", true)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Greyed rates are based on fewer than {LOW_VOLUME} payments, so treat day-to-day swings with caution. Hover a rate to see the counts behind it.
      </p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-slate-950/30 px-3 py-2">
      <div className="text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------------
 * Shared building blocks (same styling as the BackOffice App page)
 * ------------------------------------------------------------------ */

function ImportSkipReport({
  report,
  onClose,
}: {
  report: ImportReport;
  onClose: () => void;
}) {
  const missingColumns = report.expectedColumns.filter(
    (column) => !report.columnsFound.includes(column)
  );

  return (
    <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="text-sm font-medium text-amber-200">
          Why rows were skipped
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-xs text-slate-500 hover:text-white"
        >
          Dismiss
        </button>
      </div>

      <div className="mt-3 space-y-1 text-xs leading-5 text-slate-400">
        <div>
          <span className="text-slate-500">Required columns:</span>{" "}
          {report.expectedColumns.join(", ")}
        </div>

        <div>
          <span className="text-slate-500">Columns in your file:</span>{" "}
          {report.columnsFound.length
            ? report.columnsFound.join(", ")
            : "none detected"}
        </div>

        {missingColumns.length > 0 && (
          <div className="text-amber-300">
            Missing: {missingColumns.join(", ")}. Column names are case-sensitive.
          </div>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {report.skipReport.map((item) => (
          <div
            key={item.reason}
            className="rounded-lg border border-white/[0.06] bg-slate-950/40 px-4 py-3"
          >
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-200">{item.label}</span>
              <span className="text-sm font-semibold text-white">
                {item.count.toLocaleString()}
              </span>
            </div>

            {item.examples.length > 0 && (
              <ul className="mt-2 space-y-1">
                {item.examples.map((example) => (
                  <li
                    key={`${item.reason}-${example.row}`}
                    className="break-all font-mono text-[11px] leading-5 text-slate-500"
                  >
                    Row {example.row}: {example.detail}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        A row can fail more than one check, so these counts may add up to more than the skipped total.
      </p>
    </div>
  );
}

function DateField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="pdf-card rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>

      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>

      {note && <div className="mt-2 text-xs text-slate-500">{note}</div>}
    </div>
  );
}

function InsightBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="pdf-card mt-4 rounded-xl border border-indigo-400/15 bg-indigo-400/[0.05] px-5 py-4">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-300">
        Insight
      </div>

      <p className="mt-2 text-sm leading-6 text-slate-300">{children}</p>
    </div>
  );
}

function AnalysisCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pdf-card rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function BarRow({
  label,
  value,
  width,
  tone = "neutral",
}: {
  label: string;
  value: string;
  width: number;
  tone?: "neutral" | "good" | "bad";
}) {
  const barColour =
    tone === "good"
      ? "bg-emerald-400/80"
      : tone === "bad"
        ? "bg-rose-400/70"
        : "bg-white/70";

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <span className="text-sm font-medium text-white">{label}</span>
        <span className="shrink-0 text-sm font-semibold text-white">
          {value}
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full ${barColour}`}
          style={{ width: `${Math.min(width, 100)}%` }}
        />
      </div>
    </div>
  );
}

function SimpleTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="pdf-expand max-h-[420px] overflow-auto rounded-xl border border-white/[0.08]">
      <table className="w-full text-left">
        <thead className="sticky top-0 bg-slate-950">
          <tr>
            {headers.map((header, index) => (
              <th
                key={header}
                className={`px-4 py-3 text-xs font-medium uppercase tracking-[0.12em] text-slate-500 ${
                  index > 0 ? "text-right" : ""
                }`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-white/[0.06]">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={`px-4 py-3 text-sm ${
                    cellIndex === 0
                      ? "font-medium text-white"
                      : "whitespace-nowrap text-right text-slate-300"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.08] px-4 py-8 text-center text-sm text-slate-500">
      No data available for this period.
    </div>
  );
}
