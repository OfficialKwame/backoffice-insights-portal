import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const runs = await prisma.testRun.findMany({
    orderBy: {
      runDate: "desc",
    },
    include: {
      results: {
        select: {
          result: true,
        },
      },
    },
  });

  const history = runs.map((run) => {
    const passed = run.results.filter(
      (item) => item.result === "PASS"
    ).length;

    const failed = run.results.filter(
      (item) => item.result === "FAIL"
    ).length;

    const blocked = run.results.filter(
      (item) => item.result === "BLOCKED"
    ).length;

    const notRun = run.results.filter(
      (item) => item.result === "NOT_RUN"
    ).length;

    return {
      id: run.id,
      surface: run.surface,
      runDate: run.runDate,
      total: run.results.length,
      passed,
      failed,
      blocked,
      notRun,
      completed: passed + failed + blocked,
    };
  });

  return NextResponse.json(history);
}
