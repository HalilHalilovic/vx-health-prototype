import type { ClientAccount } from "@/lib/types";
import { formatWeek } from "@/lib/health-utils";

type PreviousWeeksProps = {
  selectedClient: ClientAccount | null;
};

export function PreviousWeeks({ selectedClient }: PreviousWeeksProps) {
  return (
    <section className="mt-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-base font-semibold">Previous Weeks</h2>
      {selectedClient ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-2 py-2 font-medium">Week</th>
                <th className="px-2 py-2 font-medium">Current</th>
                <th className="px-2 py-2 font-medium">Predictive</th>
                <th className="px-2 py-2 font-medium">Notes</th>
                <th className="px-2 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...selectedClient.healthHistory]
                .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
                .map((week) => (
                  <tr
                    key={week.weekStart}
                    className="border-b border-slate-100 align-top"
                  >
                    <td className="px-2 py-2">
                      {formatWeek(week.weekStart)}
                    </td>
                    <td className="px-2 py-2">
                      {week.currentScore ?? "-"}
                    </td>
                    <td className="px-2 py-2">
                      {week.predictiveScore ?? "-"}
                    </td>
                    <td className="max-w-[280px] px-2 py-2 text-slate-600">
                      {week.notes || "-"}
                    </td>
                    <td className="max-w-[280px] whitespace-pre-wrap px-2 py-2 text-slate-600">
                      {week.actions || "-"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-600">
          Select a client to view history.
        </p>
      )}
    </section>
  );
}
