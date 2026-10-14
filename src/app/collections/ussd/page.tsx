"use client";

import { useState } from "react";
import { PageShell } from "@/components/PageShell";
import { CollectionsTabs } from "@/components/collections/CollectionsTabs";
import { DateRangePicker } from "@/components/reporting/DateRangePicker";

export default function UssdCollectionsPage() {
  const [startDate, setStartDate] = useState<Date>(
    new Date("2026-08-31T00:00:00")
  );

  const [endDate, setEndDate] = useState<Date>(
    new Date("2026-09-06T00:00:00")
  );

  function handleApply(start: Date, end: Date) {
    setStartDate(start);
    setEndDate(end);
  }

  return (
    <PageShell
      title="Collections Performance"
      description="Review USSD collections performance."
    >
      <div className="space-y-6">
        <CollectionsTabs />

        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onApply={handleApply}
        />

        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <div className="text-sm font-medium text-white">
            USSD Performance
          </div>

          <div className="mt-2 text-sm text-slate-500">
            USSD collections data will appear here.
          </div>
        </div>
      </div>
    </PageShell>
  );
}