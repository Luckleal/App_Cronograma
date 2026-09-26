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

  // Sweep stale exports before writing the new one. shareAsync resolves once
  // the OS share sheet accepts the file, not once the receiving app (e.g.
  // WhatsApp/Gmail opening it in another task on Android) finishes reading
  // it — so a successful share must not delete the file right away.
  try {
    for (const cached of Paths.cache.list()) {
      if (cached.name.startsWith('cronograma-') && cached.name.endsWith('.csv')) {
        cached.delete();
      }
    }
  } catch {
    // best-effort cleanup; a stale file left behind isn't fatal
  }

  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(csv);

  try {
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      throw new Error('O compartilhamento de arquivos não está disponível neste dispositivo.');
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/csv',
      dialogTitle: 'Exportar cronograma',
      UTI: 'public.comma-separated-values-text',
    });
  } catch (err) {
    if (file.exists) file.delete();
    throw err;
  }
}
