import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { AdminShell } from "@/components/shell/admin-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware already gates this route group; this is the second,
  // server-rendered check so a protected page never even flashes
  // without a valid session first.
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <AuthSessionProvider session={session}>
      <AdminShell>{children}</AdminShell>
    </AuthSessionProvider>
  );
}
