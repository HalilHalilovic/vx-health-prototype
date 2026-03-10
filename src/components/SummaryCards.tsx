import type { SummaryData } from "@/lib/health-utils";

export function SummaryCards({ summary }: { summary: SummaryData }) {
  return (
    <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Total Clients
        </p>
        <p className="mt-2 text-2xl font-semibold">{summary.totalClients}</p>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Critical
        </p>
        <p className="mt-2 text-2xl font-semibold text-red-600">
          {summary.critical}
        </p>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          At Risk
        </p>
        <p className="mt-2 text-2xl font-semibold text-amber-600">
          {summary.atRisk}
        </p>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Scored This Week
        </p>
        <p className="mt-2 text-2xl font-semibold">
          {summary.scoredThisWeek}
        </p>
      </div>
    </section>
  );
}
