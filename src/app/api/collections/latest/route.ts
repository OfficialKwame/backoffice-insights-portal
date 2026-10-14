import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const period =
      await prisma.collectionsPeriod.findFirst({
        orderBy: {
          periodStart: "desc",
        },
        include: {
          imports: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
          _count: {
            select: {
              transactions: true,
            },
          },
        },
      });

    if (!period) {
      return NextResponse.json(
        {
          success: true,
          period: null,
        },
        {
          status: 200,
        }
      );
    }

    const latestImport = period.imports[0] ?? null;

    return NextResponse.json({
      success: true,

      import: latestImport
        ? {
            id: latestImport.id,
            fileName: latestImport.fileName,
            rowCount: latestImport.rowCount,
            importedMinDate:
              latestImport.importedMinDate,
            importedMaxDate:
              latestImport.importedMaxDate,
            createdAt: latestImport.createdAt,
          }
        : null,

      period: {
        id: period.id,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        daysCovered: period.daysCovered,
        expectedDays: period.expectedDays,
        isComplete: period.isComplete,
        transactionCount:
          period._count.transactions,
      },

      summary: period.computedSummary,
    });
  } catch (error) {
    console.error(
      "Unable to load latest collections period:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load collections data.",
      },
      {
        status: 500,
      }
    );
  }
}