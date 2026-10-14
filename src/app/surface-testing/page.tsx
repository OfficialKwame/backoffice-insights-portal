"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Surface = "LITE" | "LITE_PORTAL" | "APP" | "PORTAL";

type ResultStatus = "PASS" | "FAIL" | "BLOCKED" | "NOT_RUN";

type TestDefinition = {
  id: string;
  name: string;
  description: string | null;
  steps: string | null;
  expectedResult: string | null;
  sortOrder: number;
};

type TestResultEntry = {
  id: string;
  result: ResultStatus;
  note: string | null;
  issueReference: string | null;
  testDefinition: TestDefinition;
};

type TestRun = {
  id: string;
  surface: Surface;
  runDate: string;
  results: TestResultEntry[];
};

const surfaceLabels: Record<Surface, string> = {
  LITE: "BackOffice Lite App",
  LITE_PORTAL: "BackOffice Lite Portal",
  APP: "BackOffice App",
  PORTAL: "BackOffice Portal",
};

const surfaceCounts: Record<Surface, number> = {
  LITE: 21,
  LITE_PORTAL: 14,
  APP: 18,
  PORTAL: 11,
};

export default function SurfaceTestingPage() {
  const [selectedSurface, setSelectedSurface] =
    useState<Surface>("LITE");

  const [run, setRun] = useState<TestRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  async function loadTodayRun(surface: Surface) {
    setLoading(true);

    const res = await fetch(
      `/api/test-runs?surface=${surface}`,
      { cache: "no-store" }
    );

   const data = await res.json();

if (!res.ok) {
  console.error("Failed to load test run:", data);
  setRun(null);
  setLoading(false);
  return;
}

setRun(data);
setLoading(false);
  }

  useEffect(() => {
    loadTodayRun(selectedSurface);
  }, [selectedSurface]);

  async function startRun() {
    setStarting(true);

    const res = await fetch("/api/test-runs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        surface: selectedSurface,
      }),
    });

    const data = await res.json();

    setRun(data);
    setStarting(false);
  }

  async function updateResult(
    entry: TestResultEntry,
    changes: Partial<{
      result: ResultStatus;
      note: string;
      issueReference: string;
    }>
  ) {
    const res = await fetch(
      `/api/test-results/${entry.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(changes),
      }
    );

    if (!res.ok) return;

    const updated = await res.json();

    setRun((current) => {
      if (!current) return current;

      return {
        ...current,
        results: current.results.map((item) =>
          item.id === entry.id
            ? {
                ...item,
                result: updated.result,
                note: updated.note,
                issueReference: updated.issueReference,
              }
            : item
        ),
      };
    });
  }

  const counts = useMemo(() => {
    if (!run) {
      return {
        pass: 0,
        fail: 0,
        blocked: 0,
        notRun: 0,
        completed: 0,
      };
    }

    const pass = run.results.filter(
      (item) => item.result === "PASS"
    ).length;

    const fail = run.results.filter(
      (item) => item.result === "FAIL"
    ).length;

    const blocked = run.results.filter(
      (item) => item.result === "BLOCKED"
    ).length;

    const notRun = run.results.filter(
      (item) => item.result === "NOT_RUN"
    ).length;

    return {
      pass,
      fail,
      blocked,
      notRun,
      completed: pass + fail + blocked,
    };
  }, [run]);

  return (
    <main className="min-h-screen pl-64">
      <div className="mx-auto max-w-7xl px-8 py-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Surface Testing
            </p>

            <h1 className="mt-2 text-3xl font-semibold text-white">
              Daily Critical Checks
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Run today's merchant-critical checks and record
              anything that fails or is blocked.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/surface-testing/history"
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.04]"
            >
              History
            </Link>

            <Link
              href="/surface-testing/manage"
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.04]"
            >
              Manage Test Library
            </Link>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {(
            ["LITE", "LITE_PORTAL", "APP", "PORTAL"] as Surface[]
          ).map((surface) => (
            <button
              key={surface}
              type="button"
              onClick={() => setSelectedSurface(surface)}
              className={`rounded-lg px-4 py-2 text-sm transition ${
                selectedSurface === surface
                  ? "bg-white text-slate-950"
                  : "bg-white/[0.05] text-slate-400 hover:bg-white/[0.08]"
              }`}
            >
              {surfaceLabels[surface]}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <SummaryCard
            label="Completed"
            value={
              run
                ? `${counts.completed}/${run.results.length}`
                : `0/${surfaceCounts[selectedSurface]}`
            }
          />

          <SummaryCard
            label="Passed"
            value={String(counts.pass)}
          />

          <SummaryCard
            label="Failed"
            value={String(counts.fail)}
          />

          <SummaryCard
            label="Blocked"
            value={String(counts.blocked)}
          />
        </div>

        {loading ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.025] px-6 py-10 text-sm text-slate-400">
            Loading today's check...
          </div>
        ) : !run ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.025] px-6 py-10">
            <h2 className="text-lg font-semibold text-white">
              No check started today
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Start today's {surfaceLabels[selectedSurface]} critical
              check.
            </p>

            <button
              type="button"
              onClick={startRun}
              disabled={starting}
              className="mt-6 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              {starting
                ? "Starting..."
                : "Start Today's Check"}
            </button>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {run.results.map((entry) => (
              <TestCheckRow
                key={entry.id}
                entry={entry}
                onUpdate={updateResult}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>

      <div className="mt-2 text-2xl font-semibold text-white">
        {value}
      </div>
    </div>
  );
}

function TestCheckRow({
  entry,
  onUpdate,
}: {
  entry: TestResultEntry;
  onUpdate: (
    entry: TestResultEntry,
    changes: Partial<{
      result: ResultStatus;
      note: string;
      issueReference: string;
    }>
  ) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(entry.note ?? "");
  const [issueReference, setIssueReference] = useState(
    entry.issueReference ?? ""
  );

  const statusStyles: Record<ResultStatus, string> = {
    PASS: "bg-emerald-400/10 text-emerald-300",
    FAIL: "bg-red-400/10 text-red-300",
    BLOCKED: "bg-amber-400/10 text-amber-300",
    NOT_RUN: "bg-white/[0.05] text-slate-400",
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025]">
      <div className="flex items-center gap-5 px-5 py-4">
        <div className="flex-1">
          <div className="text-sm font-medium text-white">
            {entry.testDefinition.sortOrder}.{" "}
            {entry.testDefinition.name}
          </div>

          {entry.testDefinition.description && (
            <div className="mt-1 text-xs text-slate-500">
              {entry.testDefinition.description}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {(
            [
              ["PASS", "Pass"],
              ["FAIL", "Fail"],
              ["BLOCKED", "Blocked"],
            ] as [ResultStatus, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                onUpdate(entry, { result: value })
              }
              className={`rounded-lg px-3 py-2 text-xs font-medium ${
                entry.result === value
                  ? statusStyles[value]
                  : "bg-white/[0.04] text-slate-500 hover:bg-white/[0.08]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-16 text-right text-xs text-slate-400 hover:text-white"
        >
          {open ? "Close" : "Details"}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/[0.06] px-5 py-5">
          {entry.testDefinition.steps && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Steps
              </div>

              <div className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-300">
                {entry.testDefinition.steps}
              </div>
            </div>
          )}

          {entry.testDefinition.expectedResult && (
            <div className="mt-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Expected Result
              </div>

              <div className="mt-2 text-sm leading-6 text-slate-300">
                {entry.testDefinition.expectedResult}
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Notes
              </label>

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() =>
                  onUpdate(entry, { note })
                }
                className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none"
                placeholder="What did you observe?"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Issue Reference
              </label>

              <input
                value={issueReference}
                onChange={(e) =>
                  setIssueReference(e.target.value)
                }
                onBlur={() =>
                  onUpdate(entry, { issueReference })
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none"
                placeholder="Ticket / issue reference"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}