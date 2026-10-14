import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import {
  BACKOFFICE_APP_EVENT_LABELS,
  PAYMENT_JOURNEY_EVENTS,
} from "@/lib/usage/backoffice-app-events";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const start = searchParams.get("start");
    const end = searchParams.get("end");

    const where: any = {};

    // --------------------------------------------------
    // REPORTING PERIOD FILTER
    // --------------------------------------------------

    if (start || end) {
      where.eventTimestamp = {};

      // Ghana is UTC+0, so use explicit UTC boundaries
      if (start) {
        where.eventTimestamp.gte = new Date(
          `${start}T00:00:00.000Z`
        );
      }

      if (end) {
        where.eventTimestamp.lte = new Date(
          `${end}T23:59:59.999Z`
        );
      }
    }

    // --------------------------------------------------
    // LOAD EVENTS
    // --------------------------------------------------

    const events =
      await prisma.backOfficeAppUsageEvent.findMany({
        where,
        select: {
          eventName: true,
          sessionId: true,
          customerPhoneNumber: true,
          eventTimestamp: true,
          operatingSystem: true,
          device: true,
          appVersion: true,
          rawData: true,
        },
        orderBy: {
          eventTimestamp: "asc",
        },
      });

    // --------------------------------------------------
    // OVERVIEW
    // --------------------------------------------------

    const sessions = new Set(
      events
        .map((event) => event.sessionId)
        .filter(Boolean)
    );

    const users = new Set(
      events
        .map(
          (event) =>
            event.customerPhoneNumber
        )
        .filter(Boolean)
    );

    const appCrashes = events.filter(
      (event) =>
        event.eventName
          .trim()
          .toLowerCase() ===
        "app crash"
    ).length;

    // --------------------------------------------------
    // EVENT COUNTS
    // --------------------------------------------------

    const eventCounts =
      new Map<string, number>();

    for (const event of events) {
      eventCounts.set(
        event.eventName,
        (eventCounts.get(
          event.eventName
        ) ?? 0) + 1
      );
    }

    // --------------------------------------------------
    // FEATURE / ACTION USAGE
    // --------------------------------------------------

    const journeyEventNames =
      new Set(
        PAYMENT_JOURNEY_EVENTS.map(
          (item) => item.eventName
        )
      );

    const excludedFeatureEvents =
      new Set([
        ...journeyEventNames,
        "View Item",
        "App Crash",
      ]);

    const featureUsage =
      Array.from(
        eventCounts.entries()
      )
        .filter(
          ([eventName]) =>
            !excludedFeatureEvents.has(
              eventName
            )
        )
        .map(
          ([eventName, count]) => ({
            eventName,

            label:
              BACKOFFICE_APP_EVENT_LABELS[
                eventName
              ] ?? eventName,

            count,
          })
        )
        .sort(
          (a, b) =>
            b.count - a.count
        );

    // --------------------------------------------------
    // RAW PAYMENT JOURNEY EVENT COUNTS
    // --------------------------------------------------

    const paymentJourney =
      PAYMENT_JOURNEY_EVENTS.map(
        (journeyStep) => ({
          step: journeyStep.step,

          eventName:
            journeyStep.eventName,

          label:
            journeyStep.label,

          count:
            eventCounts.get(
              journeyStep.eventName
            ) ?? 0,
        })
      );

    // --------------------------------------------------
    // SESSION-LEVEL PAYMENT FUNNEL
    // --------------------------------------------------

    /*
      We group events by SessionId.

      A session only reaches the next funnel step when
      that event occurs AFTER the previous required step.

      Example:
      Start Session
      -> Take Payment
      -> Add To Cart
      -> Begin Purchase
      -> Purchase

      This prevents repeated event volumes from being
      treated as conversion.
    */

    type SessionEvent = {
      eventName: string;
      eventTimestamp: Date;
    };

    const eventsBySession =
      new Map<
        string,
        SessionEvent[]
      >();

    for (const event of events) {
      if (!event.sessionId) {
        continue;
      }

      if (
        !eventsBySession.has(
          event.sessionId
        )
      ) {
        eventsBySession.set(
          event.sessionId,
          []
        );
      }

      eventsBySession
        .get(event.sessionId)!
        .push({
          eventName:
            event.eventName,
          eventTimestamp:
            event.eventTimestamp,
        });
    }

    const funnelReachCounts =
      PAYMENT_JOURNEY_EVENTS.map(
        () => 0
      );

    for (const sessionEvents of
      eventsBySession.values()) {
      const orderedEvents =
        [...sessionEvents].sort(
          (a, b) =>
            a.eventTimestamp.getTime() -
            b.eventTimestamp.getTime()
        );

      let searchFromIndex = 0;

      for (
        let stepIndex = 0;
        stepIndex <
        PAYMENT_JOURNEY_EVENTS.length;
        stepIndex++
      ) {
        const requiredEvent =
          PAYMENT_JOURNEY_EVENTS[
            stepIndex
          ].eventName;

        let foundIndex = -1;

        for (
          let eventIndex =
            searchFromIndex;
          eventIndex <
          orderedEvents.length;
          eventIndex++
        ) {
          if (
            orderedEvents[eventIndex]
              .eventName ===
            requiredEvent
          ) {
            foundIndex =
              eventIndex;

            break;
          }
        }

        if (foundIndex === -1) {
          break;
        }

        funnelReachCounts[
          stepIndex
        ] += 1;

        searchFromIndex =
          foundIndex + 1;
      }
    }

    const sessionFunnel =
      PAYMENT_JOURNEY_EVENTS.map(
        (journeyStep, index) => {
          const reached =
            funnelReachCounts[
              index
            ];

          const previousReached =
            index === 0
              ? reached
              : funnelReachCounts[
                  index - 1
                ];

          const dropOff =
            index === 0
              ? 0
              : Math.max(
                  previousReached -
                    reached,
                  0
                );

          const stepConversionRate =
            index === 0
              ? 100
              : previousReached > 0
                ? (reached /
                    previousReached) *
                  100
                : 0;

          const dropOffRate =
            index === 0 ||
            previousReached === 0
              ? 0
              : (dropOff /
                  previousReached) *
                100;

          return {
            step:
              journeyStep.step,

            eventName:
              journeyStep.eventName,

            label:
              journeyStep.label,

            sessionsReached:
              reached,

            stepConversionRate:
              Number(
                stepConversionRate.toFixed(
                  2
                )
              ),

            dropOffSessions:
              dropOff,

            dropOffRate:
              Number(
                dropOffRate.toFixed(
                  2
                )
              ),
          };
        }
      );

    // Overall funnel completion

    const funnelStarts =
      funnelReachCounts[0] ?? 0;

    const funnelCompletions =
      funnelReachCounts[
        funnelReachCounts.length -
          1
      ] ?? 0;

    const overallCompletionRate =
      funnelStarts > 0
        ? (funnelCompletions /
            funnelStarts) *
          100
        : 0;

    // Biggest funnel friction point

    const frictionSteps =
      sessionFunnel.filter(
        (item) => item.step > 1
      );

    const biggestDropOff =
      frictionSteps.length > 0
        ? frictionSteps.reduce(
            (worst, current) =>
              current.dropOffRate >
              worst.dropOffRate
                ? current
                : worst
          )
        : null;

    const funnelSummary = {
      startedSessions:
        funnelStarts,

      completedSessions:
        funnelCompletions,

      completionRate: Number(
        overallCompletionRate.toFixed(
          2
        )
      ),

      biggestDropOff:
        biggestDropOff
          ? {
              step:
                biggestDropOff.step,

              label:
                biggestDropOff.label,

              sessions:
                biggestDropOff.dropOffSessions,

              rate:
                biggestDropOff.dropOffRate,
            }
          : null,
    };

    // --------------------------------------------------
    // PAYMENT CHANNEL USAGE
    // --------------------------------------------------

    const paymentChannelMap =
      new Map<
        string,
        {
          views: number;
          sessions: Set<string>;
          users: Set<string>;
        }
      >();

    for (const event of events) {
      if (
        event.eventName !==
        "View Item"
      ) {
        continue;
      }

      const rawData =
        event.rawData as Record<
          string,
          any
        >;

      const eventStoreMessage =
        rawData?.EventStoreMessage;

      const page =
        eventStoreMessage?.page;

      const channelName =
        page?.viewItemName ??
        page?.name;

      if (!channelName) {
        continue;
      }

      const normalizedChannel =
        String(
          channelName
        ).trim();

      if (!normalizedChannel) {
        continue;
      }

      if (
        !paymentChannelMap.has(
          normalizedChannel
        )
      ) {
        paymentChannelMap.set(
          normalizedChannel,
          {
            views: 0,
            sessions:
              new Set<string>(),
            users:
              new Set<string>(),
          }
        );
      }

      const channel =
        paymentChannelMap.get(
          normalizedChannel
        )!;

      channel.views += 1;

      if (event.sessionId) {
        channel.sessions.add(
          event.sessionId
        );
      }

      if (
        event.customerPhoneNumber
      ) {
        channel.users.add(
          event.customerPhoneNumber
        );
      }
    }

    const paymentChannelUsage =
      Array.from(
        paymentChannelMap.entries()
      )
        .map(
          ([name, data]) => ({
            name,
            views:
              data.views,
            sessions:
              data.sessions.size,
            users:
              data.users.size,
          })
        )
        .sort(
          (a, b) =>
            b.sessions -
            a.sessions
        );

    // --------------------------------------------------
    // OPERATING SYSTEM
    // --------------------------------------------------

    const operatingSystemMap =
      new Map<string, number>();

    for (const event of events) {
      if (
        !event.operatingSystem
      ) {
        continue;
      }

      operatingSystemMap.set(
        event.operatingSystem,
        (operatingSystemMap.get(
          event.operatingSystem
        ) ?? 0) + 1
      );
    }

    const operatingSystems =
      Array.from(
        operatingSystemMap.entries()
      )
        .map(
          ([name, count]) => ({
            name,
            count,
          })
        )
        .sort(
          (a, b) =>
            b.count - a.count
        );

    // --------------------------------------------------
    // APP VERSION
    // --------------------------------------------------

    const appVersionMap =
      new Map<string, number>();

    for (const event of events) {
      if (!event.appVersion) {
        continue;
      }

      appVersionMap.set(
        event.appVersion,
        (appVersionMap.get(
          event.appVersion
        ) ?? 0) + 1
      );
    }

    const appVersions =
      Array.from(
        appVersionMap.entries()
      )
        .map(
          ([version, count]) => ({
            version,
            count,
          })
        )
        .sort(
          (a, b) =>
            b.count - a.count
        );

    // --------------------------------------------------
    // CRASH ANALYSIS
    // --------------------------------------------------

    const crashEvents =
      events.filter(
        (event) =>
          event.eventName
            .trim()
            .toLowerCase() ===
          "app crash"
      );

    const crashesByOSMap =
      new Map<
        string,
        number
      >();

    const crashesByVersionMap =
      new Map<
        string,
        number
      >();

    const crashesByDeviceMap =
      new Map<
        string,
        number
      >();

    for (const crash of crashEvents) {
      const os =
        crash.operatingSystem?.trim() ||
        "Unknown";

      const version =
        crash.appVersion?.trim() ||
        "Unknown";

      const device =
        crash.device?.trim() ||
        "Unknown";

      crashesByOSMap.set(
        os,
        (crashesByOSMap.get(
          os
        ) ?? 0) + 1
      );

      crashesByVersionMap.set(
        version,
        (crashesByVersionMap.get(
          version
        ) ?? 0) + 1
      );

      crashesByDeviceMap.set(
        device,
        (crashesByDeviceMap.get(
          device
        ) ?? 0) + 1
      );
    }

    const crashesByOS =
      Array.from(
        crashesByOSMap.entries()
      )
        .map(
          ([name, count]) => ({
            name,
            count,
          })
        )
        .sort(
          (a, b) =>
            b.count - a.count
        );

    const crashesByVersion =
      Array.from(
        crashesByVersionMap.entries()
      )
        .map(
          ([version, count]) => ({
            version,
            count,
          })
        )
        .sort(
          (a, b) =>
            b.count - a.count
        );

    const crashesByDevice =
      Array.from(
        crashesByDeviceMap.entries()
      )
        .map(
          ([device, count]) => ({
            device,
            count,
          })
        )
        .sort(
          (a, b) =>
            b.count - a.count
        )
        .slice(0, 10);

    // What happened immediately before each crash?

    const previousEventMap =
      new Map<
        string,
        number
      >();

    for (const [
      ,
      sessionEvents,
    ] of eventsBySession) {
      const ordered =
        [...sessionEvents].sort(
          (a, b) =>
            a.eventTimestamp.getTime() -
            b.eventTimestamp.getTime()
        );

      for (
        let index = 0;
        index <
        ordered.length;
        index++
      ) {
        if (
          ordered[
            index
          ].eventName
            .trim()
            .toLowerCase() !==
          "app crash"
        ) {
          continue;
        }

        if (index === 0) {
          continue;
        }

        const previousEvent =
          ordered[
            index - 1
          ].eventName;

        previousEventMap.set(
          previousEvent,
          (previousEventMap.get(
            previousEvent
          ) ?? 0) + 1
        );
      }
    }

    const eventsBeforeCrash =
      Array.from(
        previousEventMap.entries()
      )
        .map(
          ([eventName, count]) => ({
            eventName,

            label:
              BACKOFFICE_APP_EVENT_LABELS[
                eventName
              ] ?? eventName,

            count,
          })
        )
        .sort(
          (a, b) =>
            b.count - a.count
        );

    const crashAnalysis = {
      total:
        crashEvents.length,

      byOperatingSystem:
        crashesByOS,

      byAppVersion:
        crashesByVersion,

      byDevice:
        crashesByDevice,

      eventsBeforeCrash,
    };

    // --------------------------------------------------
    // RECORDED DATA COVERAGE
    // --------------------------------------------------

    /*
      Important:

      The earliest and latest recorded events tell us
      where records exist in the imported Datadog data.

      They do NOT prove that we have continuous Datadog
      coverage between those dates.

      We therefore keep data coverage separate from the
      reporting period selected by the user.
    */

    const timestamps =
      events
        .map(
          (event) =>
            event.eventTimestamp
        )
        .sort(
          (a, b) =>
            a.getTime() -
            b.getTime()
        );

    const earliestEvent =
      timestamps.length > 0
        ? timestamps[
            0
          ].toISOString()
        : null;

    const latestEvent =
      timestamps.length > 0
        ? timestamps[
            timestamps.length -
              1
          ].toISOString()
        : null;

    // --------------------------------------------------
    // DAILY RECORD COVERAGE
    // --------------------------------------------------

    /*
      Count how many imported events exist on each UTC
      calendar day.

      This allows the frontend to distinguish an old
      isolated record from a genuinely populated period.

      A missing date should NOT automatically be treated
      as confirmed data loss because there may genuinely
      have been no recorded activity on that day.
    */

    const dailyCoverageMap =
      new Map<
        string,
        number
      >();

    for (const event of events) {
      const date =
        event.eventTimestamp
          .toISOString()
          .slice(0, 10);

      dailyCoverageMap.set(
        date,
        (dailyCoverageMap.get(
          date
        ) ?? 0) + 1
      );
    }

    const dailyCoverage =
      Array.from(
        dailyCoverageMap.entries()
      )
        .map(
          ([date, eventCount]) => ({
            date,
            events:
              eventCount,
          })
        )
        .sort(
          (a, b) =>
            a.date.localeCompare(
              b.date
            )
        );

    const activeDays =
      dailyCoverage.length;

    // --------------------------------------------------
    // CALENDAR SPAN
    // --------------------------------------------------

    /*
      This is informational only.

      Example:
      earliest event = 2 Apr
      latest event   = 4 Sep

      calendarDays tells us the size of that span.

      activeDays tells us how many individual dates
      actually contain imported records.
    */

    let calendarDays = 0;

    if (
      earliestEvent &&
      latestEvent
    ) {
      const earliestDate =
        new Date(
          `${earliestEvent.slice(
            0,
            10
          )}T00:00:00.000Z`
        );

      const latestDate =
        new Date(
          `${latestEvent.slice(
            0,
            10
          )}T00:00:00.000Z`
        );

      calendarDays =
        Math.floor(
          (latestDate.getTime() -
            earliestDate.getTime()) /
            (1000 *
              60 *
              60 *
              24)
        ) + 1;
    }

    const coveragePercent =
      calendarDays > 0
        ? Number(
            (
              (activeDays /
                calendarDays) *
              100
            ).toFixed(
              1
            )
          )
        : 0;

    const dataCoverage = {
      earliestEvent,
      latestEvent,
      activeDays,
      calendarDays,
      coveragePercent,
    };

    // --------------------------------------------------
    // DAILY ACTIVITY (users + sessions per day)
    // --------------------------------------------------

    /*
      Users: unique customers per UTC day. A customer
      active on two days counts once on each day, so
      daily users will not sum to activeUsers.

      Sessions: counted once, on the day the session
      started. Events are loaded in ascending time order,
      so the first event seen for a session is its start.
      (A session that began before the selected period is
      counted on the first day it appears in range.)

      Days with no imported records return null rather
      than 0, so the chart shows a gap instead of
      implying nobody used the app.
    */

    const dailyUsersMap =
      new Map<string, Set<string>>();

    const sessionStartDay =
      new Map<string, string>();

    for (const event of events) {
      const date = event.eventTimestamp
        .toISOString()
        .slice(0, 10);

      if (event.customerPhoneNumber) {
        if (!dailyUsersMap.has(date)) {
          dailyUsersMap.set(date, new Set());
        }

        dailyUsersMap
          .get(date)!
          .add(event.customerPhoneNumber);
      }

      if (
        event.sessionId &&
        !sessionStartDay.has(event.sessionId)
      ) {
        sessionStartDay.set(event.sessionId, date);
      }
    }

    const dailySessionsMap =
      new Map<string, number>();

    for (const date of sessionStartDay.values()) {
      dailySessionsMap.set(
        date,
        (dailySessionsMap.get(date) ?? 0) + 1
      );
    }

    // Build every day in the range so missing days
    // appear as gaps. Never plot future days.

    const todayUtc = new Date()
      .toISOString()
      .slice(0, 10);

    const rangeStart =
      start ?? earliestEvent?.slice(0, 10) ?? null;

    let rangeEnd =
      end ?? latestEvent?.slice(0, 10) ?? null;

    if (rangeEnd && rangeEnd > todayUtc) {
      rangeEnd = todayUtc;
    }

    const MAX_CHART_DAYS = 731;

    const dailyActivity: {
      date: string;
      users: number | null;
      sessions: number | null;
    }[] = [];

    if (
      rangeStart &&
      rangeEnd &&
      rangeStart <= rangeEnd
    ) {
      const cursor = new Date(
        `${rangeStart}T00:00:00.000Z`
      );

      const last = new Date(
        `${rangeEnd}T00:00:00.000Z`
      );

      while (
        cursor <= last &&
        dailyActivity.length < MAX_CHART_DAYS
      ) {
        const date = cursor
          .toISOString()
          .slice(0, 10);

        const hasRecords =
          dailyCoverageMap.has(date);

        dailyActivity.push({
          date,
          users: hasRecords
            ? dailyUsersMap.get(date)?.size ?? 0
            : null,
          sessions: hasRecords
            ? dailySessionsMap.get(date) ?? 0
            : null,
        });

        cursor.setUTCDate(
          cursor.getUTCDate() + 1
        );
      }
    }

    // --------------------------------------------------
    // REPORTING PERIOD
    // --------------------------------------------------

    /*
      Reporting period describes what the user selected.

      If no filter was selected, both values remain null.
      The frontend can therefore display:

      "All available data"

      rather than incorrectly presenting the earliest
      and latest recorded events as a continuous
      reporting period.
    */

    const period = {
      start:
        start ?? null,

      end:
        end ?? null,
    };

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return NextResponse.json({
      activeUsers:
        users.size,

      sessions:
        sessions.size,

      events:
        events.length,

      appCrashes,

      featureUsage,

      // Raw event volumes
      paymentJourney,

      // True ordered session funnel
      sessionFunnel,

      funnelSummary,

      paymentChannelUsage,

      operatingSystems,

      appVersions,

      crashAnalysis,

      // User-selected reporting period
      period,

      // Actual records found in imported Datadog data
      dataCoverage,

      // Dates on which imported records exist
      dailyCoverage,

      // Users and sessions per day (null = no records)
      dailyActivity,
    });
  } catch (error) {
    console.error(
      "Failed to load BackOffice App usage summary:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load BackOffice App usage summary.",
      },
      {
        status: 500,
      }
    );
  }
}