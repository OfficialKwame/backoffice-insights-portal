"use client";

import {
  FormEvent,
  useState,
} from "react";

import { format } from "date-fns";

import { PageShell } from "@/components/PageShell";
import { CollectionsTabs } from "@/components/collections/CollectionsTabs";
import { DateRangePicker } from "@/components/reporting/DateRangePicker";
import { InvoiceCollectionsSection } from "@/components/collections/InvoiceCollectionsSection";

export default function InvoicesPage() {
  const [startDate, setStartDate] = useState<Date>(
    new Date("2026-08-31T00:00:00")
  );

  const [endDate, setEndDate] = useState<Date>(
    new Date("2026-09-06T00:00:00")
  );

  const [
    invoiceFile,
    setInvoiceFile,
  ] = useState<File | null>(null);

  const [
    uploadingInvoices,
    setUploadingInvoices,
  ] = useState(false);

  const [
    invoiceMessage,
    setInvoiceMessage,
  ] = useState("");

  const [
    invoiceError,
    setInvoiceError,
  ] = useState("");

  const [
    refreshKey,
    setRefreshKey,
  ] = useState(0);

  function handleApply(
    start: Date,
    end: Date
  ) {
    setStartDate(start);
    setEndDate(end);
  }

  async function handleInvoiceUpload(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!invoiceFile) {
      setInvoiceError(
        "Select an invoice CSV file first."
      );
      return;
    }

    try {
      setUploadingInvoices(true);
      setInvoiceError("");
      setInvoiceMessage("");

      const formData = new FormData();

      formData.append(
        "file",
        invoiceFile
      );

      const response = await fetch(
        "/api/collections/invoices/import",
        {
          method: "POST",
          body: formData,
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to upload invoice data."
        );
      }

      setInvoiceMessage(
        data.message ||
          "Invoice data uploaded successfully."
      );

      setInvoiceFile(null);

      /*
       * Refresh the invoice report after
       * a successful upload.
       */
      setRefreshKey(
        (current) => current + 1
      );
    } catch (error) {
      setInvoiceError(
        error instanceof Error
          ? error.message
          : "Unable to upload invoice data."
      );
    } finally {
      setUploadingInvoices(false);
    }
  }

  return (
    <PageShell
      title="Collections Performance"
      description="Review invoice collections performance."
    >
      <div className="space-y-6">
        <CollectionsTabs />

        {/* Invoice upload */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
          <div>
            <div className="text-sm font-medium text-white">
              Upload Invoices
            </div>

            <div className="mt-1 text-sm text-slate-500">
              Import invoice data for collections analysis.
            </div>
          </div>

          <form
            onSubmit={handleInvoiceUpload}
            className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Invoice CSV
              </label>

              <input
                key={
                  invoiceFile
                    ? invoiceFile.name
                    : "empty"
                }
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  setInvoiceFile(
                    event.target.files?.[0] ??
                      null
                  );

                  setInvoiceError("");
                  setInvoiceMessage("");
                }}
                className="block w-full rounded-xl border border-white/10 bg-[#0d1728] px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-white/15"
              />
            </div>

            <button
              type="submit"
              disabled={
                uploadingInvoices ||
                !invoiceFile
              }
              className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {uploadingInvoices
                ? "Uploading..."
                : "Upload Invoices"}
            </button>
          </form>

          {invoiceMessage && (
            <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
              {invoiceMessage}
            </div>
          )}

          {invoiceError && (
            <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-300">
              {invoiceError}
            </div>
          )}
        </div>

        {/* Reporting period */}
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onApply={handleApply}
        />

        {/* Invoice report */}
        <InvoiceCollectionsSection
          key={refreshKey}
          periodStart={format(
            startDate,
            "yyyy-MM-dd"
          )}
          periodEnd={format(
            endDate,
            "yyyy-MM-dd"
          )}
        />
      </div>
    </PageShell>
  );
}