/** Small date helpers. Days travel between the app and the API as "2026-04-03". */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A local calendar day as "2026-04-03". */
export function toISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** "2026-04-03" as a local date at midnight. */
export function fromISODate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function today(): string {
  return toISODate(new Date());
}

export function addDays(day: string, count: number): string {
  const date = fromISODate(day);
  date.setDate(date.getDate() + count);
  return toISODate(date);
}

/** Whole days from one day to another; negative when "to" is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((fromISODate(to).getTime() - fromISODate(from).getTime()) / 86_400_000);
}

/** "3 Apr", or "3 Apr 2025" when it isn't this year. */
export function formatDay(day: string): string {
  const date = fromISODate(day);
  const short = `${date.getDate()} ${MONTHS[date.getMonth()]!.slice(0, 3)}`;
  return date.getFullYear() === new Date().getFullYear() ? short : `${short} ${date.getFullYear()}`;
}

/** "Today", "Yesterday" or "1 April". */
export function formatDayLong(day: string): string {
  const diff = daysBetween(day, today());
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const date = fromISODate(day);
  const long = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === new Date().getFullYear() ? long : `${long} ${date.getFullYear()}`;
}

export function monthTitle(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

/** "just now", "5 min ago", "2h ago", "yesterday", "4 days ago" or a date. */
export function timeAgo(instant: string, now: Date = new Date()): string {
  const then = new Date(instant);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = daysBetween(toISODate(then), toISODate(now));
  if (days <= 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDay(toISODate(then));
}

/**
 * The moment to store for an entry on a given day: the moment it was written when that was on that day,
 * midday for any other day. `written` is now unless the entry waited on the phone: then it is when it was
 * written, not when it finally went up.
 * The API keeps both the day (for "Day 14") and the moment (for ordering within a day).
 */
export function momentFor(day: string, written: Date = new Date()): string {
  if (!Number.isNaN(written.getTime()) && day === toISODate(written)) return written.toISOString();
  const date = fromISODate(day);
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
}
