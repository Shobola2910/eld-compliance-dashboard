import { createMockAdapter } from "../mock/factory";

export const nexusMockAdapter = createMockAdapter({
  provider: "nexus",
  companyNames: ["Cascade Point Carriers", "Ironwood Transport"],
  dutyStatusVocab: {
    driving: "driving",
    onDuty: "on_duty",
    offDuty: "off_duty",
    sleeper: "sleeper_berth",
  },
  violationVocab: {
    driveTime: "hos.drive_time",
    dutyTime: "hos.duty_time",
    breakRequired: "hos.break_required",
    cycleLimit: "hos.cycle_limit",
  },
});
