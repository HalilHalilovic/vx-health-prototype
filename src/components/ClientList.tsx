"use client";

import { useMemo, useState } from "react";
import type { ClientWithRisk } from "@/lib/health-utils";
import { riskBadgeClass, sortClientEntries } from "@/lib/health-utils";

type ClientListProps = {
  clientsWithRisk: ClientWithRisk[];
  selectedClientId: string;
  onSelectClient: (id: string) => void;
  onAddClient: (name: string, team: string) => Promise<void>;
};

export function ClientList({
  clientsWithRisk,
  selectedClientId,
  onSelectClient,
  onAddClient,
}: ClientListProps) {
  const [search, setSearch] = useState("");
  const [atRiskOnly, setAtRiskOnly] = useState(false);
  const [clientSort, setClientSort] = useState<"risk" | "alpha">("risk");
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientTeam, setNewClientTeam] = useState("");
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [addError, setAddError] = useState("");

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = clientsWithRisk.filter(({ client, risk }) => {
      const matchesSearch =
        query.length === 0 ||
        client.name.toLowerCase().includes(query) ||
        client.coachTeam.toLowerCase().includes(query);
      const matchesRisk =
        !atRiskOnly || risk === "Critical" || risk === "At Risk";
      return matchesSearch && matchesRisk;
    });
    return sortClientEntries(filtered, clientSort);
  }, [clientsWithRisk, search, atRiskOnly, clientSort]);

  const handleAddClient = async () => {
    if (!newClientName.trim()) return;
    setIsAddingClient(true);
    setAddError("");
    try {
      await onAddClient(
        newClientName.trim(),
        newClientTeam.trim() || "Unassigned",
      );
      setNewClientName("");
      setNewClientTeam("");
      setShowAddClient(false);
    } catch (err) {
      setAddError(
        err instanceof Error ? err.message : "Failed to add client.",
      );
    } finally {
      setIsAddingClient(false);
    }
  };

  return (
    <aside className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Clients</h2>
        <button
          onClick={() => setShowAddClient((v) => !v)}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          + Add
        </button>
      </div>

      {showAddClient && (
        <div className="mt-3 space-y-2 rounded-lg border border-slate-300 bg-slate-50 p-3">
          <input
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            placeholder="Client name"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
          <input
            value={newClientTeam}
            onChange={(e) => setNewClientTeam(e.target.value)}
            placeholder="Coach team (optional)"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
          {addError && (
            <p className="text-xs text-red-600">{addError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => void handleAddClient()}
              disabled={isAddingClient || !newClientName.trim()}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {isAddingClient ? "Adding..." : "Add Client"}
            </button>
            <button
              onClick={() => {
                setShowAddClient(false);
                setNewClientName("");
                setNewClientTeam("");
                setAddError("");
              }}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 space-y-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search client or team"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={atRiskOnly}
              onChange={(e) => setAtRiskOnly(e.target.checked)}
            />
            At-risk only
          </label>
          <select
            value={clientSort}
            onChange={(e) =>
              setClientSort(e.target.value as "risk" | "alpha")
            }
            className="rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-slate-500"
          >
            <option value="risk">Sort: Risk</option>
            <option value="alpha">Sort: A-Z</option>
          </select>
        </div>
      </div>

      <ul className="mt-3 max-h-[550px] space-y-2 overflow-auto pr-1">
        {filteredClients.map(({ client, latest, risk }) => (
          <li key={client.id}>
            <button
              onClick={() => onSelectClient(client.id)}
              className={`w-full rounded-lg border p-3 text-left transition ${
                selectedClientId === client.id
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white hover:border-slate-400"
              }`}
            >
              <p className="font-medium">{client.name}</p>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span
                  className={`rounded-full px-2 py-0.5 ${
                    selectedClientId === client.id
                      ? "bg-white/20 text-white"
                      : riskBadgeClass[risk]
                  }`}
                >
                  {risk}
                </span>
                <span
                  className={
                    selectedClientId === client.id
                      ? "text-slate-200"
                      : "text-slate-500"
                  }
                >
                  {client.coachTeam}
                </span>
              </div>
              <p
                className={`mt-1 text-xs ${
                  selectedClientId === client.id
                    ? "text-slate-200"
                    : "text-slate-500"
                }`}
              >
                Last:{" "}
                {latest?.predictiveScore !== null &&
                latest?.predictiveScore !== undefined
                  ? `C${latest.currentScore ?? "-"} / P${latest.predictiveScore}`
                  : "Not scored"}
              </p>
            </button>
          </li>
        ))}
        {filteredClients.length === 0 && (
          <li className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
            No clients match your filters.
          </li>
        )}
      </ul>
    </aside>
  );
}
