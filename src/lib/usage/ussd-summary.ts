import {
  USSD_EVENTS,
  USSD_EVENT_LABELS,
  USSD_FLOWS,
} from "./ussd-events";

/*
  Builds the USSD usage summary from stored events.

  Kept free of database code so it can be tested
  directly against a Datadog export.

  Sessions
  --------
  All events sharing a TraceId form one session. A
  session belongs to the period in which it STARTED.
  Callers should load events from a little before the
  period start to a little after its end, so that late
  failure callbacks (which arrive ~10+ minutes after the
  payment request) are attached to their session.
*/

export type UssdEvent = {
  traceId: string;
  eventName: string;
  flow: string | null;
  eventTimestamp: Date;
  customerHash: string | null;
  businessId: string | null;
  businessName: string | null;
  network: string | null;
  amount: number | null;
  amountWithoutCharges: number | null;
  providerDescription: string | null;
};

export type UssdOutcome =
  | "completed"
  | "failed"
  | "no_outcome"
  | "left_after_processing"
  | "left_at_amount"
  | "left_at_customer_number"
  | "left_at_menu";

export const USSD_OUTCOME_LABELS: Record<
  UssdOutcome,
  string
> = {
  completed: "Payment completed",
  failed: "Payment unsuccessful",
  no_outcome: "Requested, no outcome yet",
  left_after_processing: "Left after amount processed",
  left_at_amount: "Left at amount entry",
  left_at_customer_number: "Left at customer number",
  left_at_menu: "Left at menu (dial only)",
};

const OUTCOME_ORDER: UssdOutcome[] = [
  "completed",
  "failed",
  "no_outcome",
  "left_after_processing",
  "left_at_amount",
  "left_at_customer_number",
  "left_at_menu",
];

// Requests newer than this before the last event may
// still be waiting for their callback.
const PENDING_WINDOW_MS = 20 * 60 * 1000;

// Silences at least this long are flagged as possible
// logging gaps. Overnight silences in real data stay
// under ~9 minutes, so 15 avoids false alarms.
const LOG_GAP_MINUTES = 15;

// Up to this span the activity chart is hourly.
const HOURLY_MAX_DAYS = 3;

const MAX_BUCKETS = 800;

type Session = {
  traceId: string;
  start: Date;
  events: Set<string>;
  flow: string | null;
  customerHash: string | null;
  businessId: string | null;
  businessName: string | null;
  requestedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  network: string | null;
  value: number | null;
  failureReason: string | null;
  outcome: UssdOutcome;
};

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function rate(part: number, total: number) {
  return total > 0 ? round((part / total) * 100) : 0;
}

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function dayKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function hourKey(value: Date) {
  return value.toISOString().slice(0, 13);
}

function decideOutcome(session: Session): UssdOutcome {
  const has = (name: string) =>
    session.events.has(name);

  if (has(USSD_EVENTS.COMPLETED)) return "completed";
  if (has(USSD_EVENTS.FAILED)) return "failed";
  if (has(USSD_EVENTS.PAYMENT_REQUESTED))
    return "no_outcome";
  if (has(USSD_EVENTS.AMOUNT_PROCESSED))
    return "left_after_processing";
  if (has(USSD_EVENTS.AMOUNT_ENTERED))
    return "left_at_amount";
  if (has(USSD_EVENTS.CUSTOMER_NUMBER))
    return "left_at_customer_number";

  return "left_at_menu";
}

export function buildSessions(events: UssdEvent[]) {
  const ordered = [...events].sort(
    (a, b) =>
      a.eventTimestamp.getTime() -
      b.eventTimestamp.getTime()
  );

  const sessions = new Map<string, Session>();

  for (const event of ordered) {
    let session = sessions.get(event.traceId);

    if (!session) {
      session = {
        traceId: event.traceId,
        start: event.eventTimestamp,
        events: new Set(),
        flow: null,
        customerHash: null,
        businessId: null,
        businessName: null,
        requestedAt: null,
        completedAt: null,
        failedAt: null,
        network: null,
        value: null,
        failureReason: null,
        outcome: "left_at_menu",
      };

      sessions.set(event.traceId, session);
    }

    session.events.add(event.eventName);
    session.flow ??= event.flow;
    session.customerHash ??= event.customerHash;
    session.businessId ??= event.businessId;
    session.businessName ??= event.businessName;

    if (
      event.eventName ===
        USSD_EVENTS.PAYMENT_REQUESTED &&
      !session.requestedAt
    ) {
      session.requestedAt = event.eventTimestamp;
      session.network ??= event.network;
    }

    if (
      event.eventName === USSD_EVENTS.COMPLETED &&
      !session.completedAt
    ) {
      session.completedAt = event.eventTimestamp;

      // The callback's network is the authoritative one.
      session.network =
        event.network ?? session.network;

      session.value =
        event.amountWithoutCharges ??
        event.amount ??
        null;
    }

    if (
      event.eventName === USSD_EVENTS.FAILED &&
      !session.failedAt
    ) {
      session.failedAt = event.eventTimestamp;
      session.network =
        event.network ?? session.network;
      session.failureReason =
        event.providerDescription;
    }
  }

  for (const session of sessions.values()) {
    session.outcome = decideOutcome(session);
  }

  return Array.from(sessions.values());
}

