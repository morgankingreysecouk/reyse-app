import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginButton } from "./login-button";
import { Logo } from "@/components/shell/logo";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/admin");

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-indigo mb-8">
          <Logo className="scale-150 mb-3" />
          <div className="font-display font-bold text-ink text-lg tracking-wide">
            REYSE
          </div>
          <div className="text-xs text-ink-muted mt-0.5">Admin console</div>
        </div>

        <div className="rounded-xl border border-border bg-surface px-6 py-8 text-center">
          <h1 className="font-display text-base font-semibold text-ink mb-1.5">
            Sign in
          </h1>
          <p className="text-sm text-ink-muted mb-6">
            Restricted to the Reyse admin account.
          </p>
          <LoginButton />
        </div>
      </div>
    </div>
  );
}
