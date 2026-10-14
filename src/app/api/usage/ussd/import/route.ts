import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import {
  parseUssdRow,
  USSD_SKIP_REASON_LABELS,
  type UssdCsvRow,
  type UssdEventRecord,
  type UssdSkipReason,
} from "@/lib/usage/ussd-parse";

/*
  Imports the raw Datadog log export for PosUssd.

  Expected: the CSV exported from Datadog Log Explorer
  with the Content column included. Everything is read
  from Content, so other columns can be added or
  removed freely.
*/

const EXPECTED_COLUMNS = ["Date", "Content"];

const INSERT_BATCH_SIZE = 1000;

const MAX_EXAMPLES = 3;

export async function POST(request: Request) {
  try {
    const secret = process.env.USSD_HASH_SECRET;

    if (!secret) {
      return NextResponse.json(
        {
          error:
            "USSD_HASH_SECRET is not set. Add it to your .env file (any long random string) and restart the dev server.",
        },
        { status: 500 }
      );
    }

    const hashCustomer = (value: string) =>
      createHmac("sha256", secret)
        .update(value)
        .digest("hex");

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "CSV file is required." },
        { status: 400 }
      );
    }

    const text = await file.text();

    const { parse } = await import("csv-parse/sync");

    const rows = parse(text, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      bom: true,
    }) as UssdCsvRow[];

    // --------------------------------------------------
    // PARSE
    // --------------------------------------------------

    const records = new Map<string, UssdEventRecord>();

    let skipped = 0;
    let duplicatesInFile = 0;

    const skipReasons = new Map<
      UssdSkipReason,
      {
        count: number;
        examples: { row: number; detail: string }[];
      }
    >();

    for (let index = 0; index < rows.length; index++) {
      // Row 1 is the header, so data starts at row 2.
      const rowNumber = index + 2;

      const result = parseUssdRow(
        rows[index],
        hashCustomer
      );

      if (!result.ok) {
        skipped += 1;

        for (const reason of result.reasons) {
          if (!skipReasons.has(reason)) {
            skipReasons.set(reason, {
              count: 0,
              examples: [],
            });
          }

          const entry = skipReasons.get(reason)!;

          entry.count += 1;

          if (entry.examples.length < MAX_EXAMPLES) {
            entry.examples.push({
              row: rowNumber,
              detail: result.detail,
            });
          }
        }

        continue;
      }

      if (records.has(result.record.sourceId)) {
        duplicatesInFile += 1;
        continue;
      }

      records.set(
        result.record.sourceId,
        result.record
      );
    }

    // --------------------------------------------------
    // INSERT (existing events are skipped by sourceId)
    // --------------------------------------------------

    const toInsert = Array.from(records.values());

    let imported = 0;

    for (
      let offset = 0;
      offset < toInsert.length;
      offset += INSERT_BATCH_SIZE
    ) {
      const batch = toInsert.slice(
        offset,
        offset + INSERT_BATCH_SIZE
      );

      const result =
        await prisma.ussdUsageEvent.createMany({
          data: batch,
          skipDuplicates: true,
        });

      imported += result.count;
    }

    const duplicates =
      duplicatesInFile + (toInsert.length - imported);

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    const columnsFound =
      rows.length > 0 ? Object.keys(rows[0]) : [];

    const skipReport = Array.from(
      skipReasons.entries()
    )
      .map(([reason, entry]) => ({
        reason,
        label: USSD_SKIP_REASON_LABELS[reason],
        count: entry.count,
        examples: entry.examples,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      duplicates,
      totalRows: rows.length,
      expectedColumns: EXPECTED_COLUMNS,
      columnsFound,
      skipReport,
    });
  } catch (error) {
    console.error("USSD usage import failed:", error);

    return NextResponse.json(
      { error: "Failed to import USSD usage data." },
      { status: 500 }
    );
  }
}
