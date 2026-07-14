"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  provider: "leader" | "factor" | "nexus";
  label: string;
}

const PROVIDER_ICONS: Record<Props["provider"], string> = {
  leader: "/leader-eld.ico",
  factor: "/factor-eld.ico",
  nexus: "/nexus-eld.ico",
};

interface TokenStatus {
  saved: boolean;
  isValid?: boolean;
  tokenVersion?: string;
  lastValidatedAt?: string | null;
}

export default function TokenAuthTabs({ provider, label }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"v1" | "v2">("v2");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<TokenStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/tokens/${provider}`)
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, [provider]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/tokens/${provider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, tokenVersion: tab }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save token");
        return;
      }
      setSuccess("Token saved. Sync starting in the background.");
      setToken("");
      const refreshed = await fetch(`/api/tokens/${provider}`).then((r) => r.json());
      setStatus(refreshed);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-slate-800 bg-[#111623] p-6 shadow-xl">
      <div className="flex flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PROVIDER_ICONS[provider]} alt={`${label} logo`} className="mb-3 h-12 w-12 rounded-lg" />
        <h2 className="text-base font-semibold text-slate-100">{label} Automations</h2>
        <p className="mt-1 text-sm text-slate-400">Sign in to continue to your dashboard</p>
      </div>

      {status?.saved && (
        <div className="mt-4 rounded-md border border-slate-700 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
          {status.isValid ? "Token saved" : "Token saved but marked invalid"}
          {status.lastValidatedAt && ` — last validated ${new Date(status.lastValidatedAt).toLocaleString()}`}
        </div>
      )}

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-slate-400">API version</p>
        <div className="flex rounded-md border border-slate-700 p-1">
          <button
            type="button"
            onClick={() => setTab("v1")}
            className={`flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition ${
              tab === "v1" ? "bg-slate-700 text-slate-100" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            v1 Login
          </button>
          <button
            type="button"
            onClick={() => setTab("v2")}
            className={`flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition ${
              tab === "v2" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            v2 Token
          </button>
        </div>
      </div>

      {tab === "v1" ? (
        <p className="mt-4 text-sm text-slate-500">
          Legacy username/password login isn&apos;t wired up here — switch to <strong>v2 Token</strong> and paste a
          bearer token instead.
        </p>
      ) : (
        <form onSubmit={handleSave} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Bearer token</label>
            <textarea
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              rows={4}
              placeholder="Paste Bearer token here..."
              className="w-full rounded-md border border-slate-700 bg-[#0b0e14] px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              This token will be used for {label} dashboard access and encrypted at rest.
            </p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {success && <p className="text-sm text-emerald-400">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Token"}
          </button>
        </form>
      )}
    </div>
  );
}
