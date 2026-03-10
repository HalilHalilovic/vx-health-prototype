"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ClientAccount } from "@/lib/types";
import {
  applySeedOverrides,
  computeClientsWithRisk,
  computeSummary,
  ensureCurrentWeekEntry,
  formatWeek,
} from "@/lib/health-utils";
import type { SavedScoreData } from "@/components/ScoreEntryForm";
import { SummaryCards } from "@/components/SummaryCards";
import { ClientList } from "@/components/ClientList";
import { ScoreEntryForm } from "@/components/ScoreEntryForm";
import { LeadershipRiskView } from "@/components/LeadershipRiskView";
import { PreviousWeeks } from "@/components/PreviousWeeks";

type DashboardProps = {
  initialClients: ClientAccount[];
  initialDataSource: "supabase" | "seed";
  currentWeekStart: string;
};

export function Dashboard({
  initialClients,
  initialDataSource,
  currentWeekStart,
}: DashboardProps) {

  const prepareClients = useCallback(
    (raw: ClientAccount[], source: "supabase" | "seed") => {
      let withCurrentWeek = raw.map((c) =>
        ensureCurrentWeekEntry(c, currentWeekStart),
      );
      if (source === "seed") {
        withCurrentWeek = applySeedOverrides(withCurrentWeek);
      }
      return withCurrentWeek;
    },
    [currentWeekStart],
  );

  const [clients, setClients] = useState<ClientAccount[]>(() =>
    prepareClients(initialClients, initialDataSource),
  );
  const [selectedClientId, setSelectedClientId] = useState(
    () => clients[0]?.id ?? "",
  );
  const [dataSource, setDataSource] = useState(initialDataSource);
  const [isLoadingClients, setIsLoadingClients] = useState(false);

  const loadClients = useCallback(async () => {
    setIsLoadingClients(true);
    try {
      const response = await fetch("/api/clients", { cache: "no-store" });
      const payload = (await response.json()) as {
        clients: ClientAccount[];
        source: "supabase" | "seed";
      };
      const prepared = prepareClients(payload.clients, payload.source);
      setClients(prepared);
      setDataSource(payload.source);
      setSelectedClientId((prev) => {
        if (!prev) return prepared[0]?.id ?? "";
        return prepared.some((c) => c.id === prev)
          ? prev
          : (prepared[0]?.id ?? "");
      });
    } finally {
      setIsLoadingClients(false);
    }
  }, [prepareClients]);

  useEffect(() => {
    if (dataSource !== "supabase") return;
    const intervalId = window.setInterval(() => void loadClients(), 10000);
    return () => window.clearInterval(intervalId);
  }, [dataSource, loadClients]);

  const handleAddClient = useCallback(
    async (name: string, team: string) => {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, coachTeam: team }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        id?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to add client.");
      }
      await loadClients();
      if (data.id) setSelectedClientId(data.id);
    },
    [loadClients],
  );

  const handleSave = useCallback(
    (saved: SavedScoreData) => {
      setClients((prev) =>
        prev.map((client) => {
          if (client.id !== saved.clientId) return client;

          const hasWeek = client.healthHistory.some(
            (w) => w.weekStart === saved.weekStart,
          );
          if (!hasWeek) {
            return {
              ...client,
              healthHistory: [
                ...client.healthHistory,
                {
                  weekStart: saved.weekStart,
                  currentScore: saved.currentScore,
                  predictiveScore: saved.predictiveScore,
                  notes: saved.notes,
                  actions: saved.actions,
                },
              ].sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
            };
          }
          return {
            ...client,
            healthHistory: client.healthHistory.map((w) =>
              w.weekStart === saved.weekStart
                ? {
                    ...w,
                    currentScore: saved.currentScore,
                    predictiveScore: saved.predictiveScore,
                    notes: saved.notes,
                    actions: saved.actions,
                  }
                : w,
            ),
          };
        }),
      );

      if (dataSource === "supabase") {
        setTimeout(() => void loadClients(), 500);
      }
    },
    [dataSource, loadClients],
  );

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );

  const clientsWithRisk = useMemo(
    () => computeClientsWithRisk(clients),
    [clients],
  );

  const summary = useMemo(
    () => computeSummary(clientsWithRisk, currentWeekStart),
    [clientsWithRisk, currentWeekStart],
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Vx Weekly Client Health
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Coach workflow prototype for weekly scoring, action planning, and
            leadership risk visibility.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Week of{" "}
            <span className="font-medium">
              {formatWeek(currentWeekStart)}
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Data source:{" "}
            <span className="font-medium uppercase tracking-wide">
              {dataSource}
            </span>
            {isLoadingClients && (
              <span className="ml-2 text-slate-400">refreshing...</span>
            )}
          </p>
        </header>

        {dataSource === "seed" && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Supabase is not configured or unreachable. Showing fallback seed
            data.
          </div>
        )}

        <SummaryCards summary={summary} />

        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-[1.25fr_1.5fr_1.25fr]">
          <ClientList
            clientsWithRisk={clientsWithRisk}
            selectedClientId={selectedClientId}
            onSelectClient={setSelectedClientId}
            onAddClient={handleAddClient}
          />

          {selectedClient ? (
            <ScoreEntryForm
              key={selectedClientId}
              selectedClient={selectedClient}
              currentWeekStart={currentWeekStart}
              dataSource={dataSource}
              onSave={handleSave}
            />
          ) : (
            <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 md:col-span-2 lg:col-span-1">
              <h2 className="text-base font-semibold">Weekly Score Entry</h2>
              <p className="mt-3 text-sm text-slate-600">
                No client selected.
              </p>
            </section>
          )}

          <LeadershipRiskView clientsWithRisk={clientsWithRisk} />
        </section>

        <PreviousWeeks selectedClient={selectedClient} />
      </main>
    </div>
  );
}
