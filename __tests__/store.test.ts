import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import { useStore } from '../src/store/useStore';
import { Profile, ScheduleEntry } from '../src/types';

jest.mock('@react-native-async-storage/async-storage', () => {
  const data = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => data.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        data.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        data.delete(key);
      }),
      clear: jest.fn(async () => {
        data.clear();
      }),
    },
  };
});

jest.mock('expo-file-system', () => ({
  Paths: { document: { uri: 'file:///app/documents/' } },
  File: jest.fn(() => ({ delete: jest.fn() })),
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  setNotificationChannelAsync: jest.fn(async () => {}),
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { HIGH: 4 },
}));

const schedule = jest.mocked(Notifications.scheduleNotificationAsync);
const cancel = jest.mocked(Notifications.cancelScheduledNotificationAsync);
const profile: Profile = {
  name: '',
  course: '',
  notificationsEnabled: true,
  nightBeforeEnabled: true,
  nightBeforeTime: '20:00',
  sameDayMinutesBefore: 60,
};
const entry = (id: string): ScheduleEntry => ({
  id,
  title: id,
  startDate: '2030-06-10',
  endDate: '2030-06-10',
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeAll(async () => {
  await useStore.persist.rehydrate();
});

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  schedule.mockReset();
  let nextId = 0;
  schedule.mockImplementation(async () => `notification-${++nextId}`);
  jest.spyOn(Date, 'now').mockReturnValue(new Date(2029, 0, 1).getTime());
  useStore.setState({
    profile: { ...profile },
    entries: [],
    locations: [],
    modules: [],
    onboarded: false,
    hydrated: true,
    timeZone: 'America/Sao_Paulo',
  });
});

afterEach(() => jest.restoreAllMocks());

it('resetAllData apaga a foto em Paths.document e remove a URI persistida', async () => {
  const photoUri = `${Paths.document.uri}profile.jpg`;
  useStore.setState({ profile: { ...profile, photoUri }, onboarded: true });

  await useStore.getState().resetAllData();

  expect(File).toHaveBeenCalledTimes(1);
  expect(File).toHaveBeenCalledWith(photoUri);
  const photo = jest.mocked(File).mock.results[0].value;
  expect(photo.delete).toHaveBeenCalledTimes(1);
  expect(useStore.getState().profile).toEqual(profile);
  expect(useStore.getState().onboarded).toBe(false);
  const persisted = JSON.parse((await AsyncStorage.getItem('cronograma-storage'))!);
  expect(persisted.state.profile).toEqual(profile);
});

it.each([
  'https://example.com/profile.jpg',
  'data:image/jpeg;base64,YWJj',
  'content://media/external/images/123',
  'file:///external/profile.jpg',
  'file:///app/documents-other/profile.jpg',
  undefined,
])('resetAllData nao acessa arquivo para photoUri=%s', async (photoUri) => {
  useStore.setState({ profile: { ...profile, photoUri } });

  await useStore.getState().resetAllData();

  expect(File).not.toHaveBeenCalled();
  expect(useStore.getState().profile).toEqual(profile);
});

it('checkTimeZone nao reagenda nem grava quando o fuso do celular permanece igual', async () => {
  const options = Intl.DateTimeFormat().resolvedOptions();
  jest
    .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
    .mockReturnValue({ ...options, timeZone: 'America/Sao_Paulo' });
  useStore.setState({ entries: [{ ...entry('A'), nightBeforeNotificationId: 'existing-A' }] });
  const rawBefore = await AsyncStorage.getItem('cronograma-storage');
  jest.mocked(AsyncStorage.setItem).mockClear();

  await useStore.getState().checkTimeZone();

  expect(schedule).not.toHaveBeenCalled();
  expect(cancel).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(useStore.getState().timeZone).toBe('America/Sao_Paulo');
  expect(await AsyncStorage.getItem('cronograma-storage')).toBe(rawBefore);
});

