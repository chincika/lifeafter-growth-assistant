import type { AppSettings } from "./user-data-service.js";

const clientUpdateIntervals: Record<AppSettings["clientUpdateFrequency"], number> = {
  launch: 0,
  daily: 86_400_000,
  weekly: 604_800_000,
  monthly: 2_592_000_000,
  never: Number.POSITIVE_INFINITY,
};

export function planUpdateChecks(input: {
  clientUpdateFrequency: AppSettings["clientUpdateFrequency"];
  lastClientCheck: number;
  now: number;
  manualClientCheck: boolean;
}) {
  return {
    clientCheckDue:
      input.manualClientCheck ||
      input.now - input.lastClientCheck >= clientUpdateIntervals[input.clientUpdateFrequency],
    contentCheckDue: !input.manualClientCheck,
  };
}
