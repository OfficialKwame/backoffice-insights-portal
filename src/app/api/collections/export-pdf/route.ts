import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/* =========================================================
 * TYPES
 * ======================================================= */

type OverallSummary = {
  eligible_attempts: number;
  successful_transactions: number;
  failed_transactions: number;
  success_rate: number;
  failure_rate: number;
  collected_value: number;
  failed_value: number;
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

type ChannelItem = {
  channel: string;
  attempts: number;
  successful: number;
  failed: number;
  success_rate: number;
  collected_value: number;
  failed_value: number;
};

type FailureAnalysisItem = {
  channel: string;
  clean_reason: string;
  count: number;
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
};

type CollectionsSummary = {
  overall: OverallSummary;
  daily_trend?: DailyTrendItem[];
  channels?: ChannelItem[];
  failure_analysis?: FailureAnalysisItem[];
  merchant_activity?: {
    top_merchants?: MerchantItem[];
  };
};

type MerchantMovement = {
  businessId: string;
  businessName: string;

  previousValue: number;
  currentValue: number;
  collectionDelta: number;

  previousAttempts: number;
  currentAttempts: number;
  attemptDelta: number;
  attemptPercentChange: number | null;

  previousSuccessRate: number;
  currentSuccessRate: number;
  successRateDelta: number;

  previousFailures: number;
  currentFailures: number;
  failureDelta: number;
};

type InvoiceSourceSummary = {
  source: string;
  invoices: number;
  invoiceValue: number;
  collected: number;
  outstanding: number;
  collectionRate: number;
};

type InvoiceMerchantSummary = {
  businessId: string;
  businessName: string;
  invoices: number;
  invoiceValue: number;
  collected: number;
  outstanding: number;
  collectionRate: number;
};

/* =========================================================
 * HELPERS
 * ======================================================= */

function safeNumber(value: unknown) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function formatCurrency(value: number) {
  return `GHS ${new Intl.NumberFormat("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function formatShortCurrency(value: number) {
  return new Intl.NumberFormat("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDailyDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);

  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function percentChange(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }

  return ((current - previous) / Math.abs(previous)) * 100;
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function merchantName(
  current: MerchantItem | undefined,
  previous: MerchantItem | undefined,
  businessId: string
) {
  const currentName = current?.business_name?.trim();
  const previousName = previous?.business_name?.trim();

  if (
    currentName &&
    currentName.toLowerCase() !== "unnamed business"
  ) {
    return currentName;
  }

  if (
    previousName &&
    previousName.toLowerCase() !== "unnamed business"
  ) {
    return previousName;
  }

  return currentName || previousName || businessId;
}

/* =========================================================
 * ROUTE
 * ======================================================= */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const periodId = searchParams.get("periodId");

    if (!periodId) {
      return NextResponse.json(
        {
          error: "periodId is required.",
        },
        {
          status: 400,
        }
      );
    }

    /* =====================================================
     * CURRENT PERIOD
     * =================================================== */

    const period = await prisma.collectionsPeriod.findUnique({
      where: {
        id: periodId,
      },
    });

    if (!period) {
      return NextResponse.json(
        {
          error: "Collections period not found.",
        },
        {
          status: 404,
        }
      );
    }

    const currentSummary =
      period.computedSummary as unknown as CollectionsSummary;

    if (!currentSummary?.overall) {
      return NextResponse.json(
        {
          error:
            "No computed collections summary is available for this period.",
        },
        {
          status: 400,
        }
      );
    }

    /* =====================================================
     * PREVIOUS PERIOD
     * =================================================== */

    const previousPeriod =
      await prisma.collectionsPeriod.findFirst({
        where: {
          periodStart: {
            lt: period.periodStart,
          },
        },
        orderBy: {
          periodStart: "desc",
        },
      });

    const previousSummary =
      previousPeriod?.computedSummary
        ? (previousPeriod.computedSummary as unknown as CollectionsSummary)
        : null;

    /* =====================================================
     * INVOICE DATA
     * =================================================== */

    const invoices =
      await prisma.collectionsInvoice.findMany({
        where: {
          invoiceCreatedAt: {
            gte: period.periodStart,
            lte: period.periodEnd,
          },
        },
        orderBy: {
          invoiceCreatedAt: "asc",
        },
      });

    const invoiceValue = invoices.reduce(
      (sum, invoice) =>
        sum + safeNumber(invoice.totalAmount),
      0
    );

    const invoiceCollected = invoices.reduce(
      (sum, invoice) =>
        sum + safeNumber(invoice.collectedAmount),
      0
    );

    const invoiceOutstanding = invoices.reduce(
      (sum, invoice) =>
        sum + safeNumber(invoice.outstandingAmount),
      0
    );

    const paidInvoices = invoices.filter(
      (invoice) =>
        safeNumber(invoice.outstandingAmount) <= 0
    ).length;

    const partiallyPaidInvoices = invoices.filter(
      (invoice) =>
        safeNumber(invoice.collectedAmount) > 0 &&
        safeNumber(invoice.outstandingAmount) > 0
    ).length;

    const unpaidInvoices = invoices.filter(
      (invoice) =>
        safeNumber(invoice.collectedAmount) <= 0 &&
        safeNumber(invoice.outstandingAmount) > 0
    ).length;

    const overdueInvoices = invoices.filter((invoice) => {
      if (!invoice.dueDate) {
        return false;
      }

      return (
        new Date(invoice.dueDate) <= period.periodEnd &&
        safeNumber(invoice.outstandingAmount) > 0
      );
    }).length;

    const invoiceCollectionRate =
      invoiceValue > 0
        ? (invoiceCollected / invoiceValue) * 100
        : 0;

    const invoiceBusinessKeys = new Set(
      invoices.map(
        (invoice) =>
          invoice.businessId ||
          invoice.businessName ||
          "Unknown"
      )
    );

    /* =====================================================
     * INVOICE SOURCE SUMMARY
     * =================================================== */

    const invoiceSourceMap = new Map<
      string,
      InvoiceSourceSummary
    >();

    for (const invoice of invoices) {
      const source =
        invoice.source?.trim() || "Unknown";

      const existing =
        invoiceSourceMap.get(source) ?? {
          source,
          invoices: 0,
          invoiceValue: 0,
          collected: 0,
          outstanding: 0,
          collectionRate: 0,
        };

      existing.invoices += 1;
      existing.invoiceValue += safeNumber(
        invoice.totalAmount
      );
      existing.collected += safeNumber(
        invoice.collectedAmount
      );
      existing.outstanding += safeNumber(
        invoice.outstandingAmount
      );

      invoiceSourceMap.set(source, existing);
    }

    const invoiceSources = Array.from(
      invoiceSourceMap.values()
    )
      .map((source) => ({
        ...source,
        collectionRate:
          source.invoiceValue > 0
            ? (source.collected /
                source.invoiceValue) *
              100
            : 0,
      }))
      .sort(
        (a, b) =>
          b.invoiceValue - a.invoiceValue
      );

    /* =====================================================
     * INVOICE MERCHANT SUMMARY
     * =================================================== */

    const invoiceMerchantMap = new Map<
      string,
      InvoiceMerchantSummary
    >();

    for (const invoice of invoices) {
      const businessId =
        invoice.businessId ||
        invoice.businessName ||
        "Unknown";

      const businessName =
        invoice.businessName?.trim() ||
        invoice.businessId ||
        "Unknown Business";

      const existing =
        invoiceMerchantMap.get(businessId) ?? {
          businessId,
          businessName,
          invoices: 0,
          invoiceValue: 0,
          collected: 0,
          outstanding: 0,
          collectionRate: 0,
        };

      existing.invoices += 1;
      existing.invoiceValue += safeNumber(
        invoice.totalAmount
      );
      existing.collected += safeNumber(
        invoice.collectedAmount
      );
      existing.outstanding += safeNumber(
        invoice.outstandingAmount
      );

      invoiceMerchantMap.set(
        businessId,
        existing
      );
    }

    const invoiceMerchants = Array.from(
      invoiceMerchantMap.values()
    )
      .map((merchant) => ({
        ...merchant,
        collectionRate:
          merchant.invoiceValue > 0
            ? (merchant.collected /
                merchant.invoiceValue) *
              100
            : 0,
      }))
      .sort(
        (a, b) =>
          b.invoiceValue - a.invoiceValue
      )
      .slice(0, 15);

    /* =====================================================
     * MERCHANT MOVEMENT
     * =================================================== */

    const currentMerchants =
      currentSummary.merchant_activity
        ?.top_merchants ?? [];

    const previousMerchants =
      previousSummary?.merchant_activity
        ?.top_merchants ?? [];

    const currentById = new Map(
      currentMerchants.map((merchant) => [
        merchant.business_id,
        merchant,
      ])
    );

    const previousById = new Map(
      previousMerchants.map((merchant) => [
        merchant.business_id,
        merchant,
      ])
    );

    const merchantIds = Array.from(
      new Set([
        ...currentMerchants.map(
          (merchant) => merchant.business_id
        ),
        ...previousMerchants.map(
          (merchant) => merchant.business_id
        ),
      ])
    );

    const merchantMovements: MerchantMovement[] =
      merchantIds.map((businessId) => {
        const current =
          currentById.get(businessId);

        const previous =
          previousById.get(businessId);

        const previousAttempts = safeNumber(
          previous?.attempts
        );

        const currentAttempts = safeNumber(
          current?.attempts
        );

        return {
          businessId,

          businessName: merchantName(
            current,
            previous,
            businessId
          ),

          previousValue: safeNumber(
            previous?.collected_value
          ),

          currentValue: safeNumber(
            current?.collected_value
          ),

          collectionDelta:
            safeNumber(
              current?.collected_value
            ) -
            safeNumber(
              previous?.collected_value
            ),

          previousAttempts,

          currentAttempts,

          attemptDelta:
            currentAttempts -
            previousAttempts,

          attemptPercentChange:
            percentChange(
              currentAttempts,
              previousAttempts
            ),

          previousSuccessRate: safeNumber(
            previous?.success_rate
          ),

          currentSuccessRate: safeNumber(
            current?.success_rate
          ),

          successRateDelta:
            safeNumber(
              current?.success_rate
            ) -
            safeNumber(
              previous?.success_rate
            ),

          previousFailures: safeNumber(
            previous?.failed
          ),

          currentFailures: safeNumber(
            current?.failed
          ),

          failureDelta:
            safeNumber(current?.failed) -
            safeNumber(previous?.failed),
        };
      });

    const biggestIncreases = [
      ...merchantMovements,
    ]
      .filter(
        (merchant) =>
          merchant.collectionDelta > 0
      )
      .sort(
        (a, b) =>
          b.collectionDelta -
          a.collectionDelta
      )
      .slice(0, 10);

    const biggestDecreases = [
      ...merchantMovements,
    ]
      .filter(
        (merchant) =>
          merchant.collectionDelta < 0
      )
      .sort(
        (a, b) =>
          a.collectionDelta -
          b.collectionDelta
      )
      .slice(0, 10);

    const biggestSuccessRateDrops = [
      ...merchantMovements,
    ]
      .filter(
        (merchant) =>
          merchant.previousAttempts > 0 &&
          merchant.currentAttempts > 0 &&
          merchant.successRateDelta < 0
      )
      .sort(
        (a, b) =>
          a.successRateDelta -
          b.successRateDelta
      )
      .slice(0, 10);

    const biggestFailureIncreases = [
      ...merchantMovements,
    ]
      .filter(
        (merchant) =>
          merchant.failureDelta > 0
      )
      .sort(
        (a, b) =>
          b.failureDelta -
          a.failureDelta
      )
      .slice(0, 10);

   const biggestActivityDrops = [
  ...merchantMovements,
]
  .filter((merchant) => {
    const hasMeaningfulName =
      merchant.businessName &&
      merchant.businessName.toLowerCase() !==
        "unnamed business";

    return (
      hasMeaningfulName &&
      merchant.previousAttempts >= 10 &&
      merchant.currentAttempts <
        merchant.previousAttempts
    );
  })
  .sort((a, b) => {
    const aAbsoluteDrop =
      a.previousAttempts -
      a.currentAttempts;

    const bAbsoluteDrop =
      b.previousAttempts -
      b.currentAttempts;

    if (bAbsoluteDrop !== aAbsoluteDrop) {
      return bAbsoluteDrop - aAbsoluteDrop;
    }

    const aPercent =
      a.attemptPercentChange ?? 0;

    const bPercent =
      b.attemptPercentChange ?? 0;

    return aPercent - bPercent;
  })
  .slice(0, 15);

    /* =====================================================
     * PDF SETUP
     * =================================================== */

    const pdfDoc =
      await PDFDocument.create();

    const regularFont =
      await pdfDoc.embedFont(
        StandardFonts.Helvetica
      );

    const boldFont =
      await pdfDoc.embedFont(
        StandardFonts.HelveticaBold
      );

    const pageWidth = 595.28;
    const pageHeight = 841.89;

    const margin = 42;

    const headingColor = rgb(
      0.08,
      0.12,
      0.2
    );

    const bodyColor = rgb(
      0.2,
      0.24,
      0.32
    );

    const mutedColor = rgb(
      0.42,
      0.46,
      0.55
    );

    const lineColor = rgb(
      0.87,
      0.89,
      0.92
    );

    let page = pdfDoc.addPage([
      pageWidth,
      pageHeight,
    ]);

    let y = pageHeight - margin;

    function addPage() {
      page = pdfDoc.addPage([
        pageWidth,
        pageHeight,
      ]);

      y = pageHeight - margin;
    }

    function ensureSpace(
      heightNeeded: number
    ) {
      if (
        y - heightNeeded <
        margin
      ) {
        addPage();
      }
    }

    function drawText(
      text: string,
      options?: {
        size?: number;
        bold?: boolean;
        color?: ReturnType<
          typeof rgb
        >;
        x?: number;
      }
    ) {
      const size =
        options?.size ?? 10;

      const font =
        options?.bold
          ? boldFont
          : regularFont;

      const color =
        options?.color ??
        bodyColor;

      const x =
        options?.x ?? margin;

      page.drawText(text, {
        x,
        y,
        size,
        font,
        color,
      });
    }

    function drawDivider() {
      page.drawLine({
        start: {
          x: margin,
          y,
        },
        end: {
          x: pageWidth - margin,
          y,
        },
        thickness: 0.7,
        color: lineColor,
      });

      y -= 14;
    }

    function drawSectionTitle(
      title: string
    ) {
      ensureSpace(42);

      y -= 8;

      drawText(title, {
        size: 14,
        bold: true,
        color: headingColor,
      });

      y -= 20;
    }

    function drawKeyValue(
      label: string,
      value: string
    ) {
      ensureSpace(20);

      drawText(label, {
        size: 9,
        color: mutedColor,
      });

      drawText(value, {
        size: 10,
        bold: true,
        x: margin + 185,
        color: headingColor,
      });

      y -= 18;
    }

    function startNewReportPage(
      title: string
    ) {
      addPage();

      drawText(title, {
        size: 18,
        bold: true,
        color: headingColor,
      });

      y -= 28;

      drawDivider();
    }

    /* =====================================================
     * HEADER
     * =================================================== */

    const overall =
      currentSummary.overall;

    drawText(
      "Collections Performance Report",
      {
        size: 22,
        bold: true,
        color: headingColor,
      }
    );

    y -= 30;

    drawText(
      `${formatDate(
        period.periodStart
      )} - ${formatDate(
        period.periodEnd
      )}`,
      {
        size: 11,
        color: mutedColor,
      }
    );

    y -= 18;

    drawText(
      period.isComplete
        ? "Complete reporting week"
        : `Partial reporting week - ${period.daysCovered}/${period.expectedDays} days covered`,
      {
        size: 9,
        color: mutedColor,
      }
    );

    y -= 22;

    drawDivider();

    /* =====================================================
     * DIRECT SUMMARY
     * =================================================== */

    drawSectionTitle(
      "Direct Collections Summary"
    );

    drawKeyValue(
      "Success Rate",
      `${safeNumber(
        overall.success_rate
      ).toFixed(2)}%`
    );

    drawKeyValue(
      "Collected Value",
      formatCurrency(
        safeNumber(
          overall.collected_value
        )
      )
    );

    drawKeyValue(
      "Successful Transactions",
      safeNumber(
        overall.successful_transactions
      ).toLocaleString()
    );

    drawKeyValue(
      "Failed Transactions",
      safeNumber(
        overall.failed_transactions
      ).toLocaleString()
    );

    drawKeyValue(
      "Total Attempts",
      safeNumber(
        overall.eligible_attempts
      ).toLocaleString()
    );

    drawKeyValue(
      "Failure Rate",
      `${safeNumber(
        overall.failure_rate
      ).toFixed(2)}%`
    );

    drawKeyValue(
      "Failed Value",
      formatCurrency(
        safeNumber(
          overall.failed_value
        )
      )
    );

    /* =====================================================
     * WEEK-ON-WEEK
     * =================================================== */

    if (previousSummary?.overall) {
      drawSectionTitle(
        "Week-on-Week Movement"
      );

      const previousOverall =
        previousSummary.overall;

      const successRateChange =
        safeNumber(
          overall.success_rate
        ) -
        safeNumber(
          previousOverall.success_rate
        );

      const collectedChange =
        percentChange(
          safeNumber(
            overall.collected_value
          ),
          safeNumber(
            previousOverall.collected_value
          )
        );

      const attemptsChange =
        percentChange(
          safeNumber(
            overall.eligible_attempts
          ),
          safeNumber(
            previousOverall.eligible_attempts
          )
        );

      const failuresChange =
        percentChange(
          safeNumber(
            overall.failed_transactions
          ),
          safeNumber(
            previousOverall.failed_transactions
          )
        );

      drawKeyValue(
        "Success Rate Change",
        `${
          successRateChange >= 0
            ? "+"
            : ""
        }${successRateChange.toFixed(
          2
        )} pp`
      );

      drawKeyValue(
        "Collected Value Change",
        collectedChange === null
          ? "N/A"
          : `${
              collectedChange >= 0
                ? "+"
                : ""
            }${collectedChange.toFixed(
              2
            )}%`
      );

      drawKeyValue(
        "Attempts Change",
        attemptsChange === null
          ? "N/A"
          : `${
              attemptsChange >= 0
                ? "+"
                : ""
            }${attemptsChange.toFixed(
              2
            )}%`
      );

      drawKeyValue(
        "Failed Transactions Change",
        failuresChange === null
          ? "N/A"
          : `${
              failuresChange >= 0
                ? "+"
                : ""
            }${failuresChange.toFixed(
              2
            )}%`
      );
    }

    /* =====================================================
     * DAILY PERFORMANCE
     * =================================================== */

    const dailyTrend =
      currentSummary.daily_trend ?? [];

    if (dailyTrend.length > 0) {
      drawSectionTitle(
        "Daily Performance"
      );

      drawText("Date", {
        size: 8,
        bold: true,
      });

      drawText("Attempts", {
        size: 8,
        bold: true,
        x: 135,
      });

      drawText("Success", {
        size: 8,
        bold: true,
        x: 200,
      });

      drawText("Failed", {
        size: 8,
        bold: true,
        x: 260,
      });

      drawText("SR", {
        size: 8,
        bold: true,
        x: 315,
      });

      drawText("Collected", {
        size: 8,
        bold: true,
        x: 375,
      });

      y -= 16;

      drawDivider();

      for (const day of dailyTrend) {
        ensureSpace(21);

        drawText(
          formatDailyDate(day.date),
          {
            size: 8,
          }
        );

        drawText(
          safeNumber(
            day.attempts
          ).toLocaleString(),
          {
            size: 8,
            x: 135,
          }
        );

        drawText(
          safeNumber(
            day.successful
          ).toLocaleString(),
          {
            size: 8,
            x: 200,
          }
        );

        drawText(
          safeNumber(
            day.failed
          ).toLocaleString(),
          {
            size: 8,
            x: 260,
          }
        );

        drawText(
          `${safeNumber(
            day.success_rate
          ).toFixed(2)}%`,
          {
            size: 8,
            x: 315,
          }
        );

        drawText(
          formatCurrency(
            safeNumber(
              day.collected_value
            )
          ),
          {
            size: 8,
            x: 375,
          }
        );

        y -= 17;
      }
    }

    /* =====================================================
     * CHANNEL WEEK-ON-WEEK
     * =================================================== */

    const channels =
      currentSummary.channels ?? [];

    const previousChannels =
      previousSummary?.channels ?? [];

    if (channels.length > 0) {
      drawSectionTitle(
        "Channel Week-on-Week"
      );

      const previousChannelMap =
        new Map(
          previousChannels.map(
            (channel) => [
              channel.channel,
              channel,
            ]
          )
        );

      drawText("Channel", {
        size: 8,
        bold: true,
      });

      drawText("Attempts", {
        size: 8,
        bold: true,
        x: 145,
      });

      drawText("SR", {
        size: 8,
        bold: true,
        x: 240,
      });

      drawText("Failures", {
        size: 8,
        bold: true,
        x: 335,
      });

      drawText("Collected", {
        size: 8,
        bold: true,
        x: 425,
      });

      y -= 16;

      drawDivider();

      for (const channel of channels) {
        ensureSpace(24);

        const previous =
          previousChannelMap.get(
            channel.channel
          );

        drawText(
          truncate(
            channel.channel,
            16
          ),
          {
            size: 7.5,
            bold: true,
          }
        );

        drawText(
          `${safeNumber(
            previous?.attempts
          ).toLocaleString()} -> ${safeNumber(
            channel.attempts
          ).toLocaleString()}`,
          {
            size: 7,
            x: 145,
          }
        );

        drawText(
          `${safeNumber(
            previous?.success_rate
          ).toFixed(1)}% -> ${safeNumber(
            channel.success_rate
          ).toFixed(1)}%`,
          {
            size: 7,
            x: 240,
          }
        );

        drawText(
          `${safeNumber(
            previous?.failed
          ).toLocaleString()} -> ${safeNumber(
            channel.failed
          ).toLocaleString()}`,
          {
            size: 7,
            x: 335,
          }
        );

        drawText(
          `${formatShortCurrency(
            safeNumber(
              previous?.collected_value
            )
          )} -> ${formatShortCurrency(
            safeNumber(
              channel.collected_value
            )
          )}`,
          {
            size: 6.4,
            x: 425,
          }
        );

        y -= 18;
      }
    }

    /* =====================================================
     * MERCHANT MOVEMENT PAGES
     * =================================================== */

    startNewReportPage(
      "Merchant Movement"
    );

    function drawCollectionMovementTable(
      title: string,
      items: MerchantMovement[]
    ) {
      if (items.length === 0) {
        return;
      }

      drawSectionTitle(title);

      drawText("Merchant", {
        size: 8,
        bold: true,
      });

      drawText("Previous", {
        size: 8,
        bold: true,
        x: 250,
      });

      drawText("Current", {
        size: 8,
        bold: true,
        x: 345,
      });

      drawText("Attempts", {
        size: 8,
        bold: true,
        x: 445,
      });

      y -= 16;

      drawDivider();

      for (const merchant of items) {
        ensureSpace(21);

        drawText(
          truncate(
            merchant.businessName,
            31
          ),
          {
            size: 7.5,
          }
        );

        drawText(
          formatShortCurrency(
            merchant.previousValue
          ),
          {
            size: 7.2,
            x: 250,
          }
        );

        drawText(
          formatShortCurrency(
            merchant.currentValue
          ),
          {
            size: 7.2,
            x: 345,
          }
        );

        drawText(
          `${merchant.previousAttempts.toLocaleString()} -> ${merchant.currentAttempts.toLocaleString()}`,
          {
            size: 7.2,
            x: 445,
          }
        );

        y -= 17;
      }
    }

    drawCollectionMovementTable(
      "Biggest Collection Increases",
      biggestIncreases
    );

    drawCollectionMovementTable(
      "Biggest Collection Decreases",
      biggestDecreases
    );

    if (
      biggestSuccessRateDrops.length >
      0
    ) {
      drawSectionTitle(
        "Biggest Success-Rate Drops"
      );

      drawText("Merchant", {
        size: 8,
        bold: true,
      });

      drawText("Previous SR", {
        size: 8,
        bold: true,
        x: 300,
      });

      drawText("Current SR", {
        size: 8,
        bold: true,
        x: 390,
      });

      drawText("Change", {
        size: 8,
        bold: true,
        x: 480,
      });

      y -= 16;

      drawDivider();

      for (const merchant of biggestSuccessRateDrops) {
        ensureSpace(21);

        drawText(
          truncate(
            merchant.businessName,
            36
          ),
          {
            size: 7.5,
          }
        );

        drawText(
          `${merchant.previousSuccessRate.toFixed(
            2
          )}%`,
          {
            size: 7.5,
            x: 300,
          }
        );

        drawText(
          `${merchant.currentSuccessRate.toFixed(
            2
          )}%`,
          {
            size: 7.5,
            x: 390,
          }
        );

        drawText(
          `${merchant.successRateDelta.toFixed(
            2
          )} pp`,
          {
            size: 7.5,
            x: 480,
          }
        );

        y -= 17;
      }
    }

    if (
      biggestFailureIncreases.length >
      0
    ) {
      drawSectionTitle(
        "Biggest Failure Increases"
      );

      drawText("Merchant", {
        size: 8,
        bold: true,
      });

      drawText("Previous", {
        size: 8,
        bold: true,
        x: 310,
      });

      drawText("Current", {
        size: 8,
        bold: true,
        x: 390,
      });

      drawText("Increase", {
        size: 8,
        bold: true,
        x: 475,
      });

      y -= 16;

      drawDivider();

      for (const merchant of biggestFailureIncreases) {
        ensureSpace(21);

        drawText(
          truncate(
            merchant.businessName,
            38
          ),
          {
            size: 7.5,
          }
        );

        drawText(
          merchant.previousFailures.toLocaleString(),
          {
            size: 7.5,
            x: 310,
          }
        );

        drawText(
          merchant.currentFailures.toLocaleString(),
          {
            size: 7.5,
            x: 390,
          }
        );

        drawText(
          `+${merchant.failureDelta.toLocaleString()}`,
          {
            size: 7.5,
            x: 475,
          }
        );

        y -= 17;
      }
    }

    /* =====================================================
     * MERCHANT ACTIVITY DROPS
     * =================================================== */

    if (
      biggestActivityDrops.length >
      0
    ) {
      startNewReportPage(
        "Merchant Activity"
      );

      drawSectionTitle(
        "Biggest Merchant Activity Drops"
      );

      drawText("Merchant", {
        size: 8,
        bold: true,
      });

      drawText("Previous", {
        size: 8,
        bold: true,
        x: 300,
      });

      drawText("Current", {
        size: 8,
        bold: true,
        x: 380,
      });

      drawText("Change", {
        size: 8,
        bold: true,
        x: 455,
      });

      y -= 16;

      drawDivider();

      for (const merchant of biggestActivityDrops) {
        ensureSpace(22);

        drawText(
          truncate(
            merchant.businessName,
            37
          ),
          {
            size: 7.5,
          }
        );

        drawText(
          merchant.previousAttempts.toLocaleString(),
          {
            size: 7.5,
            x: 300,
          }
        );

        drawText(
          merchant.currentAttempts.toLocaleString(),
          {
            size: 7.5,
            x: 380,
          }
        );

        const change =
          merchant.attemptPercentChange;

        drawText(
          change === null
            ? "N/A"
            : `${change.toFixed(
                1
              )}%`,
          {
            size: 7.5,
            x: 455,
          }
        );

        y -= 17;
      }

      y -= 6;

      drawText(
        "Activity movement is based on transaction attempts, not collection value.",
        {
          size: 7.5,
          color: mutedColor,
        }
      );

      y -= 18;
    }

    /* =====================================================
     * FAILURE ANALYSIS
     * =================================================== */

    const failureAnalysis =
      currentSummary.failure_analysis ??
      [];

    if (failureAnalysis.length > 0) {
      drawSectionTitle(
        "Top Failure Reasons"
      );

      const groupedFailures =
        failureAnalysis.reduce<
          Record<string, number>
        >((acc, item) => {
          acc[item.clean_reason] =
            (acc[
              item.clean_reason
            ] ?? 0) +
            safeNumber(item.count);

          return acc;
        }, {});

      const topFailures =
        Object.entries(
          groupedFailures
        )
          .map(
            ([reason, count]) => ({
              reason,
              count,
            })
          )
          .sort(
            (a, b) =>
              b.count - a.count
          )
          .slice(0, 10);

      for (const item of topFailures) {
        ensureSpace(21);

        drawText(
          truncate(
            item.reason,
            60
          ),
          {
            size: 8,
          }
        );

        drawText(
          item.count.toLocaleString(),
          {
            size: 8,
            bold: true,
            x: 500,
          }
        );

        y -= 17;
      }
    }

    /* =====================================================
     * INVOICE COLLECTIONS
     * =================================================== */

    startNewReportPage(
      "Invoice Collections"
    );

    drawSectionTitle(
      "Invoice Collections Summary"
    );

    drawKeyValue(
      "Invoices Created",
      invoices.length.toLocaleString()
    );

    drawKeyValue(
      "Invoice Value",
      formatCurrency(
        invoiceValue
      )
    );

    drawKeyValue(
      "Paid Invoices",
      paidInvoices.toLocaleString()
    );

    drawKeyValue(
      "Partially Paid Invoices",
      partiallyPaidInvoices.toLocaleString()
    );

    drawKeyValue(
      "Unpaid Invoices",
      unpaidInvoices.toLocaleString()
    );

    drawKeyValue(
      "Amount Collected",
      formatCurrency(
        invoiceCollected
      )
    );

    drawKeyValue(
      "Outstanding Value",
      formatCurrency(
        invoiceOutstanding
      )
    );

    drawKeyValue(
      "Collection Rate",
      `${invoiceCollectionRate.toFixed(
        2
      )}%`
    );

    drawKeyValue(
      "Overdue Invoices",
      overdueInvoices.toLocaleString()
    );

    drawKeyValue(
      "Businesses",
      invoiceBusinessKeys.size.toLocaleString()
    );

    y -= 4;

    drawText(
      "Invoice figures reflect invoices created during the selected reporting week.",
      {
        size: 7.5,
        color: mutedColor,
      }
    );

    y -= 18;

    drawText(
      "Collected amount is cumulative against each invoice, not necessarily cash received during this week.",
      {
        size: 7.5,
        color: mutedColor,
      }
    );

    y -= 18;

    /* =====================================================
     * INVOICE SOURCE PERFORMANCE
     * =================================================== */

    if (invoiceSources.length > 0) {
      drawSectionTitle(
        "Invoice Performance by Source"
      );

      drawText("Source", {
        size: 8,
        bold: true,
      });

      drawText("Invoices", {
        size: 8,
        bold: true,
        x: 145,
      });

      drawText("Invoice Value", {
        size: 8,
        bold: true,
        x: 210,
      });

      drawText("Collected", {
        size: 8,
        bold: true,
        x: 315,
      });

      drawText("Outstanding", {
        size: 8,
        bold: true,
        x: 410,
      });

      drawText("Rate", {
        size: 8,
        bold: true,
        x: 505,
      });

      y -= 16;

      drawDivider();

      for (const source of invoiceSources) {
        ensureSpace(21);

        drawText(
          truncate(
            source.source,
            15
          ),
          {
            size: 7.5,
          }
        );

        drawText(
          source.invoices.toLocaleString(),
          {
            size: 7.5,
            x: 145,
          }
        );

        drawText(
          formatShortCurrency(
            source.invoiceValue
          ),
          {
            size: 7,
            x: 210,
          }
        );

        drawText(
          formatShortCurrency(
            source.collected
          ),
          {
            size: 7,
            x: 315,
          }
        );

        drawText(
          formatShortCurrency(
            source.outstanding
          ),
          {
            size: 7,
            x: 410,
          }
        );

        drawText(
          `${source.collectionRate.toFixed(
            1
          )}%`,
          {
            size: 7.5,
            x: 505,
          }
        );

        y -= 17;
      }
    }

    /* =====================================================
     * INVOICE MERCHANT PERFORMANCE
     * =================================================== */

    if (
      invoiceMerchants.length > 0
    ) {
      drawSectionTitle(
        "Invoice Merchant Performance"
      );

      drawText("Merchant", {
        size: 8,
        bold: true,
      });

      drawText("Inv.", {
        size: 8,
        bold: true,
        x: 250,
      });

      drawText("Value", {
        size: 8,
        bold: true,
        x: 290,
      });

      drawText("Collected", {
        size: 8,
        bold: true,
        x: 375,
      });

      drawText("Outstanding", {
        size: 8,
        bold: true,
        x: 460,
      });

      y -= 16;

      drawDivider();

      for (const merchant of invoiceMerchants) {
        ensureSpace(22);

        drawText(
          truncate(
            merchant.businessName,
            30
          ),
          {
            size: 7.3,
          }
        );

        drawText(
          merchant.invoices.toLocaleString(),
          {
            size: 7.3,
            x: 250,
          }
        );

        drawText(
          formatShortCurrency(
            merchant.invoiceValue
          ),
          {
            size: 6.8,
            x: 290,
          }
        );

        drawText(
          formatShortCurrency(
            merchant.collected
          ),
          {
            size: 6.8,
            x: 375,
          }
        );

        drawText(
          formatShortCurrency(
            merchant.outstanding
          ),
          {
            size: 6.8,
            x: 460,
          }
        );

        y -= 17;
      }
    }

    /* =====================================================
     * FOOTER
     * =================================================== */

    ensureSpace(45);

    y -= 12;

    drawDivider();

    drawText(
      "Generated from the Back Office Insights Portal.",
      {
        size: 8,
        color: mutedColor,
      }
    );

    /* =====================================================
     * SAVE PDF
     * =================================================== */

    const pdfBytes =
      await pdfDoc.save();

    const fileName =
      `collections-${formatDate(
        period.periodStart
      )
        .replace(/\s+/g, "-")
        .toLowerCase()}-${formatDate(
        period.periodEnd
      )
        .replace(/\s+/g, "-")
        .toLowerCase()}.pdf`;

    return new NextResponse(
      Buffer.from(pdfBytes),
      {
        status: 200,
        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            `attachment; filename="${fileName}"`,
        },
      }
    );
  } catch (error) {
    console.error(
      "Collections PDF export failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to generate collections PDF.",
      },
      {
        status: 500,
      }
    );
  }
}