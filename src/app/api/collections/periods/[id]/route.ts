import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: { id: string };
  }
) {
  try {
    const period =
      await prisma.collectionsPeriod.findUnique({
        where: {
          id: params.id,
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

          transactions: {
            select: {
              paymentDate: true,
            },
            orderBy: {
              paymentDate: "asc",
            },
          },
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

    /*
     * Find the reporting period immediately
     * before the selected period.
     *
     * We deliberately use periodStart rather
     * than createdAt because imports can be
     * uploaded or re-uploaded at any time.
     */
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

        include: {
          _count: {
            select: {
              transactions: true,
            },
          },
        },
      });

    const latestImport =
      period.imports[0] ?? null;
const coveredDates = Array.from(
  new Set(
    period.transactions.map((transaction) =>
      transaction.paymentDate
        .toISOString()
        .slice(0, 10)
    )
  )
);

const allDates: string[] = [];

const currentDate = new Date(
  period.periodStart
);

const finalDate = new Date(
  period.periodEnd
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

const missingDates = allDates.filter(
  (date) => !coveredDates.includes(date)
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

dataCoverage,

previousPeriod: previousPeriod

        ? {
            id: previousPeriod.id,
            periodStart:
              previousPeriod.periodStart,
            periodEnd:
              previousPeriod.periodEnd,
            daysCovered:
              previousPeriod.daysCovered,
            expectedDays:
              previousPeriod.expectedDays,
            isComplete:
              previousPeriod.isComplete,
            transactionCount:
              previousPeriod._count
                .transactions,
            summary:
              previousPeriod.computedSummary,
          }
        : null,
    });
  } catch (error) {
    console.error(
      "Unable to load collections period:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load collections period.",
      },
      {
        status: 500,
      }
    );
  }
}