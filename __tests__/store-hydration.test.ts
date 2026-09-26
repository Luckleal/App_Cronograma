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
    },
  };
});

jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn() }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

// Each case must start with a fresh module: canPersist belongs to the store
// module, and a store already hydrated successfully cannot simulate app boot.
beforeEach(() => jest.resetModules());
afterEach(() => jest.restoreAllMocks());

it.each(['erro de leitura', 'JSON invalido'] as const)(
  'preserva valor bruto e bloqueia escrita/remocao apos %s, ate recuperar hidratacao',
  async (failure) => {
    const storage = (
      require('@react-native-async-storage/async-storage') as typeof import('@react-native-async-storage/async-storage')
    ).default;
    const raw =
      failure === 'JSON invalido'
        ? '{"state":{"entries": [JSON corrompido'
        : JSON.stringify({
            version: 1,
            state: { entries: [{ id: 'preservar', title: 'Dados originais' }] },
          });
    await storage.setItem('cronograma-storage', raw);
    jest.mocked(storage.setItem).mockClear();

    let finishRead!: (value: string) => void;
    let failRead!: (error: Error) => void;
    const pendingRead = new Promise<string>((resolve, reject) => {
      finishRead = resolve;
      failRead = reject;
    });
    jest.mocked(storage.getItem).mockImplementationOnce(() => pendingRead);
    let reportFailure!: () => void;
    const failureReported = new Promise<void>((resolve) => {
      reportFailure = resolve;
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => reportFailure());
    const { useStore: store } =
      require('../src/store/useStore') as typeof import('../src/store/useStore');

    expect(store.getState().hydrated).toBe(false);
    await store.getState().setProfile({ name: 'Durante leitura' });
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();

    if (failure === 'erro de leitura') failRead(new Error('AsyncStorage indisponivel'));
    else finishRead(raw);
    await failureReported;

    expect(store.getState().hydrated).toBe(true);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Falha ao carregar'),
      expect.any(Error)
    );
    await store.getState().setProfile({ name: 'Apos falha' });
    await store.persist.clearStorage();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(await storage.getItem('cronograma-storage')).toBe(raw);

    // Simulate repairing the saved value externally and retrying hydration.
    await storage.setItem(
      'cronograma-storage',
      JSON.stringify({
        version: 1,
        state: {
          profile: {
            name: 'Recuperada',
            course: '',
            notificationsEnabled: true,
            nightBeforeEnabled: true,
            nightBeforeTime: '20:00',
            sameDayMinutesBefore: 60,
          },
          entries: [],
        },
      })
    );
    jest.mocked(storage.setItem).mockClear();
    await store.persist.rehydrate();
    expect(store.persist.hasHydrated()).toBe(true);
    expect(store.getState().profile.name).toBe('Recuperada');
    await store.getState().setProfile({ name: 'Persistencia liberada' });
    expect(storage.setItem).toHaveBeenCalled();
    expect(JSON.parse((await storage.getItem('cronograma-storage'))!).state.profile.name).toBe(
      'Persistencia liberada'
    );
    await store.persist.clearStorage();
    expect(storage.removeItem).toHaveBeenCalledWith('cronograma-storage');
    expect(await storage.getItem('cronograma-storage')).toBeNull();
  }
);
