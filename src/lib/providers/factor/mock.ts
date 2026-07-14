import { createMockAdapter } from "../mock/factory";

export const factorMockAdapter = createMockAdapter({
  provider: "factor",
  companyNames: ["Prairie Star Trucking", "Northgate Freight"],
  dutyStatusVocab: {
    driving: "D",
    onDuty: "ON",
    offDuty: "OFF",
    sleeper: "SB",
  },
  violationVocab: {
    driveTime: "11H",
    dutyTime: "14H",
    breakRequired: "30MIN",
    cycleLimit: "70H",
  },
});
