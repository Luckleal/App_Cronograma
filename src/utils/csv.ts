import { Module, ScheduleEntry, StudyLocation } from '../types';
import { formatDateFullPt } from './date';
import { sortEntries } from './schedule';

const CSV_HEADERS = [
  'Data início',
  'Data fim',
  'Horário início',
  'Horário fim',
  'Título',
  'Local',
  'Endereço',
  'Módulo',
  'Observações',
];

// Prefix formula-triggering characters with ' so spreadsheet apps treat the
// field as text instead of evaluating it (CSV formula injection).
function neutralizeFormula(value: string): string {
  return /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
}

function escapeCsvField(value: string): string {
  const safe = neutralizeFormula(value);
  if (/[",\n\r;]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function toRow(values: string[]): string {
  return values.map(escapeCsvField).join(',');
}

export function buildEntriesCsv(
  entries: ScheduleEntry[],
  locations: StudyLocation[],
  modules: Module[]
): string {
  const locationById = new Map(locations.map((l) => [l.id, l]));
  const moduleById = new Map(modules.map((m) => [m.id, m]));

  const rows = sortEntries(entries).map((entry) => {
    const location = entry.locationId ? locationById.get(entry.locationId) : undefined;
    const module = entry.moduleId ? moduleById.get(entry.moduleId) : undefined;
    return toRow([
      formatDateFullPt(entry.startDate),
      formatDateFullPt(entry.endDate),
      entry.startTime ?? '',
      entry.endTime ?? '',
      entry.title,
      location?.name ?? '',
      location?.address ?? '',
      module?.name ?? '',
      entry.notes ?? '',
    ]);
  });

  // Leading BOM so Excel opens accented characters correctly.
  return `﻿${[toRow(CSV_HEADERS), ...rows].join('\r\n')}`;
}
