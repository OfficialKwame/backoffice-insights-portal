import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildDailyLine } from "@/lib/outputs/buildDailyLine";

function startOfDay(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function endOfDay(date: Date) {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

export async function GET() {
  try {
    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);

    /*
     * -------------------------------------------------------
     * SURFACE TESTING
     * -------------------------------------------------------
     */

    const testRuns = await prisma.testRun.findMany({
      where: {
        runDate: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      include: {
        results: {
          include: {
            testDefinition: true,
          },
        },
      },
      orderBy: {
        runDate: "asc",
      },
    });

    const surfaceTesting = {
      runsCompleted: testRuns.length,
      checksCompleted: 0,
      passed: 0,
      failed: 0,
      blocked: 0,
      notRun: 0,

      surfaces: [] as string[],

      issues: [] as {
        surface: string;
        testName: string;
        result: string;
        note: string | null;
        issueReference: string | null;
      }[],
    };

    const testedSurfaces = new Set<string>();

    for (const run of testRuns) {
      testedSurfaces.add(run.surface);

      for (const entry of run.results) {
        if (entry.result === "PASS") {
          surfaceTesting.passed += 1;
          surfaceTesting.checksCompleted += 1;
        }

        if (entry.result === "FAIL") {
          surfaceTesting.failed += 1;
          surfaceTesting.checksCompleted += 1;
        }

        if (entry.result === "BLOCKED") {
          surfaceTesting.blocked += 1;
          surfaceTesting.checksCompleted += 1;
        }

        if (entry.result === "NOT_RUN") {
          surfaceTesting.notRun += 1;
        }

        if (
          entry.result === "FAIL" ||
          entry.result === "BLOCKED" ||
          entry.issueReference
        ) {
          surfaceTesting.issues.push({
            surface: run.surface,
            testName: entry.testDefinition.name,
            result: entry.result,
            note: entry.note,
            issueReference: entry.issueReference,
          });
        }
      }
    }

    surfaceTesting.surfaces = Array.from(testedSurfaces);

    /*
     * -------------------------------------------------------
     * DESIGN DRIFT
     * -------------------------------------------------------
     */

    const driftReviews = await prisma.designDriftReview.findMany({
      where: {
        reviewDate: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      include: {
        items: true,
      },
      orderBy: {
        reviewDate: "asc",
      },
    });

    const driftItemsCreated = await prisma.designDriftItem.findMany({
      where: {
        createdAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      include: {
        review: true,
      },
    });

    const driftItemsUpdated = await prisma.designDriftItem.findMany({
      where: {
        updatedAt: {
          gte: dayStart,
          lte: dayEnd,
        },
        createdAt: {
          lt: dayStart,
        },
      },
      include: {
        review: true,
      },
    });

    const designDrift = {
      reviewsCompleted: driftReviews.length,

      areasReviewed: driftReviews.reduce(
        (total, review) => total + review.areasReviewed,
        0
      ),

      surfacesReviewed: Array.from(
        new Set(driftReviews.map((review) => review.surface))
      ),

      itemsRaised: driftItemsCreated.length,

      itemsCreated: driftItemsCreated.map((item) => ({
        id: item.id,
        surface: item.review.surface,
        area: item.area,
        title: item.title,
        severity: item.severity,
        status: item.status,
        raisedTo: item.raisedTo,
      })),

      itemsUpdated: driftItemsUpdated.map((item) => ({
        id: item.id,
        surface: item.review.surface,
        area: item.area,
        title: item.title,
        severity: item.severity,
        status: item.status,
        raisedTo: item.raisedTo,
      })),
    };

    /*
     * -------------------------------------------------------
     * COLLECTIONS PERFORMANCE
     * -------------------------------------------------------
     */

    const collectionImports =
      await prisma.collectionsImport.findMany({
        where: {
          createdAt: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
        include: {
          period: {
            select: {
              id: true,
              periodStart: true,
              periodEnd: true,
              daysCovered: true,
              expectedDays: true,
              isComplete: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

    const collections = {
      importsCompleted: collectionImports.length,

      rowsImported: collectionImports.reduce(
        (total, item) => total + item.rowCount,
        0
      ),

      imports: collectionImports.map((item) => ({
        id: item.id,
        fileName: item.fileName,
        rowCount: item.rowCount,
        importedMinDate: item.importedMinDate,
        importedMaxDate: item.importedMaxDate,

        period: item.period
          ? {
              id: item.period.id,
              periodStart: item.period.periodStart,
              periodEnd: item.period.periodEnd,
              daysCovered: item.period.daysCovered,
              expectedDays: item.period.expectedDays,
              isComplete: item.period.isComplete,
            }
          : null,
      })),
    };

    /*
     * -------------------------------------------------------
     * MANUAL ACTIVITY LOG
     * -------------------------------------------------------
     */

    const manualActivities =
      await prisma.activityLog.findMany({
        where: {
          activityDate: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
        orderBy: {
          activityDate: "asc",
        },
      });

    const activityLog = {
      total: manualActivities.length,

      activities: manualActivities.map((activity) => ({
        id: activity.id,
        category: activity.category,
        action: activity.action,
        description: activity.description,
        activityDate: activity.activityDate,
      })),
    };

    /*
     * -------------------------------------------------------
     * DAILY ACTIVITY SOURCE
     * -------------------------------------------------------
     *
     * This response is intentionally factual.
     * No performance interpretation happens here.
     *
     * The Daily Line generator will consume this source
     * and turn the recorded actions into a concise update.
     */

     const dailyLine = buildDailyLine({
      date: now.toISOString().split("T")[0],
      surfaceTesting,
      designDrift,
      collections,
      activityLog,
    });

    return NextResponse.json({
      date: now.toISOString().split("T")[0],
      dailyLine,
      surfaceTesting,
      designDrift,
      collections,
      activityLog,
    });
  } catch (error) {
    console.error(
      "Failed to build daily output source:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to build daily output source.",
      },
      {
        status: 500,
      }
    );
  }
}