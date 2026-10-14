"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";

type WeeklyNote = {
  NUMBER: string;
  DONE: string;
  LEARNED: string;
  STUCK: string;
  NEED: string;
  NEXT: string;
};

const outputs = [
  {
    title: "Biweekly 1:1 Prep",
    cadence: "Every 2 weeks",
    description:
      "A focused preparation view using product quality, design drift and collections performance.",
    structure: [
      "Current picture",
      "One deep topic",
      "Key trade-off or decision",
      "Support needed",
      "Next commitment",
    ],
  },
  {
    title: "Monthly Read",
    cadence: "Monthly",
    description:
      "A higher-level summary of product quality, drift, collections performance and recurring patterns.",
    structure: [
      "Overall direction",
      "What improved",
      "What deteriorated",
      "Recurring issues",
      "Merchant signals",
      "Priorities for next month",
    ],
  },
];

export default function OutputsPage() {
  /*
   * -------------------------------------------------------
   * DAILY LINE
   * -------------------------------------------------------
   */

  const [dailyLine, setDailyLine] = useState("");
  const [generatingDaily, setGeneratingDaily] =
    useState(false);
  const [dailyError, setDailyError] = useState("");
  const [dailyCopied, setDailyCopied] =
    useState(false);

  /*
   * -------------------------------------------------------
   * WEEKLY NOTE
   * -------------------------------------------------------
   */

  const [weeklyNote, setWeeklyNote] =
    useState<WeeklyNote | null>(null);

  const [weeklyNoteText, setWeeklyNoteText] =
    useState("");

  const [generatingWeekly, setGeneratingWeekly] =
    useState(false);

  const [weeklyError, setWeeklyError] =
    useState("");

  const [weeklyCopied, setWeeklyCopied] =
    useState(false);

  /*
   * -------------------------------------------------------
   * DAILY LINE ACTIONS
   * -------------------------------------------------------
   */

  async function generateDailyLine() {
    setGeneratingDaily(true);
    setDailyError("");
    setDailyCopied(false);

    try {
      const res = await fetch(
        "/api/outputs/daily",
        {
          cache: "no-store",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setDailyError(
          data.error ||
            "Failed to generate Daily Line."
        );
        return;
      }

      setDailyLine(data.dailyLine || "");
    } catch (error) {
      console.error(error);

      setDailyError(
        "Failed to generate Daily Line."
      );
    } finally {
      setGeneratingDaily(false);
    }
  }

  useEffect(() => {
  generateDailyLine();
}, []);

  async function copyDailyLine() {
    if (!dailyLine) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        dailyLine
      );

      setDailyCopied(true);

      setTimeout(() => {
        setDailyCopied(false);
      }, 2000);
    } catch (error) {
      console.error(
        "Failed to copy Daily Line:",
        error
      );
    }
  }

  /*
   * -------------------------------------------------------
   * WEEKLY NOTE ACTIONS
   * -------------------------------------------------------
   */

  async function generateWeeklyNote() {
    setGeneratingWeekly(true);
    setWeeklyError("");
    setWeeklyCopied(false);

    try {
      const res = await fetch(
        "/api/outputs/weekly",
        {
          cache: "no-store",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setWeeklyError(
          data.error ||
            "Failed to generate weekly note."
        );
        return;
      }

      setWeeklyNote(data.weeklyNote);
      setWeeklyNoteText(
        data.weeklyNoteText || ""
      );
    } catch (error) {
      console.error(error);

      setWeeklyError(
        "Failed to generate weekly note."
      );
    } finally {
      setGeneratingWeekly(false);
    }
  }

  async function copyWeeklyNote() {
    if (!weeklyNoteText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        weeklyNoteText
      );

      setWeeklyCopied(true);

      setTimeout(() => {
        setWeeklyCopied(false);
      }, 2000);
    } catch (error) {
      console.error(
        "Failed to copy weekly note:",
        error
      );
    }
  }

  return (
    <PageShell
      title="Outputs"
      description="Prepare recurring updates from Surface Testing, Design Drift, Collections Performance and activities already recorded in the portal."
    >
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          <SourceCard
            title="Surface Testing"
            body="Product quality, failed checks, blocked checks and live issues."
          />

          <SourceCard
            title="Design Drift"
            body="Areas reviewed, drift found, open items, resolved items and items raised to Design."
          />

          <SourceCard
            title="Collections Performance"
            body="Collections activity, imported data and performance evidence used in reporting."
          />
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">
              Reporting Outputs
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Each output is prepared from work already
              captured in the portal.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <DailyOutputCard
              dailyLine={dailyLine}
              generating={generatingDaily}
              error={dailyError}
              copied={dailyCopied}
              onGenerate={generateDailyLine}
              onCopy={copyDailyLine}
            />

            <WeeklyOutputCard
              note={weeklyNote}
              generating={generatingWeekly}
              error={weeklyError}
              copied={weeklyCopied}
              onGenerate={generateWeeklyNote}
              onCopy={copyWeeklyNote}
            />

            {outputs.map((output) => (
              <OutputCard
                key={output.title}
                title={output.title}
                cadence={output.cadence}
                description={
                  output.description
                }
                structure={output.structure}
              />
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}

/*
 * -------------------------------------------------------
 * DAILY LINE CARD
 * -------------------------------------------------------
 */

function DailyOutputCard({
  dailyLine,
  generating,
  error,
  copied,
  onGenerate,
  onCopy,
}: {
  dailyLine: string;
  generating: boolean;
  error: string;
  copied: boolean;
  onGenerate: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">
            Daily Line
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            A factual update of work completed,
            checks performed, issues raised and
            follow-ups recorded today.
          </p>
        </div>

        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-medium text-slate-300">
          Daily
        </span>
      </div>

      {!dailyLine ? (
        <div className="mt-5">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Sources
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {[
              "Surface Testing",
              "Design Drift",
              "Collections",
              "Activity Log",
            ].map((item) => (
              <span
                key={item}
                className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-xs text-slate-300"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-white/[0.08] bg-slate-950/60 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Today&apos;s Update
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-200">
            {dailyLine}
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-red-400/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          disabled={generating}
          onClick={onGenerate}
          className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {generating
            ? "Generating..."
            : dailyLine
            ? "Refresh Daily Line"
            : "Generate Daily Line"}
        </button>

        {dailyLine && (
          <button
            type="button"
            onClick={onCopy}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white"
          >
            {copied
              ? "Copied"
              : "Copy Update"}
          </button>
        )}
      </div>
    </div>
  );
}

/*
 * -------------------------------------------------------
 * WEEKLY NOTE CARD
 * -------------------------------------------------------
 */

function WeeklyOutputCard({
  note,
  generating,
  error,
  copied,
  onGenerate,
  onCopy,
}: {
  note: WeeklyNote | null;
  generating: boolean;
  error: string;
  copied: boolean;
  onGenerate: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">
            Weekly Note
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            A concise management update prepared from
            Surface Testing, Design Drift and
            Collections Performance for the current
            reporting week.
          </p>
        </div>

        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-medium text-slate-300">
          Weekly
        </span>
      </div>

      {!note ? (
        <div className="mt-5">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Structure
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {[
              "NUMBER",
              "DONE",
              "LEARNED",
              "STUCK",
              "NEED",
              "NEXT",
            ].map((item) => (
              <span
                key={item}
                className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-xs text-slate-300"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-white/[0.08] bg-slate-950/60">
          <WeeklyLine
            label="NUMBER"
            value={note.NUMBER}
          />

          <WeeklyLine
            label="DONE"
            value={note.DONE}
          />

          <WeeklyLine
            label="LEARNED"
            value={note.LEARNED}
          />

          <WeeklyLine
            label="STUCK"
            value={note.STUCK}
          />

          <WeeklyLine
            label="NEED"
            value={note.NEED}
          />

          <WeeklyLine
            label="NEXT"
            value={note.NEXT}
            last
          />
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg bg-red-400/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          disabled={generating}
          onClick={onGenerate}
          className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {generating
            ? "Generating..."
            : note
            ? "Regenerate"
            : "Generate Weekly Note"}
        </button>

        {note && (
          <button
            type="button"
            onClick={onCopy}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white"
          >
            {copied
              ? "Copied"
              : "Copy Note"}
          </button>
        )}
      </div>
    </div>
  );
}

function WeeklyLine({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[110px_1fr] gap-4 px-4 py-3 ${
        last
          ? ""
          : "border-b border-white/[0.06]"
      }`}
    >
      <div className="text-xs font-semibold text-slate-500">
        {label}
      </div>

      <div className="text-sm leading-6 text-slate-200">
        {value}
      </div>
    </div>
  );
}

function SourceCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Source
      </div>

      <h3 className="mt-2 text-base font-semibold text-white">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-400">
        {body}
      </p>
    </div>
  );
}

function OutputCard({
  title,
  cadence,
  description,
  structure,
}: {
  title: string;
  cadence: string;
  description: string;
  structure: string[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-white">
            {title}
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            {description}
          </p>
        </div>

        <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-medium text-slate-300">
          {cadence}
        </span>
      </div>

      <div className="mt-5 border-t border-white/[0.06] pt-4">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Structure
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {structure.map((item) => (
            <span
              key={item}
              className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-xs text-slate-300"
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled
        className="mt-5 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-500"
      >
        Generate
      </button>
    </div>
  );
}