"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LoginButton() {
  const params = useSearchParams();
  const denied = params.get("error") === "AccessDenied";

  return (
    <div className="space-y-3">
      {denied && (
        <p className="text-xs text-danger bg-danger/10 border border-danger/30 rounded-md px-3 py-2">
          That Google account isn&apos;t authorised for this console.
        </p>
      )}
      <Button
        className="w-full"
        onClick={() => signIn("google", { callbackUrl: "/" })}
      >
        Continue with Google
      </Button>
    </div>
  );
}
