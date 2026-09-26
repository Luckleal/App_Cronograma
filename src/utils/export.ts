import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { Module, ScheduleEntry, StudyLocation } from '../types';
import { buildEntriesCsv } from './csv';
import { todayISO } from './date';

function downloadCsvOnWeb(csv: string, fileName: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke after the click has had a chance to start the download — some
  // browsers (older Safari) fail the download if the URL dies immediately.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportEntriesAsCsv(
  entries: ScheduleEntry[],
  locations: StudyLocation[],
  modules: Module[]
): Promise<void> {
  const csv = buildEntriesCsv(entries, locations, modules);
  const fileName = `cronograma-${todayISO()}.csv`;

  if (Platform.OS === 'web') {
    downloadCsvOnWeb(csv, fileName);
    return;
  }

  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('O compartilhamento de arquivos não está disponível neste dispositivo.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Exportar cronograma',
    UTI: 'public.comma-separated-values-text',
  });
}
