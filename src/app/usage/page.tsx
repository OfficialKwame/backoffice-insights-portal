import Link from "next/link";
import { PageShell } from "@/components/PageShell";

export default function UsageAnalysisPage() {
  return (
    <PageShell
      title="Usage Analysis"
      description="Understand how BackOffice App and USSD are being used, the journeys users take, and where they experience friction."
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Link
          href="/usage/backoffice-app"
          className="group rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 transition hover:border-white/[0.16] hover:bg-white/[0.04]"
        >
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Product
          </div>

          <h2 className="mt-3 text-xl font-semibold text-white">
            BackOffice App
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Analyse users, sessions, feature usage, payment journeys,
            devices, app versions, crashes and friction.
          </p>

          <div className="mt-6 text-sm font-medium text-slate-300 group-hover:text-white">
            Open analysis →
          </div>
        </Link>

        <Link
          href="/usage/ussd"
          className="group rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 transition hover:border-white/[0.16] hover:bg-white/[0.04]"
        >
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Product
          </div>

          <h2 className="mt-3 text-xl font-semibold text-white">
            USSD
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Analyse sessions, General Flow and specialised flows,
            payment journeys, drop-offs and friction.
          </p>

          <div className="mt-6 text-sm font-medium text-slate-300 group-hover:text-white">
            Open analysis →
          </div>
        </Link>
      </div>
    </PageShell>
  );
}