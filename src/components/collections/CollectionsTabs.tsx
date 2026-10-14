"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    label: "Collections",
    href: "/collections",
  },
  {
    label: "Invoices",
    href: "/collections/invoices",
  },
  {
    label: "USSD",
    href: "/collections/ussd",
  },
];

export function CollectionsTabs() {
  const pathname = usePathname();

  return (
    <div className="border-b border-white/[0.06]">
      <nav className="flex gap-6">
        {tabs.map((tab) => {
          const active =
            tab.href === "/collections"
              ? pathname === "/collections"
              : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative pb-3 text-sm font-medium transition ${
                active
                  ? "text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab.label}

              {active && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-emerald-400" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}