it('checkTimeZone reagenda todas as atividades e persiste o novo fuso do celular', async () => {
  const options = Intl.DateTimeFormat().resolvedOptions();
  jest
    .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
    .mockReturnValue({ ...options, timeZone: 'Europe/Lisbon' });
  useStore.setState({
    entries: [
      { ...entry('A'), nightBeforeNotificationId: 'old-A' },
      { ...entry('B'), nightBeforeNotificationId: 'old-B' },
    ],
  });
  jest.mocked(AsyncStorage.setItem).mockClear();

  await useStore.getState().checkTimeZone();

  expect(cancel.mock.calls).toEqual([['old-A'], ['old-B']]);
  expect(schedule.mock.calls.map(([request]) => request.content.body)).toEqual(['A', 'B']);
  expect(useStore.getState().timeZone).toBe('Europe/Lisbon');
  expect(useStore.getState().entries.map((item) => item.nightBeforeNotificationId)).toEqual([
    'notification-1',
    'notification-2',
  ]);
  expect(AsyncStorage.setItem).toHaveBeenCalled();
  const persisted = JSON.parse((await AsyncStorage.getItem('cronograma-storage'))!);
  expect(persisted.state.timeZone).toBe('Europe/Lisbon');
  expect(persisted.state.entries).toEqual(useStore.getState().entries);

  // A subsequent foreground check in the same zone must not rebuild reminders.
  jest.mocked(AsyncStorage.setItem).mockClear();
  await useStore.getState().checkTimeZone();
  expect(schedule).toHaveBeenCalledTimes(2);
  expect(cancel).toHaveBeenCalledTimes(2);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

it('serializa reagendamentos e preserva atividade adicionada durante o loop', async () => {
  const blocked = deferred<string>();
  const started = deferred<void>();
  schedule.mockImplementationOnce(() => {
    started.resolve();
    return blocked.promise;
  });
  useStore.setState({ entries: [entry('A'), entry('B')] });
  const first = useStore.getState().rescheduleAllNotifications();
  await started.promise;

  const added = useStore
    .getState()
    .addEntry({ title: 'C', startDate: '2030-06-10', endDate: '2030-06-10' });
  const second = useStore.getState().rescheduleAllNotifications();
  try {
    // Drain promise continuations while the first native operation remains blocked.
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(useStore.getState().entries.map((item) => item.title)).toEqual(['A', 'B', 'C']);
  } finally {
    blocked.resolve('first-A');
    await Promise.all([first, added, second]);
  }

  expect(schedule.mock.calls.map(([request]) => request.content.body)).toEqual([
    'A',
    'B',
    'C',
    'A',
    'B',
    'C',
  ]);
  const entries = useStore.getState().entries;
  expect(entries.map((item) => item.title)).toEqual(['A', 'B', 'C']);
  expect(new Set(entries.map((item) => item.nightBeforeNotificationId)).size).toBe(3);
  expect(entries.every((item) => Boolean(item.nightBeforeNotificationId))).toBe(true);
  expect(cancel).toHaveBeenCalledWith('first-A');
  const persisted = JSON.parse((await AsyncStorage.getItem('cronograma-storage'))!);
  expect(persisted.state.entries).toEqual(entries);
});

it('addEntry salva e persiste mesmo quando o agendamento falha, e a fila continua', async () => {
  const error = new Error('agendamento indisponivel');
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  schedule.mockRejectedValueOnce(error);
  const input = { title: 'Atividade salva', startDate: '2030-06-10', endDate: '2030-06-10' };

  await expect(useStore.getState().addEntry(input)).resolves.toBeUndefined();
  const saved = useStore.getState().entries[0];
  expect(saved).toMatchObject(input);
  expect(saved.id).toEqual(expect.any(String));
  expect(saved.nightBeforeNotificationId).toBeUndefined();
  expect(saved.sameDayNotificationId).toBeUndefined();
  expect(warn).toHaveBeenCalledWith(expect.stringContaining(saved.id), error);
  const persisted = JSON.parse((await AsyncStorage.getItem('cronograma-storage'))!);
  expect(persisted.state.entries).toEqual([saved]);

  await useStore.getState().rescheduleAllNotifications();
  expect(useStore.getState().entries[0].nightBeforeNotificationId).toBe('notification-1');
});

it('salva a atividade e cancela o primeiro lembrete quando o segundo falha', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  schedule
    .mockResolvedValueOnce('partial-reminder')
    .mockRejectedValueOnce(new Error('segundo lembrete falhou'));

  await useStore.getState().addEntry({
    title: 'Dois lembretes',
    startDate: '2030-06-10',
    endDate: '2030-06-10',
    startTime: '10:00',
  });

  expect(schedule).toHaveBeenCalledTimes(2);
  expect(cancel).toHaveBeenCalledWith('partial-reminder');
  expect(useStore.getState().entries).toHaveLength(1);
  expect(useStore.getState().entries[0]).toMatchObject({
    title: 'Dois lembretes',
    nightBeforeNotificationId: undefined,
    sameDayNotificationId: undefined,
  });
});

it('migra perfil parcial mesclando padroes e preservando escolhas falsas e zero', async () => {
  await AsyncStorage.setItem(
    'cronograma-storage',
    JSON.stringify({
      version: 0,
      state: {
        onboarded: true,
        profile: { name: 'Yasmin', notificationsEnabled: false, sameDayMinutesBefore: 0 },
        entries: [{ id: 'old', title: 'Legado', date: '2024-02-29' }],
      },
    })
  );

  await useStore.persist.rehydrate();

  expect(useStore.getState().profile).toEqual({
    ...profile,
    name: 'Yasmin',
    notificationsEnabled: false,
    sameDayMinutesBefore: 0,
  });
  expect(useStore.getState().entries).toEqual([
    { id: 'old', title: 'Legado', startDate: '2024-02-29', endDate: '2024-02-29' },
  ]);
  expect(useStore.getState().onboarded).toBe(true);
  expect(useStore.getState().hydrated).toBe(true);
  const persisted = JSON.parse((await AsyncStorage.getItem('cronograma-storage'))!);
  expect(persisted.version).toBe(1);
  expect(persisted.state.profile).toEqual(useStore.getState().profile);
});

it('migra perfil ausente usando todos os padroes', async () => {
  await AsyncStorage.setItem(
    'cronograma-storage',
    JSON.stringify({ version: 0, state: { entries: [] } })
  );
  await useStore.persist.rehydrate();
  expect(useStore.getState().profile).toEqual(profile);
});

it('resetAllData remove apenas o snapshot e preserva addEntry durante o cancelamento', async () => {
  const blocked = deferred<void>();
  const started = deferred<void>();
  cancel.mockImplementationOnce(() => {
    started.resolve();
    return blocked.promise;
  });
  useStore.setState({
    entries: [
      { ...entry('A'), nightBeforeNotificationId: 'old-A' },
      { ...entry('B'), sameDayNotificationId: 'old-B' },
    ],
    profile: { ...profile, name: 'Antes do reset' },
    onboarded: true,
  });

  const reset = useStore.getState().resetAllData();
  await started.promise;
  const input = { title: 'Criada durante reset', startDate: '2030-06-10', endDate: '2030-06-10' };
  const add = useStore.getState().addEntry(input);
  const addedId = useStore.getState().entries.find((item) => item.title === input.title)!.id;
  try {
    expect(useStore.getState().entries).toHaveLength(3);
    expect(schedule).not.toHaveBeenCalled();
  } finally {
    blocked.resolve();
    await Promise.all([reset, add]);
  }

  expect(cancel.mock.calls).toEqual([['old-A'], ['old-B']]);
  expect(schedule).toHaveBeenCalledTimes(1);
  expect(schedule.mock.calls[0][0].content.body).toBe(input.title);
  const remaining = useStore.getState().entries;
  expect(remaining).toEqual([
    {
      ...input,
      id: addedId,
      nightBeforeNotificationId: 'notification-1',
      sameDayNotificationId: undefined,
    },
  ]);
  expect(useStore.getState().profile).toEqual(profile);
  expect(useStore.getState().onboarded).toBe(false);
  const persisted = JSON.parse((await AsyncStorage.getItem('cronograma-storage'))!);
  expect(persisted.state.entries).toEqual(remaining);
});
