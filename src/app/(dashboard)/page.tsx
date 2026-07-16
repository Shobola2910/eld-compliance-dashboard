import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { providerTokens } from "@/lib/db/schema";
import { PROVIDERS, PROVIDER_LABELS } from "@/lib/providers/registry";
import type { Provider } from "@/lib/providers/types";
import ProviderTabSlider, { type ProviderPanel } from "@/components/ProviderTabSlider";
import ProviderDriverTable from "@/components/ProviderDriverTable";
import TokenAuthTabs from "@/components/TokenAuthTabs";
import ProviderActionPanel from "@/components/ProviderActionPanel";
import SyncSummary from "@/components/SyncSummary";
import { getLatestSyncSummary } from "@/lib/pipeline/syncSummary";

export const dynamic = "force-dynamic";

function parseProvider(value: string | undefined): Provider {
  return PROVIDERS.includes(value as Provider) ? (value as Provider) : PROVIDERS[0];
}

async function buildPanel(provider: Provider): Promise<ProviderPanel> {
  const [tokenRow] = await db.select().from(providerTokens).where(eq(providerTokens.provider, provider));
  const isConnected = !!tokenRow?.isValid;
  const syncSummary = isConnected ? await getLatestSyncSummary(provider) : null;

  return {
    provider,
    content: isConnected ? (
      <>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">{PROVIDER_LABELS[provider]} drivers</h1>
            <p className="mt-1 text-sm text-slate-400">Synced automatically from your {PROVIDER_LABELS[provider]} token.</p>
          </div>
          <ProviderActionPanel provider={provider} />
        </div>
        {syncSummary && <SyncSummary summary={syncSummary} />}
        <ProviderDriverTable provider={provider} />
      </>
    ) : (
      <div className="flex justify-center pt-8">
        <TokenAuthTabs provider={provider} label={PROVIDER_LABELS[provider]} />
      </div>
    ),
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string }>;
}) {
  const { provider: providerParam } = await searchParams;
  const initialProvider = parseProvider(providerParam);

  const panels = await Promise.all(PROVIDERS.map(buildPanel));

  return <ProviderTabSlider initialProvider={initialProvider} panels={panels} />;
}
