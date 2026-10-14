"use client";

import { useEffect, useMemo, useState } from "react";

type Surface = "LITE" | "LITE_PORTAL" | "APP" | "PORTAL";

type HistoryRun = {
  id: string;
  surface: Surface;
  runDate: string;
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  notRun: number;
  completed: number;
};

const surfaceLabels: Record<Surface, string> = {
  LITE: "BackOffice Lite App",
  LITE_PORTAL: "BackOffice Lite Portal",
  APP: "BackOffice App",
  PORTAL: "BackOffice Portal",
};

export default function SurfaceTestingHistoryPage() {
  const [runs, setRuns] = useState<HistoryRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [surfaceFilter, setSurfaceFilter] =
    useState<"ALL" | Surface>("ALL");

  async function loadHistory() {
    setLoading(true);

    const res = await fetch("/api/test-runs/history", {
      cache: "no-store",
    });

    const data = await res.json();

    setRuns(data);
    setLoading(false);
  }

  useEffect(() => {
    loadHistory();
  }, []);

  const filteredRuns = useMemo(() => {
    if (surfaceFilter === "ALL") return runs;

    return runs.filter(
      (run) => run.surface === surfaceFilter
    );
  }, [runs, surfaceFilter]);

  return (
    <main className="min-h-screen pl-64">
      <div className="mx-auto max-w-7xl px-8 py-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Surface Testing
          </p>

          <h1 className="mt-2 text-3xl font-semibold text-white">
            Daily Check History
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Review previous BackOffice Lite App, BackOffice Lite Portal,
            BackOffice App and BackOffice Portal daily critical checks.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {(
            [
              "ALL",
              "LITE",
              "LITE_PORTAL",
              "APP",
              "PORTAL",
            ] as const
          ).map((surface) => (
            <button
              key={surface}
              type="button"
              onClick={() => setSurfaceFilter(surface)}
              className={`rounded-lg px-4 py-2 text-sm transition ${
                surfaceFilter === surface
                  ? "bg-white text-slate-950"
                  : "bg-white/[0.05] text-slate-400 hover:bg-white/[0.08]"
              }`}
            >
              {surface === "ALL"
                ? "All"
                : surfaceLabels[surface]}
            </button>
          ))}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
          <div className="grid grid-cols-[180px_1fr_110px_110px_110px_110px] border-b border-white/10 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <div>Date</div>
            <div>Surface</div>
            <div>Completed</div>
            <div>Passed</div>
            <div>Failed</div>
            <div>Blocked</div>
          </div>

          {loading ? (
            <div className="px-5 py-8 text-sm text-slate-400">
              Loading history...
            </div>
          ) : filteredRuns.length === 0 ? (
            <div className="px-5 py-8 text-sm text-slate-400">
              No test history found.
            </div>
          ) : (
            filteredRuns.map((run) => (
              <div
                key={run.id}
                className="grid grid-cols-[180px_1fr_110px_110px_110px_110px] items-center border-b border-white/[0.06] px-5 py-4 last:border-b-0"
              >
                <div className="text-sm text-slate-300">
                  {new Date(run.runDate).toLocaleDateString(
                    "en-GB",
                    {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }
                  )}
                </div>

                <div className="text-sm font-medium text-white">
                  {surfaceLabels[run.surface]}
                </div>

                <div className="text-sm text-slate-300">
                  {run.completed}/{run.total}
                </div>

                <div className="text-sm text-emerald-300">
                  {run.passed}
                </div>

                <div className="text-sm text-red-300">
                  {run.failed}
                </div>

                <div className="text-sm text-amber-300">
                  {run.blocked}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}