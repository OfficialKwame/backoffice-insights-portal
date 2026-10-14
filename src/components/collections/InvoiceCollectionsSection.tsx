"use client";

import {
  useEffect,
  useState,
} from "react";

type InvoiceSummary = {
  invoicesCreated: number;
  invoiceValue: number;
  paidInvoices: number;
  partiallyPaidInvoices: number;
  unpaidInvoices: number;
  amountCollected: number;
  outstandingValue: number;
  collectionRate: number;
  overdueInvoices: number;
  businesses: number;
};

type InvoiceSource = {
  source: string;
  invoices: number;
  invoiceValue: number;
  amountCollected: number;
  outstandingValue: number;
  collectionRate: number;
};

type InvoiceMerchant = {
  businessId: string;
  businessName: string;
  invoices: number;
  invoiceValue: number;
  amountCollected: number;
  outstandingValue: number;
  collectionRate: number;
};

type InvoiceSummaryResponse = {
  summary: InvoiceSummary;
  sources: InvoiceSource[];
  merchants: InvoiceMerchant[];
};

type MerchantSort =
  | "invoice-value"
  | "outstanding"
  | "collection-rate"
  | "invoices";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2,
  }).format(value);
}

function InvoiceMetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-violet-400/20 bg-violet-400/[0.06] p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-violet-300/60">
        {label}
      </div>

      <div className="mt-3 text-2xl font-semibold tracking-tight text-white">
        {value}
      </div>
    </div>
  );
}

