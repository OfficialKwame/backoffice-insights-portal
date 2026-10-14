"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Surface = "LITE" | "APP";

type DriftItem = {
  id: string;
  status:
    | "NEW"
    | "RAISED"
    | "IN_PROGRESS"
    | "FIXED"
    | "ACCEPTED";
};

type DesignDriftReview = {
  id: string;
  surface: Surface;
  reviewDate: string;
  areasReviewed: number;
  notes: string | null;
  items: DriftItem[];
};

const surfaceLabels: Record<Surface, string> = {
  LITE: "BackOffice Lite App",
  APP: "BackOffice App",
};

export default function DesignDriftPage() {
  const router = useRouter();

  const [reviews, setReviews] = useState<DesignDriftReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [surface, setSurface] = useState<Surface>("LITE");
  const [reviewDate, setReviewDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [areasReviewed, setAreasReviewed] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  async function loadReviews() {
    setLoading(true);

    try {
      const res = await fetch("/api/design-drift/reviews", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        console.error(
          "Failed to load design drift reviews:",
          data
        );

        setReviews([]);
        return;
      }

      setReviews(data);
    } catch (error) {
      console.error(
        "Failed to load design drift reviews:",
        error
      );

      setReviews([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReviews();
  }, []);

  async function createReview(e: FormEvent) {
    e.preventDefault();

    if (!reviewDate) {
      setError("Choose a review date.");
      return;
    }

    setError("");
    setSaving(true);

    try {
      const res = await fetch(
        "/api/design-drift/reviews",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            surface,
            reviewDate,
            areasReviewed:
              Number(areasReviewed) || 0,
            notes,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(
          data.error ||
            "Failed to create review."
        );

        return;
      }

      setAreasReviewed("");
      setNotes("");

      await loadReviews();
    } catch (error) {
      console.error(error);
      setError("Failed to create review.");
    } finally {
      setSaving(false);
    }
  }

  const summary = useMemo(() => {
    const totalReviews = reviews.length;

    const totalAreasReviewed = reviews.reduce(
      (sum, review) =>
        sum + review.areasReviewed,
      0
    );

    const allItems = reviews.flatMap(
      (review) => review.items
    );

    const driftFound = allItems.length;

    const open = allItems.filter(
      (item) =>
        item.status !== "FIXED" &&
        item.status !== "ACCEPTED"
    ).length;

    const resolved = allItems.filter(
      (item) =>
        item.status === "FIXED" ||
        item.status === "ACCEPTED"
    ).length;

    return {
      totalReviews,
      totalAreasReviewed,
      driftFound,
      open,
      resolved,
    };
  }, [reviews]);

  return (
    <main className="min-h-screen pl-64">
      <div className="mx-auto max-w-7xl px-8 py-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Product Quality
          </p>

          <h1 className="mt-2 text-3xl font-semibold text-white">
            Design Drift
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Compare what is live against approved
            designs, log drift, raise issues to
            Design and track them through
            resolution.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-5 gap-4">
          <SummaryCard
            label="Reviews"
            value={summary.totalReviews}
          />

          <SummaryCard
            label="Areas Reviewed"
            value={summary.totalAreasReviewed}
          />

          <SummaryCard
            label="Drift Found"
            value={summary.driftFound}
          />

          <SummaryCard
            label="Open"
            value={summary.open}
          />

          <SummaryCard
            label="Resolved"
            value={summary.resolved}
          />
        </div>

        <div className="mt-8 grid grid-cols-[360px_1fr] gap-6">
          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <h2 className="text-base font-semibold text-white">
              Start Review
            </h2>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Record that an approved-vs-live
              comparison was completed.
            </p>

            <form
              onSubmit={createReview}
              className="mt-6 space-y-5"
            >
              <div>
                <label className="text-xs font-medium text-slate-400">
                  App
                </label>

                <select
                  value={surface}
                  onChange={(e) =>
                    setSurface(
                      e.target.value as Surface
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none"
                >
                  <option value="LITE">
                    BackOffice Lite App
                  </option>

                  <option value="APP">
                    BackOffice App
                  </option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400">
                  Review Date
                </label>

                <input
                  type="date"
                  value={reviewDate}
                  onChange={(e) =>
                    setReviewDate(
                      e.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400">
                  Areas Reviewed
                </label>

                <input
                  type="number"
                  min="0"
                  value={areasReviewed}
                  onChange={(e) =>
                    setAreasReviewed(
                      e.target.value
                    )
                  }
                  placeholder="e.g. 12"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400">
                  Notes
                </label>

                <textarea
                  value={notes}
                  onChange={(e) =>
                    setNotes(e.target.value)
                  }
                  rows={4}
                  placeholder="Optional review note"
                  className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-400/10 px-3 py-2 text-xs text-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : "Create Review"}
              </button>
            </form>
          </section>

          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-base font-semibold text-white">
                Review History
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Approved design comparisons
                recorded across both apps.
              </p>
            </div>

            {loading ? (
              <div className="px-5 py-8 text-sm text-slate-400">
                Loading reviews...
              </div>
            ) : reviews.length === 0 ? (
              <div className="px-5 py-10 text-sm text-slate-400">
                No design reviews recorded yet.
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-[150px_1fr_130px_120px_100px] border-b border-white/[0.06] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <div>Date</div>
                  <div>App</div>
                  <div>Areas</div>
                  <div>Drift</div>
                  <div>Open</div>
                </div>

                {reviews.map((review) => {
                  const openItems =
                    review.items.filter(
                      (item) =>
                        item.status !==
                          "FIXED" &&
                        item.status !==
                          "ACCEPTED"
                    ).length;

                  return (
                    <button
                      key={review.id}
                      type="button"
                      onClick={() =>
                        router.push(
                          `/design-drift/${review.id}`
                        )
                      }
                      className="grid w-full grid-cols-[150px_1fr_130px_120px_100px] items-center border-b border-white/[0.06] px-5 py-4 text-left transition last:border-b-0 hover:bg-white/[0.025]"
                    >
                      <div className="text-sm text-slate-400">
                        {new Date(
                          review.reviewDate
                        ).toLocaleDateString(
                          "en-GB",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </div>

                      <div>
                        <div className="text-sm font-medium text-white">
                          {
                            surfaceLabels[
                              review.surface
                            ]
                          }
                        </div>

                        {review.notes && (
                          <div className="mt-1 max-w-md truncate text-xs text-slate-500">
                            {review.notes}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="text-sm font-medium text-white">
                          {review.areasReviewed}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-medium text-white">
                          {review.items.length}
                        </div>
                      </div>

                      <div>
                        <div
                          className={`text-sm font-medium ${
                            openItems > 0
                              ? "text-amber-300"
                              : "text-emerald-300"
                          }`}
                        >
                          {openItems}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-4">
      <div className="text-xs font-medium text-slate-500">
        {label}
      </div>

      <div className="mt-2 text-2xl font-semibold text-white">
        {value}
      </div>
    </div>
  );
}