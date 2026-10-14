"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Surface = "LITE" | "APP";

type DriftStatus =
  | "NEW"
  | "RAISED"
  | "IN_PROGRESS"
  | "FIXED"
  | "ACCEPTED";

type DriftSeverity = "LOW" | "MEDIUM" | "HIGH";

type DriftItem = {
  id: string;
  area: string;
  title: string;
  approvedReference: string | null;
  liveObservation: string;
  approvedScreenshot: string | null;
  liveScreenshot: string | null;
  severity: DriftSeverity;
  status: DriftStatus;
  designReference: string | null;
  raisedTo: string | null;
  dateRaised: string | null;
  fixNotes: string | null;
  dateFixed: string | null;
};

type Review = {
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

const statusLabels: Record<DriftStatus, string> = {
  NEW: "New",
  RAISED: "Raised",
  IN_PROGRESS: "In Progress",
  FIXED: "Fixed",
  ACCEPTED: "Accepted",
};

const severityLabels: Record<DriftSeverity, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export default function DesignDriftReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(
    null
  );
  const [error, setError] = useState("");

  const [area, setArea] = useState("");
  const [title, setTitle] = useState("");
  const [approvedReference, setApprovedReference] =
    useState("");
  const [liveObservation, setLiveObservation] =
    useState("");
  const [approvedScreenshot, setApprovedScreenshot] =
    useState("");
  const [liveScreenshot, setLiveScreenshot] =
    useState("");
  const [severity, setSeverity] =
    useState<DriftSeverity>("MEDIUM");
  const [designReference, setDesignReference] =
    useState("");

  async function loadReview(showLoading = true) {
    if (showLoading) {
      setLoading(true);
    }

    try {
      const res = await fetch(
        "/api/design-drift/reviews",
        {
          cache: "no-store",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError("Failed to load review.");
        return;
      }

      const found = data.find(
        (item: Review) => item.id === params.id
      );

      if (!found) {
        setError("Review not found.");
        return;
      }

      setReview(found);
    } catch (error) {
      console.error(error);
      setError("Failed to load review.");
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadReview();
  }, [params.id]);

  async function createDrift(e: FormEvent) {
    e.preventDefault();

    if (!area.trim()) {
      setError("Enter the area or flow.");
      return;
    }

    if (!title.trim()) {
      setError("Enter a short drift title.");
      return;
    }

    if (!liveObservation.trim()) {
      setError("Describe what is live.");
      return;
    }

    setError("");
    setSaving(true);

    try {
      const res = await fetch(
        "/api/design-drift/items",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reviewId: params.id,
            area,
            title,
            approvedReference,
            liveObservation,
            approvedScreenshot,
            liveScreenshot,
            severity,
            designReference,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(
          data.error || "Failed to log drift."
        );
        return;
      }

      setArea("");
      setTitle("");
      setApprovedReference("");
      setLiveObservation("");
      setApprovedScreenshot("");
      setLiveScreenshot("");
      setSeverity("MEDIUM");
      setDesignReference("");

      await loadReview(false);
    } catch (error) {
      console.error(error);
      setError("Failed to log drift.");
    } finally {
      setSaving(false);
    }
  }

  async function updateDrift(
    itemId: string,
    data: Record<string, unknown>
  ) {
    setUpdatingId(itemId);
    setError("");

    try {
      const res = await fetch(
        `/api/design-drift/items/${itemId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        }
      );

      const response = await res.json();

      if (!res.ok) {
        setError(
          response.error ||
            "Failed to update drift item."
        );
        return false;
      }

      await loadReview(false);

      return true;
    } catch (error) {
      console.error(error);
      setError("Failed to update drift item.");
      return false;
    } finally {
      setUpdatingId(null);
    }
  }

  async function changeStatus(
    item: DriftItem,
    status: DriftStatus
  ) {
    const update: Record<string, unknown> = {
      status,
    };

    if (status === "RAISED" && !item.dateRaised) {
      update.dateRaised = new Date()
        .toISOString()
        .slice(0, 10);
    }

    if (
      (status === "FIXED" ||
        status === "ACCEPTED") &&
      !item.dateFixed
    ) {
      update.dateFixed = new Date()
        .toISOString()
        .slice(0, 10);
    }

    await updateDrift(item.id, update);
  }

  const openCount =
    review?.items.filter(
      (item) =>
        item.status !== "FIXED" &&
        item.status !== "ACCEPTED"
    ).length ?? 0;

  const resolvedCount =
    review?.items.filter(
      (item) =>
        item.status === "FIXED" ||
        item.status === "ACCEPTED"
    ).length ?? 0;

  if (loading) {
    return (
      <main className="min-h-screen pl-64">
        <div className="px-8 py-8 text-sm text-slate-400">
          Loading review...
        </div>
      </main>
    );
  }

  if (!review) {
    return (
      <main className="min-h-screen pl-64">
        <div className="px-8 py-8">
          <button
            type="button"
            onClick={() =>
              router.push("/design-drift")
            }
            className="text-sm text-slate-400 hover:text-white"
          >
            ← Back to Design Drift
          </button>

          <div className="mt-6 text-sm text-red-300">
            {error || "Review not found."}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pl-64">
      <div className="mx-auto max-w-7xl px-8 py-8">
        <button
          type="button"
          onClick={() =>
            router.push("/design-drift")
          }
          className="text-sm text-slate-400 hover:text-white"
        >
          ← Back to Design Drift
        </button>

        <div className="mt-6 flex items-start justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Design Drift Review
            </p>

            <h1 className="mt-2 text-3xl font-semibold text-white">
              {surfaceLabels[review.surface]}
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              {new Date(
                review.reviewDate
              ).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
              {" · "}
              {review.areasReviewed} areas reviewed
            </p>

            {review.notes && (
              <p className="mt-2 text-sm text-slate-500">
                {review.notes}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <MetricCard
              label="Drift Found"
              value={review.items.length}
            />

            <MetricCard
              label="Open"
              value={openCount}
            />

            <MetricCard
              label="Resolved"
              value={resolvedCount}
            />
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-400/10 bg-red-400/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mt-8 grid grid-cols-[380px_1fr] gap-6">
          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <h2 className="text-base font-semibold text-white">
              Log Drift
            </h2>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Capture what was approved, what is live
              and the evidence.
            </p>

            <form
              onSubmit={createDrift}
              className="mt-6 space-y-5"
            >
              <Field
                label="Area / Flow"
                value={area}
                onChange={setArea}
                placeholder="e.g. Take Payment"
              />

              <Field
                label="Drift Title"
                value={title}
                onChange={setTitle}
                placeholder="Short description"
              />

              <TextArea
                label="Approved Reference"
                value={approvedReference}
                onChange={setApprovedReference}
                placeholder="What the approved design shows"
              />

              <TextArea
                label="Live Observation"
                value={liveObservation}
                onChange={setLiveObservation}
                placeholder="What is currently live"
              />

              <Field
                label="Approved Screenshot"
                value={approvedScreenshot}
                onChange={setApprovedScreenshot}
                placeholder="Image path or reference"
              />

              <Field
                label="Live Screenshot"
                value={liveScreenshot}
                onChange={setLiveScreenshot}
                placeholder="Image path or reference"
              />

              <div>
                <label className="text-xs font-medium text-slate-400">
                  Severity
                </label>

                <select
                  value={severity}
                  onChange={(e) =>
                    setSeverity(
                      e.target
                        .value as DriftSeverity
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none"
                >
                  <option value="LOW">
                    Low
                  </option>

                  <option value="MEDIUM">
                    Medium
                  </option>

                  <option value="HIGH">
                    High
                  </option>
                </select>
              </div>

              <Field
                label="Design Reference"
                value={designReference}
                onChange={setDesignReference}
                placeholder="Optional Figma/design reference"
              />

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : "Log Drift"}
              </button>
            </form>
          </section>

          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-base font-semibold text-white">
                Drift Items
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Raise identified differences to
                Design and track them through
                resolution.
              </p>
            </div>

            {review.items.length === 0 ? (
              <div className="px-5 py-10 text-sm text-slate-400">
                No drift found in this review.
              </div>
            ) : (
              <div>
                {review.items.map((item) => (
                  <DriftItemCard
                    key={item.id}
                    item={item}
                    updating={
                      updatingId === item.id
                    }
                    onUpdate={updateDrift}
                    onChangeStatus={
                      changeStatus
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function DriftItemCard({
  item,
  updating,
  onUpdate,
  onChangeStatus,
}: {
  item: DriftItem;
  updating: boolean;
  onUpdate: (
    itemId: string,
    data: Record<string, unknown>
  ) => Promise<boolean>;
  onChangeStatus: (
    item: DriftItem,
    status: DriftStatus
  ) => Promise<void>;
}) {
  const [raisedTo, setRaisedTo] = useState(
    item.raisedTo || ""
  );
  const [dateRaised, setDateRaised] = useState(
    toDateInput(item.dateRaised)
  );
  const [fixNotes, setFixNotes] = useState(
    item.fixNotes || ""
  );
  const [dateFixed, setDateFixed] = useState(
    toDateInput(item.dateFixed)
  );

  useEffect(() => {
    setRaisedTo(item.raisedTo || "");
    setDateRaised(
      toDateInput(item.dateRaised)
    );
    setFixNotes(item.fixNotes || "");
    setDateFixed(
      toDateInput(item.dateFixed)
    );
  }, [
    item.raisedTo,
    item.dateRaised,
    item.fixNotes,
    item.dateFixed,
  ]);

  async function saveTrackingDetails() {
    await onUpdate(item.id, {
      raisedTo,
      dateRaised: dateRaised || null,
      fixNotes,
      dateFixed: dateFixed || null,
    });
  }

  return (
    <div className="border-b border-white/[0.06] px-5 py-5 last:border-b-0">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            {item.area}
          </div>

          <div className="mt-1 text-base font-medium text-white">
            {item.title}
          </div>
        </div>

        <div className="flex gap-2">
          <SeverityBadge
            severity={item.severity}
          />

          <StatusBadge status={item.status} />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-5">
        <div className="rounded-xl bg-white/[0.025] p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Approved
          </div>

          <div className="mt-2 text-sm leading-6 text-slate-300">
            {item.approvedReference ||
              "No approved reference added."}
          </div>
        </div>

        <div className="rounded-xl bg-white/[0.025] p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Live
          </div>

          <div className="mt-2 text-sm leading-6 text-slate-300">
            {item.liveObservation}
          </div>
        </div>
      </div>

      {(item.approvedScreenshot ||
        item.liveScreenshot ||
        item.designReference) && (
        <div className="mt-4 grid grid-cols-3 gap-4 text-xs">
          <ReferenceValue
            label="Approved Screenshot"
            value={item.approvedScreenshot}
          />

          <ReferenceValue
            label="Live Screenshot"
            value={item.liveScreenshot}
          />

          <ReferenceValue
            label="Design Reference"
            value={item.designReference}
          />
        </div>
      )}

      <div className="mt-5 border-t border-white/[0.06] pt-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Tracking
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <Field
            label="Raised To"
            value={raisedTo}
            onChange={setRaisedTo}
            placeholder="e.g. Design Team"
          />

          <DateField
            label="Date Raised"
            value={dateRaised}
            onChange={setDateRaised}
          />

          <TextArea
            label="Fix Notes"
            value={fixNotes}
            onChange={setFixNotes}
            placeholder="What was changed or agreed"
          />

          <DateField
            label="Date Fixed"
            value={dateFixed}
            onChange={setDateFixed}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={updating}
            onClick={saveTrackingDetails}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
          >
            Save Details
          </button>

          {item.status === "NEW" && (
            <button
              type="button"
              disabled={updating}
              onClick={() =>
                onChangeStatus(
                  item,
                  "RAISED"
                )
              }
              className="rounded-lg bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-400/20 disabled:opacity-40"
            >
              Raise to Design
            </button>
          )}

          {item.status === "RAISED" && (
            <button
              type="button"
              disabled={updating}
              onClick={() =>
                onChangeStatus(
                  item,
                  "IN_PROGRESS"
                )
              }
              className="rounded-lg bg-blue-400/10 px-3 py-2 text-xs font-medium text-blue-300 hover:bg-blue-400/20 disabled:opacity-40"
            >
              Mark In Progress
            </button>
          )}

          {(item.status === "RAISED" ||
            item.status ===
              "IN_PROGRESS") && (
            <>
              <button
                type="button"
                disabled={updating}
                onClick={() =>
                  onChangeStatus(
                    item,
                    "FIXED"
                  )
                }
                className="rounded-lg bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-40"
              >
                Mark Fixed
              </button>

              <button
                type="button"
                disabled={updating}
                onClick={() =>
                  onChangeStatus(
                    item,
                    "ACCEPTED"
                  )
                }
                className="rounded-lg bg-white/[0.06] px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/[0.1] hover:text-white disabled:opacity-40"
              >
                Accept Drift
              </button>
            </>
          )}

          {(item.status === "FIXED" ||
            item.status === "ACCEPTED") && (
            <button
              type="button"
              disabled={updating}
              onClick={() =>
                onChangeStatus(
                  item,
                  "IN_PROGRESS"
                )
              }
              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-400 hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
            >
              Reopen
            </button>
          )}

          {updating && (
            <span className="ml-2 text-xs text-slate-500">
              Saving...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="min-w-[110px] rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3">
      <div className="text-xs text-slate-500">
        {label}
      </div>

      <div className="mt-1 text-2xl font-semibold text-white">
        {value}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-400">
        {label}
      </label>

      <input
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none"
      />
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-400">
        {label}
      </label>

      <input
        type="date"
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none"
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-400">
        {label}
      </label>

      <textarea
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
        rows={3}
        className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none"
      />
    </div>
  );
}

function ReferenceValue({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (!value) {
    return null;
  }

  return (
    <div>
      <div className="text-slate-500">
        {label}
      </div>

      <div className="mt-1 break-all text-slate-300">
        {value}
      </div>
    </div>
  );
}

function SeverityBadge({
  severity,
}: {
  severity: DriftSeverity;
}) {
  const classes: Record<
    DriftSeverity,
    string
  > = {
    LOW: "bg-slate-400/10 text-slate-300",
    MEDIUM:
      "bg-amber-400/10 text-amber-300",
    HIGH: "bg-red-400/10 text-red-300",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${classes[severity]}`}
    >
      {severityLabels[severity]}
    </span>
  );
}

function StatusBadge({
  status,
}: {
  status: DriftStatus;
}) {
  const classes: Record<
    DriftStatus,
    string
  > = {
    NEW: "bg-white/[0.06] text-slate-300",
    RAISED:
      "bg-amber-400/10 text-amber-300",
    IN_PROGRESS:
      "bg-blue-400/10 text-blue-300",
    FIXED:
      "bg-emerald-400/10 text-emerald-300",
    ACCEPTED:
      "bg-purple-400/10 text-purple-300",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${classes[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function toDateInput(
  value: string | null
) {
  if (!value) {
    return "";
  }

  return new Date(value)
    .toISOString()
    .slice(0, 10);
}