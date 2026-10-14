"use client";

import { FormEvent, useEffect, useState } from "react";

type Activity = {
  id: string;
  activityDate: string;
  category: string;
  action: string;
  description: string | null;
  createdAt: string;
};

const categories = [
  "Surface Testing",
  "Collections Performance",
  "Design Drift",
  "Issue Follow-up",
  "Fix Verification",
  "Deploy Check",
  "Other",
];

export default function ActivityLogPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [category, setCategory] = useState(categories[0]);
  const [action, setAction] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadActivities() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/activity-log", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load activities.");
      }

      const data = await response.json();
      setActivities(data);
    } catch (err) {
      console.error(err);
      setError("Couldn't load activities.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivities();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!action.trim()) {
      setError("Enter the activity you completed.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch("/api/activity-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category,
          action: action.trim(),
          description: description.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);

        throw new Error(
          data?.error || "Failed to save activity."
        );
      }

      setAction("");
      setDescription("");

      await loadActivities();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't save activity."
      );
    } finally {
      setSaving(false);
    }
  }

  function isToday(dateValue: string) {
    const date = new Date(dateValue);
    const today = new Date();

    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }

  const todaysActivities = activities.filter((activity) =>
    isToday(activity.activityDate)
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Workspace
        </div>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
          Activity Log
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Record work that is not automatically captured by the portal
          workflows.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Log activity */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
          <div>
            <h2 className="text-base font-semibold text-white">
              Log Activity
            </h2>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Add important work that would otherwise be missed from
              reporting.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-6 space-y-5"
          >
            <div>
              <label
                htmlFor="category"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Category
              </label>

              <select
                id="category"
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value)
                }
                className="w-full rounded-xl border border-white/[0.08] bg-[#0d1728] px-3 py-3 text-sm text-white outline-none transition focus:border-slate-500"
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="action"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Activity
              </label>

              <input
                id="action"
                type="text"
                value={action}
                onChange={(event) =>
                  setAction(event.target.value)
                }
                placeholder="e.g. Verified card payment fix"
                className="w-full rounded-xl border border-white/[0.08] bg-[#0d1728] px-3 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-slate-500"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-slate-300"
                >
                  Details
                </label>

                <span className="text-xs text-slate-600">
                  Optional
                </span>
              </div>

              <textarea
                id="description"
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                rows={5}
                placeholder="Add any useful context..."
                className="w-full resize-none rounded-xl border border-white/[0.08] bg-[#0d1728] px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-slate-500"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Activity"}
            </button>
          </form>
        </div>

        {/* Today's activity */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-white">
                Today
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {todaysActivities.length} manually logged{" "}
                {todaysActivities.length === 1
                  ? "activity"
                  : "activities"}
              </p>
            </div>

            <div className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-medium text-slate-400">
              Manual
            </div>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-6">
                <p className="text-sm text-slate-500">
                  Loading activities...
                </p>
              </div>
            ) : todaysActivities.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/[0.1] bg-white/[0.015] px-5 py-12 text-center">
                <p className="text-sm font-medium text-slate-300">
                  No manual activities logged today
                </p>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
                  Activities captured automatically by other workflows
                  do not need to be entered here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {todaysActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className="rounded-xl border border-white/[0.07] bg-[#0d1728] p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-slate-300">
                        {activity.category}
                      </span>

                      <span className="text-xs text-slate-600">
                        {new Date(
                          activity.activityDate
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <p className="mt-3 text-sm font-semibold text-white">
                      {activity.action}
                    </p>

                    {activity.description && (
                      <p className="mt-1.5 text-sm leading-6 text-slate-400">
                        {activity.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}