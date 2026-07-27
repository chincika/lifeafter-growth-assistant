export type DateOnly = `${number}-${number}-${number}`;

export interface ActivityPeriod {
  start: DateOnly;
  end: DateOnly;
}

export type ActivityStatus = "upcoming" | "active" | "ended";

const MILLISECONDS_PER_DAY = 86_400_000;

export function toUtcDay(date: DateOnly): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new RangeError(`Invalid date-only value: ${date}`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid calendar date: ${date}`);
  }

  return timestamp / MILLISECONDS_PER_DAY;
}

export function differenceInCalendarDays(later: DateOnly, earlier: DateOnly): number {
  return toUtcDay(later) - toUtcDay(earlier);
}

export function inclusiveActivityDays(period: ActivityPeriod): number {
  const days = differenceInCalendarDays(period.end, period.start) + 1;
  if (days <= 0) throw new RangeError("Activity end must not precede its start");
  return days;
}

export function getActivityStatus(today: DateOnly, period: ActivityPeriod): ActivityStatus {
  const todayDay = toUtcDay(today);
  const startDay = toUtcDay(period.start);
  const endDay = toUtcDay(period.end);
  if (endDay < startDay) throw new RangeError("Activity end must not precede its start");
  if (todayDay < startDay) return "upcoming";
  if (todayDay > endDay) return "ended";
  return "active";
}
