import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";

type RawInvoiceRow = {
  Invoiceid?: unknown;
  Businessid?: unknown;
  Businessname?: unknown;
  Source?: unknown;
  Createdat?: unknown;
  Duedate?: unknown;
  Totalamount?: unknown;
  Aggregatedamount?: unknown;
  Remindingamount?: unknown;
  Status?: unknown;
  Lastpaymentdate?: unknown;
  [key: string]: unknown;
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

function parseOptionalDate(
  value: unknown
): Date | null {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const parsed = new Date(
    String(value)
  );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return null;
  }

  return parsed;
}

function parseRequiredDate(
  value: unknown,
  label: string
): Date {
  const parsed =
    parseOptionalDate(value);

  if (!parsed) {
    throw new Error(
      `${label} is missing or invalid.`
    );
  }

  return parsed;
}

function parseAmount(
  value: unknown
): Prisma.Decimal {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return new Prisma.Decimal(0);
  }

  const numeric =
    Number(value);

  if (
    !Number.isFinite(
      numeric
    )
  ) {
    return new Prisma.Decimal(0);
  }

  return new Prisma.Decimal(
    numeric
  );
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

    if (
      !(file instanceof File)
    ) {
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
     * Save original source file.
     */
    const uploadDir =
      path.join(
        process.cwd(),
        "data",
        "raw",
        "invoice-imports"
      );

    await fs.mkdir(
      uploadDir,
      {
        recursive: true,
      }
    );

    const timestamp =
      new Date()
        .toISOString()
        .replace(
          /[:.]/g,
          "-"
        );

    const safeFileName =
      file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      );

    const storedFileName =
      `${timestamp}-${safeFileName}`;

    storedFilePath =
      path.join(
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
     * Extract rows using the same
     * generic extractor already used
     * for transaction imports.
     */
    const rows =
      (await runPythonJson(
"compute/collections/extract_invoice_rows.py",
        storedFilePath
      )) as RawInvoiceRow[];

    if (
      !Array.isArray(rows) ||
      rows.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "The uploaded file contains no invoice rows.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Validate and prepare invoices.
     */
    const prepared =
      rows.map(
        (row, index) => {
          const invoiceId =
            row.Invoiceid ===
              null ||
            row.Invoiceid ===
              undefined
              ? ""
              : String(
                  row.Invoiceid
                ).trim();

          if (
            !invoiceId
          ) {
            throw new Error(
              `Row ${
                index + 1
              } has no Invoiceid.`
            );
          }

          const invoiceCreatedAt =
            parseRequiredDate(
              row.Createdat,
              `Row ${
                index + 1
              } Createdat`
            );

          const businessId =
            row.Businessid ===
              null ||
            row.Businessid ===
              undefined
              ? null
              : String(
                  row.Businessid
                ).trim() ||
                null;

          const businessName =
            row.Businessname ===
              null ||
            row.Businessname ===
              undefined
              ? null
              : String(
                  row.Businessname
                ).trim() ||
                null;

          const source =
            row.Source ===
              null ||
            row.Source ===
              undefined
              ? null
              : String(
                  row.Source
                ).trim() ||
                null;

          const status =
            row.Status ===
              null ||
            row.Status ===
              undefined
              ? null
              : String(
                  row.Status
                ).trim() ||
                null;

          return {
            invoiceId,
            businessId,
            businessName,
            source,
            invoiceCreatedAt,
            dueDate:
              parseOptionalDate(
                row.Duedate
              ),
            totalAmount:
              parseAmount(
                row.Totalamount
              ),
            collectedAmount:
              parseAmount(
                row.Aggregatedamount
              ),
            outstandingAmount:
              parseAmount(
                row.Remindingamount
              ),
            status,
            lastPaymentDate:
              parseOptionalDate(
                row.Lastpaymentdate
              ),
            rawData:
              row,
          };
        }
      );

    /*
     * Upsert by Invoiceid.
     *
     * Re-uploading updated invoice
     * data updates the existing row
     * rather than creating duplicates.
     */
    for (
      const invoice
      of prepared
    ) {
      await prisma.collectionsInvoice.upsert(
        {
          where: {
            invoiceId:
              invoice.invoiceId,
          },

          update: {
            businessId:
              invoice.businessId,

            businessName:
              invoice.businessName,

            source:
              invoice.source,

            invoiceCreatedAt:
              invoice.invoiceCreatedAt,

            dueDate:
              invoice.dueDate,

            totalAmount:
              invoice.totalAmount,

            collectedAmount:
              invoice.collectedAmount,

            outstandingAmount:
              invoice.outstandingAmount,

            status:
              invoice.status,

            lastPaymentDate:
              invoice.lastPaymentDate,

            rawData:
              invoice.rawData as Prisma.InputJsonValue,
          },

          create: {
            invoiceId:
              invoice.invoiceId,

            businessId:
              invoice.businessId,

            businessName:
              invoice.businessName,

            source:
              invoice.source,

            invoiceCreatedAt:
              invoice.invoiceCreatedAt,

            dueDate:
              invoice.dueDate,

            totalAmount:
              invoice.totalAmount,

            collectedAmount:
              invoice.collectedAmount,

            outstandingAmount:
              invoice.outstandingAmount,

            status:
              invoice.status,

            lastPaymentDate:
              invoice.lastPaymentDate,

            rawData:
              invoice.rawData as Prisma.InputJsonValue,
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        fileName:
          file.name,
        rowsProcessed:
          prepared.length,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Invoice import failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invoice import failed.",
      },
      {
        status: 500,
      }
    );
  }
}
