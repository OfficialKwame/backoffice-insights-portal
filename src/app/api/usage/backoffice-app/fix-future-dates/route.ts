import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function safeDate(value: unknown) {
  if (!value) {
    return null;
  }

  const parsed = new Date(String(value));

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}

export async function GET() {
  try {
    /*
     * Find records whose stored eventTimestamp
     * is later than today.
     *
     * This is a one-time repair endpoint for the
     * incorrectly future-dated BackOffice App events.
     */
    const now = new Date();

    const endOfTodayUtc = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        23,
        59,
        59,
        999
      )
    );

    const futureEvents =
      await prisma.backOfficeAppUsageEvent.findMany({
        where: {
          eventTimestamp: {
            gt: endOfTodayUtc,
          },
        },
        select: {
          id: true,
          sourceId: true,
          eventName: true,
          eventTimestamp: true,
          rawData: true,
        },
        orderBy: {
          eventTimestamp: "asc",
        },
      });

    let fixed = 0;
    let skipped = 0;

    const changes: Array<{
      eventName: string;
      oldTimestamp: string;
      newTimestamp: string;
      source: string;
    }> = [];

    for (const event of futureEvents) {
      const raw =
        event.rawData as Record<
          string,
          any
        >;

      const logTimestamp =
        safeDate(
          raw?.["@timestamp"]
        );

      const createdAt =
        safeDate(
          raw?.CreatedAt
        );

      /*
       * Prefer Datadog's @timestamp.
       * Fall back to CreatedAt.
       */
      const replacement =
        logTimestamp ??
        createdAt;

      if (!replacement) {
        skipped += 1;
        continue;
      }

      /*
       * Safety check:
       * don't replace a bad future timestamp
       * with another future timestamp.
       */
      if (
        replacement.getTime() >
        endOfTodayUtc.getTime()
      ) {
        skipped += 1;
        continue;
      }

      await prisma.backOfficeAppUsageEvent.update({
        where: {
          id: event.id,
        },
        data: {
          eventTimestamp:
            replacement,
        },
      });

      changes.push({
        eventName:
          event.eventName,
        oldTimestamp:
          event.eventTimestamp.toISOString(),
        newTimestamp:
          replacement.toISOString(),
        source: logTimestamp
          ? "@timestamp"
          : "CreatedAt",
      });

      fixed += 1;
    }

    return NextResponse.json({
      success: true,
      futureEventsFound:
        futureEvents.length,
      fixed,
      skipped,
      cutoff:
        endOfTodayUtc.toISOString(),
      changes,
    });
  } catch (error) {
    console.error(
      "Failed to repair future-dated usage events:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to repair future-dated usage events.",
      },
      {
        status: 500,
      }
    );
  }
}