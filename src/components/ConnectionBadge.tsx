type ConnectionStatus = "connected" | "disconnected" | "unknown";

const STYLES: Record<ConnectionStatus, string> = {
  connected: "bg-emerald-500/15 text-emerald-400",
  disconnected: "bg-red-500/15 text-red-400",
  unknown: "bg-slate-500/15 text-slate-400",
};

const LABELS: Record<ConnectionStatus, string> = {
  connected: "Connected",
  disconnected: "Disconnected",
  unknown: "Unknown",
};

export default function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}>{LABELS[status]}</span>
  );
}
