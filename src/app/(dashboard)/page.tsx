import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { providerTokens } from "@/lib/db/schema";
import { PROVIDERS, PROVIDER_LABELS } from "@/lib/providers/registry";
import type { Provider } from "@/lib/providers/types";
import ProviderTabs from "@/components/ProviderTabs";
import ProviderDriverTable from "@/components/ProviderDriverTable";
import TokenAuthTabs from "@/components/TokenAuthTabs";

export const dynamic = "force-dynamic";

function parseProvider(value: string | undefined): Provider {
  return PROVIDERS.includes(value as Provider) ? (value as Provider) : PROVIDERS[0];
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string }>;
}) {
  const { provider: providerParam } = await searchParams;
  const provider = parseProvider(providerParam);

  const [tokenRow] = await db.select().from(providerTokens).where(eq(providerTokens.provider, provider));
  const isConnected = !!tokenRow?.isValid;

  return (
    <div>
      <ProviderTabs active={provider} />

      <div key={provider} className="mt-6 animate-fade-in">
        {isConnected ? (
          <>
            <h1 className="text-lg font-semibold text-slate-100">{PROVIDER_LABELS[provider]} drivers</h1>
            <p className="mt-1 text-sm text-slate-400">Synced automatically from your {PROVIDER_LABELS[provider]} token.</p>
            <ProviderDriverTable provider={provider} />
          </>
        ) : (
          <div className="flex justify-center pt-8">
            <TokenAuthTabs provider={provider} label={PROVIDER_LABELS[provider]} />
          </div>
        )}
      </div>
    </div>
  );
}
