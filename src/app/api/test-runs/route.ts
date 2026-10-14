import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Surface =
  | "LITE"
  | "LITE_PORTAL"
  | "APP"
  | "PORTAL";

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

async function syncRunWithActiveTests(
  runId: string,
  surface: Surface
) {
  const activeTests = await prisma.testDefinition.findMany({
    where: {
      surface,
      isActive: true,
    },
    orderBy: {
      sortOrder: "asc",
    },
  });

  const existingResults =
    await prisma.testResultEntry.findMany({
      where: {
        testRunId: runId,
      },
      select: {
        testDefinitionId: true,
      },
    });

  const existingIds = new Set(
    existingResults.map(
      (result) => result.testDefinitionId
    )
  );

  const missingTests = activeTests.filter(
    (test) => !existingIds.has(test.id)
  );

  if (missingTests.length > 0) {
  for (const test of missingTests) {
    await prisma.testResultEntry.upsert({
      where: {
        testRunId_testDefinitionId: {
          testRunId: runId,
          testDefinitionId: test.id,
        },
      },
      update: {},
      create: {
        testRunId: runId,
        testDefinitionId: test.id,
        result: "NOT_RUN",
      },
    });
  }
}
}

async function getRunWithResults(runId: string) {
  const run = await prisma.testRun.findUnique({
    where: {
      id: runId,
    },
    include: {
      results: {
        include: {
          testDefinition: true,
        },
      },
    },
  });

  if (!run) {
    return null;
  }

  run.results.sort(
    (a, b) =>
      a.testDefinition.sortOrder -
      b.testDefinition.sortOrder
  );

  return run;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const surface = searchParams.get(
      "surface"
    ) as Surface | null;

    if (!surface) {
      return NextResponse.json(
        { error: "Surface is required." },
        { status: 400 }
      );
    }

    const { start, end } = getTodayRange();

    const existingRun = await prisma.testRun.findFirst({
      where: {
        surface,
        runDate: {
          gte: start,
          lte: end,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!existingRun) {
      return NextResponse.json(null);
    }

    await syncRunWithActiveTests(
      existingRun.id,
      surface
    );

    const run = await getRunWithResults(
      existingRun.id
    );

    return NextResponse.json(run);
  } catch (error) {
    console.error("GET /api/test-runs failed:", error);

    return NextResponse.json(
      {
        error: "Failed to load today's test run.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const surface = body.surface as Surface | undefined;

    if (!surface) {
      return NextResponse.json(
        { error: "Surface is required." },
        { status: 400 }
      );
    }

    const { start, end } = getTodayRange();

    const existingRun = await prisma.testRun.findFirst({
      where: {
        surface,
        runDate: {
          gte: start,
          lte: end,
        },
      },
    });

    if (existingRun) {
      await syncRunWithActiveTests(
        existingRun.id,
        surface
      );

      const run = await getRunWithResults(
        existingRun.id
      );

      return NextResponse.json(run);
    }

    const activeTests =
      await prisma.testDefinition.findMany({
        where: {
          surface,
          isActive: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
      });

    if (activeTests.length === 0) {
      return NextResponse.json(
        {
          error:
            "No active tests found for this surface.",
        },
        { status: 400 }
      );
    }

    const createdRun = await prisma.testRun.create({
      data: {
        surface,
        runDate: new Date(),
        results: {
          create: activeTests.map((test) => ({
            testDefinitionId: test.id,
            result: "NOT_RUN",
          })),
        },
      },
    });

    const run = await getRunWithResults(
      createdRun.id
    );

    return NextResponse.json(run, {
      status: 201,
    });
  } catch (error) {
    console.error("POST /api/test-runs failed:", error);

    return NextResponse.json(
      {
        error: "Failed to start today's test run.",
      },
      { status: 500 }
    );
  }
}