import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";

type RawRow = {
  ID?: unknown;
  Paymentdate?: unknown;
  [key: string]: unknown;
};

type ParsedRow = {
  transactionId: string;
  paymentDate: Date;
  rawData: RawRow;
  periodStart: Date;
  periodEnd: Date;
};

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

function getWeekBounds(date: Date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  const normalized = new Date(
    Date.UTC(
      year,
      month,
      day,
      0,
      0,
      0,
      0
    )
  );

  const dayOfWeek =
    normalized.getUTCDay();

  // JS: Sunday = 0, Monday = 1
  const daysSinceMonday =
    dayOfWeek === 0
      ? 6
      : dayOfWeek - 1;

  const periodStart =
    new Date(normalized);

  periodStart.setUTCDate(
    periodStart.getUTCDate() -
      daysSinceMonday
  );

  const periodEnd =
    new Date(periodStart);

  periodEnd.setUTCDate(
    periodEnd.getUTCDate() + 6
  );

  periodEnd.setUTCHours(
    23,
    59,
    59,
    999
  );

  return {
    periodStart,
    periodEnd,
  };
}

function dateKey(date: Date) {
  return date
    .toISOString()
    .slice(0, 10);
}

function weekKey(
  periodStart: Date,
  periodEnd: Date
) {
  return `${periodStart.toISOString()}|${periodEnd.toISOString()}`;
}

function chunkArray<T>(
  items: T[],
  size: number
): T[][] {
  const chunks: T[][] = [];

  for (
    let i = 0;
    i < items.length;
    i += size
  ) {
    chunks.push(
      items.slice(i, i + size)
    );
  }

  return chunks;
}

