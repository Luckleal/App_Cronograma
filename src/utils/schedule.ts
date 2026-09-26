import { ScheduleEntry } from '../types';
import { addDays, compareISODate, startOfWeekISO, todayISO } from './date';

const MAX_ENTRY_SPAN_DAYS = 366;

// Warn once per entry (not on every render/expansion) when its span gets
// clipped, so the console doesn't get spammed by repeated calendar renders.
const warnedTruncatedEntryIds = new Set<string>();

export function sortEntries(entries: ScheduleEntry[]): ScheduleEntry[] {
  return [...entries].sort((a, b) => {
    const dateCompare = compareISODate(a.startDate, b.startDate);
    if (dateCompare !== 0) return dateCompare;
    return (a.startTime ?? '').localeCompare(b.startTime ?? '');
  });
}

export function isMultiDay(entry: ScheduleEntry): boolean {
  return entry.startDate !== entry.endDate;
}

function expandEntryDates(entry: ScheduleEntry): string[] {
  const dates: string[] = [];
  let cursor = entry.startDate;
  let i = 0;
  for (; i < MAX_ENTRY_SPAN_DAYS && compareISODate(cursor, entry.endDate) <= 0; i++) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  if (
    i === MAX_ENTRY_SPAN_DAYS &&
    compareISODate(cursor, entry.endDate) <= 0 &&
    !warnedTruncatedEntryIds.has(entry.id)
  ) {
    warnedTruncatedEntryIds.add(entry.id);
    console.warn(
      `Atividade "${entry.title}" (${entry.id}) tem intervalo maior que ${MAX_ENTRY_SPAN_DAYS} dias; exibição no calendário foi limitada a esse período.`
    );
  }
  return dates;
}

export function entriesForDate(entries: ScheduleEntry[], dateISO: string): ScheduleEntry[] {
  return sortEntries(
    entries.filter(
      (e) => compareISODate(e.startDate, dateISO) <= 0 && compareISODate(e.endDate, dateISO) >= 0
    )
  );
}

export function upcomingEntries(entries: ScheduleEntry[], limit = 5): ScheduleEntry[] {
  const today = todayISO();
  return sortEntries(entries.filter((e) => compareISODate(e.endDate, today) >= 0)).slice(0, limit);
}

export function groupEntriesByDate(
  entries: ScheduleEntry[]
): { date: string; entries: ScheduleEntry[] }[] {
  const byDate = new Map<string, ScheduleEntry[]>();
  for (const entry of entries) {
    for (const date of expandEntryDates(entry)) {
      const list = byDate.get(date) ?? [];
      list.push(entry);
      byDate.set(date, list);
    }
  }
  return [...byDate.keys()]
    .sort(compareISODate)
    .map((date) => ({ date, entries: sortEntries(byDate.get(date)!) }));
}

export function groupEntriesByWeek(
  entries: ScheduleEntry[]
): { weekStart: string; weekEnd: string; days: { date: string; entries: ScheduleEntry[] }[] }[] {
  const byDate = groupEntriesByDate(entries);
  const weeks: {
    weekStart: string;
    weekEnd: string;
    days: { date: string; entries: ScheduleEntry[] }[];
  }[] = [];
  for (const day of byDate) {
    const weekStart = startOfWeekISO(day.date);
    const last = weeks[weeks.length - 1];
    if (last && last.weekStart === weekStart) {
      last.days.push(day);
    } else {
      weeks.push({ weekStart, weekEnd: addDays(weekStart, 6), days: [day] });
    }
  }
  return weeks;
}
