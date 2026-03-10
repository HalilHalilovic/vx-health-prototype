import type { ClientAccount, ScoreValue } from "@/lib/types";

function getRecentMondays(count: number): string[] {
  const today = new Date();
  const day = today.getDay();
  const mondayOffset = (day + 6) % 7;
  const latestMonday = new Date(today);
  latestMonday.setDate(today.getDate() - mondayOffset);

  const weeks: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const week = new Date(latestMonday);
    week.setDate(latestMonday.getDate() - i * 7);
    weeks.push(week.toISOString().slice(0, 10));
  }
  return weeks;
}

const weeks = getRecentMondays(6);

function toHistory(
  scores: Array<[ScoreValue | null, ScoreValue | null]>,
): ClientAccount["healthHistory"] {
  return scores.map(([currentScore, predictiveScore], index) => ({
    weekStart: weeks[index],
    currentScore,
    predictiveScore,
    actions: "",
    notes: "",
  }));
}

export const seedClientAccounts: ClientAccount[] = [
  {
    id: "craftstone-foods",
    name: "CraftStone Foods",
    coachTeam: "Capybara",
    healthHistory: toHistory([
      [4, 4],
      [4, 3],
      [3, 3],
      [3, 2],
      [2, 2],
      [3, 3],
    ]),
  },
  {
    id: "swiftcurrent-labs",
    name: "SwiftCurrent Labs",
    coachTeam: "Wombat",
    healthHistory: toHistory([
      [3, 3],
      [3, 3],
      [3, 3],
      [3, 3],
      [3, 3],
      [3, 2],
    ]),
  },
  {
    id: "lowland-process-group",
    name: "Lowland Process Group",
    coachTeam: "Capybara",
    healthHistory: toHistory([
      [5, 5],
      [5, 5],
      [5, 5],
      [5, 5],
      [5, 5],
      [5, 5],
    ]),
  },
  {
    id: "irongate-enterprises",
    name: "IronGate Enterprises",
    coachTeam: "Wombat",
    healthHistory: toHistory([
      [3, 3],
      [3, 3],
      [4, 3],
      [4, 4],
      [5, 5],
      [5, 4],
    ]),
  },
  {
    id: "keystone-materials-collective",
    name: "Keystone Materials Collective",
    coachTeam: "Capybara",
    healthHistory: toHistory([
      [5, 5],
      [5, 5],
      [5, 5],
      [5, 5],
      [5, 5],
      [5, 5],
    ]),
  },
  {
    id: "loftin",
    name: "Loftin",
    coachTeam: "Wombat",
    healthHistory: toHistory([
      [5, 5],
      [5, 5],
      [5, 5],
      [5, 4],
      [5, 5],
      [5, 5],
    ]),
  },
  {
    id: "vege-labs",
    name: "Vege Labs",
    coachTeam: "Wombat",
    healthHistory: toHistory([
      [4, 3],
      [3, 2],
      [2, 1],
      [1, 1],
      [1, 1],
      [2, 2],
    ]),
  },
  {
    id: "magline",
    name: "Magline",
    coachTeam: "Wombat",
    healthHistory: toHistory([
      [3, 3],
      [3, 2],
      [2, 2],
      [2, 1],
      [1, 1],
      [2, 2],
    ]),
  },
  {
    id: "airpro",
    name: "AirPro",
    coachTeam: "Wombat",
    healthHistory: toHistory([
      [4, 4],
      [5, 5],
      [5, 5],
      [5, 5],
      [5, 5],
      [4, 4],
    ]),
  },
  {
    id: "ecosphere",
    name: "Ecosphere",
    coachTeam: "House",
    healthHistory: toHistory([
      [5, 5],
      [5, 5],
      [5, 4],
      [5, 5],
      [5, 4],
      [5, 4],
    ]),
  },
  {
    id: "wiscon-products",
    name: "Wiscon Products",
    coachTeam: "Unassigned",
    healthHistory: toHistory([
      [3, 4],
      [3, 3],
      [4, 3],
      [4, 4],
      [4, 3],
      [4, 4],
    ]),
  },
  {
    id: "towa",
    name: "TOWA",
    coachTeam: "Unassigned",
    healthHistory: toHistory([
      [4, 4],
      [2, 3],
      [3, 4],
      [4, 5],
      [3, 4],
      [5, 5],
    ]),
  },
];
