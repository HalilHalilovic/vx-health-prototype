"use client";

import { useMemo, useState } from "react";
import type { ClientWithRisk } from "@/lib/health-utils";
import { riskBadgeClass, sortClientEntries } from "@/lib/health-utils";

type LeadershipRiskViewProps = {
  clientsWithRisk: ClientWithRisk[];
};

export function LeadershipRiskView({
  clientsWithRisk,
}: LeadershipRiskViewProps) {
  const [leadershipSort, setLeadershipSort] = useState<"risk" | "alpha">(
    "risk",
  );

  const sorted = useMemo(
    () => sortClientEntries(clientsWithRisk, leadershipSort),
    [clientsWithRisk, leadershipSort],
  );

  return (
    <aside className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Leadership Risk View</h2>
        <select
          value={leadershipSort}
          onChange={(e) =>
            setLeadershipSort(e.target.value as "risk" | "alpha")
          }
          className="rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-slate-500"
        >
          <option value="risk">Sort: Risk</option>
          <option value="alpha">Sort: A-Z</option>
        </select>
      </div>
      <ul className="mt-3 max-h-[550px] space-y-2 overflow-auto pr-1">
        {sorted.map(({ client, latest, risk }) => (
          <li
            key={`risk-${client.id}`}
            className="rounded-lg border border-slate-200 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{client.name}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${riskBadgeClass[risk]}`}
              >
                {risk}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              {latest
                ? `Current ${latest.currentScore ?? "-"} • Predictive ${latest.predictiveScore ?? "-"}`
                : "No score yet"}
            </p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
