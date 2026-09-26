import { combineDateAndTime, isValidISODate, isValidTime } from '../src/utils/date';

describe('isValidISODate', () => {
  it.each(['2024-02-29', '2000-02-29', '2026-01-31', '2026-12-31'])('aceita %s', (value) => {
    expect(isValidISODate(value)).toBe(true);
  });

  it.each(['2025-02-29', '1900-02-29', '2026-02-31', '2026-04-31', '2026-00-10', '2026-13-10', '2026-01-00', '2026-1-01', '31/02/2026', '', null, undefined])('rejeita %s', (value) => {
    expect(isValidISODate(value)).toBe(false);
  });
});

describe('isValidTime', () => {
  it.each(['00:00', '12:30', '23:59'])('aceita %s', (value) => {
    expect(isValidTime(value)).toBe(true);
  });

  it.each(['24:00', '23:60', '7:00', '00:00:00', '-1:00', ' 00:00', '', null, undefined])('rejeita %s', (value) => {
    expect(isValidTime(value)).toBe(false);
  });

  it('combina meia-noite preservando o dia local', () => {
    const date = combineDateAndTime('2024-02-29', '00:00');
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()])
      .toEqual([2024, 1, 29, 0, 0]);
  });
});
