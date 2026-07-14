import { createMockAdapter } from "../mock/factory";

export const leaderMockAdapter = createMockAdapter({
  provider: "leader",
  companyNames: ["Summit Line Logistics", "Redwood Carriers"],
  dutyStatusVocab: {
    driving: "DRIVING",
    onDuty: "ON_DUTY",
    offDuty: "OFF_DUTY",
    sleeper: "SLEEPER",
  },
  violationVocab: {
    driveTime: "DRIVE_TIME_EXCEEDED",
    dutyTime: "DUTY_TIME_EXCEEDED",
    breakRequired: "BREAK_REQUIRED",
    cycleLimit: "CYCLE_LIMIT_EXCEEDED",
  },
});
