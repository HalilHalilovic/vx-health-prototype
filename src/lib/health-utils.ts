import type { ClientAccount, ScoreValue, WeeklyHealthScore } from "@/lib/types";

export const scoreOptions: ScoreValue[] = [5, 4, 3, 2, 1];

export type RiskLevel = "Critical" | "At Risk" | "Watch" | "Healthy" | "Not Scored";

export type ClientWithRisk = {
  client: ClientAccount;
  latest: WeeklyHealthScore | null;
  risk: RiskLevel;
};

export type SummaryData = {
  totalClients: number;
  critical: number;
  atRisk: number;
  scoredThisWeek: number;
};

export function getCurrentWeekStart(): string {
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

const monthNames = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatWeek(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function ensureCurrentWeekEntry(
  client: ClientAccount,
  currentWeekStart: string,
): ClientAccount {
  const hasCurrentWeek = client.healthHistory.some(
    (week) => week.weekStart === currentWeekStart,
  );
  if (hasCurrentWeek) return client;

  return {
    ...client,
    healthHistory: [
      ...client.healthHistory,
      {
        weekStart: currentWeekStart,
        currentScore: null,
        predictiveScore: null,
        actions: "",
        notes: "",
      },
    ].sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
  };
}

export function latestScoredWeek(
  client: ClientAccount,
): WeeklyHealthScore | null {
  for (let i = client.healthHistory.length - 1; i >= 0; i -= 1) {
    const week = client.healthHistory[i];
    if (week.currentScore !== null || week.predictiveScore !== null) return week;
  }
  return null;
}

export function riskLevelFromWeek(
  week: WeeklyHealthScore | null,
): RiskLevel {
  if (!week || week.predictiveScore === null) return "Not Scored";
  if (week.predictiveScore <= 2) return "Critical";
  if (week.predictiveScore === 3) return "At Risk";
  if (week.predictiveScore === 4) return "Watch";
  return "Healthy";
}

export const riskRank: Record<RiskLevel, number> = {
  Critical: 4,
  "At Risk": 3,
  Watch: 2,
  Healthy: 1,
  "Not Scored": 0,
};

export const riskBadgeClass: Record<RiskLevel, string> = {
  Critical: "bg-red-100 text-red-700",
  "At Risk": "bg-amber-100 text-amber-700",
  Watch: "bg-yellow-100 text-yellow-700",
  Healthy: "bg-emerald-100 text-emerald-700",
  "Not Scored": "bg-slate-100 text-slate-600",
};

export function computeClientsWithRisk(
  clients: ClientAccount[],
): ClientWithRisk[] {
  return clients.map((client) => {
    const latest = latestScoredWeek(client);
    return { client, latest, risk: riskLevelFromWeek(latest) };
  });
}

export function sortClientEntries(
  entries: ClientWithRisk[],
  mode: "risk" | "alpha",
): ClientWithRisk[] {
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
}

export function computeSummary(
  clientsWithRisk: ClientWithRisk[],
  currentWeekStart: string,
): SummaryData {
  const critical = clientsWithRisk.filter(
    ({ risk }) => risk === "Critical",
  ).length;
  const atRisk = clientsWithRisk.filter(
    ({ risk }) => risk === "At Risk",
  ).length;
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
}

// --- Client-only localStorage utilities for seed-mode overrides ---

const seedOverridesStorageKey = "vx_seed_overrides_v1";

export type SeedScoreOverride = {
  clientId: string;
  weekStart: string;
  currentScore: ScoreValue | null;
  predictiveScore: ScoreValue | null;
  notes: string;
  actions: string;
};

export function loadSeedOverrides(): SeedScoreOverride[] {
  try {
    const raw = window.localStorage.getItem(seedOverridesStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SeedScoreOverride[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function writeSeedOverride(override: SeedScoreOverride) {
  const existing = loadSeedOverrides();
  const deduped = existing.filter(
    (item) =>
      !(
        item.clientId === override.clientId &&
        item.weekStart === override.weekStart
      ),
  );
  deduped.push(override);
  window.localStorage.setItem(
    seedOverridesStorageKey,
    JSON.stringify(deduped),
  );
}

export function applySeedOverrides(
  clients: ClientAccount[],
): ClientAccount[] {
  const overrides = loadSeedOverrides();
  if (overrides.length === 0) return clients;

  return clients.map((client) => {
    const clientOverrides = overrides.filter(
      (item) => item.clientId === client.id,
    );
    if (clientOverrides.length === 0) return client;

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
      healthHistory: history.sort((a, b) =>
        a.weekStart.localeCompare(b.weekStart),
      ),
    };
  });
}
