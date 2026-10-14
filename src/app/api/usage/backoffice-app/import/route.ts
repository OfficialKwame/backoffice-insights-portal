import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RawRow = {
  Date?: string;
  Host?: string;
  Service?: string;
  Content?: string;
};

function safeJsonParse(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();

  return text.length > 0 ? text : null;
}

function safeDate(value: unknown) {
  if (!value) {
    return null;
  }

  const parsed = new Date(String(value));

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}

/**
 * Choose the timestamp used for reporting.
 *
 * Priority:
 * 1. EventTime — when it looks valid
 * 2. @timestamp
 * 3. CreatedAt
 * 4. CSV Date
 *
 * Some source records have an EventTime that is incorrectly
 * dated in the future. When we have a trustworthy logging
 * timestamp and EventTime is later than it, we use the
 * logging timestamp instead.
 *
 * The original source values remain untouched in rawData.
 */
function parseEventTime(
  content: Record<string, any>,
  fallbackDate?: string
) {
  const eventTime = safeDate(
    content.EventTime ??
      content.EventTimestamp ??
      content.Timestamp
  );

  const logTimestamp = safeDate(
    content["@timestamp"]
  );

  const createdAt = safeDate(
    content.CreatedAt
  );

  const csvDate = safeDate(
    fallbackDate
  );

  const trustedTimestamp =
    logTimestamp ??
    createdAt ??
    csvDate;

  if (!eventTime) {
    return trustedTimestamp;
  }

  /*
   * If EventTime is later than the timestamp at which
   * the event was actually logged/created, treat
   * EventTime as unreliable.
   *
   * Allow a small tolerance because timestamps from
   * different systems may differ slightly.
   */
  if (trustedTimestamp) {
    const toleranceMs =
      5 * 60 * 1000;

    if (
      eventTime.getTime() >
      trustedTimestamp.getTime() +
        toleranceMs
    ) {
      return trustedTimestamp;
    }
  }

  return eventTime;
}

export async function POST(request: Request) {
  try {
    const formData =
      await request.formData();

    const file =
      formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error:
            "CSV file is required.",
        },
        { status: 400 }
      );
    }

    const text =
      await file.text();

    const { parse } =
      await import(
        "csv-parse/sync"
      );

    const rows = parse(text, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      bom: true,
    }) as RawRow[];

    let imported = 0;
    let skipped = 0;
    let duplicates = 0;

    /*
      Skip diagnostics.

      Each skipped row records why it was skipped, plus
      a few example rows per reason. Examples show the
      CSV row number and the field names found in the
      Content JSON (not the values), so the report is
      safe to share.
    */

    const SKIP_REASON_LABELS: Record<string, string> = {
      missing_content:
        "Content column is empty or missing",
      invalid_json:
        "Content is not valid JSON",
      missing_id:
        "No Id in Content",
      missing_event_name:
        "No EventName in Content",
      missing_timestamp:
        "No usable timestamp (EventTime, @timestamp, CreatedAt or Date)",
    };

    const MAX_EXAMPLES = 3;

    const skipReasons = new Map<
      string,
      {
        count: number;
        examples: {
          row: number;
          detail: string;
        }[];
      }
    >();

    const recordSkip = (
      reason: string,
      rowNumber: number,
      detail: string
    ) => {
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
          detail,
        });
      }
    };

    for (
      let index = 0;
      index < rows.length;
      index++
    ) {
      const row = rows[index];

      // Row 1 is the header, so data starts at row 2.
      const rowNumber = index + 2;

      const rawContent =
        normalizeString(row.Content);

      if (!rawContent) {
        recordSkip(
          "missing_content",
          rowNumber,
          "Content was empty"
        );

        skipped += 1;
        continue;
      }

      const content =
        safeJsonParse(
          rawContent
        );

      if (
        !content ||
        typeof content !==
          "object" ||
        Array.isArray(content)
      ) {
        recordSkip(
          "invalid_json",
          rowNumber,
          `Starts with: ${rawContent.slice(0, 60)}`
        );

        skipped += 1;
        continue;
      }

      const sourceId =
        normalizeString(
          content.Id
        );

      const eventName =
        normalizeString(
          content.EventName
        );

      const eventTimestamp =
        parseEventTime(
          content,
          row.Date
        );

      if (
        !sourceId ||
        !eventName ||
        !eventTimestamp
      ) {
        const fields = Object.keys(content)
          .slice(0, 12)
          .join(", ");

        const detail = `Fields found: ${
          fields || "none"
        }${
          Object.keys(content).length > 12
            ? ", ..."
            : ""
        }`;

        if (!sourceId) {
          recordSkip(
            "missing_id",
            rowNumber,
            detail
          );
        }

        if (!eventName) {
          recordSkip(
            "missing_event_name",
            rowNumber,
            detail
          );
        }

        if (!eventTimestamp) {
          recordSkip(
            "missing_timestamp",
            rowNumber,
            detail
          );
        }

        skipped += 1;
        continue;
      }

      const existing =
        await prisma.backOfficeAppUsageEvent.findUnique(
          {
            where: {
              sourceId,
            },
            select: {
              id: true,
            },
          }
        );

      if (existing) {
        duplicates += 1;
        continue;
      }

      const eventId =
        normalizeString(
          content.EventId
        );

      const sessionId =
        normalizeString(
          content.SessionId
        );

      const customerPhoneNumber =
        normalizeString(
          content.CustomerPhoneNumber
        );

      const operatingSystem =
        normalizeString(
          content.OperatingSystem
        );

      const device =
        normalizeString(
          content.DeviceName ??
            content.DeviceBrand ??
            content.DeviceId
        );

      const appVersion =
        normalizeString(
          content.AppVersion
        );

      await prisma.backOfficeAppUsageEvent.create(
        {
          data: {
            sourceId,
            eventId,
            sessionId,
            customerPhoneNumber,
            eventName,
            eventTimestamp,
            operatingSystem,
            device,
            appVersion,
            rawData:
              content,
          },
        }
      );

      imported += 1;
    }

    // Column names found in the CSV header, so a
    // renamed or missing column is obvious.
    const columnsFound =
      rows.length > 0
        ? Object.keys(rows[0])
        : [];

    const skipReport = Array.from(
      skipReasons.entries()
    )
      .map(([reason, entry]) => ({
        reason,
        label:
          SKIP_REASON_LABELS[reason] ?? reason,
        count: entry.count,
        examples: entry.examples,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      duplicates,
      totalRows:
        rows.length,
      expectedColumns: [
        "Date",
        "Host",
        "Service",
        "Content",
      ],
      columnsFound,
      skipReport,
    });
  } catch (error) {
    console.error(
      "BackOffice App usage import failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to import BackOffice App usage data.",
      },
      { status: 500 }
    );
  }
}