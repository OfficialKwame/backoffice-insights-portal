import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";

function runPythonJson(
  scriptPath: string,
  filePath: string
): Promise<any> {
  return new Promise((resolve, reject) => {
    const python = spawn("python3", [
      scriptPath,
      filePath,
    ]);

    let stdout = "";
    let stderr = "";

    python.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    python.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    python.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            stderr ||
              stdout ||
              "Python process failed."
          )
        );
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(
          new Error(
            `Unable to parse Python output as JSON.\n${stdout}`
          )
        );
      }
    });
  });
}

function parseDateRange(request: Request) {
  const { searchParams } = new URL(request.url);

  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    throw new Error(
      "Both start and end dates are required."
    );
  }

  const startDate = new Date(
    `${start}T00:00:00.000Z`
  );

  const endDate = new Date(
    `${end}T23:59:59.999Z`
  );

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime())
  ) {
    throw new Error(
      "Invalid reporting period."
    );
  }

  if (startDate > endDate) {
    throw new Error(
      "Start date cannot be after end date."
    );
  }

  return {
    start,
    end,
    startDate,
    endDate,
  };
}

export async function GET(
  request: Request
) {
  try {
    const {
      start,
      end,
      startDate,
      endDate,
    } = parseDateRange(request);

    /*
     * Load every transaction recorded
     * within the selected calendar range.
     */
    const transactions =
      await prisma.collectionsTransaction.findMany({
        where: {
          paymentDate: {
            gte: startDate,
            lte: endDate,
          },
        },

        orderBy: {
          paymentDate: "asc",
        },
      });

    if (transactions.length === 0) {
      return NextResponse.json(
        {
          error:
            "No collections data was found for the selected reporting period.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * Prepare the working directory used
     * by the verified collections compute.
     */
    const workingDir = path.join(
      process.cwd(),
      "data",
      "working"
    );

    await fs.mkdir(workingDir, {
      recursive: true,
    });

    const workingFilePath = path.join(
      workingDir,
      `custom-${start}-${end}.json`
    );

    /*
     * Rebuild the original transaction rows
     * expected by compute.py.
     */
    const consolidatedRows =
      transactions.map(
        (transaction) =>
          transaction.rawData
      );

    await fs.writeFile(
      workingFilePath,
      JSON.stringify(consolidatedRows),
      "utf-8"
    );

    /*
     * Run the same verified calculation
     * used for saved weekly periods.
     */
    const computedSummary =
      await runPythonJson(
        "compute/collections/compute.py",
        workingFilePath
      );

    /*
     * Determine exactly which calendar
     * dates contain transaction data.
     */
    const coveredDates = new Set(
      transactions.map(
        (transaction) =>
          transaction.paymentDate
            .toISOString()
            .slice(0, 10)
      )
    );

    /*
     * Build every calendar date in the
     * selected reporting period.
     */
    const allDates: string[] = [];

    const currentDate = new Date(
      `${start}T00:00:00.000Z`
    );

    const finalDate = new Date(
      `${end}T00:00:00.000Z`
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

    const coveredDateList =
      allDates.filter((date) =>
        coveredDates.has(date)
      );

    const missingDates =
      allDates.filter((date) =>
        !coveredDates.has(date)
      );

    const dataCoverage = {
      calendarDays: allDates.length,

      activeDays:
        coveredDateList.length,

      coveragePercent:
        allDates.length > 0
          ? Number(
              (
                (coveredDateList.length /
                  allDates.length) *
                100
              ).toFixed(1)
            )
          : 0,

      coveredDates:
        coveredDateList,

      missingDates,
    };
return NextResponse.json({
  success: true,

  import: null,

  period: {
    id: `custom-${start}-${end}`,
    periodStart: start,
    periodEnd: end,
    daysCovered: dataCoverage.activeDays,
    expectedDays: dataCoverage.calendarDays,
    isComplete:
      dataCoverage.activeDays ===
      dataCoverage.calendarDays,
    transactionCount: transactions.length,
  },

  summary: computedSummary,

  previousPeriod: null,

  dataCoverage,
});




  } catch (error) {
    console.error(
      "Unable to load custom collections range:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load collections range.",
      },
      {
        status: 400,
      }
    );
  }
}