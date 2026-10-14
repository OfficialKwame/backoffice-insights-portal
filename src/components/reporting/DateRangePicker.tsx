"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker, DateRange } from "react-day-picker";
import {
  
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subDays,
  subWeeks,
} from "date-fns";

import "react-day-picker/style.css";

type DateRangePickerProps = {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onApply: (startDate: Date, endDate: Date) => void;
};

export function DateRangePicker({
  startDate,
  endDate,
  onApply,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const [range, setRange] = useState<DateRange | undefined>({
    from: startDate,
    to: endDate,
  });

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRange({
      from: startDate,
      to: endDate,
    });
  }, [startDate, endDate]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function applyRange(selectedRange?: DateRange) {
    const selected = selectedRange ?? range;

    if (!selected?.from || !selected?.to) {
      return;
    }

    onApply(selected.from, selected.to);
    setOpen(false);
  }

  function selectPreset(from: Date, to: Date) {
    const selected = { from, to };

    setRange(selected);
    onApply(from, to);
    setOpen(false);
  }

  const today = new Date();

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Reporting Period
          </div>

          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="flex min-w-[280px] items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-white/20"
          >
            <span className="text-sm font-medium text-white">
              {startDate && endDate
                ? `${format(startDate, "dd MMM yyyy")} → ${format(
                    endDate,
                    "dd MMM yyyy"
                  )}`
                : "Select reporting period"}
            </span>

            <span className="text-slate-500">▾</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              selectPreset(subDays(today, 6), today)
            }
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:border-white/20 hover:text-white"
          >
            Last 7 Days
          </button>

          <button
            type="button"
            onClick={() =>
              selectPreset(
                startOfWeek(today, { weekStartsOn: 1 }),
                endOfWeek(today, { weekStartsOn: 1 })
              )
            }
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:border-white/20 hover:text-white"
          >
            This Week
          </button>

          <button
            type="button"
            onClick={() => {
              const previousWeek = subWeeks(today, 1);

              selectPreset(
                startOfWeek(previousWeek, {
                  weekStartsOn: 1,
                }),
                endOfWeek(previousWeek, {
                  weekStartsOn: 1,
                })
              );
            }}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:border-white/20 hover:text-white"
          >
            Last Week
          </button>

          <button
            type="button"
            onClick={() =>
              selectPreset(
                startOfMonth(today),
                endOfMonth(today)
              )
            }
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:border-white/20 hover:text-white"
          >
            This Month
          </button>
        </div>
      </div>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-3 rounded-2xl border border-white/10 bg-[#0d1728] p-5 shadow-2xl">
          <DayPicker
            mode="range"
            selected={range}
            onSelect={setRange}
            numberOfMonths={2}
            defaultMonth={range?.from ?? today}
          />

          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
            <div className="text-xs text-slate-500">
              {range?.from && range?.to
                ? `${format(
                    range.from,
                    "dd MMM yyyy"
                  )} → ${format(
                    range.to,
                    "dd MMM yyyy"
                  )}`
                : range?.from
                  ? "Select an end date"
                  : "Select a start date"}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!range?.from || !range?.to}
                onClick={() => applyRange()}
                className="rounded-lg bg-emerald-400 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}