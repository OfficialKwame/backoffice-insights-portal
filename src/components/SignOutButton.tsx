"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="print:hidden rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
    >
      Sign out
    </button>
  );
}