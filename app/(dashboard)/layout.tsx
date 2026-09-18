import { getOwnerUserId } from "@/lib/auth";
import { getOwnerSettings } from "@/lib/get-settings";
import AppShell from "@/components/app-shell";
import ThemeHydrator from "@/components/theme-hydrator";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const userId = await getOwnerUserId();
  const settings = await getOwnerSettings(userId);

  return (
    <>
      <ThemeHydrator theme={settings?.theme ?? "rose"} />
      <AppShell>{children}</AppShell>
    </>
  );
}
