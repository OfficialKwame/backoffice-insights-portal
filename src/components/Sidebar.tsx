"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  {
    href: "/today",
    label: "Today",
    icon: "◫",
  },
  {
    href: "/surface-testing",
    label: "Surface Testing",
    icon: "✓",
  },
  {
    href: "/collections",
    label: "Collections Performance",
    icon: "↗",
  },

  {
    href: "/feature-data-sheets",
    label: "Feature Data Sheets",
    icon: "▤",
  },

  {
    href: "/usage",
    label: "Usage Performance",
    icon: "◩",
  },
  {
    href: "/activity-log",
    label: "Activity Log",
    icon: "+",
  },
  {
    href: "/quick-notes",
    label: "Quick Notes",
    icon: "▧",
  },
  {
    href: "/outputs",
    label: "Outputs",
    icon: "▤",
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-64 border-r border-white/[0.06] bg-[#08111f]">
      {/* Brand */}
      <div className="flex h-24 items-center border-b border-white/[0.06] px-6">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            BackOffice
          </div>

          <div className="mt-1 text-lg font-semibold leading-tight tracking-tight text-white">
            Collections Insights
            <br />
            Portal
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="px-3 py-6">
        <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
          Workspace
        </div>

        <nav className="space-y-1">
          {items.map((item) => {
            const active = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                  active
                    ? "bg-[#152235] font-medium text-white"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-md text-sm ${
                    active
                      ? "bg-white/[0.08] text-white"
                      : "text-slate-500 group-hover:text-slate-300"
                  }`}
                >
                  {item.icon}
                </span>

                <span>{item.label}</span>

                {active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* V1 indicator */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-white/[0.06] p-4">
        <div className="rounded-lg bg-white/[0.025] px-3 py-3">
          <div className="text-xs font-medium text-slate-300">
            Collections Insights Portal
          </div>

          <div className="mt-1 text-[11px] text-slate-600">
            V1 · Internal
          </div>
        </div>
      </div>
    </aside>
  );
}