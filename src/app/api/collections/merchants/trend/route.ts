import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/*
  Daily transaction trend for one merchant.

  GET /api/collections/merchants/trend
    ?businessId=...   (required)
    &end=YYYY-MM-DD   (required: end of the period being viewed)
    &range=7d|14d|1m|3m

  Counting follows compute/collections/compute.py exactly:
  - a transaction counts only when Issuccessful is clearly
    true or false (anything else is excluded)
  - collected value = Amountpaid of successful transactions
  - failed value    = Amountpaid of failed transactions
  - merchants are matched on the trimmed Businessid

  Days with no imported collections data at all are
  returned with hasData = false, so the chart shows a gap.
  Days with imported data but no activity for this
  merchant are real zeros.
*/

const RANGES = ["7d", "14d", "1m", "3m"] as const;

type Range = (typeof RANGES)[number];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const BUSINESS_NAME_KEY = "Businesses - Businessid → Name";

// Same values as normalize_success() in compute.py.
const TRUE_VALUES = new Set([
  "true",
  "1",
  "yes",
  "successful",
  "success",
]);

const FALSE_VALUES = new Set([
  "false",
  "0",
  "no",
  "failed",
  "failure",
]);

function normaliseSuccess(value: string | null) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim().toLowerCase();

  if (TRUE_VALUES.has(text)) return true;
  if (FALSE_VALUES.has(text)) return false;

  return null;
}

function toAmount(value: string | null) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getRangeStart(end: string, range: Range) {
  const start = new Date(`${end}T00:00:00.000Z`);

  if (range === "7d") {
    start.setUTCDate(start.getUTCDate() - 6);
  } else if (range === "14d") {
    start.setUTCDate(start.getUTCDate() - 13);
  } else {
    start.setUTCMonth(
      start.getUTCMonth() - (range === "1m" ? 1 : 3)
    );
    start.setUTCDate(start.getUTCDate() + 1);
  }

  return dayKey(start);
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

type TransactionRow = {
  day: string;
  success: string | null;
  amount: string | null;
  name: string | null;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const businessId = searchParams.get("businessId")?.trim();
    const end = searchParams.get("end")?.slice(0, 10);
    const range = (searchParams.get("range") ?? "7d") as Range;

    if (!businessId) {
      return NextResponse.json(
        { error: "businessId is required." },
        { status: 400 }
      );
    }

    if (!end || !DATE_PATTERN.test(end)) {
      return NextResponse.json(
        { error: "end must be a date in YYYY-MM-DD format." },
        { status: 400 }
      );
    }

    if (!RANGES.includes(range)) {
      return NextResponse.json(
        { error: `range must be one of: ${RANGES.join(", ")}.` },
        { status: 400 }
      );
    }

    const start = getRangeStart(end, range);

    const startDate = new Date(`${start}T00:00:00.000Z`);
    const endDate = new Date(`${end}T23:59:59.999Z`);

    // This merchant's transactions in the range.
    const rows = await prisma.$queryRaw<TransactionRow[]>`
      SELECT
        to_char("paymentDate", 'YYYY-MM-DD') AS day,
        "rawData"->>'Issuccessful' AS success,
        "rawData"->>'Amountpaid' AS amount,
        COALESCE(
          NULLIF(btrim("rawData"->>(${BUSINESS_NAME_KEY}::text)), ''),
          NULLIF(btrim("rawData"->>'Businessname'), '')
        ) AS name
      FROM "CollectionsTransaction"
      WHERE "paymentDate" >= ${startDate}
        AND "paymentDate" <= ${endDate}
        AND btrim("rawData"->>'Businessid') = (${businessId}::text)
    `;

    // Days that have any imported collections data.
    const coveredRows = await prisma.$queryRaw<{ day: string }[]>`
      SELECT DISTINCT to_char("paymentDate", 'YYYY-MM-DD') AS day
      FROM "CollectionsTransaction"
      WHERE "paymentDate" >= ${startDate}
        AND "paymentDate" <= ${endDate}
    `;

    const coveredDays = new Set(
      coveredRows.map((row: { day: string }) => row.day)
    );

    type DayTotals = {
      successful: number;
      failed: number;
      collected: number;
      failedValue: number;
    };

    const byDay = new Map<string, DayTotals>();
    let businessName: string | null = null;
    let excluded = 0;

    for (const row of rows) {
      businessName ??= row.name;

      const success = normaliseSuccess(row.success);

      if (success === null) {
        excluded += 1;
        continue;
      }

      if (!byDay.has(row.day)) {
        byDay.set(row.day, {
          successful: 0,
          failed: 0,
          collected: 0,
          failedValue: 0,
        });
      }

      const totals = byDay.get(row.day)!;
      const amount = toAmount(row.amount);

      if (success) {
        totals.successful += 1;
        totals.collected += amount;
      } else {
        totals.failed += 1;
        totals.failedValue += amount;
      }
    }

    // Every day in the range, oldest first.
    const days = [];
    const cursor = new Date(startDate);

    while (dayKey(cursor) <= end) {
      const date = dayKey(cursor);
      const hasData = coveredDays.has(date);
      const totals = byDay.get(date);

      const successful = totals?.successful ?? 0;
      const failed = totals?.failed ?? 0;
      const attempts = successful + failed;

      days.push({
        date,
        hasData,
        attempts: hasData ? attempts : null,
        successful: hasData ? successful : null,
        failed: hasData ? failed : null,
        success_rate:
          hasData && attempts > 0
            ? round((successful / attempts) * 100)
            : null,
        collected_value: hasData
          ? round(totals?.collected ?? 0)
          : null,
        failed_value: hasData
          ? round(totals?.failedValue ?? 0)
          : null,
      });

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const sum = (key: keyof DayTotals) =>
      Array.from(byDay.values()).reduce(
        (total, day) => total + day[key],
        0
      );

    const successful = sum("successful");
    const failed = sum("failed");
    const attempts = successful + failed;

    return NextResponse.json({
      businessId,
      businessName,
      range,
      start,
      end,
      days,
      totals: {
        attempts,
        successful,
        failed,
        success_rate:
          attempts > 0 ? round((successful / attempts) * 100) : 0,
        collected_value: round(sum("collected")),
        failed_value: round(sum("failedValue")),
      },
      coverage: {
        calendarDays: days.length,
        daysWithData: days.filter((day) => day.hasData).length,
      },
      // Rows skipped because Issuccessful was unclear.
      excludedTransactions: excluded,
    });
  } catch (error) {
    console.error("Failed to load merchant trend:", error);

    return NextResponse.json(
      { error: "Failed to load merchant trend." },
      { status: 500 }
    );
  }
}
