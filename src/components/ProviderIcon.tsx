import type { Provider } from "@/lib/providers/types";

const PROVIDER_ICON_SRC: Record<Provider, string> = {
  leader: "/leader-eld.ico",
  factor: "/factor-eld.ico",
  nexus: "/nexus-eld.ico",
};

const SIZE_CLASSES = {
  sm: "h-5 w-5 rounded-md",
  md: "h-8 w-8 rounded-lg",
  lg: "h-14 w-14 rounded-xl",
} as const;

export default function ProviderIcon({
  provider,
  size = "sm",
}: {
  provider: Provider;
  size?: keyof typeof SIZE_CLASSES;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={PROVIDER_ICON_SRC[provider]}
      alt=""
      className={`${SIZE_CLASSES[size]} shrink-0 border border-slate-700/70 bg-slate-900/40 object-cover shadow-sm`}
    />
  );
}
