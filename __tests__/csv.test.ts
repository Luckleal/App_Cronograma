import { buildEntriesCsv } from '../src/utils/csv';
import { ScheduleEntry } from '../src/types';

const entry: ScheduleEntry = { id: 'csv', title: 'Aula', startDate: '2026-02-01', endDate: '2026-02-01' };

describe('buildEntriesCsv', () => {
  it.each([
    ['Aula, pratica', '"Aula, pratica"'],
    ['Aula "especial"', '"Aula ""especial"""'],
    ['linha\nseguinte', '"linha\nseguinte"'],
    ['linha\rseguinte', '"linha\rseguinte"'],
    ['linha\r\nseguinte', '"linha\r\nseguinte"'],
    ['Educação e ação', 'Educação e ação'],
    ['=1+1', "'=1+1"],
    [' \t=1+1', "' \t=1+1"],
  ])('escapa o campo %j', (title, expected) => {
    const csv = buildEntriesCsv([{ ...entry, title }], [], []);
    expect(csv.slice(csv.indexOf('\r\n') + 2)).toBe(`01/02/2026,01/02/2026,,,${expected},,,,`);
  });

  it('inclui BOM, cabecalho acentuado e dados associados escapados', () => {
    const csv = buildEntriesCsv([{ ...entry, locationId: 'l', moduleId: 'm', notes: 'Observação, útil' }],
      [{ id: 'l', name: 'Clínica', address: 'Rua "A"', color: '#fff' }],
      [{ id: 'm', name: 'Módulo 1', startDate: entry.startDate, endDate: entry.endDate, color: '#fff' }]);
    expect(csv.startsWith('\uFEFFData início,Data fim,Horário início,Horário fim,Título,Local,Endereço,Módulo,Observações\r\n')).toBe(true);
    expect(csv.endsWith('Aula,Clínica,"Rua ""A""",Módulo 1,"Observação, útil"')).toBe(true);
  });
});