export async function POST(
  req: Request
) {
  let storedFilePath:
    | string
    | null = null;

  try {
    const formData =
      await req.formData();

    const file =
      formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error:
            "A file is required.",
        },
        {
          status: 400,
        }
      );
    }

    const extension = path
      .extname(file.name)
      .toLowerCase();

    const allowedExtensions = [
      ".xlsx",
      ".xls",
      ".csv",
    ];

    if (
      !allowedExtensions.includes(
        extension
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Upload a CSV or Excel file.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Save the original upload once.
     */
    const uploadDir = path.join(
      process.cwd(),
      "data",
      "raw",
      "imports"
    );

    await fs.mkdir(uploadDir, {
      recursive: true,
    });

    const timestamp =
      new Date()
        .toISOString()
        .replace(/[:.]/g, "-");

    const safeFileName =
      file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

    const storedFileName =
      `${timestamp}-${safeFileName}`;

    storedFilePath = path.join(
      uploadDir,
      storedFileName
    );

    const bytes =
      await file.arrayBuffer();

    await fs.writeFile(
      storedFilePath,
      Buffer.from(bytes)
    );

    /*
     * Extract raw transaction rows.
     */
    const rows =
      (await runPythonJson(
        "compute/collections/extract_rows.py",
        storedFilePath
      )) as RawRow[];

    if (
      !Array.isArray(rows) ||
      rows.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "The uploaded file contains no transaction rows.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Validate every transaction
     * and determine its reporting week.
     */
    const parsedRows:
      ParsedRow[] = rows.map(
        (row, index) => {
          const transactionId =
            row.ID === null ||
            row.ID === undefined
              ? ""
              : String(
                  row.ID
                ).trim();

          const paymentDate =
            row.Paymentdate === null ||
            row.Paymentdate ===
              undefined
              ? null
              : new Date(
                  String(
                    row.Paymentdate
                  )
                );

          if (!transactionId) {
            throw new Error(
              `Row ${
                index + 1
              } has no transaction ID.`
            );
          }

          if (
            !paymentDate ||
            Number.isNaN(
              paymentDate.getTime()
            )
          ) {
            throw new Error(
              `Row ${
                index + 1
              } has an invalid Paymentdate.`
            );
          }

          const week =
            getWeekBounds(
              paymentDate
            );

          return {
            transactionId,
            paymentDate,
            rawData: row,
            periodStart:
              week.periodStart,
            periodEnd:
              week.periodEnd,
          };
        }
      );

    /*
     * Split transactions automatically
     * into Monday-Sunday reporting weeks.
     */
    const rowsByWeek =
      new Map<
        string,
        ParsedRow[]
      >();

    for (const row of parsedRows) {
      const key = weekKey(
        row.periodStart,
        row.periodEnd
      );

      const existing =
        rowsByWeek.get(key) ?? [];

      existing.push(row);

      rowsByWeek.set(
        key,
        existing
      );
    }

    /*
     * Create working directory once.
     */
    const workingDir = path.join(
      process.cwd(),
      "data",
      "working"
    );

    await fs.mkdir(workingDir, {
      recursive: true,
    });

    /*
     * Store the results for every
     * reporting week found in the file.
     */
    const processedPeriods: {
      import: {
        id: string;
        fileName: string;
        rowCount: number;
        importedMinDate:
          | Date
          | null;
        importedMaxDate:
          | Date
          | null;
        createdAt: Date;
      };

      period: {
        id: string;
        periodStart: Date;
        periodEnd: Date;
        daysCovered: number;
        expectedDays: number;
        isComplete: boolean;
        transactionCount: number;
      };

      summary: any;
    }[] = [];

    /*
     * Process every week independently.
     */
    for (
      const weekRows
      of rowsByWeek.values()
    ) {
      const firstRow =
        weekRows[0];

      /*
       * Get or create the weekly
       * consolidated period.
       */
      const period =
        await prisma.collectionsPeriod.upsert(
          {
            where: {
              periodStart_periodEnd:
                {
                  periodStart:
                    firstRow.periodStart,
                  periodEnd:
                    firstRow.periodEnd,
                },
            },

            update: {},

            create: {
              periodStart:
                firstRow.periodStart,
              periodEnd:
                firstRow.periodEnd,
            },
          }
        );

      /*
       * Upsert transactions by ID.
       *
       * Re-uploading a transaction
       * updates the existing row instead
       * of creating a duplicate.
       */
      const chunks =
        chunkArray(
          weekRows,
          250
        );

      for (
        const chunk of chunks
      ) {
        await prisma.$transaction(
          chunk.map((row) =>
            prisma.collectionsTransaction.upsert(
              {
                where: {
                  transactionId:
                    row.transactionId,
                },

                update: {
                  paymentDate:
                    row.paymentDate,

                  periodId:
                    period.id,

                  rawData:
                    row.rawData as Prisma.InputJsonValue,
                },

                create: {
                  transactionId:
                    row.transactionId,

                  paymentDate:
                    row.paymentDate,

                  periodId:
                    period.id,

                  rawData:
                    row.rawData as Prisma.InputJsonValue,
                },
              }
            )
          )
        );
      }

      /*
       * Record this source upload
       * against this specific week.
       */
      const importedDates =
        weekRows.map(
          (row) =>
            row.paymentDate
        );

      const importedMinDate =
        new Date(
          Math.min(
            ...importedDates.map(
              (date) =>
                date.getTime()
            )
          )
        );

      const importedMaxDate =
        new Date(
          Math.max(
            ...importedDates.map(
              (date) =>
                date.getTime()
            )
          )
        );

      const savedImport =
        await prisma.collectionsImport.create(
          {
            data: {
              fileName:
                file.name,

              filePath:
                storedFilePath,

              rowCount:
                weekRows.length,

              importedMinDate,

              importedMaxDate,

              periodId:
                period.id,
            },
          }
        );

      /*
       * Fetch ALL unique transactions
       * currently stored for this week.
       */
      const consolidatedTransactions =
        await prisma.collectionsTransaction.findMany(
          {
            where: {
              periodId:
                period.id,
            },

            orderBy: {
              paymentDate:
                "asc",
            },
          }
        );

      /*
       * Build a consolidated JSON file.
       */
      const workingFilePath =
        path.join(
          workingDir,
          `week-${dateKey(
            period.periodStart
          )}.json`
        );

      const consolidatedRows =
        consolidatedTransactions.map(
          (transaction) =>
            transaction.rawData
        );

      await fs.writeFile(
        workingFilePath,
        JSON.stringify(
          consolidatedRows
        ),
        "utf-8"
      );

      /*
       * Run the verified Pandas compute
       * against the complete consolidated
       * data currently stored for the week.
       */
      const computedSummary =
        await runPythonJson(
          "compute/collections/compute.py",
          workingFilePath
        );

      /*
       * Determine how many calendar days
       * currently contain transaction data.
       */
      const coveredDates =
        new Set(
          consolidatedTransactions.map(
            (transaction) =>
              dateKey(
                transaction.paymentDate
              )
          )
        );

      const daysCovered =
        coveredDates.size;

      const isComplete =
        daysCovered >= 7;

      /*
       * Update the weekly period
       * with the recomputed metrics.
       */
      const updatedPeriod =
        await prisma.collectionsPeriod.update(
          {
            where: {
              id: period.id,
            },

            data: {
              daysCovered,

              expectedDays: 7,

              isComplete,

              computedSummary:
                computedSummary as Prisma.InputJsonValue,
            },
          }
        );

      /*
       * Add this week to the collection
       * of successfully processed periods.
       */
      processedPeriods.push({
        import: {
          id:
            savedImport.id,

          fileName:
            savedImport.fileName,

          rowCount:
            savedImport.rowCount,

          importedMinDate:
            savedImport.importedMinDate,

          importedMaxDate:
            savedImport.importedMaxDate,

          createdAt:
            savedImport.createdAt,
        },

        period: {
          id:
            updatedPeriod.id,

          periodStart:
            updatedPeriod.periodStart,

          periodEnd:
            updatedPeriod.periodEnd,

          daysCovered:
            updatedPeriod.daysCovered,

          expectedDays:
            updatedPeriod.expectedDays,

          isComplete:
            updatedPeriod.isComplete,

          transactionCount:
            consolidatedTransactions.length,
        },

        summary:
          computedSummary,
      });
    }

    /*
     * Safety check.
     */
    if (
      processedPeriods.length === 0
    ) {
      throw new Error(
        "No reporting periods were processed."
      );
    }

    /*
     * Put newest affected reporting week
     * first.
     */
    processedPeriods.sort(
      (a, b) =>
        b.period.periodStart.getTime() -
        a.period.periodStart.getTime()
    );

    const latest =
      processedPeriods[0];

    /*
     * Preserve the existing top-level
     * response shape so the Collections
     * page continues working.
     *
     * `periods` contains every week
     * affected by this upload.
     */
    return NextResponse.json(
      {
        success: true,

        weeksProcessed:
          processedPeriods.length,

        periods:
          processedPeriods,

        import:
          latest.import,

        period:
          latest.period,

        summary:
          latest.summary,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Collections import failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Collections import failed.",
      },
      {
        status: 500,
      }
    );
  }
}