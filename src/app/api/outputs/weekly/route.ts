import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type CollectionsOverall = {
  total_rows?: number;
  failed_value?: number;
  failure_rate?: number;
  success_rate?: number;
  collected_value?: number;
  eligible_attempts?: number;
  failed_transactions?: number;
  unrecognized_statuses?: number;
  successful_transactions?: number;
};

type CollectionsChannel = {
  failed?: number;
  channel?: string;
  attempts?: number;
  successful?: number;
  failed_value?: number;
  failure_rate?: number;
  success_rate?: number;
  collected_value?: number;
  collection_share?: number;
};

type CollectionsSummary = {
  overall?: CollectionsOverall;
  channels?: CollectionsChannel[];
  [key: string]: unknown;
};

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

function getMonday(date: Date) {
  const result = startOfDay(date);
  const day = result.getDay();

  const difference =
    day === 0 ? -6 : 1 - day;

  result.setDate(result.getDate() + difference);

  return result;
}

function formatNumber(value: number | undefined) {
  if (value === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("en-GB").format(value);
}

function formatMoney(value: number | undefined) {
  if (value === undefined) {
    return "—";
  }

  return `GH₵${new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function formatPercent(value: number | undefined) {
  if (value === undefined) {
    return "—";
  }

  return `${value.toFixed(2)}%`;
}

function percentageChange(
  current: number | undefined,
  previous: number | undefined
) {
  if (
    current === undefined ||
    previous === undefined ||
    previous === 0
  ) {
    return null;
  }

  return ((current - previous) / previous) * 100;
}

function percentagePointChange(
  current: number | undefined,
  previous: number | undefined
) {
  if (
    current === undefined ||
    previous === undefined
  ) {
    return null;
  }

  return current - previous;
}

function signedPercent(value: number | null) {
  if (value === null) {
    return null;
  }

  const sign = value > 0 ? "+" : "";

  return `${sign}${value.toFixed(2)}%`;
}

function signedPoints(value: number | null) {
  if (value === null) {
    return null;
  }

  const sign = value > 0 ? "+" : "";

  return `${sign}${value.toFixed(2)}pp`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const requestedDate =
      searchParams.get("date");

    const referenceDate = requestedDate
      ? new Date(`${requestedDate}T12:00:00`)
      : new Date();

    if (
      Number.isNaN(referenceDate.getTime())
    ) {
      return NextResponse.json(
        {
          error: "Invalid date.",
        },
        {
          status: 400,
        }
      );
    }

    const weekStart =
      getMonday(referenceDate);

    const weekEnd = new Date(weekStart);

    weekEnd.setDate(
      weekEnd.getDate() + 6
    );

    const weekStartDate =
      startOfDay(weekStart);

    const weekEndDate =
      endOfDay(weekEnd);

    /*
     * SURFACE TESTING
     */

    const testRuns =
      await prisma.testRun.findMany({
        where: {
          runDate: {
            gte: weekStartDate,
            lte: weekEndDate,
          },
        },
        include: {
          results: {
            include: {
              testDefinition: {
                select: {
                  name: true,
                  surface: true,
                },
              },
            },
          },
        },
        orderBy: {
          runDate: "asc",
        },
      });

    const surfaceResults =
      testRuns.flatMap(
        (run) => run.results
      );

    const passed =
      surfaceResults.filter(
        (result) =>
          result.result === "PASS"
      ).length;

    const failed =
      surfaceResults.filter(
        (result) =>
          result.result === "FAIL"
      ).length;

    const blocked =
      surfaceResults.filter(
        (result) =>
          result.result === "BLOCKED"
      ).length;

    const notRun =
      surfaceResults.filter(
        (result) =>
          result.result === "NOT_RUN"
      ).length;

    const completedChecks =
      passed + failed + blocked;

    const surfaceIssues =
      testRuns.flatMap((run) =>
        run.results
          .filter(
            (result) =>
              result.result === "FAIL" ||
              result.result === "BLOCKED"
          )
          .map((result) => ({
            date: run.runDate,
            surface:
              result.testDefinition
                .surface,
            test:
              result.testDefinition.name,
            result: result.result,
            note: result.note,
            issueReference:
              result.issueReference,
          }))
      );

    const surfaceTesting = {
      runs: testRuns.length,
      checks: surfaceResults.length,
      completedChecks,
      passed,
      failed,
      blocked,
      notRun,
      issues: surfaceIssues,
    };

    /*
     * DESIGN DRIFT
     */

    const designReviews =
      await prisma.designDriftReview.findMany(
        {
          where: {
            reviewDate: {
              gte: weekStartDate,
              lte: weekEndDate,
            },
          },
          include: {
            items: true,
          },
          orderBy: {
            reviewDate: "asc",
          },
        }
      );

    const driftItems =
      designReviews.flatMap(
        (review) => review.items
      );

    const driftOpen =
      driftItems.filter(
        (item) =>
          item.status !== "FIXED" &&
          item.status !== "ACCEPTED"
      ).length;

    const driftResolved =
      driftItems.filter(
        (item) =>
          item.status === "FIXED" ||
          item.status === "ACCEPTED"
      ).length;

    const areasReviewed =
      designReviews.reduce(
        (sum, review) =>
          sum + review.areasReviewed,
        0
      );

    const designDrift = {
      reviews: designReviews.length,
      areasReviewed,
      driftFound: driftItems.length,

      new: driftItems.filter(
        (item) =>
          item.status === "NEW"
      ).length,

      raised: driftItems.filter(
        (item) =>
          item.status === "RAISED"
      ).length,

      inProgress: driftItems.filter(
        (item) =>
          item.status ===
          "IN_PROGRESS"
      ).length,

      fixed: driftItems.filter(
        (item) =>
          item.status === "FIXED"
      ).length,

      accepted: driftItems.filter(
        (item) =>
          item.status === "ACCEPTED"
      ).length,

      open: driftOpen,
      resolved: driftResolved,

      items: driftItems.map(
        (item) => ({
          area: item.area,
          title: item.title,
          severity: item.severity,
          status: item.status,
          raisedTo: item.raisedTo,
          dateRaised: item.dateRaised,
          fixNotes: item.fixNotes,
          dateFixed: item.dateFixed,
        })
      ),
    };

    /*
     * COLLECTIONS - CURRENT WEEK
     */

    const collectionsPeriod =
      await prisma.collectionsPeriod.findFirst(
        {
          where: {
            periodStart: {
              lte: weekEndDate,
            },
            periodEnd: {
              gte: weekStartDate,
            },
          },
          orderBy: {
            periodStart: "desc",
          },
        }
      );

    /*
     * COLLECTIONS - PREVIOUS WEEK
     */

    const previousPeriod =
      collectionsPeriod
        ? await prisma.collectionsPeriod.findFirst(
            {
              where: {
                periodStart: {
                  lt: collectionsPeriod.periodStart,
                },
              },
              orderBy: {
                periodStart: "desc",
              },
            }
          )
        : null;

    const currentSummary =
      collectionsPeriod
        ?.computedSummary as
        | CollectionsSummary
        | null;

    const previousSummary =
      previousPeriod
        ?.computedSummary as
        | CollectionsSummary
        | null;

    const currentOverall =
      currentSummary?.overall;

    const previousOverall =
      previousSummary?.overall;

    const successRateChange =
      percentagePointChange(
        currentOverall?.success_rate,
        previousOverall?.success_rate
      );

    const collectedChange =
      percentageChange(
        currentOverall?.collected_value,
        previousOverall?.collected_value
      );

    const attemptsChange =
      percentageChange(
        currentOverall?.eligible_attempts,
        previousOverall?.eligible_attempts
      );

    const failedValueChange =
      percentageChange(
        currentOverall?.failed_value,
        previousOverall?.failed_value
      );

    const collections =
      collectionsPeriod
        ? {
            periodId:
              collectionsPeriod.id,

            periodStart:
              collectionsPeriod.periodStart,

            periodEnd:
              collectionsPeriod.periodEnd,

            daysCovered:
              collectionsPeriod.daysCovered,

            expectedDays:
              collectionsPeriod.expectedDays,

            isComplete:
              collectionsPeriod.isComplete,

            summary:
              currentSummary,

            previousPeriod:
              previousPeriod
                ? {
                    periodId:
                      previousPeriod.id,

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

                    summary:
                      previousSummary,
                  }
                : null,

            wow: {
              successRateChange,
              collectedChange,
              attemptsChange,
              failedValueChange,
            },
          }
        : null;

    /*
     * WEEKLY NOTE
     */

    const numberParts: string[] = [];

    if (currentOverall) {
      numberParts.push(
        `Collections SR ${formatPercent(
          currentOverall.success_rate
        )}`
      );

      numberParts.push(
        `${formatMoney(
          currentOverall.collected_value
        )} collected`
      );

      numberParts.push(
        `${formatNumber(
          currentOverall.eligible_attempts
        )} attempts`
      );
    }

    if (collectionsPeriod) {
      numberParts.push(
        `${collectionsPeriod.daysCovered}/${collectionsPeriod.expectedDays} days covered`
      );
    }

    const NUMBER =
      numberParts.length > 0
        ? numberParts.join(" · ")
        : "No collections data recorded for the week.";

    const doneParts: string[] = [];

    if (completedChecks > 0) {
      doneParts.push(
        `${completedChecks} surface checks completed across ${testRuns.length} runs`
      );
    }

    if (designReviews.length > 0) {
      doneParts.push(
        `${designReviews.length} design review${
          designReviews.length === 1
            ? ""
            : "s"
        } covering ${areasReviewed} areas`
      );
    }

    if (driftResolved > 0) {
      doneParts.push(
        `${driftResolved} drift item${
          driftResolved === 1
            ? ""
            : "s"
        } resolved`
      );
    }

    const DONE =
      doneParts.length > 0
        ? doneParts.join(" · ")
        : "No completed quality or design activity recorded yet.";

    const learnedParts: string[] = [];

    if (
      successRateChange !== null
    ) {
      learnedParts.push(
        `success rate moved ${signedPoints(
          successRateChange
        )} vs the previous saved week`
      );
    }

    if (
      collectedChange !== null
    ) {
      learnedParts.push(
        `collected value moved ${signedPercent(
          collectedChange
        )}`
      );
    }

    if (
      currentSummary?.channels &&
      currentSummary.channels.length > 0
    ) {
      const topChannel = [
        ...currentSummary.channels,
      ].sort(
        (a, b) =>
          (b.collection_share ?? 0) -
          (a.collection_share ?? 0)
      )[0];

      if (
        topChannel?.channel &&
        topChannel.collection_share !==
          undefined
      ) {
        learnedParts.push(
          `${topChannel.channel} contributed ${topChannel.collection_share.toFixed(
            2
          )}% of collections`
        );
      }
    }

    const LEARNED =
      learnedParts.length > 0
        ? learnedParts.join(" · ")
        : "Not enough comparison data yet to establish a clear weekly movement.";

    const stuckParts: string[] = [];

    if (failed > 0) {
      stuckParts.push(
        `${failed} failed surface check${
          failed === 1 ? "" : "s"
        }`
      );
    }

    if (blocked > 0) {
      stuckParts.push(
        `${blocked} blocked check${
          blocked === 1 ? "" : "s"
        }`
      );
    }

    if (driftOpen > 0) {
      stuckParts.push(
        `${driftOpen} design drift item${
          driftOpen === 1 ? "" : "s"
        } still open`
      );
    }

    const STUCK =
      stuckParts.length > 0
        ? stuckParts.join(" · ")
        : "No material blockers recorded.";

    const issuesWithoutContext =
      surfaceIssues.filter(
        (issue) =>
          !issue.note &&
          !issue.issueReference
      ).length;

    const needParts: string[] = [];

    if (issuesWithoutContext > 0) {
      needParts.push(
        `add context or issue references to ${issuesWithoutContext} failed/blocked check${
          issuesWithoutContext === 1
            ? ""
            : "s"
        }`
      );
    }

    if (driftOpen > 0) {
      needParts.push(
        "close or progress outstanding design drift"
      );
    }

    const NEED =
      needParts.length > 0
        ? needParts.join(" · ")
        : "No additional support recorded.";

    const nextParts: string[] = [];

    if (notRun > 0) {
      nextParts.push(
        `complete remaining ${notRun} surface checks`
      );
    }

    if (driftOpen > 0) {
      nextParts.push(
        "follow through on open design drift"
      );
    }

    if (
      collectionsPeriod &&
      !collectionsPeriod.isComplete
    ) {
      nextParts.push(
        `continue collections monitoring through the remaining ${
          collectionsPeriod.expectedDays -
          collectionsPeriod.daysCovered
        } day${
          collectionsPeriod.expectedDays -
            collectionsPeriod.daysCovered ===
          1
            ? ""
            : "s"
        }`
      );
    }

    const NEXT =
      nextParts.length > 0
        ? nextParts.join(" · ")
        : "Continue daily quality and collections monitoring.";

    const weeklyNote = {
      NUMBER,
      DONE,
      LEARNED,
      STUCK,
      NEED,
      NEXT,
    };

    const weeklyNoteText = [
      `NUMBER: ${NUMBER}`,
      `DONE: ${DONE}`,
      `LEARNED: ${LEARNED}`,
      `STUCK: ${STUCK}`,
      `NEED: ${NEED}`,
      `NEXT: ${NEXT}`,
    ].join("\n");

    /*
     * RESPONSE
     */

    return NextResponse.json({
      period: {
        start: weekStartDate,
        end: weekEndDate,

        isCurrentWeek:
          new Date() >= weekStartDate &&
          new Date() <= weekEndDate,
      },

      surfaceTesting,

      designDrift,

      collections,

      weeklyNote,

      weeklyNoteText,
    });
  } catch (error) {
    console.error(
      "GET /api/outputs/weekly failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to prepare weekly output data.",
      },
      {
        status: 500,
      }
    );
  }
}