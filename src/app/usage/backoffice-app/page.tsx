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

type PaymentJourneyItem = {
  step: number;
  eventName: string;
  label: string;
  count: number;
};

type PaymentChannelUsageItem = {
  name: string;
  views: number;
  sessions: number;
  users: number;
};

type FeatureUsageItem = {
  eventName: string;
  label: string;
  count: number;
};

type OperatingSystemItem = {
  name: string;
  count: number;
};

type AppVersionItem = {
  version: string;
  count: number;
};

type CrashBreakdownItem = {
  name: string;
  count: number;
};

type CrashVersionItem = {
  version: string;
  count: number;
};

type CrashDeviceItem = {
  device: string;
  count: number;
};

type EventBeforeCrashItem = {
  eventName: string;
  label: string;
  count: number;
};

type CrashAnalysis = {
  total: number;
  byOperatingSystem: CrashBreakdownItem[];
  byAppVersion: CrashVersionItem[];
  byDevice: CrashDeviceItem[];
  eventsBeforeCrash: EventBeforeCrashItem[];
};

type DataCoverage = {
  earliestEvent: string | null;
  latestEvent: string | null;
  activeDays: number;
  calendarDays: number;
  coveragePercent: number;
};

type DailyCoverageItem = {
  date: string;
  events: number;
};

type DailyActivityItem = {
  date: string;
  users: number | null;
  sessions: number | null;
};

type SkipReportItem = {
  reason: string;
  label: string;
  count: number;
  examples: {
    row: number;
    detail: string;
  }[];
};

type ImportReport = {
  expectedColumns: string[];
  columnsFound: string[];
  skipReport: SkipReportItem[];
};

type UsageSummary = {
  activeUsers: number;
  sessions: number;
  events: number;
  appCrashes: number;

  featureUsage: FeatureUsageItem[];
  paymentJourney: PaymentJourneyItem[];
  paymentChannelUsage: PaymentChannelUsageItem[];
  operatingSystems: OperatingSystemItem[];
  appVersions: AppVersionItem[];
  crashAnalysis: CrashAnalysis;

  period: {
    start: string | null;
    end: string | null;
  };

  dataCoverage: DataCoverage;
  dailyCoverage: DailyCoverageItem[];
  dailyActivity: DailyActivityItem[];
};

function formatDateInput(date: Date) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatReportDate(
  value: string | null | undefined
) {
  if (!value) {
    return "";
  }

  const date = value.includes("T")
    ? new Date(value)
    : new Date(
        `${value}T00:00:00.000Z`
      );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }
  ).format(date);
}

function percentage(
  value: number,
  total: number
) {
  if (!total) {
    return 0;
  }

  return (
    (value / total) *
    100
  );
}

function getWeekRange(
  value: string
) {
  const [
    yearString,
    weekString,
  ] = value.split("-W");

  const year =
    Number(yearString);

  const week =
    Number(weekString);

  if (!year || !week) {
    return null;
  }

  const january4 =
    new Date(
      year,
      0,
      4
    );

  const january4Day =
    january4.getDay() ||
    7;

  const monday =
    new Date(
      january4
    );

  monday.setDate(
    january4.getDate() -
      january4Day +
      1 +
      (week - 1) * 7
  );

  const sunday =
    new Date(
      monday
    );

  sunday.setDate(
    monday.getDate() + 6
  );

  return {
    start:
      formatDateInput(
        monday
      ),

    end:
      formatDateInput(
        sunday
      ),
  };
}


