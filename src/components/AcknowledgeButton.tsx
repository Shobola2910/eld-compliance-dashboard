"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AcknowledgeButton({ alertId }: { alertId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await fetch(`/api/alerts/${alertId}/acknowledge`, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
    >
      {loading ? "..." : "Acknowledge"}
    </button>
  );
}
