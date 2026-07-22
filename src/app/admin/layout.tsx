import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

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
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </AuthSessionProvider>
  );
}