export function InvoiceCollectionsSection({
  periodStart,
  periodEnd,
}: {
  periodStart: string;
  periodEnd: string;
}) {
  const [data, setData] =
    useState<InvoiceSummaryResponse | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [merchantSort, setMerchantSort] =
    useState<MerchantSort>(
      "invoice-value"
    );

  const [
    merchantPageSize,
    setMerchantPageSize,
  ] = useState(10);

  const [merchantPage, setMerchantPage] =
    useState(1);

  useEffect(() => {
    async function loadInvoices() {
      setLoading(true);
      setError("");

      try {
        const start =
          periodStart.slice(0, 10);

        const end =
          periodEnd.slice(0, 10);

        const res = await fetch(
          `/api/collections/invoices/summary?start=${start}&end=${end}`,
          {
            cache: "no-store",
          }
        );

        const result = await res.json();

        if (!res.ok) {
          throw new Error(
            result?.error ||
              "Unable to load invoice collections."
          );
        }

        setData(result);

        // Return to page 1 whenever
        // the reporting period changes.
        setMerchantPage(1);
      } catch (err) {
        console.error(
          "Unable to load invoice collections:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load invoice collections."
        );
      } finally {
        setLoading(false);
      }
    }

    loadInvoices();
  }, [periodStart, periodEnd]);

  const sortedMerchants = data
    ? [...data.merchants].sort(
        (a, b) => {
          switch (merchantSort) {
            case "outstanding":
              return (
                b.outstandingValue -
                a.outstandingValue
              );

            case "collection-rate":
              return (
                a.collectionRate -
                b.collectionRate
              );

            case "invoices":
              return (
                b.invoices -
                a.invoices
              );

            case "invoice-value":
            default:
              return (
                b.invoiceValue -
                a.invoiceValue
              );
          }
        }
      )
    : [];

  const merchantTotalPages = Math.max(
    1,
    Math.ceil(
      sortedMerchants.length /
        merchantPageSize
    )
  );

  const safeMerchantPage = Math.min(
    merchantPage,
    merchantTotalPages
  );

  const merchantStartIndex =
    (safeMerchantPage - 1) *
    merchantPageSize;

  const merchantEndIndex =
    merchantStartIndex +
    merchantPageSize;

  const paginatedInvoiceMerchants =
    sortedMerchants.slice(
      merchantStartIndex,
      merchantEndIndex
    );

  function handleMerchantSortChange(
    value: MerchantSort
  ) {
    setMerchantSort(value);
    setMerchantPage(1);
  }

  function handlePageSizeChange(
    value: number
  ) {
    setMerchantPageSize(value);
    setMerchantPage(1);
  }

  return (
    <section className="space-y-4">
      {/* Section heading */}
      <div className="rounded-2xl border border-violet-400/20 bg-violet-400/[0.035] px-6 py-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-violet-300">
              Invoice Collections
            </div>

            <p className="mt-1 text-xs leading-5 text-slate-400">
              Performance of invoices
              created during the selected
              reporting week.
            </p>
          </div>

          <div className="text-xs text-violet-300/60">
            Invoice cohort view
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-violet-400/15 bg-violet-400/[0.03] px-6 py-10 text-center text-sm text-slate-500">
          Loading invoice collections...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-4 text-sm text-red-300">
          {error}
        </div>
      ) : !data ? null : (
        <>
          {/* Primary metrics */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <InvoiceMetricCard
              label="Invoices Created"
              value={data.summary.invoicesCreated.toLocaleString()}
            />

            <InvoiceMetricCard
              label="Invoice Value"
              value={formatCurrency(
                data.summary.invoiceValue
              )}
            />

            <InvoiceMetricCard
              label="Amount Collected"
              value={formatCurrency(
                data.summary.amountCollected
              )}
            />

            <InvoiceMetricCard
              label="Collection Rate"
              value={`${data.summary.collectionRate.toFixed(
                2
              )}%`}
            />
          </div>

          {/* Secondary metrics */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <InvoiceMetricCard
              label="Outstanding Value"
              value={formatCurrency(
                data.summary.outstandingValue
              )}
            />

            <InvoiceMetricCard
              label="Paid Invoices"
              value={data.summary.paidInvoices.toLocaleString()}
            />

            <InvoiceMetricCard
              label="Overdue Invoices"
              value={data.summary.overdueInvoices.toLocaleString()}
            />

            <InvoiceMetricCard
              label="Businesses"
              value={data.summary.businesses.toLocaleString()}
            />
          </div>

          {/* Payment status */}
          <div className="grid gap-4 sm:grid-cols-3">
            <InvoiceMetricCard
              label="Fully Paid"
              value={data.summary.paidInvoices.toLocaleString()}
            />

            <InvoiceMetricCard
              label="Partially Paid"
              value={data.summary.partiallyPaidInvoices.toLocaleString()}
            />

            <InvoiceMetricCard
              label="Unpaid"
              value={data.summary.unpaidInvoices.toLocaleString()}
            />
          </div>

          {/* Source breakdown */}
          <div className="overflow-hidden rounded-2xl border border-violet-400/20 bg-violet-400/[0.025]">
            <div className="border-b border-violet-400/10 px-6 py-5">
              <div className="text-sm font-medium text-white">
                Invoice Collections by Source
              </div>

              <div className="mt-1 text-xs text-slate-500">
                Invoice activity from
                BO Lite and mPOS during
                the selected reporting
                week.
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px]">
                <thead>
                  <tr className="border-b border-violet-400/10">
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500">
                      Source
                    </th>

                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                      Invoices
                    </th>

                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                      Invoice Value
                    </th>

                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                      Collected
                    </th>

                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                      Outstanding
                    </th>

                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500">
                      Collection Rate
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {data.sources.map(
                    (source) => (
                      <tr
                        key={source.source}
                        className="border-b border-violet-400/[0.06] last:border-0"
                      >
                        <td className="px-6 py-4 text-sm font-medium text-violet-200">
                          {source.source}
                        </td>

                        <td className="px-4 py-4 text-right text-sm text-slate-300">
                          {source.invoices.toLocaleString()}
                        </td>

                        <td className="px-4 py-4 text-right text-sm text-slate-300">
                          {formatCurrency(
                            source.invoiceValue
                          )}
                        </td>

                        <td className="px-4 py-4 text-right text-sm text-slate-300">
                          {formatCurrency(
                            source.amountCollected
                          )}
                        </td>

                        <td className="px-4 py-4 text-right text-sm text-slate-300">
                          {formatCurrency(
                            source.outstandingValue
                          )}
                        </td>

                        <td className="px-6 py-4 text-right text-sm font-medium text-white">
                          {source.collectionRate.toFixed(
                            2
                          )}
                          %
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Merchant breakdown */}
          <div className="overflow-hidden rounded-2xl border border-violet-400/20 bg-violet-400/[0.025]">
            <div className="border-b border-violet-400/10 px-6 py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-sm font-medium text-white">
                    Invoice Merchant
                    Performance
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    Invoice value,
                    collections and
                    outstanding balances
                    by business for the
                    selected reporting
                    week.
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  {/* Sort */}
                  <div>
                    <div className="mb-1.5 text-xs text-slate-500">
                      Sort by
                    </div>

                    <select
                      value={merchantSort}
                      onChange={(e) =>
                        handleMerchantSortChange(
                          e.target
                            .value as MerchantSort
                        )
                      }
                      className="w-full rounded-xl border border-violet-400/20 bg-[#0d1728] px-4 py-2.5 text-sm text-white outline-none sm:w-56"
                    >
                      <option value="invoice-value">
                        Highest Invoice
                        Value
                      </option>

                      <option value="outstanding">
                        Highest Outstanding
                      </option>

                      <option value="collection-rate">
                        Lowest Collection
                        Rate
                      </option>

                      <option value="invoices">
                        Most Invoices
                      </option>
                    </select>
                  </div>

                  {/* Rows per page */}
                  <div>
                    <div className="mb-1.5 text-xs text-slate-500">
                      Rows
                    </div>

                    <select
                      value={
                        merchantPageSize
                      }
                      onChange={(e) =>
                        handlePageSizeChange(
                          Number(
                            e.target.value
                          )
                        )
                      }
                      className="w-full rounded-xl border border-violet-400/20 bg-[#0d1728] px-4 py-2.5 text-sm text-white outline-none sm:w-28"
                    >
                      <option value={10}>
                        10
                      </option>

                      <option value={25}>
                        25
                      </option>

                      <option value={50}>
                        50
                      </option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {data.merchants.length ===
            0 ? (
              <div className="px-6 py-8 text-sm text-slate-500">
                No invoice merchant data
                is available for this
                reporting week.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[950px]">
                    <thead>
                      <tr className="border-b border-violet-400/10">
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500">
                          Business
                        </th>

                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                          Invoices
                        </th>

                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                          Invoice Value
                        </th>

                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                          Collected
                        </th>

                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                          Outstanding
                        </th>

                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500">
                          Collection Rate
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {paginatedInvoiceMerchants.map(
                        (merchant) => (
                          <tr
                            key={
                              merchant.businessId
                            }
                            className="border-b border-violet-400/[0.06] last:border-0"
                          >
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-white">
                                {
                                  merchant.businessName
                                }
                              </div>

                              <div className="mt-1 text-xs text-slate-600">
                                {
                                  merchant.businessId
                                }
                              </div>
                            </td>

                            <td className="px-4 py-4 text-right text-sm text-slate-300">
                              {merchant.invoices.toLocaleString()}
                            </td>

                            <td className="px-4 py-4 text-right text-sm text-slate-300">
                              {formatCurrency(
                                merchant.invoiceValue
                              )}
                            </td>

                            <td className="px-4 py-4 text-right text-sm text-slate-300">
                              {formatCurrency(
                                merchant.amountCollected
                              )}
                            </td>

                            <td className="px-4 py-4 text-right text-sm text-slate-300">
                              {formatCurrency(
                                merchant.outstandingValue
                              )}
                            </td>

                            <td className="px-6 py-4 text-right text-sm font-medium text-white">
                              {merchant.collectionRate.toFixed(
                                2
                              )}
                              %
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex flex-col gap-3 border-t border-violet-400/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-slate-500">
                    Showing{" "}
                    {sortedMerchants.length ===
                    0
                      ? 0
                      : merchantStartIndex +
                        1}
                    –
                    {Math.min(
                      merchantEndIndex,
                      sortedMerchants.length
                    )}{" "}
                    of{" "}
                    {
                      sortedMerchants.length
                    }{" "}
                    businesses
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setMerchantPage(
                          (current) =>
                            Math.max(
                              1,
                              current - 1
                            )
                        )
                      }
                      disabled={
                        safeMerchantPage <=
                        1
                      }
                      className="rounded-lg border border-violet-400/20 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-violet-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Previous
                    </button>

                    <div className="text-xs text-slate-500">
                      Page{" "}
                      {safeMerchantPage} of{" "}
                      {merchantTotalPages}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setMerchantPage(
                          (current) =>
                            Math.min(
                              merchantTotalPages,
                              current + 1
                            )
                        )
                      }
                      disabled={
                        safeMerchantPage >=
                        merchantTotalPages
                      }
                      className="rounded-lg border border-violet-400/20 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-violet-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="text-xs leading-5 text-slate-600">
            Amount collected represents
            cumulative collections against
            invoices created during this
            reporting period. It does not
            represent invoice payments
            received specifically during
            this week.
          </div>
        </>
      )}
    </section>
  );
}