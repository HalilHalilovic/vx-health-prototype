import { fetchClients } from "@/lib/data";
import { getCurrentWeekStart } from "@/lib/health-utils";
import { Dashboard } from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { clients, source } = await fetchClients();
  const currentWeekStart = getCurrentWeekStart();

  return (
    <Dashboard
      initialClients={clients}
      initialDataSource={source}
      currentWeekStart={currentWeekStart}
    />
  );
}
