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
        className="flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
          <polygon points="6 3 20 12 6 21 6 3" />
        </svg>
        {checking ? "Running..." : "Run"}
      </button>
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        {loggingOut ? "..." : "Logout"}
      </button>
    </div>
  );
}
