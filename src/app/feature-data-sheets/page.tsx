
"use client";

import { useState } from "react";

type InvoiceRow = Record<string, string>;

type InvoiceResults = {
  invoicesCreated: number;
  invoiceValue: number;
  amountCollected: number;
  outstandingValue: number;
  businesses: number;
  collectionRate: number;
};

function parseCSV(text: string): InvoiceRow[] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) >
    (firstLine.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      row.push(field);
      field = "";
    } else if (
      (char === "\n" || char === "\r") &&
      !inQuotes
    ) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((value) => value.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    if (row.some((value) => value.trim() !== "")) {
      rows.push(row);
    }
  }

  if (rows.length < 2) {
    throw new Error("The CSV must contain a header and data rows.");
  }

  const headers = rows[0].map((header) =>
    header.trim().replace(/^\uFEFF/, "").toLowerCase()
  );

  return rows.slice(1).map((values) => {
    const record: InvoiceRow = {};
    headers.forEach((header, index) => {
      record[header] = (values[index] ?? "").trim();
    });
    return record;
  });
}

function amount(value: string | undefined): number {
  if (!value) return 0;

  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function FeatureDataSheetsPage() {
  const [feature, setFeature] = useState("Invoices");
  const [month, setMonth] = useState("2026-10");
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<InvoiceResults | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function generateDataSheet() {
    if (!file || !month) return;

    setLoading(true);
    setError("");
    setResults(null);

    try {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        throw new Error(
          "Please upload a CSV file for this first version. Excel support will be added next."
        );
      }

      if (feature !== "Invoices") {
        throw new Error(
          "CSV calculations for Take Payments have not been added yet."
        );
      }

      const text = await file.text();
      const rows = parseCSV(text);

      const [year, monthNumber] = month.split("-").map(Number);

      const selectedRows = rows.filter((row) => {
        const createdAt = row.createdat;
        if (!createdAt) return false;

        const date = new Date(createdAt);
        return (
          !Number.isNaN(date.getTime()) &&
          date.getUTCFullYear() === year &&
          date.getUTCMonth() + 1 === monthNumber
        );
      });

      const activeRows = selectedRows.filter(
        (row) =>
          row.iscancelled?.toLowerCase() !== "true" &&
          row.isdeleted?.toLowerCase() !== "true" &&
          !row.deletedat
      );

      const businessIds = new Set(
        activeRows
          .map((row) => row.businessid)
          .filter((id) => Boolean(id))
      );

      const invoiceValue = activeRows.reduce(
        (sum, row) => sum + amount(row.totalamount),
        0
      );

      const amountCollected = activeRows.reduce(
        (sum, row) => sum + amount(row.aggregatedamount),
        0
      );

      const outstandingValue = activeRows.reduce(
        (sum, row) => sum + amount(row.remindingamount),
        0
      );

      setResults({
        invoicesCreated: activeRows.length,
        invoiceValue,
        amountCollected,
        outstandingValue,
        businesses: businessIds.size,
        collectionRate:
          invoiceValue > 0 ? (amountCollected / invoiceValue) * 100 : 0,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to process the file."
      );
    } finally {
      setLoading(false);
    }
  }

  const metrics = results
    ? [
        ["Invoices created", results.invoicesCreated.toLocaleString()],
        ["Invoice value", formatCurrency(results.invoiceValue)],
        ["Amount collected", formatCurrency(results.amountCollected)],
        ["Outstanding value", formatCurrency(results.outstandingValue)],
        ["Businesses", results.businesses.toLocaleString()],
        ["Collection rate", `${results.collectionRate.toFixed(2)}%`],
      ]
    : [];

  return (
    <main className="ml-64 min-h-screen space-y-8 p-8 text-white">
      <div>
        <p className="text-sm text-slate-400">BackOffice / Reporting</p>
        <h1 className="mt-2 text-2xl font-semibold">
          Feature Data Sheets
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Upload raw data and generate monthly feature reports for Marketing and PR.
        </p>
      </div>

      <section className="max-w-3xl space-y-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <div>
          <label className="mb-2 block text-sm text-slate-300">Feature</label>
          <select
            value={feature}
            onChange={(e) => {
              setFeature(e.target.value);
              setResults(null);
              setError("");
            }}
            className="w-full rounded-lg border border-white/10 bg-[#0d1728] p-3"
          >
            <option value="Invoices">Invoices</option>
            <option value="Take Payments">Take Payments</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-300">Channel</label>
          <input
            value="BackOffice App"
            readOnly
            className="w-full rounded-lg border border-white/10 bg-[#0d1728] p-3 text-slate-400"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-300">Reporting month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setResults(null);
            }}
            className="w-full rounded-lg border border-white/10 bg-[#0d1728] p-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-300">Raw data CSV</label>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResults(null);
              setError("");
            }}
            className="block w-full text-sm text-slate-400 file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-white"
          />
          {file && (
            <p className="mt-2 text-xs text-slate-400">
              Selected: {file.name}
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={!file || !month || loading}
          onClick={generateDataSheet}
          className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Processing..." : "Generate Data Sheet"}
        </button>

        {error && (
          <div className="rounded-lg border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}
      </section>

      {results && (
        <section className="max-w-5xl space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Invoice results</h2>
            <p className="mt-1 text-sm text-slate-400">
              {month} · BackOffice App · Invoices
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {metrics.map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-5"
              >
                <p className="text-sm text-slate-400">{label}</p>
                <p className="mt-3 text-xl font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <p className="text-xs leading-5 text-amber-300/80">
            These figures reflect invoices created in the selected month,
            excluding rows marked cancelled or deleted. Collected and
            outstanding amounts are the values currently recorded against
            those invoices; they are not necessarily payments received
            during the selected month.
          </p>
        </section>
      )}
    </main>
  );
}
