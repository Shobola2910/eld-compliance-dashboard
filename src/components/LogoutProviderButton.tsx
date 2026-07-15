"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutProviderButton({
  provider,
  label,
}: {
  provider: "leader" | "factor" | "nexus";
  label: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!confirm(`Disconnect ${label}? You'll need to paste the token again to reconnect.`)) return;
    setLoading(true);
    try {
      await fetch(`/api/tokens/${provider}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
    >
      {loading ? "..." : "Log out"}
    </button>
  );
}
