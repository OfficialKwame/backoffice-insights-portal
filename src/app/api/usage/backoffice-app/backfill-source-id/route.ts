import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function normalizeString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();

  return text.length > 0 ? text : null;
}

export async function GET() {
  try {
    const events =
      await prisma.backOfficeAppUsageEvent.findMany({
        where: {
          sourceId: null,
        },
        select: {
          id: true,
          rawData: true,
        },
      });

    let updated = 0;
    let skipped = 0;
    let duplicates = 0;

    for (const event of events) {
      const rawData = event.rawData as Record<
        string,
        unknown
      >;

      const sourceId = normalizeString(
        rawData?.Id
      );

      if (!sourceId) {
        skipped += 1;
        continue;
      }

      const existing =
        await prisma.backOfficeAppUsageEvent.findUnique({
          where: {
            sourceId,
          },
          select: {
            id: true,
          },
        });

      if (existing) {
        duplicates += 1;
        continue;
      }

      await prisma.backOfficeAppUsageEvent.update({
        where: {
          id: event.id,
        },
        data: {
          sourceId,
        },
      });

      updated += 1;
    }

    return NextResponse.json({
      success: true,
      totalChecked: events.length,
      updated,
      skipped,
      duplicates,
    });
  } catch (error) {
    console.error(
      "BackOffice App source ID backfill failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to backfill BackOffice App source IDs.",
      },
      { status: 500 }
    );
  }
}