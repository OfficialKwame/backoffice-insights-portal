import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { buildUssdSummary } from "@/lib/usage/ussd-summary";

/*
  Sessions belong to the period in which they started,
  but their later events can fall outside it. A failure
  callback arrives ~11 minutes after the payment request,
  so we load a buffer either side of the period and let
  the summary keep only sessions that started inside it.
*/
const BUFFER_MS = 60 * 60 * 1000;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (
      (start && !DATE_PATTERN.test(start)) ||
      (end && !DATE_PATTERN.test(end))
    ) {
      return NextResponse.json(
        { error: "Dates must be in YYYY-MM-DD format." },
        { status: 400 }
      );
    }

    if (start && end && start > end) {
      return NextResponse.json(
        { error: "Start date must be before end date." },
        { status: 400 }
      );
    }

    const where: any = {};

    if (start || end) {
      where.eventTimestamp = {};

      if (start) {
        where.eventTimestamp.gte = new Date(
          new Date(`${start}T00:00:00.000Z`).getTime() -
            BUFFER_MS
        );
      }

      if (end) {
        where.eventTimestamp.lte = new Date(
          new Date(`${end}T23:59:59.999Z`).getTime() +
            BUFFER_MS
        );
      }
    }

    const rows =
      await prisma.ussdUsageEvent.findMany({
        where,
        select: {
          traceId: true,
          eventName: true,
          flow: true,
          eventTimestamp: true,
          customerHash: true,
          businessId: true,
          businessName: true,
          network: true,
          amount: true,
          amountWithoutCharges: true,
          providerDescription: true,
        },
        orderBy: { eventTimestamp: "asc" },
      });

    const toNumber = (value: unknown) =>
      value === null || value === undefined
        ? null
        : Number(value);

    const events = rows.map((row: any) => ({
      ...row,
      amount: toNumber(row.amount),
      amountWithoutCharges: toNumber(
        row.amountWithoutCharges
      ),
    }));

    const summary = buildUssdSummary(events, {
      start,
      end,
    });

    return NextResponse.json(summary);
  } catch (error) {
    console.error(
      "Failed to load USSD usage summary:",
      error
    );

    return NextResponse.json(
      { error: "Failed to load USSD usage summary." },
      { status: 500 }
    );
  }
}
