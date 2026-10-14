import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const issues = await prisma.testResultEntry.findMany({
    where: {
      result: {
        in: ["FAIL", "BLOCKED"],
      },
      testRun: {
        runDate: {
          gte: start,
          lte: end,
        },
      },
    },
    include: {
      testDefinition: true,
      testRun: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const response = issues.map((item) => ({
    id: item.id,
    result: item.result,
    note: item.note,
    issueReference: item.issueReference,
    surface: item.testRun.surface,
    testName: item.testDefinition.name,
  }));

  return NextResponse.json(response);
}