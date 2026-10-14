import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function normalizeSource(source: string | null) {
  const value = (source ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  if (value === "mpos") {
    return "mPOS";
  }

  if (
    value === "bolite" ||
    value === "bo-lite" ||
    value === "backofficelite"
  ) {
    return "BO Lite";
  }

  return source?.trim() || "Unknown";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    if (!startParam || !endParam) {
      return NextResponse.json(
        {
          error:
            "Both start and end dates are required.",
        },
        { status: 400 }
      );
    }

    const parsedStart = new Date(startParam);
    const parsedEnd = new Date(endParam);

    if (
      Number.isNaN(parsedStart.getTime()) ||
      Number.isNaN(parsedEnd.getTime())
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid reporting period dates.",
        },
        { status: 400 }
      );
    }

    const periodStart = startOfDay(parsedStart);
    const periodEnd = endOfDay(parsedEnd);

    /*
     * V1 cohort:
     * invoices CREATED during the selected
     * reporting period.
     */
    const invoices =
      await prisma.collectionsInvoice.findMany({
        where: {
          invoiceCreatedAt: {
            gte: periodStart,
            lte: periodEnd,
          },
        },

        orderBy: {
          invoiceCreatedAt: "asc",
        },
      });

    /*
     * Data coverage
     *
     * A day is considered covered when at
     * least one invoice record exists with
     * invoiceCreatedAt on that date.
     */
    const coveredDateSet = new Set(
      invoices.map((invoice) =>
        invoice.invoiceCreatedAt
          .toISOString()
          .slice(0, 10)
      )
    );

    const allDates: string[] = [];

    const currentDate = new Date(
      `${startParam}T00:00:00.000Z`
    );

    const finalDate = new Date(
      `${endParam}T00:00:00.000Z`
    );

    while (currentDate <= finalDate) {
      allDates.push(
        currentDate
          .toISOString()
          .slice(0, 10)
      );

      currentDate.setUTCDate(
        currentDate.getUTCDate() + 1
      );
    }

    const coveredDates = allDates.filter(
      (date) => coveredDateSet.has(date)
    );

    const missingDates = allDates.filter(
      (date) => !coveredDateSet.has(date)
    );

    const dataCoverage = {
      calendarDays: allDates.length,
      activeDays: coveredDates.length,

      coveragePercent:
        allDates.length > 0
          ? Number(
              (
                (coveredDates.length /
                  allDates.length) *
                100
              ).toFixed(1)
            )
          : 0,

      coveredDates,
      missingDates,
    };

    const overdueAsOf = periodEnd;

    let invoiceValue = 0;
    let amountCollected = 0;
    let outstandingValue = 0;

    let paidInvoices = 0;
    let partiallyPaidInvoices = 0;
    let unpaidInvoices = 0;
    let overdueInvoices = 0;

    const businesses = new Set<string>();

    const sourceMap = new Map<
      string,
      {
        source: string;
        invoices: number;
        invoiceValue: number;
        amountCollected: number;
        outstandingValue: number;
      }
    >();

    const merchantMap = new Map<
      string,
      {
        businessId: string;
        businessName: string;
        invoices: number;
        invoiceValue: number;
        amountCollected: number;
        outstandingValue: number;
      }
    >();

    for (const invoice of invoices) {
      const total = Number(
        invoice.totalAmount
      );

      const collected = Number(
        invoice.collectedAmount
      );

      const outstanding = Number(
        invoice.outstandingAmount
      );

      invoiceValue += total;
      amountCollected += collected;
      outstandingValue += outstanding;

      /*
       * Determine payment state from amounts
       * rather than depending only on the
       * source Status text.
       */
      if (
        outstanding <= 0 &&
        collected >= total &&
        total > 0
      ) {
        paidInvoices += 1;
      } else if (
        collected > 0 &&
        outstanding > 0
      ) {
        partiallyPaidInvoices += 1;
      } else {
        unpaidInvoices += 1;
      }

      /*
       * An invoice is overdue only when:
       * - it has a due date
       * - the due date has passed
       * - money is still outstanding
       */
      if (
        invoice.dueDate &&
        invoice.dueDate < overdueAsOf &&
        outstanding > 0
      ) {
        overdueInvoices += 1;
      }

      if (invoice.businessId) {
        businesses.add(
          invoice.businessId
        );
      }

      /*
       * Source breakdown
       */
      const source = normalizeSource(
        invoice.source
      );

      const existingSource =
        sourceMap.get(source) ?? {
          source,
          invoices: 0,
          invoiceValue: 0,
          amountCollected: 0,
          outstandingValue: 0,
        };

      existingSource.invoices += 1;
      existingSource.invoiceValue += total;
      existingSource.amountCollected +=
        collected;
      existingSource.outstandingValue +=
        outstanding;

      sourceMap.set(
        source,
        existingSource
      );

      /*
       * Merchant breakdown
       */
      const businessKey =
        invoice.businessId ||
        invoice.businessName ||
        "UNKNOWN";

      const existingMerchant =
        merchantMap.get(businessKey) ?? {
          businessId:
            invoice.businessId ??
            "Unknown",

          businessName:
            invoice.businessName ??
            "Unknown Business",

          invoices: 0,
          invoiceValue: 0,
          amountCollected: 0,
          outstandingValue: 0,
        };

      existingMerchant.invoices += 1;
      existingMerchant.invoiceValue +=
        total;
      existingMerchant.amountCollected +=
        collected;
      existingMerchant.outstandingValue +=
        outstanding;

      merchantMap.set(
        businessKey,
        existingMerchant
      );
    }

    const collectionRate =
      invoiceValue > 0
        ? (amountCollected /
            invoiceValue) *
          100
        : 0;

    const sources = Array.from(
      sourceMap.values()
    )
      .map((source) => ({
        ...source,

        collectionRate:
          source.invoiceValue > 0
            ? (source.amountCollected /
                source.invoiceValue) *
              100
            : 0,
      }))
      .sort(
        (a, b) =>
          b.invoiceValue -
          a.invoiceValue
      );

    const merchants = Array.from(
      merchantMap.values()
    )
      .map((merchant) => ({
        ...merchant,

        collectionRate:
          merchant.invoiceValue > 0
            ? (merchant.amountCollected /
                merchant.invoiceValue) *
              100
            : 0,
      }))
      .sort(
        (a, b) =>
          b.invoiceValue -
          a.invoiceValue
      );

    const discrepancies = invoices
      .map((invoice) => {
        const total = Number(
          invoice.totalAmount
        );

        const collected = Number(
          invoice.collectedAmount
        );

        const outstanding = Number(
          invoice.outstandingAmount
        );

        const difference =
          collected +
          outstanding -
          total;

        return {
          invoiceId:
            invoice.invoiceId,

          businessName:
            invoice.businessName,

          source:
            invoice.source,

          totalAmount: total,
          collectedAmount: collected,
          outstandingAmount:
            outstanding,

          difference,
        };
      })
      .filter(
        (invoice) =>
          Math.abs(
            invoice.difference
          ) > 0.001
      );

    return NextResponse.json({
      period: {
        start:
          periodStart.toISOString(),

        end:
          periodEnd.toISOString(),
      },

      dataCoverage,

      summary: {
        invoicesCreated:
          invoices.length,

        invoiceValue,
        paidInvoices,
        partiallyPaidInvoices,
        unpaidInvoices,
        amountCollected,
        outstandingValue,
        collectionRate,
        overdueInvoices,

        businesses:
          businesses.size,
      },

      sources,
      merchants,
      discrepancies,
    });
  } catch (error) {
    console.error(
      "Unable to calculate invoice summary:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to calculate invoice summary.",
      },
      { status: 500 }
    );
  }
}