export default function BackOfficeAppUsagePage() {
  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  const [
    importing,
    setImporting,
  ] = useState(false);

  const [
    loadingSummary,
    setLoadingSummary,
  ] = useState(true);

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    importReport,
    setImportReport,
  ] =
    useState<ImportReport | null>(
      null
    );

  const [
    summary,
    setSummary,
  ] =
    useState<UsageSummary | null>(
      null
    );

  const [
    selectedWeek,
    setSelectedWeek,
  ] = useState("");

  const [
    startDate,
    setStartDate,
  ] = useState("");

  const [
    endDate,
    setEndDate,
  ] = useState("");

  const loadSummary =
    useCallback(
      async (
        start?: string,
        end?: string
      ) => {
        try {
          setLoadingSummary(
            true
          );

          setError("");

          const params =
            new URLSearchParams();

          if (start) {
            params.set(
              "start",
              start
            );
          }

          if (end) {
            params.set(
              "end",
              end
            );
          }

          const query =
            params.toString();

          const response =
            await fetch(
              `/api/usage/backoffice-app/summary${
                query
                  ? `?${query}`
                  : ""
              }`,
              {
                cache:
                  "no-store",
              }
            );

          const data =
            await response.json();

          if (
            !response.ok
          ) {
            throw new Error(
              data?.error ||
                "Failed to load usage summary."
            );
          }

          setSummary(
            data
          );
        } catch (error) {
          console.error(
            error
          );

          setError(
            error instanceof
              Error
              ? error.message
              : "Couldn't load the usage summary."
          );
        } finally {
          setLoadingSummary(
            false
          );
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
    const file =
      event.target
        .files?.[0];

    if (!file) {
      return;
    }

    try {
      setImporting(
        true
      );

      setMessage("");
      setError("");
      setImportReport(null);

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      const response =
        await fetch(
          "/api/usage/backoffice-app/import",
          {
            method:
              "POST",

            body:
              formData,
          }
        );

      const data =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          data?.error ||
            "Failed to import usage data."
        );
      }

      setMessage(
        `Imported ${data.imported.toLocaleString()} events. ${data.skipped.toLocaleString()} rows skipped. ${data.duplicates.toLocaleString()} duplicates ignored.`
      );

      if (data.skipped > 0) {
        setImportReport({
          expectedColumns:
            data.expectedColumns ?? [],
          columnsFound:
            data.columnsFound ?? [],
          skipReport:
            data.skipReport ?? [],
        });
      }

      await loadSummary(
        startDate ||
          undefined,
        endDate ||
          undefined
      );
    } catch (error) {
      console.error(
        error
      );

      setError(
        error instanceof
          Error
          ? error.message
          : "Couldn't import the usage data."
      );
    } finally {
      setImporting(
        false
      );

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
      }
    }
  }

  function handleWeekChange(
    value: string
  ) {
    setSelectedWeek(
      value
    );

    if (!value) {
      return;
    }

    const range =
      getWeekRange(
        value
      );

    if (!range) {
      return;
    }

    setStartDate(
      range.start
    );

    setEndDate(
      range.end
    );

    loadSummary(
      range.start,
      range.end
    );
  }

  function handleApplyPeriod() {
    loadSummary(
      startDate ||
        undefined,
      endDate ||
        undefined
    );
  }

  function handleClearPeriod() {
    setSelectedWeek(
      ""
    );

    setStartDate("");
    setEndDate("");

    loadSummary();
  }

  function handleLast7Days() {
    const end =
      new Date();

    const start =
      new Date();

    start.setDate(
      end.getDate() - 6
    );

    const formattedStart =
      formatDateInput(
        start
      );

    const formattedEnd =
      formatDateInput(
        end
      );

    setSelectedWeek(
      ""
    );

    setStartDate(
      formattedStart
    );

    setEndDate(
      formattedEnd
    );

    loadSummary(
      formattedStart,
      formattedEnd
    );
  }

  // mode "html" downloads the report; "pdf" opens the
  // print dialog to save it as a PDF.
  async function handleExportHtml(
    mode: "html" | "pdf" = "html"
  ) {
    if (!summary) {
      setError(
        "There is no usage data to export."
      );

      return;
    }

    const report =
      document.querySelector(
        "[data-html-report='true']"
      );

    if (!report) {
      setError(
        "Couldn't find the report content to export."
      );

      return;
    }

    setError("");

    const reportClone =
      report.cloneNode(
        true
      ) as HTMLElement;

    /*
     * Remove portal-only controls.
     */
    reportClone
      .querySelectorAll(
        "[data-export-hide='true']"
      )
      .forEach(
        (element) => {
          element.remove();
        }
      );

    /*
     * Make the report header visible.
     */
    const reportHeader =
      reportClone.querySelector(
        ".html-report-header"
      ) as HTMLElement | null;

    if (
      reportHeader
    ) {
      reportHeader.classList.remove(
        "hidden"
      );

      reportHeader.style.display =
        "block";
    }

    /*
     * Expand anything that normally
     * scrolls in the live dashboard.
     */
    reportClone
      .querySelectorAll(
        ".pdf-expand"
      )
      .forEach(
        (element) => {
          const htmlElement =
            element as HTMLElement;

          htmlElement.style.maxHeight =
            "none";

          htmlElement.style.height =
            "auto";

          htmlElement.style.overflow =
            "visible";
        }
      );

    /*
     * Remove sticky table headers.
     */
    reportClone
      .querySelectorAll(
        "thead"
      )
      .forEach(
        (element) => {
          const htmlElement =
            element as HTMLElement;

          htmlElement.style.position =
            "static";
        }
      );

    /*
     * Embed application CSS.
     */
    const embeddedCss =
      getEmbeddedStyles(
        mode === "pdf"
      );

    const html =
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />

  <title>BackOffice App Usage Analysis</title>

  <style>
    ${embeddedCss}

    html {
      color-scheme: dark;
      background: #020617;
    }

    body {
      margin: 0 !important;
      padding: 40px !important;
      min-height: 100vh;
      background: #020617 !important;
      color: #e2e8f0 !important;
      font-family: Arial, Helvetica, sans-serif;
    }

    .html-report-container {
      width: 100%;
      max-width: 1600px;
      margin: 0 auto;
    }

    .html-report-header {
      display: block !important;
    }

    .html-report-container .pdf-report {
      font-size: 100% !important;
    }

    .html-report-container .pdf-page,
    .html-report-container .pdf-page-first {
      break-before: auto !important;
      page-break-before: auto !important;
    }

    .html-report-container .pdf-expand {
      max-height: none !important;
      height: auto !important;
      overflow: visible !important;
    }

    .html-report-container thead {
      position: static !important;
    }

    @media (max-width: 900px) {
      body {
        padding: 20px !important;
      }
    }
  </style>
</head>

<body>
  <main class="html-report-container">
    ${reportClone.outerHTML}
  </main>
</body>
</html>`;

    const blob =
      new Blob(
        [html],
        {
          type:
            "text/html;charset=utf-8",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    // Name the file after the period actually loaded,
    // not dates typed into the filters but not applied.
    const selectedStart =
      summary.period.start;

    const selectedEnd =
      summary.period.end;

    let fileName =
      "backoffice-app-usage-all-available-data.html";

    if (
      selectedStart &&
      selectedEnd
    ) {
      fileName =
        `backoffice-app-usage-${selectedStart.slice(
          0,
          10
        )}-to-${selectedEnd.slice(
          0,
          10
        )}.html`;
    } else if (
      selectedStart
    ) {
      fileName =
        `backoffice-app-usage-from-${selectedStart.slice(
          0,
          10
        )}.html`;
    } else if (
      selectedEnd
    ) {
      fileName =
        `backoffice-app-usage-to-${selectedEnd.slice(
          0,
          10
        )}.html`;
    }

    if (mode === "pdf") {
      URL.revokeObjectURL(url);

      try {
        await printReportAsPdf(
          html,
          fileName.replace(
            /\.html$/,
            ""
          )
        );
      } catch (error) {
        console.error(error);

        setError(
          "Couldn't prepare the PDF. Try Export HTML instead."
        );
      }

      return;
    }

    link.href =
      url;

    link.download =
      fileName;

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();

    URL.revokeObjectURL(
      url
    );
  }

  const journey =
    summary
      ?.paymentJourney ??
    [];

  const channels =
    summary
      ?.paymentChannelUsage ??
    [];

  const features =
    summary
      ?.featureUsage ??
    [];

  const operatingSystems =
    summary
      ?.operatingSystems ??
    [];

  const appVersions =
    summary
      ?.appVersions ??
    [];

  const crashes =
    summary
      ?.crashAnalysis;

  const dailyActivity =
    summary
      ?.dailyActivity ??
    [];

  const maxChannelSessions =
    Math.max(
      ...channels.map(
        (item) =>
          item.sessions
      ),
      1
    );

  const maxFeatureCount =
    Math.max(
      ...features.map(
        (item) =>
          item.count
      ),
      1
    );

  const maxOSCount =
    Math.max(
      ...operatingSystems.map(
        (item) =>
          item.count
      ),
      1
    );

  const firstJourneyCount =
    journey[0]
      ?.count ??
    0;

  const finalJourneyCount =
    journey[
      journey.length -
        1
    ]?.count ?? 0;

  const rawJourneyRatio =
    percentage(
      finalJourneyCount,
      firstJourneyCount
    );

  const iosEvents =
    operatingSystems.find(
      (item) =>
        item.name.toLowerCase() ===
        "ios"
    )?.count ?? 0;

  const androidEvents =
    operatingSystems.find(
      (item) =>
        item.name.toLowerCase() ===
        "android"
    )?.count ?? 0;

  const iosCrashes =
    crashes
      ?.byOperatingSystem.find(
        (item) =>
          item.name.toLowerCase() ===
          "ios"
      )?.count ?? 0;

  const androidCrashes =
    crashes
      ?.byOperatingSystem.find(
        (item) =>
          item.name.toLowerCase() ===
          "android"
      )?.count ?? 0;

  /*
   * OVERVIEW INSIGHT
   */
  const overviewInsight =
    (() => {
      if (
        !summary ||
        summary.events === 0
      ) {
        return "There is not enough usage data in this period to generate an overview insight.";
      }

      const crashRate =
        percentage(
          summary.appCrashes,
          summary.sessions
        );

      const iosActivityShare =
        percentage(
          iosEvents,
          summary.events
        );

      const iosCrashShare =
        percentage(
          iosCrashes,
          crashes?.total ??
            0
        );

      let insight =
        `${summary.activeUsers.toLocaleString()} active users generated ` +
        `${summary.sessions.toLocaleString()} sessions and ` +
        `${summary.events.toLocaleString()} tracked events during this period.`;

      if (
        summary.appCrashes >
        0
      ) {
        insight +=
          ` ${summary.appCrashes.toLocaleString()} app crashes were recorded, ` +
          `equivalent to ${crashRate.toFixed(
            1
          )} crashes per 100 sessions.`;
      }

      if (
        crashes?.total &&
        iosCrashShare >
          iosActivityShare +
            10
      ) {
        insight +=
          ` iOS appears to have a higher stability risk. It represents ` +
          `${iosActivityShare.toFixed(
            1
          )}% of recorded app activity but accounts for ` +
          `${iosCrashShare.toFixed(
            1
          )}% of crashes, so iOS should be prioritised for investigation.`;
      }

      return insight;
    })();

  /*
   * CORE JOURNEY INSIGHT
   */
  const journeyInsight =
    (() => {
      if (
        journey.length <
          2 ||
        firstJourneyCount ===
          0
      ) {
        return "There is not enough payment journey activity in this period to identify a clear movement.";
      }

      let biggestDrop = {
        from: "",
        to: "",
        rate: 0,
      };

      for (
        let index = 1;
        index <
        journey.length;
        index += 1
      ) {
        const previous =
          journey[
            index - 1
          ];

        const current =
          journey[
            index
          ];

        if (
          previous.count <=
            0 ||
          current.count >
            previous.count
        ) {
          continue;
        }

        const dropRate =
          percentage(
            previous.count -
              current.count,
            previous.count
          );

        if (
          dropRate >
          biggestDrop.rate
        ) {
          biggestDrop = {
            from:
              previous.label,

            to:
              current.label,

            rate:
              dropRate,
          };
        }
      }

      let insight =
        `Payment activity reduces from ${firstJourneyCount.toLocaleString()} app opens to ` +
        `${finalJourneyCount.toLocaleString()} successful transaction events.`;

      if (
        biggestDrop.rate >
        0
      ) {
        insight +=
          ` The biggest drop is between ${biggestDrop.from.toLowerCase()} and ` +
          `${biggestDrop.to.toLowerCase()}, where activity falls by ${biggestDrop.rate.toFixed(
            1
          )}%. ` +
          `This is the main point in the journey to investigate.`;
      }

      insight +=
        " However, the data does not confirm that these users abandoned the payment process, since actions can repeat within a session.";

      return insight;
    })();

  /*
   * PAYMENT CHANNEL INSIGHT
   */
  const channelInsight =
    (() => {
      if (
        channels.length ===
        0
      ) {
        return "There is not enough payment-channel activity in this period to identify a clear usage pattern.";
      }

      const topChannel =
        channels[0];

      const secondChannel =
        channels[1];

      let insight =
        `${topChannel.name} is the most-used payment channel, appearing in ` +
        `${topChannel.sessions.toLocaleString()} sessions across ` +
        `${topChannel.users.toLocaleString()} users.`;

      if (
        secondChannel &&
        secondChannel.sessions >
          0
      ) {
        const leadRatio =
          topChannel.sessions /
          secondChannel.sessions;

        if (
          leadRatio >= 2
        ) {
          insight +=
            ` That is ${leadRatio.toFixed(
              1
            )} times the session activity of ` +
            `${secondChannel.name}, the next most-used channel.`;
        } else {
          insight +=
            ` ${secondChannel.name} follows with ` +
            `${secondChannel.sessions.toLocaleString()} sessions.`;
        }
      }

      const viewsPerSession =
        topChannel.views /
        Math.max(
          topChannel.sessions,
          1
        );

      if (
        viewsPerSession >=
        1.5
      ) {
        insight +=
          ` Users viewed ${topChannel.name} an average of ${viewsPerSession.toFixed(
            1
          )} times per session, ` +
          `indicating repeated interaction with the channel.`;
      }

      return insight;
    })();

  /*
   * FRICTION INSIGHT
   */
  const frictionInsight =
    (() => {
      if (
        !crashes ||
        crashes.total === 0
      ) {
        return "No recorded app crashes were found during this period.";
      }

      const iosActivityShare =
        percentage(
          iosEvents,
          summary?.events ??
            0
        );

      const iosCrashShare =
        percentage(
          iosCrashes,
          crashes.total
        );

      const androidActivityShare =
        percentage(
          androidEvents,
          summary?.events ??
            0
        );

      const androidCrashShare =
        percentage(
          androidCrashes,
          crashes.total
        );

      const topPreviousEvent =
        crashes
          .eventsBeforeCrash?.[0];

      let insight =
        `${crashes.total.toLocaleString()} app crashes were recorded during this period.`;

      if (
        iosCrashShare >
        iosActivityShare +
          10
      ) {
        insight +=
          ` iOS appears to have a higher stability risk, accounting for ${iosCrashShare.toFixed(
            1
          )}% of crashes ` +
          `while representing only ${iosActivityShare.toFixed(
            1
          )}% of recorded app activity.`;
      } else if (
        androidCrashShare >
        androidActivityShare +
          10
      ) {
        insight +=
          ` Android appears to have a higher stability risk, accounting for ${androidCrashShare.toFixed(
            1
          )}% of crashes ` +
          `while representing ${androidActivityShare.toFixed(
            1
          )}% of recorded app activity.`;
      }

      if (
        topPreviousEvent &&
        topPreviousEvent.count >
          0
      ) {
        const investigationArea =
          topPreviousEvent.eventName ===
            "Start Session" ||
          topPreviousEvent.label
            .toLowerCase()
            .includes(
              "open app"
            )
            ? "app startup"
            : topPreviousEvent.label.toLowerCase();

        insight +=
          ` ${topPreviousEvent.label} was the most common event immediately before a crash, ` +
          `occurring ${topPreviousEvent.count.toLocaleString()} times, making ${investigationArea} an area to investigate.`;
      }

      insight +=
        " This identifies where attention may be needed, but does not confirm the technical cause of the crashes.";

      return insight;
    })();

  /*
   * REPORTING PERIOD
   */
  const reportPeriodLabel =
    summary?.period
      .start &&
    summary?.period
      .end
      ? `${formatReportDate(
          summary.period
            .start
        )} - ${formatReportDate(
          summary.period
            .end
        )}`
      : summary?.period
          .start
        ? `From ${formatReportDate(
            summary.period
              .start
          )}`
        : summary?.period
            .end
          ? `Up to ${formatReportDate(
              summary.period
                .end
            )}`
          : "All available data";

  const generatedDate =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        day: "numeric",
        month:
          "short",
        year:
          "numeric",
      }
    ).format(
      new Date()
    );

  return (
    <PageShell
      title="BackOffice App Usage"
      description="Analyse how the BackOffice App is being used, which journeys matter most, and where users experience friction."
    >
      <div
        data-html-report="true"
        className="pdf-report space-y-6"
      >
        {/* Report header */}
        <div className="html-report-header hidden print:block">
          <div className="border-b border-white/[0.10] pb-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Usage Analysis
            </div>

            <h1 className="mt-2 text-2xl font-semibold text-white">
              BackOffice App Usage Analysis
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-400">
              <div>
                <span className="text-slate-500">
                  Reporting Period:
                </span>{" "}
                {
                  reportPeriodLabel
                }
              </div>

              <div>
                <span className="text-slate-500">
                  Data Source:
                </span>{" "}
                Datadog
              </div>

              <div>
                <span className="text-slate-500">
                  Generated:
                </span>{" "}
                {
                  generatedDate
                }
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
            className="rounded-lg bg-white/[0.08] px-4 py-2 text-sm font-medium text-white"
          >
            BackOffice App
          </Link>

          <Link
            href="/usage/ussd"
            className="rounded-lg px-4 py-2 text-sm text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
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
                Usage dataset
              </div>

              <p className="mt-1 text-sm text-slate-400">
                Import the raw BackOffice App analytics event export.
              </p>
            </div>

            <div>
              <input
                ref={
                  fileInputRef
                }
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={
                  handleFileChange
                }
              />

              <button
                type="button"
                disabled={
                  importing
                }
                onClick={() =>
                  fileInputRef.current?.click()
                }
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importing
                  ? "Importing..."
                  : "Import Usage Data"}
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
              onClose={() =>
                setImportReport(null)
              }
            />
          )}
        </div>

        {/* Reporting period */}
        <div
          data-export-hide="true"
          className="print:hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"
        >
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                Week
              </label>

              <input
                type="week"
                value={
                  selectedWeek
                }
                onChange={(
                  event
                ) =>
                  handleWeekChange(
                    event
                      .target
                      .value
                  )
                }
                className="rounded-xl border border-white/[0.08] bg-slate-950 px-4 py-2.5 text-sm text-white outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                Start Date
              </label>

              <input
                type="date"
                value={
                  startDate
                }
                onChange={(
                  event
                ) => {
                  setSelectedWeek(
                    ""
                  );

                  setStartDate(
                    event
                      .target
                      .value
                  );
                }}
                className="rounded-xl border border-white/[0.08] bg-slate-950 px-4 py-2.5 text-sm text-white outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                End Date
              </label>

              <input
                type="date"
                value={
                  endDate
                }
                onChange={(
                  event
                ) => {
                  setSelectedWeek(
                    ""
                  );

                  setEndDate(
                    event
                      .target
                      .value
                  );
                }}
                className="rounded-xl border border-white/[0.08] bg-slate-950 px-4 py-2.5 text-sm text-white outline-none"
              />
            </div>

            <button
              type="button"
              onClick={
                handleApplyPeriod
              }
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-200"
            >
              Apply
            </button>

            <button
              type="button"
              onClick={
                handleLast7Days
              }
              className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.07]"
            >
              Last 7 Days
            </button>

            <button
              type="button"
              onClick={
                handleClearPeriod
              }
              className="rounded-xl px-4 py-2.5 text-sm text-slate-400 hover:text-white"
            >
              All Data
            </button>

            <button
              type="button"
              onClick={() =>
                handleExportHtml(
                  "html"
                )
              }
              disabled={
                loadingSummary ||
                !summary
              }
              className="rounded-xl border border-indigo-400/20 bg-indigo-400/10 px-4 py-2.5 text-sm font-semibold text-indigo-200 transition hover:bg-indigo-400/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Export HTML
            </button>

            <button
              type="button"
              onClick={() =>
                handleExportHtml(
                  "pdf"
                )
              }
              disabled={
                loadingSummary ||
                !summary
              }
              title="Opens the print dialog. Choose Save as PDF."
              className="rounded-xl border border-indigo-400/20 bg-indigo-400/10 px-4 py-2.5 text-sm font-semibold text-indigo-200 transition hover:bg-indigo-400/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Export PDF
            </button>
          </div>

          {summary
            ?.dataCoverage
            ?.earliestEvent &&
            summary
              ?.dataCoverage
              ?.latestEvent && (
              <div className="mt-4 text-xs leading-5 text-slate-500">
                <div>
                  Recorded
                  events in
                  this view:{" "}
                  {formatReportDate(
                    summary
                      .dataCoverage
                      .earliestEvent
                  )}{" "}
                  to{" "}
                  {formatReportDate(
                    summary
                      .dataCoverage
                      .latestEvent
                  )}
                </div>

                <div>
                  Records exist
                  on{" "}
                  {summary.dataCoverage.activeDays.toLocaleString()}{" "}
                  calendar
                  days within
                  this range.
                </div>

                <div>
                  This reflects
                  records
                  currently
                  available in
                  Datadog and
                  does not imply
                  continuous
                  historical
                  coverage.
                </div>
              </div>
            )}
        </div>

        {/* Data coverage (same as the Collections page) */}
        {dailyActivity.length > 0 && (
          <DataCoverageCard
            days={dailyActivity.map((day) => ({
              date: day.date,
              hasData: day.users !== null,
              detail:
                day.users !== null
                  ? `${(day.sessions ?? 0).toLocaleString()} sessions · ${day.users.toLocaleString()} users`
                  : undefined,
            }))}
          />
        )}

        {/* Overview */}
        <section className="pdf-page-first">
          <SectionHeading
            title="Overview"
            description="Core usage and engagement signals for the selected period."
          />

          <div className="pdf-overview-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Active Users"
              value={
                loadingSummary
                  ? "..."
                  : (
                      summary?.activeUsers ??
                      0
                    ).toLocaleString()
              }
              note="Unique customer identifiers"
            />

            <MetricCard
              label="Sessions"
              value={
                loadingSummary
                  ? "..."
                  : (
                      summary?.sessions ??
                      0
                    ).toLocaleString()
              }
            />

            <MetricCard
              label="Events"
              value={
                loadingSummary
                  ? "..."
                  : (
                      summary?.events ??
                      0
                    ).toLocaleString()
              }
            />

            <MetricCard
              label="App Crashes"
              value={
                loadingSummary
                  ? "..."
                  : (
                      summary?.appCrashes ??
                      0
                    ).toLocaleString()
              }
              note={
                summary?.sessions
                  ? `${percentage(
                      summary.appCrashes,
                      summary.sessions
                    ).toFixed(
                      1
                    )} crashes per 100 sessions`
                  : undefined
              }
            />
          </div>

          {summary && (
            <div className="mt-4">
              <UsageTrendCard
                reportData={
                  dailyActivity
                }
              />
            </div>
          )}

          <InsightBox>
            {overviewInsight}
          </InsightBox>
        </section>

        {/* Payment Journey */}
        <section className="pdf-page pdf-card relative overflow-hidden rounded-3xl border border-indigo-400/25 bg-gradient-to-br from-indigo-500/[0.10] via-white/[0.035] to-cyan-500/[0.06] p-7 shadow-[0_20px_80px_rgba(79,70,229,0.10)]">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl" />

          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <div className="mb-2 inline-flex items-center rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-200">
                  Core Journey
                </div>

                <h2 className="text-xl font-semibold text-white">
                  Payment Journey
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  How payment activity moves from opening the app through to a successful transaction.
                </p>
              </div>

              {firstJourneyCount >
                0 && (
                <div className="rounded-2xl border border-white/[0.10] bg-slate-950/50 px-5 py-4">
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                    Start → Success Event Ratio
                  </div>

                  <div className="mt-1 text-3xl font-semibold text-white">
                    {rawJourneyRatio.toFixed(
                      1
                    )}
                    %
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    Event activity indicator
                  </div>
                </div>
              )}
            </div>

            <div className="pdf-journey-grid mt-8 grid gap-3 lg:grid-cols-5">
              {journey.map(
                (
                  item,
                  index
                ) => {
                  const previous =
                    index >
                    0
                      ? journey[
                          index -
                            1
                        ]
                          ?.count ??
                        0
                      : 0;

                  const movement =
                    index >
                      0 &&
                    previous >
                      0
                      ? percentage(
                          item.count,
                          previous
                        )
                      : null;

                  const isFinal =
                    item.eventName ===
                    "Purchase";

                  return (
                    <div
                      key={
                        item.eventName
                      }
                      className="relative"
                    >
                      <div
                        className={`pdf-card h-full rounded-2xl border p-5 ${
                          isFinal
                            ? "border-emerald-400/30 bg-emerald-400/[0.08]"
                            : "border-white/[0.10] bg-slate-950/45"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                              isFinal
                                ? "bg-emerald-400 text-emerald-950"
                                : "bg-indigo-400/15 text-indigo-200"
                            }`}
                          >
                            {
                              item.step
                            }
                          </div>

                          {movement !==
                            null && (
                            <span className="text-xs text-slate-500">
                              {movement.toFixed(
                                1
                              )}
                              %
                            </span>
                          )}
                        </div>

                        <div className="mt-5 text-sm font-medium text-slate-300">
                          {
                            item.label
                          }
                        </div>

                        <div className="mt-2 text-3xl font-semibold tracking-tight text-white">
                          {item.count.toLocaleString()}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          events
                        </div>

                        {index >
                          0 && (
                          <div className="mt-4 border-t border-white/[0.06] pt-3 text-xs text-slate-500">
                            {movement?.toFixed(
                              1
                            )}
                            % of previous stage volume
                          </div>
                        )}
                      </div>

                      {index <
                        journey.length -
                          1 && (
                        <div className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.10] bg-slate-900 text-sm text-slate-500 lg:flex">
                          →
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-slate-950/30 px-5 py-4">
              <p className="max-w-3xl text-xs leading-5 text-slate-500">
                This view shows tracked event activity across the payment journey. It is not treated as a true conversion funnel because actions can repeat within the same session.
              </p>

              <div className="text-xs font-medium text-slate-400">
                {firstJourneyCount.toLocaleString()}{" "}
                starts
                <span className="mx-2 text-slate-600">
                  →
                </span>
                {finalJourneyCount.toLocaleString()}{" "}
                successful transaction events
              </div>
            </div>

            <InsightBox>
              {journeyInsight}
            </InsightBox>
          </div>
        </section>

        {/* Channel + Feature */}
        <section className="pdf-page">
          <div className="pdf-two-column grid gap-5 xl:grid-cols-2">
            <AnalysisCard
              title="Payment Channel Usage"
              description="Payment channels viewed during usage, ranked by unique sessions."
            >
              {channels.length ===
              0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-5">
                  {channels.map(
                    (
                      channel
                    ) => (
                      <BarRow
                        key={
                          channel.name
                        }
                        label={
                          channel.name
                        }
                        value={`${channel.sessions.toLocaleString()} sessions`}
                        width={percentage(
                          channel.sessions,
                          maxChannelSessions
                        )}
                        detail={`${channel.users.toLocaleString()} users · ${channel.views.toLocaleString()} views · ${(
                          channel.views /
                          Math.max(
                            channel.sessions,
                            1
                          )
                        ).toFixed(
                          1
                        )} views/session`}
                      />
                    )
                  )}
                </div>
              )}
            </AnalysisCard>

            <AnalysisCard
              title="Other Feature Usage"
              description="Tracked actions outside the core payment journey."
            >
              {features.length ===
              0 ? (
                <EmptyState />
              ) : (
                <div className="pdf-expand max-h-[430px] space-y-5 overflow-y-auto pr-2">
                  {features.map(
                    (
                      feature
                    ) => (
                      <BarRow
                        key={
                          feature.eventName
                        }
                        label={
                          feature.label
                        }
                        value={feature.count.toLocaleString()}
                        width={percentage(
                          feature.count,
                          maxFeatureCount
                        )}
                      />
                    )
                  )}
                </div>
              )}
            </AnalysisCard>
          </div>

          <InsightBox>
            {channelInsight}
          </InsightBox>
        </section>

        {/* Friction */}
        <section className="pdf-page">
          <SectionHeading
            title="Friction"
            description="Confirmed crash signals and where they are concentrated."
          />

          <div className="pdf-overview-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total Crashes"
              value={(
                crashes?.total ??
                0
              ).toLocaleString()}
            />

            <MetricCard
              label="Crashes / 100 Sessions"
              value={
                summary?.sessions
                  ? percentage(
                      crashes?.total ??
                        0,
                      summary.sessions
                    ).toFixed(
                      1
                    )
                  : "0.0"
              }
            />

            <MetricCard
              label="iOS Crashes"
              value={iosCrashes.toLocaleString()}
              note={
                crashes?.total
                  ? `${percentage(
                      iosCrashes,
                      crashes.total
                    ).toFixed(
                      1
                    )}% of crashes`
                  : undefined
              }
            />

            <MetricCard
              label="Android Crashes"
              value={androidCrashes.toLocaleString()}
              note={
                crashes?.total
                  ? `${percentage(
                      androidCrashes,
                      crashes.total
                    ).toFixed(
                      1
                    )}% of crashes`
                  : undefined
              }
            />
          </div>

          <div className="pdf-two-column mt-5 grid gap-5 xl:grid-cols-2">
            <AnalysisCard
              title="Crash Distribution by OS"
              description="Compare crash concentration with overall app activity."
            >
              <div className="space-y-5">
                <ComparisonRow
                  label="iOS"
                  crashes={
                    iosCrashes
                  }
                  activity={
                    iosEvents
                  }
                  totalCrashes={
                    crashes?.total ??
                    0
                  }
                  totalActivity={
                    summary?.events ??
                    0
                  }
                />

                <ComparisonRow
                  label="Android"
                  crashes={
                    androidCrashes
                  }
                  activity={
                    androidEvents
                  }
                  totalCrashes={
                    crashes?.total ??
                    0
                  }
                  totalActivity={
                    summary?.events ??
                    0
                  }
                />
              </div>

              {crashes?.total ? (
                <div className="mt-5 rounded-xl border border-amber-500/15 bg-amber-500/[0.05] p-4 text-sm leading-6 text-slate-400">
                  <span className="font-medium text-amber-200">
                    Signal:
                  </span>{" "}
                  iOS represents{" "}
                  {percentage(
                    iosEvents,
                    summary?.events ??
                      0
                  ).toFixed(
                    1
                  )}
                  % of recorded app activity but accounts for{" "}
                  {percentage(
                    iosCrashes,
                    crashes.total
                  ).toFixed(
                    1
                  )}
                  % of crashes. This suggests iOS has a disproportionately high share of crashes and should be prioritised for investigation.
                </div>
              ) : null}
            </AnalysisCard>

            <AnalysisCard
              title="Events Before Crash"
              description="The event immediately preceding a recorded crash in the same session."
            >
              {!crashes
                ?.eventsBeforeCrash
                ?.length ? (
                <EmptyState />
              ) : (
                <div className="space-y-3">
                  {crashes.eventsBeforeCrash.map(
                    (
                      item
                    ) => (
                      <div
                        key={
                          item.eventName
                        }
                        className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-slate-950/30 px-4 py-3"
                      >
                        <span className="text-sm text-slate-300">
                          {
                            item.label
                          }
                        </span>

                        <span className="text-sm font-semibold text-white">
                          {item.count.toLocaleString()}
                        </span>
                      </div>
                    )
                  )}
                </div>
              )}

              <p className="mt-4 text-xs leading-5 text-slate-500">
                This shows correlation, not confirmed root cause. Consecutive crash events may also indicate repeated crash logging.
              </p>
            </AnalysisCard>

            <AnalysisCard
              title="Crashes by App Version"
              description="Versions associated with recorded crashes."
            >
              {!crashes
                ?.byAppVersion
                ?.length ? (
                <EmptyState />
              ) : (
                <SimpleTable
                  headers={[
                    "Version",
                    "Crashes",
                  ]}
                  rows={crashes.byAppVersion.map(
                    (
                      item
                    ) => [
                      item.version,
                      item.count.toLocaleString(),
                    ]
                  )}
                />
              )}

              <p className="mt-4 text-xs leading-5 text-slate-500">
                Crash counts alone do not establish which version is least stable; version usage exposure should also be considered.
              </p>
            </AnalysisCard>

            <AnalysisCard
              title="Devices Affected"
              description="Devices with recorded app crash events."
            >
              {!crashes
                ?.byDevice
                ?.length ? (
                <EmptyState />
              ) : (
                <SimpleTable
                  headers={[
                    "Device",
                    "Crashes",
                  ]}
                  rows={crashes.byDevice.map(
                    (
                      item
                    ) => [
                      item.device,
                      item.count.toLocaleString(),
                    ]
                  )}
                />
              )}
            </AnalysisCard>
          </div>

          <InsightBox>
            {frictionInsight}
          </InsightBox>
        </section>

        {/* Devices & Versions */}
        <section className="pdf-page">
          <SectionHeading
            title="Devices & Versions"
            description="Understand where overall BackOffice App activity is coming from."
          />

          <div className="pdf-two-column grid gap-5 xl:grid-cols-2">
            <AnalysisCard
              title="Operating System"
              description="Share of recorded app activity by operating system."
            >
              {operatingSystems.length ===
              0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-5">
                  {operatingSystems.map(
                    (
                      os
                    ) => (
                      <BarRow
                        key={
                          os.name
                        }
                        label={
                          os.name
                            .charAt(
                              0
                            )
                            .toUpperCase() +
                          os.name.slice(
                            1
                          )
                        }
                        value={`${os.count.toLocaleString()} events`}
                        width={percentage(
                          os.count,
                          maxOSCount
                        )}
                        detail={`${percentage(
                          os.count,
                          summary?.events ??
                            0
                        ).toFixed(
                          1
                        )}% of activity`}
                      />
                    )
                  )}
                </div>
              )}
            </AnalysisCard>

            <AnalysisCard
              title="App Versions"
              description="Recorded activity by app version."
            >
              {appVersions.length ===
              0 ? (
                <EmptyState />
              ) : (
                <SimpleTable
                  headers={[
                    "Version",
                    "Events",
                    "Share",
                  ]}
                  rows={appVersions.map(
                    (
                      version
                    ) => [
                      version.version,
                      version.count.toLocaleString(),
                      `${percentage(
                        version.count,
                        summary?.events ??
                          0
                      ).toFixed(
                        1
                      )}%`,
                    ]
                  )}
                />
              )}
            </AnalysisCard>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function ImportSkipReport({
  report,
  onClose,
}: {
  report: ImportReport;
  onClose: () => void;
}) {
  const missingColumns =
    report.expectedColumns.filter(
      (column) =>
        !report.columnsFound.includes(column)
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
          <span className="text-slate-500">
            Expected columns:
          </span>{" "}
          {report.expectedColumns.join(", ")}
        </div>

        <div>
          <span className="text-slate-500">
            Columns in your file:
          </span>{" "}
          {report.columnsFound.length
            ? report.columnsFound.join(", ")
            : "none detected"}
        </div>

        {missingColumns.length > 0 && (
          <div className="text-amber-300">
            Missing: {missingColumns.join(", ")}.
            Column names are case-sensitive.
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
              <span className="text-sm text-slate-200">
                {item.label}
              </span>

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

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-white">
        {title}
      </h2>

      <p className="mt-1 text-sm text-slate-400">
        {description}
      </p>
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

      <div className="mt-3 text-2xl font-semibold text-white">
        {value}
      </div>

      {note && (
        <div className="mt-2 text-xs text-slate-500">
          {note}
        </div>
      )}
    </div>
  );
}

function InsightBox({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <div className="pdf-card mt-4 rounded-xl border border-indigo-400/15 bg-indigo-400/[0.05] px-5 py-4">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-300">
        Insight
      </div>

      <p className="mt-2 text-sm leading-6 text-slate-300">
        {children}
      </p>
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
  children:
    React.ReactNode;
}) {
  return (
    <div className="pdf-card rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6">
      <h3 className="text-base font-semibold text-white">
        {title}
      </h3>

      <p className="mt-1 text-sm leading-6 text-slate-400">
        {description}
      </p>

      <div className="mt-6">
        {children}
      </div>
    </div>
  );
}

function BarRow({
  label,
  value,
  width,
  detail,
}: {
  label: string;
  value: string;
  width: number;
  detail?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-white">
          {label}
        </span>

        <span className="text-sm font-semibold text-white">
          {value}
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-white/70"
          style={{
            width: `${Math.min(
              width,
              100
            )}%`,
          }}
        />
      </div>

      {detail && (
        <div className="mt-2 text-xs text-slate-500">
          {detail}
        </div>
      )}
    </div>
  );
}

function ComparisonRow({
  label,
  crashes,
  activity,
  totalCrashes,
  totalActivity,
}: {
  label: string;
  crashes: number;
  activity: number;
  totalCrashes: number;
  totalActivity: number;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-slate-950/30 p-4">
      <div className="flex items-center justify-between">
        <span className="font-medium text-white">
          {label}
        </span>

        <span className="text-sm font-semibold text-white">
          {crashes} crashes
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-slate-500">
            Activity share
          </div>

          <div className="mt-1 text-sm font-medium text-slate-200">
            {percentage(
              activity,
              totalActivity
            ).toFixed(
              1
            )}
            %
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-500">
            Crash share
          </div>

          <div className="mt-1 text-sm font-medium text-slate-200">
            {percentage(
              crashes,
              totalCrashes
            ).toFixed(
              1
            )}
            %
          </div>
        </div>
      </div>
    </div>
  );
}

function SimpleTable({
  headers,
  rows,
}: {
  headers:
    string[];

  rows:
    string[][];
}) {
  return (
    <div className="pdf-expand max-h-[420px] overflow-auto rounded-xl border border-white/[0.08]">
      <table className="w-full text-left">
        <thead className="sticky top-0 bg-slate-950">
          <tr>
            {headers.map(
              (
                header,
                index
              ) => (
                <th
                  key={
                    header
                  }
                  className={`px-4 py-3 text-xs font-medium uppercase tracking-[0.12em] text-slate-500 ${
                    index >
                    0
                      ? "text-right"
                      : ""
                  }`}
                >
                  {header}
                </th>
              )
            )}
          </tr>
        </thead>

        <tbody>
          {rows.map(
            (
              row,
              rowIndex
            ) => (
              <tr
                key={
                  rowIndex
                }
                className="border-t border-white/[0.06]"
              >
                {row.map(
                  (
                    cell,
                    cellIndex
                  ) => (
                    <td
                      key={
                        cellIndex
                      }
                      className={`px-4 py-3 text-sm ${
                        cellIndex ===
                        0
                          ? "font-medium text-white"
                          : "text-right text-slate-300"
                      }`}
                    >
                      {cell}
                    </td>
                  )
                )}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

type TrendRange =
  | "report"
  | "7d"
  | "1m"
  | "3m"
  | "6m"
  | "12m";

const TREND_RANGES: {
  value: TrendRange;
  label: string;
}[] = [
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
      range === "1m"
        ? 1
        : range === "3m"
          ? 3
          : range === "6m"
            ? 6
            : 12;

    start.setUTCMonth(start.getUTCMonth() - months);
    start.setUTCDate(start.getUTCDate() + 1);
  }

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function UsageTrendCard({
  reportData,
}: {
  reportData: DailyActivityItem[];
}) {
  const [range, setRange] =
    useState<TrendRange>("report");

  const [rangeData, setRangeData] =
    useState<DailyActivityItem[] | null>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    if (range === "report") {
      setRangeData(null);
      setError("");
      return;
    }

    let cancelled = false;

    const { start, end } = getTrendRange(range);

    setLoading(true);
    setError("");

    fetch(
      `/api/usage/backoffice-app/summary?start=${start}&end=${end}`,
      { cache: "no-store" }
    )
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Failed to load trend data."
          );
        }

        if (!cancelled) {
          setRangeData(data.dailyActivity ?? []);
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

    // reportData changes after an import or a page
    // filter change, so the chosen range refreshes too.
  }, [range, reportData]);

  const data =
    range === "report"
      ? reportData
      : rangeData ?? [];

  const hasChart =
    data.length >= 2 &&
    data.some((item) => item.users !== null);

  const rangeLabel =
    range === "report"
      ? null
      : (() => {
          const { start, end } =
            getTrendRange(range);

          return `${formatReportDate(
            start
          )} - ${formatReportDate(end)}`;
        })();

  return (
    <div className="pdf-card rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">
            Users &amp; Sessions Over Time
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-400">
            Daily unique users and sessions started each day.
            {rangeLabel && (
              <span className="text-slate-500">
                {" "}
                · {rangeLabel}
              </span>
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
              onClick={() =>
                setRange(option.value)
              }
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

      <div
        className={`mt-6 transition-opacity ${
          loading ? "opacity-40" : ""
        }`}
      >
        {error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : hasChart ? (
          <UsageTrendChart data={data} />
        ) : loading ? (
          <div className="px-4 py-16 text-center text-sm text-slate-500">
            Loading...
          </div>
        ) : (
          <EmptyState />
        )}
      </div>

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Users are unique per day, so daily figures will not add up to the period's Active Users. Gaps mark days with no records in the imported Datadog data.
      </p>
    </div>
  );
}

function niceMax(value: number) {
  if (value <= 0) {
    return 1;
  }

  const magnitude =
    10 ** Math.floor(Math.log10(value));

  const normalised = value / magnitude;

  const nice =
    normalised <= 1
      ? 1
      : normalised <= 2
        ? 2
        : normalised <= 5
          ? 5
          : 10;

  return nice * magnitude;
}

const CHART_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatChartDay(date: string) {
  const [, month, day] = date.split("-");

  return `${Number(day)} ${
    CHART_MONTHS[Number(month) - 1]
  }`;
}

function UsageTrendChart({
  data,
}: {
  data: DailyActivityItem[];
}) {
  const containerRef =
    useRef<HTMLDivElement | null>(null);

  const [width, setWidth] = useState(800);

  const [hoverIndex, setHoverIndex] =
    useState<number | null>(null);

  // Render at the container's real pixel width so
  // text and lines never scale up on wide screens.
  useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return;
    }

    const update = () =>
      setWidth(
        Math.max(element.clientWidth, 320)
      );

    update();

    const observer = new ResizeObserver(update);

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const height = 240;

  const pad = {
    top: 12,
    right: 12,
    bottom: 28,
    left: 36,
  };

  const innerWidth =
    width - pad.left - pad.right;

  const innerHeight =
    height - pad.top - pad.bottom;

  const values = data
    .flatMap((item) => [
      item.users,
      item.sessions,
    ])
    .filter(
      (value): value is number =>
        value !== null
    );

  const yMax = niceMax(
    Math.max(...values, 1)
  );

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(
    (fraction) =>
      Math.round(yMax * fraction)
  );

  const lastIndex = data.length - 1;

  const x = (index: number) =>
    pad.left +
    (index / Math.max(lastIndex, 1)) *
      innerWidth;

  const y = (value: number) =>
    pad.top +
    innerHeight -
    (value / yMax) * innerHeight;

  // Roughly one date label per 90px.
  const maxLabels = Math.max(
    2,
    Math.floor(innerWidth / 90)
  );

  const labelEvery = Math.max(
    1,
    Math.ceil(data.length / maxLabels)
  );

  const labelIndexes = data
    .map((_, index) => index)
    .filter(
      (index) =>
        index % labelEvery === 0
    );

  // Add the last day unless it would crowd
  // the previous label.
  if (
    lastIndex > 0 &&
    !labelIndexes.includes(lastIndex) &&
    lastIndex -
      labelIndexes[
        labelIndexes.length - 1
      ] >=
      labelEvery / 2
  ) {
    labelIndexes.push(lastIndex);
  }

  const showAllDots = data.length <= 31;

  const series = [
    {
      key: "users" as const,
      name: "Users",
      color: "#818cf8",
    },
    {
      key: "sessions" as const,
      name: "Sessions",
      color: "#2dd4bf",
    },
  ];

  // Split each line at null days so gaps stay visible.
  const buildPaths = (
    key: "users" | "sessions"
  ) => {
    const paths: string[] = [];
    let current = "";

    data.forEach((item, index) => {
      const value = item[key];

      if (value === null) {
        if (current) {
          paths.push(current);
        }

        current = "";
        return;
      }

      current += `${current ? "L" : "M"}${x(
        index
      )},${y(value)} `;
    });

    if (current) {
      paths.push(current);
    }

    return paths;
  };

  // A day with records but no neighbours has no
  // line to sit on, so it always gets a dot.
  const isIsolated = (index: number) =>
    data[index].users !== null &&
    (index === 0 ||
      data[index - 1].users === null) &&
    (index === lastIndex ||
      data[index + 1].users === null);

  function handleMouseMove(
    event: React.MouseEvent<SVGRectElement>
  ) {
    const bounds =
      event.currentTarget.getBoundingClientRect();

    const ratio =
      (event.clientX - bounds.left) /
      bounds.width;

    const index = Math.round(
      ratio * lastIndex
    );

    setHoverIndex(
      Math.min(
        Math.max(index, 0),
        lastIndex
      )
    );
  }

  const hovered =
    hoverIndex !== null
      ? data[hoverIndex]
      : null;

  const tooltipLeft =
    hoverIndex !== null
      ? Math.min(
          Math.max(x(hoverIndex), 70),
          width - 70
        )
      : 0;

  return (
    <div>
      <div className="mb-3 flex items-center gap-5 text-xs text-slate-400">
        {series.map((line) => (
          <div
            key={line.key}
            className="flex items-center gap-2"
          >
            <span
              className="inline-block h-0.5 w-4 rounded-full"
              style={{
                backgroundColor: line.color,
              }}
            />
            {line.name}
          </div>
        ))}
      </div>

      <div
        ref={containerRef}
        className="relative w-full"
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="block h-auto w-full"
          role="img"
          aria-label="Daily users and sessions"
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
              key={data[index].date}
              x={x(index)}
              y={height - 8}
              textAnchor={
                index === 0
                  ? "start"
                  : index === lastIndex
                    ? "end"
                    : "middle"
              }
              fontSize="11"
              fill="#64748b"
            >
              {formatChartDay(
                data[index].date
              )}
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
            buildPaths(line.key).map(
              (path, index) => (
                <path
                  key={`${line.key}-${index}`}
                  d={path}
                  fill="none"
                  stroke={line.color}
                  strokeWidth="1.75"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )
            )
          )}

          {series.map((line) =>
            data.map((item, index) => {
              const value = item[line.key];

              if (value === null) {
                return null;
              }

              const isHovered =
                index === hoverIndex;

              if (
                !showAllDots &&
                !isHovered &&
                !isIsolated(index)
              ) {
                return null;
              }

              return (
                <circle
                  key={`${line.key}-${item.date}`}
                  cx={x(index)}
                  cy={y(value)}
                  r={isHovered ? 4 : 2.5}
                  fill={
                    isHovered
                      ? line.color
                      : "#020617"
                  }
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
            onMouseLeave={() =>
              setHoverIndex(null)
            }
          />
        </svg>

        {hovered && (
          <div
            data-export-hide="true"
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-white/[0.10] bg-slate-950/95 px-3 py-2 text-xs shadow-lg"
            style={{ left: tooltipLeft }}
          >
            <div className="mb-1 font-medium text-white">
              {formatChartDay(hovered.date)}
            </div>

            {hovered.users === null ? (
              <div className="text-slate-500">
                No records
              </div>
            ) : (
              series.map((line) => (
                <div
                  key={line.key}
                  className="flex items-center justify-between gap-4 text-slate-300"
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor:
                          line.color,
                      }}
                    />
                    {line.name}
                  </span>

                  <span className="font-semibold text-white">
                    {(
                      hovered[line.key] ?? 0
                    ).toLocaleString()}
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

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.08] px-4 py-8 text-center text-sm text-slate-500">
      No data available for this period.
    </div>
  );
}
