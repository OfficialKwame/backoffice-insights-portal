"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { PlaceholderCard } from "@/components/PlaceholderCard";

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

type AttentionItem = {
  id: string;
  result: "FAIL" | "BLOCKED";
  note: string | null;
  issueReference: string | null;
  surface: Surface;
  testName: string;
};

const surfaceLabels: Record<Surface, string> = {
  LITE: "BackOffice Lite App",
  LITE_PORTAL: "BackOffice Lite Portal",
  APP: "BackOffice App",
  PORTAL: "BackOffice Portal",
};

const expectedCounts: Record<Surface, number> = {
  LITE: 21,
  LITE_PORTAL: 14,
  APP: 18,
  PORTAL: 11,
};

function getStatus(run?: HistoryRun) {
  if (!run || run.completed === 0) {
    return {
      label: "Not Started",
      className: "text-slate-500",
    };
  }

  if (run.completed === run.total) {
    if (run.failed > 0) {
      return {
        label: "Complete · Failed",
        className: "text-red-300",
      };
    }

    if (run.blocked > 0) {
      return {
        label: "Complete · Blocked",
        className: "text-amber-300",
      };
    }

    return {
      label: "Complete",
      className: "text-emerald-300",
    };
  }

  return {
    label: "In Progress",
    className: "text-amber-300",
  };
}

export default function TodayPage() {
  const [runs, setRuns] = useState<HistoryRun[]>([]);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadToday() {
      setLoading(true);

      try {
        const historyRes = await fetch("/api/test-runs/history", {
          cache: "no-store",
        });

        const historyData = await historyRes.json();

        const today = new Date().toDateString();

        const todayRuns = historyData.filter(
          (run: HistoryRun) =>
            new Date(run.runDate).toDateString() === today
        );

        setRuns(todayRuns);

        const attentionRes = await fetch("/api/test-runs/attention", {
          cache: "no-store",
        });

        const attentionData = await attentionRes.json();

        setAttentionItems(attentionData);
      } catch (error) {
        console.error("Unable to load Today data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadToday();
  }, []);

  const latestBySurface = useMemo(() => {
    const map: Partial<Record<Surface, HistoryRun>> = {};

    for (const run of runs) {
      if (!map[run.surface]) {
        map[run.surface] = run;
      }
    }

    return map;
  }, [runs]);

  return (
    <PageShell
      title="Today"
      description="Your daily working screen: surface-check progress, collections snapshot and anything that needs attention."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Surface Checks */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
          <div className="text-sm font-medium text-white">
            Surface Checks
          </div>

          <div className="mt-4 space-y-4">
            {(
              ["LITE", "LITE_PORTAL", "APP", "PORTAL"] as Surface[]
            ).map((surface) => {
              const run = latestBySurface[surface];
              const status = getStatus(run);

              return (
                <div
                  key={surface}
                  className="flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="text-sm text-slate-300">
                      {surfaceLabels[surface]}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      {loading
                        ? "Loading..."
                        : run
                        ? `${run.completed}/${run.total} completed`
                        : `0/${expectedCounts[surface]} completed`}
                    </div>
                  </div>

                  <div
                    className={`text-xs font-medium ${status.className}`}
                  >
                    {loading ? "—" : status.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Collections Snapshot */}
        <PlaceholderCard
          title="Collections Snapshot"
          body="Phase 3/4 will add success rate, collected value, attempts and channel movement."
        />

        {/* Needs Attention */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-white">
              Needs Attention
            </div>

            {attentionItems.length > 0 && (
              <a
                href="/surface-testing"
                className="text-xs text-slate-400 hover:text-white"
              >
                View all →
              </a>
            )}
          </div>

          {loading ? (
            <div className="mt-4 text-sm text-slate-500">
              Loading...
            </div>
          ) : attentionItems.length === 0 ? (
            <div className="mt-4 text-sm text-emerald-300">
              Nothing needs attention.
            </div>
          ) : (
            <>
              <div className="mt-5 flex gap-6">
                <div>
                  <div className="text-2xl font-semibold text-red-300">
                    {
                      attentionItems.filter(
                        (item) => item.result === "FAIL"
                      ).length
                    }
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    Failed
                  </div>
                </div>

                <div>
                  <div className="text-2xl font-semibold text-amber-300">
                    {
                      attentionItems.filter(
                        (item) => item.result === "BLOCKED"
                      ).length
                    }
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    Blocked
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {attentionItems.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-500">
                          {surfaceLabels[item.surface]}
                        </div>

                        <div className="mt-1 text-sm font-medium text-white">
                          {item.testName}
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          item.result === "FAIL"
                            ? "bg-red-400/10 text-red-300"
                            : "bg-amber-400/10 text-amber-300"
                        }`}
                      >
                        {item.result === "FAIL"
                          ? "Failed"
                          : "Blocked"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {attentionItems.length > 3 && (
                <div className="mt-4 text-xs text-slate-500">
                  + {attentionItems.length - 3} more issues
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PageShell>
  );
}