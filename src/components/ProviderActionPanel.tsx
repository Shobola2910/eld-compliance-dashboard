"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ProviderActionPanel({ provider }: { provider: "leader" | "factor" | "nexus" }) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleCheck() {
    setChecking(true);
    try {
      await fetch(`/api/sync/provider/${provider}`, { method: "POST" });
      router.refresh();
    } finally {
      setChecking(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch(`/api/tokens/${provider}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleCheck}
        disabled={checking}
        className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-1.5 text-sm font-semibold text-white shadow-[0_0_12px_-2px_rgba(168,85,247,0.6)] transition hover:brightness-110 disabled:opacity-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="M6.3 2.841A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.269l9.344-5.89a1.5 1.5 0 0 0 0-2.538L6.3 2.84Z" />
        </svg>
        {checking ? "Checking..." : "Check"}
      </button>
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-600 to-pink-600 px-4 py-1.5 text-sm font-semibold text-white shadow-[0_0_12px_-2px_rgba(220,38,38,0.5)] transition hover:brightness-110 disabled:opacity-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path
            fillRule="evenodd"
            d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z"
            clipRule="evenodd"
          />
          <path
            fillRule="evenodd"
            d="M6 10a.75.75 0 0 1 .75-.75h9.546l-1.048-.943a.75.75 0 1 1 1.004-1.114l2.5 2.25a.75.75 0 0 1 0 1.114l-2.5 2.25a.75.75 0 1 1-1.004-1.114l1.048-.943H6.75A.75.75 0 0 1 6 10Z"
            clipRule="evenodd"
          />
        </svg>
        {loggingOut ? "..." : "Logout"}
      </button>
    </div>
  );
}
