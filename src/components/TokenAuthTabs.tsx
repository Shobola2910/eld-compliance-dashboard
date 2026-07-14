"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProviderIcon from "@/components/ProviderIcon";

interface Props {
  provider: "leader" | "factor" | "nexus";
  label: string;
}

interface TokenStatus {
  saved: boolean;
  isValid?: boolean;
  tokenVersion?: string;
  lastValidatedAt?: string | null;
  hasTenantId?: boolean;
}

// Factor ELD's real API also requires a stable per-account tenant_id header
// alongside the bearer token (see DevTools -> that same request's Request
// Headers). Other providers don't need this yet.
const PROVIDERS_NEEDING_TENANT_ID: Props["provider"][] = ["factor"];

export default function TokenAuthTabs({ provider, label }: Props) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [status, setStatus] = useState<TokenStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const needsTenantId = PROVIDERS_NEEDING_TENANT_ID.includes(provider);

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
        body: JSON.stringify({ token, tenantId: tenantId || undefined, tokenVersion: "v2" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save token");
        return;
      }
      setSuccess("Token saved. Sync starting in the background.");
      setToken("");
      setTenantId("");
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
        <ProviderIcon provider={provider} size="lg" />
        <h2 className="mt-3 text-base font-semibold text-slate-100">{label} Automations</h2>
        <p className="mt-1 text-sm text-slate-400">Paste your token to connect</p>
      </div>

      {status?.saved && (
        <div className="mt-4 rounded-md border border-slate-700 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
          {status.isValid ? "Token saved" : "Token saved but marked invalid"}
          {status.lastValidatedAt && ` — last validated ${new Date(status.lastValidatedAt).toLocaleString()}`}
        </div>
      )}

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

        {needsTenantId && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Tenant ID</label>
            <input
              required
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="e.g. 96335ac3-5a93-4a29-af8b-08d874801325"
              className="w-full rounded-md border border-slate-700 bg-[#0b0e14] px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              {label} also requires this. In DevTools → Network, open any API request and copy the{" "}
              <code className="text-slate-400">tenant_id</code> request header value.
            </p>
          </div>
        )}

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
    </div>
  );
}
