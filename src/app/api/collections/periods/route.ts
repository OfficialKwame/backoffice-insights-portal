import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const periods =
      await prisma.collectionsPeriod.findMany({
        orderBy: {
          periodStart: "desc",
        },
        select: {
          id: true,
          periodStart: true,
          periodEnd: true,
          daysCovered: true,
          expectedDays: true,
          isComplete: true,

          _count: {
            select: {
              transactions: true,
            },
          },
        },
      });

    return NextResponse.json({
      success: true,

      periods: periods.map((period) => ({
        id: period.id,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        daysCovered: period.daysCovered,
        expectedDays: period.expectedDays,
        isComplete: period.isComplete,
        transactionCount:
          period._count.transactions,
      })),
    });
  } catch (error) {
    console.error(
      "Unable to load collections periods:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load collections periods.",
      },
      {
        status: 500,
      }
    );
  }
}