import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { buildEntriesCsv } from '../src/utils/csv';
import { todayISO } from '../src/utils/date';
import { exportEntriesAsCsv } from '../src/utils/export';

jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///app/cache/', list: jest.fn(() => []) } },
  File: jest.fn(),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(Paths.cache.list).mockReturnValue([]);
});

it.each(['sucesso', 'falha'] as const)(
  'apaga o CSV do cache apenas quando shareAsync falha, nunca durante ou apos %s',
  async (outcome) => {
    const entries = [
      { id: 'a', title: 'Atividade privada', startDate: '2030-06-10', endDate: '2030-06-10' },
    ];
    const fileName = `cronograma-${todayISO()}.csv`;
    const file = {
      uri: `${Paths.cache.uri}${fileName}`,
      exists: false,
      create: jest.fn(() => {
        file.exists = true;
      }),
      write: jest.fn(),
      delete: jest.fn(() => {
        file.exists = false;
      }),
    };
    jest.mocked(File).mockImplementation(() => file as unknown as File);
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
    let finishShare!: () => void;
    let failShare!: (error: Error) => void;
    const pendingShare = new Promise<void>((resolve, reject) => {
      finishShare = resolve;
      failShare = reject;
    });
    let reportStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      reportStarted = resolve;
    });
    jest.mocked(Sharing.shareAsync).mockImplementation(() => {
      reportStarted();
      return pendingShare;
    });
    const error = new Error('compartilhamento falhou');

    const exported = exportEntriesAsCsv(entries, [], []);
    const settled =
      outcome === 'falha'
        ? expect(exported).rejects.toBe(error)
        : expect(exported).resolves.toBeUndefined();
    await started;
    try {
      expect(File).toHaveBeenCalledWith(Paths.cache, fileName);
      expect(file.create).toHaveBeenCalledTimes(1);
      expect(file.write).toHaveBeenCalledWith(buildEntriesCsv(entries, [], []));
      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        file.uri,
        expect.objectContaining({ mimeType: 'text/csv' })
      );
      expect(file.exists).toBe(true);
      expect(file.delete).not.toHaveBeenCalled();
    } finally {
      if (outcome === 'falha') failShare(error);
      else finishShare();
      await settled;
    }

    if (outcome === 'falha') {
      expect(file.delete).toHaveBeenCalledTimes(1);
      expect(file.exists).toBe(false);
    } else {
      // shareAsync resolving only means the OS accepted the share intent —
      // the receiving app (e.g. WhatsApp on Android) may still be reading
      // the file in another task, so a successful share must not delete it.
      expect(file.delete).not.toHaveBeenCalled();
      expect(file.exists).toBe(true);
    }
  }
);

it('remove exportacoes antigas do cache antes de gravar a nova, sem tocar em outros arquivos', async () => {
  const staleCsv = { name: 'cronograma-2030-01-01.csv', delete: jest.fn() };
  const unrelated = { name: 'outro-arquivo.csv', delete: jest.fn() };
  jest
    .mocked(Paths.cache.list)
    .mockReturnValue([staleCsv, unrelated] as unknown as ReturnType<typeof Paths.cache.list>);
  const fileName = `cronograma-${todayISO()}.csv`;
  const file = {
    uri: `${Paths.cache.uri}${fileName}`,
    exists: false,
    create: jest.fn(() => {
      file.exists = true;
    }),
    write: jest.fn(),
    delete: jest.fn(() => {
      file.exists = false;
    }),
  };
  jest.mocked(File).mockImplementation(() => file as unknown as File);
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(Sharing.shareAsync).mockResolvedValue(undefined);

  await exportEntriesAsCsv([], [], []);

  expect(staleCsv.delete).toHaveBeenCalledTimes(1);
  expect(unrelated.delete).not.toHaveBeenCalled();
});
