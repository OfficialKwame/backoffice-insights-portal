import { normaliseNetwork } from "./ussd-events";

/*
  Turns one row of the Datadog USSD log export into a
  record for the database, or a reason it was skipped.

  Everything is read from the Content column (the full
  log as JSON). The other columns are only a fallback for
  the timestamp, because spreadsheet apps can mangle
  them (e.g. phone numbers turned into decimals).

  Privacy: the customer's number is replaced by a keyed
  hash, and the customer's name is never stored.
*/

export type UssdCsvRow = Record<string, string | undefined>;

export type UssdEventRecord = {
  sourceId: string;
  traceId: string;
  eventName: string;
  flow: string | null;
  eventTimestamp: Date;
  customerHash: string | null;
  businessId: string | null;
  businessName: string | null;
  sector: string | null;
  channel: string | null;
  network: string | null;
  amount: number | null;
  amountWithoutCharges: number | null;
  charges: number | null;
  paymentCategory: string | null;
  providerDescription: string | null;
  sessionStatus: string | null;
};

export type UssdSkipReason =
  | "missing_content"
  | "invalid_json"
  | "missing_trace"
  | "missing_event_name"
  | "missing_timestamp";

export const USSD_SKIP_REASON_LABELS: Record<
  UssdSkipReason,
  string
> = {
  missing_content: "Content column is empty or missing",
  invalid_json: "Content is not valid JSON",
  missing_trace: "No TraceId in Content",
  missing_event_name: "No Action.Name in Content",
  missing_timestamp:
    "No usable timestamp (@timestamp or Date)",
};

export type UssdParseResult =
  | { ok: true; record: UssdEventRecord }
  | {
      ok: false;
      reasons: UssdSkipReason[];
      detail: string;
    };

function text(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const result = String(value).trim();

  return result.length > 0 ? result : null;
}

function num(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function date(value: unknown) {
  const raw = text(value);

  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}

export function parseUssdRow(
  row: UssdCsvRow,
  hashCustomer: (value: string) => string
): UssdParseResult {
  const rawContent = text(row.Content);

  if (!rawContent) {
    return {
      ok: false,
      reasons: ["missing_content"],
      detail: "Content was empty",
    };
  }

  let content: any;

  try {
    content = JSON.parse(rawContent);
  } catch {
    content = null;
  }

  if (
    !content ||
    typeof content !== "object" ||
    Array.isArray(content)
  ) {
    return {
      ok: false,
      reasons: ["invalid_json"],
      detail: `Starts with: ${rawContent.slice(0, 60)}`,
    };
  }

  const event = content.LogAnalyticEvent ?? {};
  const action = event.Action ?? {};
  const customer = event.Customer ?? {};
  const page = event.Page ?? {};

  const traceId = text(action.TraceId);
  const eventName = text(action.Name);

  const eventTimestamp =
    date(content["@timestamp"]) ??
    date(page.CreatedAt) ??
    date(row.Date);

  const reasons: UssdSkipReason[] = [];

  if (!traceId) reasons.push("missing_trace");
  if (!eventName) reasons.push("missing_event_name");
  if (!eventTimestamp) reasons.push("missing_timestamp");

  if (reasons.length > 0) {
    const fields = [
      "Action",
      "Customer",
      "Page",
    ]
      .map(
        (section) =>
          `${section}: ${
            Object.keys(event[section] ?? {}).join(
              ", "
            ) || "none"
          }`
      )
      .join(" | ");

    return {
      ok: false,
      reasons,
      detail: `Fields found: ${fields}`,
    };
  }

  const mobile = text(customer.CustomerMobileNumber);
  const channel = text(action.Channel);

  return {
    ok: true,
    record: {
      // Unique per step of a session, so re-importing
      // overlapping exports never double counts.
      sourceId: `${traceId}:${eventName}:${eventTimestamp!.toISOString()}`,
      traceId: traceId!,
      eventName: eventName!,
      flow: text(page.Flow),
      eventTimestamp: eventTimestamp!,
      customerHash: mobile
        ? hashCustomer(mobile)
        : null,
      businessId: text(customer.BusinessId),
      businessName: text(customer.BusinessName),
      sector: text(page.Sector),
      channel,
      network: normaliseNetwork(channel),
      amount: num(action.Amount),
      amountWithoutCharges: num(
        action.AmountWithoutCharges
      ),
      charges: num(action.Charges),
      paymentCategory: text(action.PaymentCategory),
      providerDescription: text(
        action.ProviderDescription
      ),
      sessionStatus: text(page.SessionStatus),
    },
  };
}
