import { getOwnerUserId } from "@/lib/auth";
import { getOwnerSettings } from "@/lib/get-settings";
import Dashboard from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const userId = await getOwnerUserId();
  const settings = await getOwnerSettings(userId);

  return (
    <Dashboard
      displayName={settings?.displayName ?? "Vaishnavi"}
      image={settings?.profileImage || undefined}
    />
  );
}
