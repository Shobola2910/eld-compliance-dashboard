import type { Provider } from "./types";

interface ExternalDriverLinkInput {
  providerCompanyId: string;
  providerDriverId: string;
  name: string;
  truckNumber: string | null;
}

// Returns a deep link straight into the driver's real log view on the
// provider's own web app, or null if we don't know that provider's URL
// pattern yet (falls back to our internal /drivers/[id] page in that case).
export function buildExternalDriverUrl(provider: Provider, driver: ExternalDriverLinkInput): string | null {
  switch (provider) {
    case "factor": {
      // Confirmed via DevTools against the real app.factoreld.com:
      // https://app.factoreld.com/{companyId}/driver/hos/graphs?driverId={driverId}&driverName=...&tab=list
      const params = new URLSearchParams({
        driverId: driver.providerDriverId,
        driverName: driver.name,
        tab: "list",
      });
      if (driver.truckNumber) params.set("vehicleNumber", driver.truckNumber);
      return `https://app.factoreld.com/${driver.providerCompanyId}/driver/hos/graphs?${params.toString()}`;
    }
    case "leader":
    case "nexus":
    default:
      return null;
  }
}
