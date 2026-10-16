/**
 * Publish-slot scheduling in a named time zone without a date library.
 * A slot is weekday ∈ config.weekdays at config.publishHour:00 local time.
 */

/** Offset (minutes) of `timeZone` from UTC at the given instant, e.g. -240 for EDT. */
export function tzOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/** UTC instant for a local wall-clock time in `timeZone` (handles DST transitions). */
export function zonedTimeToUtc(y: number, m: number, d: number, hour: number, timeZone: string): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, hour, 0, 0));
  const offset1 = tzOffsetMinutes(guess, timeZone);
  const first = new Date(guess.getTime() - offset1 * 60000);
  const offset2 = tzOffsetMinutes(first, timeZone);
  return offset1 === offset2 ? first : new Date(guess.getTime() - offset2 * 60000);
}

/** Local calendar date (y, m, d, ISO weekday 1–7) of an instant in `timeZone`. */
export function localDate(instant: Date, timeZone: string): { y: number; m: number; d: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday")) + 1;
  return { y: Number(get("year")), m: Number(get("month")), d: Number(get("day")), weekday: wd };
}

export interface SlotConfig {
  weekdays: number[];
  publishHour: number;
  timezone: string;
}

/**
 * First slot strictly after `now + minLeadHours` that is not already taken
 * (taken = any existing publish time within the same local day).
 */
export function nextPublishSlot(taken: string[], cfg: SlotConfig, now = new Date(), minLeadHours = 2): Date {
  const takenDays = new Set(
    taken.map((iso) => {
      const l = localDate(new Date(iso), cfg.timezone);
      return `${l.y}-${l.m}-${l.d}`;
    })
  );
  const earliest = now.getTime() + minLeadHours * 3600_000;
  for (let i = 0; i < 400; i++) {
    const day = new Date(now.getTime() + i * 86400_000);
    const l = localDate(day, cfg.timezone);
    if (!cfg.weekdays.includes(l.weekday)) continue;
    if (takenDays.has(`${l.y}-${l.m}-${l.d}`)) continue;
    const slot = zonedTimeToUtc(l.y, l.m, l.d, cfg.publishHour, cfg.timezone);
    if (slot.getTime() <= earliest) continue;
    return slot;
  }
  throw new Error("No free publish slot within 400 days");
}
