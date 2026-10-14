import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const events =
      await prisma.backOfficeAppUsageEvent.findMany({
        where: {
          eventName: "View Item",
        },
        select: {
          rawData: true,
        },
        take: 20,
      });

    return NextResponse.json({
      count: events.length,
      samples: events.map((event) => {
        const raw = event.rawData as Record<
          string,
          unknown
        >;

        return {
          eventStoreMessage:
            raw.EventStoreMessage ?? null,
        };
      }),
    });
  } catch (error) {
    console.error(
      "Failed to inspect screen views:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to inspect screen views.",
      },
      { status: 500 }
    );
  }
}