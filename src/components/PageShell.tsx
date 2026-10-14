import { ReactNode } from "react";

export function PageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="min-h-screen pl-64">
      <main className="w-full px-6 py-8 xl:px-8 2xl:px-10">
<header className="mb-8 print:hidden">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Back Office Insights
          </p>

          <h1 className="mt-2 text-3xl font-semibold">
            {title}
          </h1>

          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            {description}
          </p>
        </header>

        {children}
      </main>
    </div>
  );
}