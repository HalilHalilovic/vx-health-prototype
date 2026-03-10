"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientAccount, ScoreValue, WeeklyHealthScore } from "@/lib/types";

const scoreOptions: ScoreValue[] = [5, 4, 3, 2, 1];
const seedOverridesStorageKey = "vx_seed_overrides_v1";

type SeedScoreOverride = {
  clientId: string;
  weekStart: string;
  currentScore: ScoreValue | null;
  predictiveScore: ScoreValue | null;
  notes: string;
  actions: string;
};

function getCurrentWeekStart() {
  const today = new Date();
  const day = today.getDay();
  const mondayOffset = (day + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, "0");
  const date = String(monday.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

function formatWeek(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ensureCurrentWeekEntry(
  client: ClientAccount,
  currentWeekStart: string,
): ClientAccount {
  const hasCurrentWeek = client.healthHistory.some(
    (week) => week.weekStart === currentWeekStart,
  );
  if (hasCurrentWeek) {
    return client;
  }

  const currentWeek: WeeklyHealthScore = {
    weekStart: currentWeekStart,
    currentScore: null,
    predictiveScore: null,
    actions: "",
    notes: "",
  };

  return {
    ...client,
    healthHistory: [...client.healthHistory, currentWeek].sort((a, b) =>
      a.weekStart.localeCompare(b.weekStart),
    ),
  };
}

function latestScoredWeek(client: ClientAccount) {
  for (let i = client.healthHistory.length - 1; i >= 0; i -= 1) {
    const week = client.healthHistory[i];
    if (week.currentScore !== null || week.predictiveScore !== null) {
      return week;
    }
  }
  return null;
}

type RiskLevel = "Critical" | "At Risk" | "Watch" | "Healthy" | "Not Scored";

function riskLevelFromWeek(week: WeeklyHealthScore | null): RiskLevel {
  if (!week || week.predictiveScore === null) {
    return "Not Scored";
  }
  if (week.predictiveScore <= 2) {
    return "Critical";
  }
  if (week.predictiveScore === 3) {
    return "At Risk";
  }
  if (week.predictiveScore === 4) {
    return "Watch";
  }
  return "Healthy";
}

const riskRank: Record<RiskLevel, number> = {
  Critical: 4,
  "At Risk": 3,
  Watch: 2,
  Healthy: 1,
  "Not Scored": 0,
};

function loadSeedOverrides(): SeedScoreOverride[] {
  try {
    const raw = window.localStorage.getItem(seedOverridesStorageKey);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as SeedScoreOverride[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
}

function writeSeedOverride(override: SeedScoreOverride) {
  const existing = loadSeedOverrides();
  const deduped = existing.filter(
    (item) =>
      !(item.clientId === override.clientId && item.weekStart === override.weekStart),
  );
  deduped.push(override);
  window.localStorage.setItem(seedOverridesStorageKey, JSON.stringify(deduped));
}

function applySeedOverrides(clients: ClientAccount[]): ClientAccount[] {
  const overrides = loadSeedOverrides();
  if (overrides.length === 0) {
    return clients;
  }

  return clients.map((client) => {
    const clientOverrides = overrides.filter((item) => item.clientId === client.id);
    if (clientOverrides.length === 0) {
      return client;
    }

    const history = [...client.healthHistory];
    for (const override of clientOverrides) {
      const existingIndex = history.findIndex(
        (week) => week.weekStart === override.weekStart,
      );
      const nextWeek: WeeklyHealthScore = {
        weekStart: override.weekStart,
        currentScore: override.currentScore,
        predictiveScore: override.predictiveScore,
        notes: override.notes,
        actions: override.actions,
      };
      if (existingIndex >= 0) {
        history[existingIndex] = nextWeek;
      } else {
        history.push(nextWeek);
      }
    }

    return {
      ...client,
      healthHistory: history.sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    };
  });
}

export default function Home() {
  const currentWeekStart = useMemo(getCurrentWeekStart, []);

  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [search, setSearch] = useState("");
  const [atRiskOnly, setAtRiskOnly] = useState(false);
  const [clientSort, setClientSort] = useState<"risk" | "alpha">("risk");
  const [leadershipSort, setLeadershipSort] = useState<"risk" | "alpha">("risk");
  const [currentScore, setCurrentScore] = useState<ScoreValue | null>(null);
  const [predictiveScore, setPredictiveScore] = useState<ScoreValue | null>(null);
  const [notes, setNotes] = useState("");
  const [actions, setActions] = useState("");
  const [status, setStatus] = useState("");
  const [isGeneratingActions, setIsGeneratingActions] = useState(false);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [hasLoadedClientsOnce, setHasLoadedClientsOnce] = useState(false);
  const [dataSource, setDataSource] = useState<"supabase" | "seed">("seed");
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientTeam, setNewClientTeam] = useState("");
  const [isAddingClient, setIsAddingClient] = useState(false);

  const loadClients = useCallback(async () => {
    setIsLoadingClients(true);
    try {
      const response = await fetch("/api/clients", { cache: "no-store" });
      const payload = (await response.json()) as {
        clients: ClientAccount[];
        source: "supabase" | "seed";
      };
      let withCurrentWeek = payload.clients.map((client) =>
        ensureCurrentWeekEntry(client, currentWeekStart),
      );
      if (payload.source === "seed") {
        withCurrentWeek = applySeedOverrides(withCurrentWeek);
      }
      setClients(withCurrentWeek);
      setDataSource(payload.source);
      setSelectedClientId((prev) => {
        if (!prev) {
          return withCurrentWeek[0]?.id || "";
        }
        return withCurrentWeek.some((client) => client.id === prev)
          ? prev
          : (withCurrentWeek[0]?.id ?? "");
      });
    } finally {
      setIsLoadingClients(false);
      setHasLoadedClientsOnce(true);
    }
  }, [currentWeekStart]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  useEffect(() => {
    if (dataSource !== "supabase") {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadClients();
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [dataSource, loadClients]);

  const handleAddClient = async () => {
    if (!newClientName.trim()) return;
    setIsAddingClient(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newClientName.trim(), coachTeam: newClientTeam.trim() || "Unassigned" }),
      });
      const data = (await res.json()) as { ok?: boolean; id?: string; error?: string };
      if (!res.ok) {
        setStatus(data.error ?? "Failed to add client.");
        return;
      }
      setNewClientName("");
      setNewClientTeam("");
      setShowAddClient(false);
      await loadClients();
      if (data.id) setSelectedClientId(data.id);
    } catch {
      setStatus("Network error adding client.");
    } finally {
      setIsAddingClient(false);
    }
  };

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );

  const selectedWeekEntry = useMemo(
    () =>
      selectedClient?.healthHistory.find(
        (week) => week.weekStart === currentWeekStart,
      ) ?? null,
    [selectedClient, currentWeekStart],
  );

  const prevClientIdRef = useRef("");
  useEffect(() => {
    if (prevClientIdRef.current === selectedClientId) {
      return;
    }
    prevClientIdRef.current = selectedClientId;
    setCurrentScore(selectedWeekEntry?.currentScore ?? null);
    setPredictiveScore(selectedWeekEntry?.predictiveScore ?? null);
    setNotes(selectedWeekEntry?.notes ?? "");
    setActions(selectedWeekEntry?.actions ?? "");
    setStatus("");
  }, [selectedClientId, selectedWeekEntry]);

  const clientsWithRisk = useMemo(
    () =>
      clients.map((client) => {
        const latest = latestScoredWeek(client);
        const risk = riskLevelFromWeek(latest);
        return { client, latest, risk };
      }),
    [clients],
  );

  const sortEntries = (
    entries: typeof clientsWithRisk,
    mode: "risk" | "alpha",
  ) => {
    const sorted = [...entries];
    if (mode === "alpha") {
      sorted.sort((a, b) => a.client.name.localeCompare(b.client.name));
    } else {
      sorted.sort((a, b) => {
        const riskDiff = riskRank[b.risk] - riskRank[a.risk];
        if (riskDiff !== 0) return riskDiff;
        const aScore = a.latest?.predictiveScore ?? 6;
        const bScore = b.latest?.predictiveScore ?? 6;
        if (aScore !== bScore) return aScore - bScore;
        return a.client.name.localeCompare(b.client.name);
      });
    }
    return sorted;
  };

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = clientsWithRisk.filter(({ client, risk }) => {
      const matchesSearch =
        query.length === 0 ||
        client.name.toLowerCase().includes(query) ||
        client.coachTeam.toLowerCase().includes(query);
      const matchesRisk = !atRiskOnly || risk === "Critical" || risk === "At Risk";
      return matchesSearch && matchesRisk;
    });
    return sortEntries(filtered, clientSort);
  }, [clientsWithRisk, search, atRiskOnly, clientSort]);

  const leadershipClients = useMemo(
    () => sortEntries(clientsWithRisk, leadershipSort),
    [clientsWithRisk, leadershipSort],
  );

  const summary = useMemo(() => {
    const critical = clientsWithRisk.filter(({ risk }) => risk === "Critical").length;
    const atRisk = clientsWithRisk.filter(({ risk }) => risk === "At Risk").length;
    const scoredThisWeek = clientsWithRisk.filter(({ client }) =>
      client.healthHistory.some(
        (week) =>
          week.weekStart === currentWeekStart &&
          week.currentScore !== null &&
          week.predictiveScore !== null,
      ),
    ).length;
    return {
      totalClients: clientsWithRisk.length,
      critical,
      atRisk,
      scoredThisWeek,
    };
  }, [clientsWithRisk, currentWeekStart]);

  async function saveWeeklyScore() {
    if (!selectedClient) {
      return;
    }
    if (currentScore === null || predictiveScore === null) {
      setStatus("Please select both Current and Predictive scores.");
      return;
    }
    if (predictiveScore < 5 && actions.trim().length === 0) {
      setStatus("Actions are required when Predictive Score is below 5.");
      return;
    }

    const applyLocalUpdate = (prevClients: ClientAccount[]) =>
      prevClients.map((client) => {
        if (client.id !== selectedClient.id) {
          return client;
        }
        const hasCurrentWeek = client.healthHistory.some(
          (week) => week.weekStart === currentWeekStart,
        );
        if (!hasCurrentWeek) {
          return {
            ...client,
            healthHistory: [
              ...client.healthHistory,
              {
                weekStart: currentWeekStart,
                currentScore,
                predictiveScore,
                notes: notes.trim(),
                actions: actions.trim(),
              },
            ].sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
          };
        }
        return {
          ...client,
          healthHistory: client.healthHistory.map((week) =>
            week.weekStart === currentWeekStart
              ? {
                  ...week,
                  currentScore,
                  predictiveScore,
                  notes: notes.trim(),
                  actions: actions.trim(),
                }
              : week,
          ),
        };
      });

    if (dataSource === "seed") {
      writeSeedOverride({
        clientId: selectedClient.id,
        weekStart: currentWeekStart,
        currentScore,
        predictiveScore,
        notes: notes.trim(),
        actions: actions.trim(),
      });
      setClients(applyLocalUpdate);
      setStatus("Saved locally (seed mode).");
      return;
    }

    const response = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: selectedClient.id,
        weekStart: currentWeekStart,
        currentScore,
        predictiveScore,
        notes,
        actions,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        details?: string;
      };
      setStatus(
        payload.details
          ? `${payload.error ?? "Could not save score in Supabase."} (${payload.details})`
          : (payload.error ?? "Could not save score in Supabase."),
      );
      return;
    }

    setClients(applyLocalUpdate);
    setStatus("Saved to Supabase.");
    setTimeout(() => void loadClients(), 500);
  }

  async function generateActions() {
    if (!selectedClient) {
      return;
    }
    if (predictiveScore === null) {
      setStatus("Set a predictive score first.");
      return;
    }

    setIsGeneratingActions(true);
    setStatus("");
    try {
      const response = await fetch("/api/suggest-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: selectedClient.name,
          currentScore,
          predictiveScore,
          notes,
        }),
      });
      const payload = (await response.json()) as {
        suggestions: string[];
        source: "openai" | "heuristic";
      };
      setActions(payload.suggestions.map((line) => `- ${line}`).join("\n"));
      setStatus(
        payload.source === "openai"
          ? "Suggested actions generated by AI."
          : "Suggested actions generated from fallback logic.",
      );
    } catch {
      setStatus("Could not generate suggestions. Try again.");
    } finally {
      setIsGeneratingActions(false);
    }
  }

  const riskClass: Record<RiskLevel, string> = {
    Critical: "bg-red-100 text-red-700",
    "At Risk": "bg-amber-100 text-amber-700",
    Watch: "bg-yellow-100 text-yellow-700",
    Healthy: "bg-emerald-100 text-emerald-700",
    "Not Scored": "bg-slate-100 text-slate-600",
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Vx Weekly Client Health</h1>
          <p className="mt-2 text-sm text-slate-600">
            Coach workflow prototype for weekly scoring, action planning, and
            leadership risk visibility.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Week of <span className="font-medium">{formatWeek(currentWeekStart)}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Data source:{" "}
            <span className="font-medium uppercase tracking-wide">{dataSource}</span>
          </p>
        </header>

        {dataSource === "seed" ? (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Supabase is not configured or unreachable. Showing fallback seed data.
          </div>
        ) : null}

        {isLoadingClients && !hasLoadedClientsOnce ? (
          <div className="mb-6 rounded-lg border border-slate-200 bg-white px-4 py-8 text-sm text-slate-600">
            Loading clients from Supabase...
          </div>
        ) : null}

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Clients</p>
            <p className="mt-2 text-2xl font-semibold">{summary.totalClients}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs uppercase tracking-wide text-slate-500">Critical</p>
            <p className="mt-2 text-2xl font-semibold text-red-600">{summary.critical}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs uppercase tracking-wide text-slate-500">At Risk</p>
            <p className="mt-2 text-2xl font-semibold text-amber-600">{summary.atRisk}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Scored This Week
            </p>
            <p className="mt-2 text-2xl font-semibold">{summary.scoredThisWeek}</p>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-[1.25fr_1.5fr_1.25fr]">
          <aside className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Clients</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddClient((v) => !v)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  + Add
                </button>
                <button
                  onClick={() => void loadClients()}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Refresh
                </button>
              </div>
            </div>

            {showAddClient && (
              <div className="mt-3 rounded-lg border border-slate-300 bg-slate-50 p-3 space-y-2">
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
                <div className="flex gap-2">
                  <button
                    onClick={() => void handleAddClient()}
                    disabled={isAddingClient || !newClientName.trim()}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {isAddingClient ? "Adding..." : "Add Client"}
                  </button>
                  <button
                    onClick={() => { setShowAddClient(false); setNewClientName(""); setNewClientTeam(""); }}
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
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search client or team"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={atRiskOnly}
                    onChange={(event) => setAtRiskOnly(event.target.checked)}
                  />
                  At-risk only
                </label>
                <select
                  value={clientSort}
                  onChange={(event) =>
                    setClientSort(event.target.value as "risk" | "alpha")
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
                    onClick={() => setSelectedClientId(client.id)}
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
                            : riskClass[risk]
                        }`}
                      >
                        {risk}
                      </span>
                      <span className={selectedClientId === client.id ? "text-slate-200" : "text-slate-500"}>
                        {client.coachTeam}
                      </span>
                    </div>
                    <p
                      className={`mt-1 text-xs ${
                        selectedClientId === client.id ? "text-slate-200" : "text-slate-500"
                      }`}
                    >
                      Last:{" "}
                      {latest?.predictiveScore !== null && latest?.predictiveScore !== undefined
                        ? `C${latest.currentScore ?? "-"} / P${latest.predictiveScore}`
                        : "Not scored"}
                    </p>
                  </button>
                </li>
              ))}
              {filteredClients.length === 0 ? (
                <li className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                  No clients match your filters.
                </li>
              ) : null}
            </ul>
          </aside>

          <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 md:col-span-2 lg:col-span-1">
            <h2 className="text-base font-semibold">Weekly Score Entry</h2>
            {selectedClient ? (
              <div className="mt-3">
                <p className="text-sm text-slate-600">
                  <span className="font-medium text-slate-900">{selectedClient.name}</span> (
                  {selectedClient.coachTeam})
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium">Current Score (this week)</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {scoreOptions.map((score) => (
                        <button
                          key={`current-${score}`}
                          onClick={() => setCurrentScore(score)}
                          className={`min-w-[2.25rem] rounded-md px-3 py-1.5 text-sm font-medium ${
                            currentScore === score
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {score}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Predictive Score (next week)</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {scoreOptions.map((score) => (
                        <button
                          key={`predictive-${score}`}
                          onClick={() => setPredictiveScore(score)}
                          className={`min-w-[2.25rem] rounded-md px-3 py-1.5 text-sm font-medium ${
                            predictiveScore === score
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {score}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-sm font-medium">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={4}
                    placeholder="Context from this week (delivery, stakeholder sentiment, risks)..."
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                  />
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">
                      Actions to move Predictive Score to 5
                    </label>
                    <button
                      onClick={generateActions}
                      disabled={isGeneratingActions}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isGeneratingActions ? "Generating..." : "Suggest with AI"}
                    </button>
                  </div>
                  <textarea
                    value={actions}
                    onChange={(event) => setActions(event.target.value)}
                    rows={5}
                    placeholder="Required if predictive score is below 5."
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                  />
                </div>

                {status ? (
                  <p className="mt-4 text-center text-sm text-slate-600">{status}</p>
                ) : null}

                <div className="mt-3 text-center">
                  <button
                    onClick={saveWeeklyScore}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                  >
                    Save Weekly Score
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">No client selected.</p>
            )}
          </section>

          <aside className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Leadership Risk View</h2>
              <select
                value={leadershipSort}
                onChange={(event) =>
                  setLeadershipSort(event.target.value as "risk" | "alpha")
                }
                className="rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-slate-500"
              >
                <option value="risk">Sort: Risk</option>
                <option value="alpha">Sort: A-Z</option>
              </select>
            </div>
            <ul className="mt-3 max-h-[550px] space-y-2 overflow-auto pr-1">
              {leadershipClients.map(({ client, latest, risk }) => (
                <li key={`risk-${client.id}`} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{client.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${riskClass[risk]}`}>
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
        </section>

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
                      <tr key={week.weekStart} className="border-b border-slate-100 align-top">
                        <td className="px-2 py-2">{formatWeek(week.weekStart)}</td>
                        <td className="px-2 py-2">{week.currentScore ?? "-"}</td>
                        <td className="px-2 py-2">{week.predictiveScore ?? "-"}</td>
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
            <p className="mt-3 text-sm text-slate-600">Select a client to view history.</p>
          )}
        </section>
      </main>
    </div>
  );
}
