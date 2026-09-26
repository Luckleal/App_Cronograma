import { monthNamesPt, weekdayNamesPt, weekdayShortPt } from '../theme';

// All date-only values in this app are ISO strings "yyyy-MM-dd" and are always
// parsed/formatted using LOCAL date components (never `new Date(isoString)`,
// which parses as UTC and can shift the day in negative-offset timezones like BRT).

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function compareISODate(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isTodayISO(iso: string): boolean {
  return iso === todayISO();
}

export function isPastISO(iso: string): boolean {
  return compareISODate(iso, todayISO()) < 0;
}

export function weekdayShort(iso: string): string {
  return weekdayShortPt[parseISODate(iso).getDay()];
}

export function weekdayLong(iso: string): string {
  return weekdayNamesPt[parseISODate(iso).getDay()];
}

export function formatDatePt(iso: string): string {
  const date = parseISODate(iso);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function formatDateLongPt(iso: string): string {
  const date = parseISODate(iso);
  return `${date.getDate()} de ${monthNamesPt[date.getMonth()]}`;
}

export function formatDateFullPt(iso: string): string {
  const date = parseISODate(iso);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

// Returns the ISO date of the Monday that starts the week containing `iso`.
export function startOfWeekISO(iso: string): string {
  const date = parseISODate(iso);
  const day = date.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diffToMonday);
  return toISODate(date);
}

export function combineDateAndTime(dateISO: string, time?: string): Date {
  const date = parseISODate(dateISO);
  if (time) {
    const [h, min] = time.split(':').map(Number);
    date.setHours(h ?? 0, min ?? 0, 0, 0);
  }
  return date;
}

export function isFutureDateTime(dateISO: string, time?: string): boolean {
  return combineDateAndTime(dateISO, time).getTime() > Date.now();
}

export function formatTimeRange(start?: string, end?: string): string {
  if (!start && !end) return '';
  if (start && end) return `${start} - ${end}`;
  return start ?? end ?? '';
}

// Rejects malformed strings and calendar-impossible dates (e.g. "2026-02-31",
// which `new Date` would silently roll over to 2026-03-03).
export function isValidISODate(iso: string | undefined | null): iso is string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function isValidTime(time: string | undefined | null): time is string {
  if (!time) return false;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}