export type UssdSummaryOptions = {
  start?: string | null; // YYYY-MM-DD (UTC)
  end?: string | null; // YYYY-MM-DD (UTC)
  now?: Date;
};

export function buildUssdSummary(
  events: UssdEvent[],
  options: UssdSummaryOptions = {}
) {
  const now = options.now ?? new Date();

  const rangeStart = options.start
    ? new Date(`${options.start}T00:00:00.000Z`)
    : null;

  const rangeEnd = options.end
    ? new Date(`${options.end}T23:59:59.999Z`)
    : null;

  const allSessions = buildSessions(events);

  // Sessions belong to the period in which they started.
  const sessions = allSessions.filter(
    (session) =>
      (!rangeStart || session.start >= rangeStart) &&
      (!rangeEnd || session.start <= rangeEnd)
  );

  /*
    Coverage and gap detection use events that fall
    inside the period, not every event of its sessions.
    A USSD session can be resumed hours later under the
    same TraceId, which would otherwise stretch coverage
    past the period and create false gaps.
  */
  const includedEvents = events.filter(
    (event) =>
      (!rangeStart ||
        event.eventTimestamp >= rangeStart) &&
      (!rangeEnd || event.eventTimestamp <= rangeEnd)
  );

  const latestEventAll = events.reduce<Date | null>(
    (latest, event) =>
      !latest || event.eventTimestamp > latest
        ? event.eventTimestamp
        : latest,
    null
  );

  // ------------------------------------------------
  // OVERVIEW
  // ------------------------------------------------

  const count = (outcome: UssdOutcome) =>
    sessions.filter(
      (session) => session.outcome === outcome
    ).length;

  const completed = count("completed");
  const failed = count("failed");
  const noOutcome = count("no_outcome");

  const requested = sessions.filter(
    (session) => session.requestedAt
  ).length;

  const pendingRecent = sessions.filter(
    (session) =>
      session.outcome === "no_outcome" &&
      latestEventAll &&
      latestEventAll.getTime() -
        session.requestedAt!.getTime() <
        PENDING_WINDOW_MS
  ).length;

  const customers = new Set(
    sessions
      .map((session) => session.customerHash)
      .filter(Boolean)
  );

  const merchants = new Set(
    sessions
      .map((session) => session.businessId)
      .filter(Boolean)
  );

  const valueCompleted = sessions.reduce(
    (total, session) =>
      session.outcome === "completed"
        ? total + (session.value ?? 0)
        : total,
    0
  );

  const completedValues = sessions
    .filter(
      (session) =>
        session.outcome === "completed" &&
        session.value !== null
    )
    .map((session) => session.value!);

  const secondsToComplete = sessions
    .filter(
      (session) =>
        session.requestedAt && session.completedAt
    )
    .map(
      (session) =>
        (session.completedAt!.getTime() -
          session.requestedAt!.getTime()) /
        1000
    )
    .filter((value) => value >= 0);

  const minutesToFail = sessions
    .filter(
      (session) => session.requestedAt && session.failedAt
    )
    .map(
      (session) =>
        (session.failedAt!.getTime() -
          session.requestedAt!.getTime()) /
        60000
    )
    .filter((value) => value >= 0);

  const overview = {
    sessions: sessions.length,
    customers: customers.size,
    merchants: merchants.size,
    requested,
    completed,
    failed,
    noOutcome,
    pendingRecent,
    // Of sessions that got a payment result.
    paymentSuccessRate: rate(completed, completed + failed),
    // Of all sessions started.
    sessionCompletionRate: rate(
      completed,
      sessions.length
    ),
    valueCompleted: round(valueCompleted, 2),
    averagePayment:
      completed > 0
        ? round(valueCompleted / completed, 2)
        : 0,
    // Typical payment: a few very large payments pull
    // the average far above what most customers pay.
    medianPayment: median(completedValues),
    medianSecondsToComplete: median(secondsToComplete),
    medianMinutesToFail: median(minutesToFail),
  };

  // ------------------------------------------------
  // OUTCOMES
  // ------------------------------------------------

  const outcomes = OUTCOME_ORDER.map((outcome) => ({
    key: outcome,
    label: USSD_OUTCOME_LABELS[outcome],
    sessions: count(outcome),
    share: rate(count(outcome), sessions.length),
  }));

  // ------------------------------------------------
  // FLOWS (session-level funnels)
  // ------------------------------------------------

  const flows = USSD_FLOWS.map((definition) => {
    const flowSessions = sessions.filter(
      (session) => session.flow === definition.key
    );

    const flowCompleted = flowSessions.filter(
      (session) => session.outcome === "completed"
    ).length;

    const flowFailed = flowSessions.filter(
      (session) => session.outcome === "failed"
    ).length;

    let previous = flowSessions.length;

    const steps = definition.steps.map(
      (step, index) => {
        // A session "reached" a step if it logged it, or
        // logged any later step (logs can be missed).
        const later = definition.steps.slice(index);

        const reached = flowSessions.filter(
          (session) =>
            later.some((name) =>
              session.events.has(name)
            )
        ).length;

        const result = {
          key: step,
          label: USSD_EVENT_LABELS[step] ?? step,
          sessions: reached,
          ofStart: rate(reached, flowSessions.length),
          fromPrevious:
            index === 0
              ? 100
              : rate(reached, previous),
        };

        previous = reached;

        return result;
      }
    );

    // Largest step-to-step loss, excluding the start.
    const biggestDrop = steps
      .slice(1)
      .map((step, index) => ({
        from: steps[index].label,
        to: step.label,
        lost: steps[index].sessions - step.sessions,
        rate: round(100 - step.fromPrevious),
      }))
      .sort((a, b) => b.rate - a.rate)[0];

    return {
      key: definition.key,
      label: definition.label,
      description: definition.description,
      sessions: flowSessions.length,
      completed: flowCompleted,
      failed: flowFailed,
      paymentSuccessRate: rate(
        flowCompleted,
        flowCompleted + flowFailed
      ),
      completionRate: rate(
        flowCompleted,
        flowSessions.length
      ),
      steps,
      biggestDrop:
        biggestDrop && biggestDrop.lost > 0
          ? biggestDrop
          : null,
    };
  });

  const menuOnly = sessions.filter(
    (session) => !session.flow
  ).length;

  // ------------------------------------------------
  // NETWORKS
  // ------------------------------------------------

  const networkMap = new Map<
    string,
    { completed: number; failed: number }
  >();

  for (const session of sessions) {
    if (
      session.outcome !== "completed" &&
      session.outcome !== "failed"
    ) {
      continue;
    }

    const name = session.network ?? "Unknown";

    if (!networkMap.has(name)) {
      networkMap.set(name, { completed: 0, failed: 0 });
    }

    networkMap.get(name)![
      session.outcome === "completed"
        ? "completed"
        : "failed"
    ] += 1;
  }

  const networks = Array.from(networkMap.entries())
    .map(([name, value]) => ({
      name,
      completed: value.completed,
      failed: value.failed,
      total: value.completed + value.failed,
      successRate: rate(
        value.completed,
        value.completed + value.failed
      ),
    }))
    .sort((a, b) => b.total - a.total);

  // ------------------------------------------------
  // FAILURE REASONS
  // ------------------------------------------------

  const reasonMap = new Map<string, number>();

  for (const session of sessions) {
    if (session.outcome !== "failed") {
      continue;
    }

    const reason =
      session.failureReason ?? "No reason given";

    reasonMap.set(
      reason,
      (reasonMap.get(reason) ?? 0) + 1
    );
  }

  const failureReasons = Array.from(
    reasonMap.entries()
  )
    .map(([reason, total]) => ({
      reason,
      sessions: total,
      share: rate(total, failed),
    }))
    .sort((a, b) => b.sessions - a.sessions);

  // ------------------------------------------------
  // TOP MERCHANTS
  // ------------------------------------------------

  const merchantMap = new Map<
    string,
    {
      name: string;
      sessions: number;
      completed: number;
      failed: number;
      value: number;
    }
  >();

  for (const session of sessions) {
    if (!session.businessId) {
      continue;
    }

    if (!merchantMap.has(session.businessId)) {
      merchantMap.set(session.businessId, {
        name:
          session.businessName ?? session.businessId,
        sessions: 0,
        completed: 0,
        failed: 0,
        value: 0,
      });
    }

    const merchant = merchantMap.get(
      session.businessId
    )!;

    merchant.sessions += 1;

    if (session.outcome === "completed") {
      merchant.completed += 1;
      merchant.value += session.value ?? 0;
    }

    if (session.outcome === "failed") {
      merchant.failed += 1;
    }
  }

  const topMerchants = Array.from(
    merchantMap.values()
  )
    .map((merchant) => ({
      ...merchant,
      value: round(merchant.value, 2),
      paymentSuccessRate: rate(
        merchant.completed,
        merchant.completed + merchant.failed
      ),
    }))
    .sort(
      (a, b) =>
        b.completed - a.completed || b.value - a.value
    )
    .slice(0, 10);

  // ------------------------------------------------
  // DATA COVERAGE
  // ------------------------------------------------

  const timestamps = includedEvents
    .map((event) => event.eventTimestamp.getTime())
    .sort((a, b) => a - b);

  const earliestEvent = timestamps.length
    ? new Date(timestamps[0])
    : null;

  const latestEvent = timestamps.length
    ? new Date(timestamps[timestamps.length - 1])
    : null;

  const recordDays = new Set(
    sessions.map((session) => dayKey(session.start))
  );

  /*
    Periods with no events at all between the first and
    last record. These usually mean logging (or the
    service) stopped, not that nobody used USSD.
    Gaps across whole days without records are left to
    the chart and coverage note instead.
  */
  const logGaps: {
    from: string;
    to: string;
    minutes: number;
  }[] = [];

  for (let index = 1; index < timestamps.length; index++) {
    const minutes =
      (timestamps[index] - timestamps[index - 1]) / 60000;

    if (
      minutes >= LOG_GAP_MINUTES &&
      minutes < 24 * 60
    ) {
      logGaps.push({
        from: new Date(
          timestamps[index - 1]
        ).toISOString(),
        to: new Date(timestamps[index]).toISOString(),
        minutes: Math.round(minutes),
      });
    }
  }

  /*
    Day-by-day coverage, like the Collections page.
    The calendar runs across the selected period (never
    past today), or from the first to the last record
    when no period is selected.
  */
  const sessionsByDay = new Map<string, number>();

  for (const session of sessions) {
    const key = dayKey(session.start);
    sessionsByDay.set(
      key,
      (sessionsByDay.get(key) ?? 0) + 1
    );
  }

  const todayKey = dayKey(now);

  const calendarFrom =
    options.start ??
    (earliestEvent ? dayKey(earliestEvent) : null);

  let calendarTo =
    options.end ??
    (latestEvent ? dayKey(latestEvent) : null);

  if (calendarTo && calendarTo > todayKey) {
    calendarTo = todayKey;
  }

  const days: {
    date: string;
    sessions: number;
    hasData: boolean;
  }[] = [];

  if (
    calendarFrom &&
    calendarTo &&
    calendarFrom <= calendarTo
  ) {
    const cursor = new Date(
      `${calendarFrom}T00:00:00.000Z`
    );

    while (
      dayKey(cursor) <= calendarTo &&
      days.length < MAX_BUCKETS
    ) {
      const key = dayKey(cursor);
      const count = sessionsByDay.get(key) ?? 0;

      days.push({
        date: key,
        sessions: count,
        hasData: count > 0,
      });

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  /*
    Daily payment success rate per flow, for the
    "Daily Success Rate by Flow" table. Same definition
    as elsewhere: completed / (completed + unsuccessful),
    with each session counted on the day it started.
  */
  const flowDaily = USSD_FLOWS.map((definition) => {
    const perDay = new Map<
      string,
      { completed: number; failed: number }
    >();

    for (const session of sessions) {
      if (
        session.flow !== definition.key ||
        (session.outcome !== "completed" &&
          session.outcome !== "failed")
      ) {
        continue;
      }

      const key = dayKey(session.start);

      if (!perDay.has(key)) {
        perDay.set(key, { completed: 0, failed: 0 });
      }

      perDay.get(key)![
        session.outcome === "completed"
          ? "completed"
          : "failed"
      ] += 1;
    }

    const cells = days.map((day) => {
      const counts = perDay.get(day.date);
      const completed = counts?.completed ?? 0;
      const failed = counts?.failed ?? 0;

      return {
        date: day.date,
        completed,
        failed,
        successRate:
          completed + failed > 0
            ? round((completed / (completed + failed)) * 100, 2)
            : null,
      };
    });

    const completed = cells.reduce(
      (total, cell) => total + cell.completed,
      0
    );

    const failed = cells.reduce(
      (total, cell) => total + cell.failed,
      0
    );

    return {
      key: definition.key,
      label: definition.label,
      days: cells,
      total: {
        completed,
        failed,
        successRate:
          completed + failed > 0
            ? round((completed / (completed + failed)) * 100, 2)
            : null,
      },
    };
  });

  const coveredDays = days.filter(
    (day) => day.hasData
  ).length;

  const dataCoverage = {
    earliestEvent: earliestEvent?.toISOString() ?? null,
    latestEvent: latestEvent?.toISOString() ?? null,
    activeDays: recordDays.size,
    calendarDays: days.length,
    coveragePercent:
      days.length > 0
        ? round((coveredDays / days.length) * 100)
        : 0,
    days,
    coveredDates: days
      .filter((day) => day.hasData)
      .map((day) => day.date),
    missingDates: days
      .filter((day) => !day.hasData)
      .map((day) => day.date),
    logGaps: logGaps.slice(-10),
    logGapCount: logGaps.length,
  };

  // ------------------------------------------------
  // ACTIVITY OVER TIME
  // ------------------------------------------------

  /*
    Bucketed by session start. Hourly for short ranges,
    daily otherwise. Buckets with no imported records
    are null so the chart shows a gap, not a zero:
    - daily: days with no sessions
    - hourly: hours on days with no sessions, and hours
      before the first / after the last record
  */

  const spanStart =
    rangeStart ??
    (earliestEvent
      ? new Date(`${dayKey(earliestEvent)}T00:00:00.000Z`)
      : null);

  let spanEnd =
    rangeEnd ??
    (latestEvent
      ? new Date(`${dayKey(latestEvent)}T23:59:59.999Z`)
      : null);

  if (spanEnd && spanEnd > now) {
    spanEnd = now;
  }

  const spanDays =
    spanStart && spanEnd
      ? (spanEnd.getTime() - spanStart.getTime()) /
        86400000
      : 0;

  const granularity: "hour" | "day" =
    spanDays <= HOURLY_MAX_DAYS ? "hour" : "day";

  const bucketOf =
    granularity === "hour" ? hourKey : dayKey;

  const bucketSessions = new Map<string, number>();
  const bucketCompleted = new Map<string, number>();
  const bucketCustomers = new Map<string, Set<string>>();

  for (const session of sessions) {
    const key = bucketOf(session.start);

    bucketSessions.set(
      key,
      (bucketSessions.get(key) ?? 0) + 1
    );

    if (session.outcome === "completed") {
      bucketCompleted.set(
        key,
        (bucketCompleted.get(key) ?? 0) + 1
      );
    }

    if (session.customerHash) {
      if (!bucketCustomers.has(key)) {
        bucketCustomers.set(key, new Set());
      }

      bucketCustomers
        .get(key)!
        .add(session.customerHash);
    }
  }

  const firstHour = earliestEvent
    ? hourKey(earliestEvent)
    : null;

  const lastHour = latestEvent
    ? hourKey(latestEvent)
    : null;

  const activity: {
    key: string;
    sessions: number | null;
    customers: number | null;
    completed: number | null;
  }[] = [];

  if (spanStart && spanEnd && spanStart <= spanEnd) {
    const cursor = new Date(spanStart);

    if (granularity === "hour") {
      cursor.setUTCMinutes(0, 0, 0);
    } else {
      cursor.setUTCHours(0, 0, 0, 0);
    }

    while (
      cursor <= spanEnd &&
      activity.length < MAX_BUCKETS
    ) {
      const key = bucketOf(cursor);

      const hasRecords =
        granularity === "day"
          ? recordDays.has(key)
          : recordDays.has(dayKey(cursor)) &&
            !!firstHour &&
            !!lastHour &&
            key >= firstHour &&
            key <= lastHour;

      activity.push({
        key,
        sessions: hasRecords
          ? bucketSessions.get(key) ?? 0
          : null,
        customers: hasRecords
          ? bucketCustomers.get(key)?.size ?? 0
          : null,
        completed: hasRecords
          ? bucketCompleted.get(key) ?? 0
          : null,
      });

      if (granularity === "hour") {
        cursor.setUTCHours(cursor.getUTCHours() + 1);
      } else {
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }
  }

  return {
    period: {
      start: options.start ?? null,
      end: options.end ?? null,
    },
    overview,
    outcomes,
    flows,
    menuOnly,
    networks,
    failureReasons,
    topMerchants,
    dataCoverage,
    flowDaily,
    activity: {
      granularity,
      buckets: activity,
    },
  };
}

export type UssdSummary = ReturnType<
  typeof buildUssdSummary
>;
