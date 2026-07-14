export type ConnectionStatus = "connected" | "disconnected" | "unknown";

export type ConnectionChangeEvent = "connected" | "disconnected" | null;

// Pure diff: the previously stored status *is* the last snapshot, so no
// separate history table lookup is needed to detect a transition.
export function detectConnectionChange(
  previousStatus: ConnectionStatus,
  newStatus: ConnectionStatus
): ConnectionChangeEvent {
  if (newStatus === "unknown" || newStatus === previousStatus) return null;
  return newStatus;
}
