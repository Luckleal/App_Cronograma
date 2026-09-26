import { ScheduleEntry } from '../src/types';
import {
  entriesForDate,
  groupEntriesByDate,
  groupEntriesByWeek,
  sortEntries,
} from '../src/utils/schedule';

const makeEntry = (patch: Partial<ScheduleEntry> = {}): ScheduleEntry => ({
  id: 'a',
  title: 'Aula',
  startDate: '2026-01-04',
  endDate: '2026-01-05',
  ...patch,
});

afterEach(() => jest.restoreAllMocks());

it('agrupa intervalo inclusivo e ordena atividades sem alterar entrada', () => {
  const late = makeEntry({ id: 'late', startTime: '15:00' });
  const early = makeEntry({ id: 'early', startTime: '08:00' });
  const entries = [late, early];
  expect(groupEntriesByDate(entries)).toEqual([
    { date: '2026-01-04', entries: [early, late] },
    { date: '2026-01-05', entries: [early, late] },
  ]);
  expect(entries).toEqual([late, early]);
  expect(sortEntries(entries)).toEqual([early, late]);
});

it('separa domingo e segunda nas semanas corretas, inclusive na virada do ano', () => {
  const entry = makeEntry();
  expect(groupEntriesByWeek([entry])).toEqual([
    {
      weekStart: '2025-12-29',
      weekEnd: '2026-01-04',
      days: [{ date: '2026-01-04', entries: [entry] }],
    },
    {
      weekStart: '2026-01-05',
      weekEnd: '2026-01-11',
      days: [{ date: '2026-01-05', entries: [entry] }],
    },
  ]);
});

it('retorna grupos vazios quando nao ha atividades', () => {
  expect(groupEntriesByDate([])).toEqual([]);
  expect(groupEntriesByWeek([])).toEqual([]);
});

it('expande exatamente 366 dias sem aviso, incluindo 29 de fevereiro', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const days = groupEntriesByDate([
    makeEntry({ id: '366', startDate: '2024-01-01', endDate: '2024-12-31' }),
  ]);
  expect(days).toHaveLength(366);
  expect(days[59].date).toBe('2024-02-29');
  expect(days[365].date).toBe('2024-12-31');
  expect(warn).not.toHaveBeenCalled();
});

it('limita intervalo longo a 366 dias e avisa uma unica vez por atividade', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const entry = makeEntry({ id: 'long-span', startDate: '2024-01-01', endDate: '2025-12-31' });
  expect(groupEntriesByDate([entry])).toHaveLength(366);
  expect(groupEntriesByDate([entry])).toHaveLength(366);
  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('366'));
  expect(entriesForDate([entry], '2025-12-31')).toEqual([entry]);
  expect(entriesForDate([entry], '2026-01-01')).toEqual([]);
});
