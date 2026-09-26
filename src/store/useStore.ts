import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { cancelEntryNotifications, scheduleEntryNotifications } from '../notifications';
import { Module, Profile, ScheduleEntry, StudyLocation } from '../types';
import { isValidISODate } from '../utils/date';
import { generateId } from '../utils/id';

const defaultProfile: Profile = {
  name: '',
  course: '',
  notificationsEnabled: true,
  nightBeforeEnabled: true,
  nightBeforeTime: '20:00',
  sameDayMinutesBefore: 60,
};

// Serializes every notification-scheduling operation (add/update/delete entry,
// reschedule-all, location edits that touch linked entries) so concurrent calls
// never race each other and leave duplicate/orphaned native notifications.
let opQueue: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = opQueue.then(task, task);
  opQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

// Writes are blocked until hydration finishes without error, so a failed
// read (corrupt JSON, storage error) never gets overwritten by the in-memory
// defaults — the raw persisted value is preserved for diagnosis/recovery.
let canPersist = false;

// Guards checkTimeZone against overlapping calls (e.g. a mount check racing
// a duplicate AppState 'active' event) — without this, both would read the
// same stale timeZone before either awaits and each queue a full reschedule.
let timeZoneCheckPending = false;

const guardedStorage = {
  getItem: (name: string) => AsyncStorage.getItem(name),
  setItem: (name: string, value: string) =>
    canPersist ? AsyncStorage.setItem(name, value) : Promise.resolve(),
  removeItem: (name: string) => (canPersist ? AsyncStorage.removeItem(name) : Promise.resolve()),
};

type State = {
  hydrated: boolean;
  onboarded: boolean;
  profile: Profile;
  locations: StudyLocation[];
  modules: Module[];
  entries: ScheduleEntry[];
  timeZone: string;

  completeOnboarding: () => void;
  setProfile: (patch: Partial<Profile>) => Promise<void>;

  addLocation: (location: Omit<StudyLocation, 'id'>) => StudyLocation;
  updateLocation: (id: string, patch: Partial<StudyLocation>) => Promise<void>;
  deleteLocation: (id: string) => Promise<void>;

  addModule: (module: Omit<Module, 'id'>) => Module;
  updateModule: (id: string, patch: Partial<Module>) => void;
  deleteModule: (id: string) => void;

  addEntry: (
    entry: Omit<ScheduleEntry, 'id' | 'nightBeforeNotificationId' | 'sameDayNotificationId'>
  ) => Promise<void>;
  updateEntry: (id: string, patch: Partial<ScheduleEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;

  rescheduleAllNotifications: () => Promise<void>;
  resetAllData: () => Promise<void>;
  // Opcao A: o horario segue o fuso do celular. Compara o fuso atual com o
  // usado no ultimo agendamento e, se mudou, reagenda tudo e atualiza o salvo.
  checkTimeZone: () => Promise<void>;
};

export const useStore = create<State>()(
  persist(
    (set, get) => {
      // Schedules (or clears) native notifications for a single entry and merges
      // the resulting notification ids back into that entry only — never
      // overwrites the rest of the entries array, so it's safe to run after an
      // `await` even if other entries were added/edited/removed in the meantime.
      const scheduleForEntry = async (id: string) => {
        const { entries, locations, profile } = get();
        const entry = entries.find((e) => e.id === id);
        if (!entry) return;
        const location = locations.find((l) => l.id === entry.locationId);
        try {
          const notifIds = await scheduleEntryNotifications(entry, location, profile);
          set((s) => ({
            entries: s.entries.map((e) =>
              e.id === id
                ? {
                    ...e,
                    nightBeforeNotificationId: notifIds.nightBeforeNotificationId,
                    sameDayNotificationId: notifIds.sameDayNotificationId,
                  }
                : e
            ),
          }));
        } catch (err) {
          console.warn(`Falha ao agendar notificações da atividade ${id}`, err);
          set((s) => ({
            entries: s.entries.map((e) =>
              e.id === id
                ? { ...e, nightBeforeNotificationId: undefined, sameDayNotificationId: undefined }
                : e
            ),
          }));
        }
      };

      return {
        hydrated: false,
        onboarded: false,
        profile: defaultProfile,
        locations: [],
        modules: [],
        entries: [],
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,

        completeOnboarding: () => set({ onboarded: true }),

        setProfile: async (patch) => {
          const notificationRelevant = [
            'notificationsEnabled',
            'nightBeforeEnabled',
            'nightBeforeTime',
            'sameDayMinutesBefore',
          ];
          const touchesNotifications = Object.keys(patch).some((k) =>
            notificationRelevant.includes(k)
          );
          set((s) => ({ profile: { ...s.profile, ...patch } }));
          if (touchesNotifications) {
            await get().rescheduleAllNotifications();
          }
        },

        addLocation: (location) => {
          const newLocation: StudyLocation = { ...location, id: generateId() };
          set((s) => ({ locations: [...s.locations, newLocation] }));
          return newLocation;
        },
        updateLocation: async (id, patch) => {
          set((s) => ({
            locations: s.locations.map((l) => (l.id === id ? { ...l, ...patch } : l)),
          }));
          // The location's name/address is embedded in already-scheduled notification
          // text, so linked entries need their reminders rebuilt.
          const affected = get()
            .entries.filter((e) => e.locationId === id)
            .map((e) => e.id);
          if (affected.length === 0) return;
          await enqueue(async () => {
            for (const entryId of affected) await scheduleForEntry(entryId);
          });
        },
        deleteLocation: async (id) => {
          const affected = get()
            .entries.filter((e) => e.locationId === id)
            .map((e) => e.id);
          set((s) => ({
            locations: s.locations.filter((l) => l.id !== id),
            entries: s.entries.map((e) =>
              e.locationId === id ? { ...e, locationId: undefined } : e
            ),
          }));
          if (affected.length === 0) return;
          await enqueue(async () => {
            for (const entryId of affected) await scheduleForEntry(entryId);
          });
        },

        addModule: (module) => {
          const newModule: Module = { ...module, id: generateId() };
          set((s) => ({ modules: [...s.modules, newModule] }));
          return newModule;
        },
        updateModule: (id, patch) => {
          set((s) => ({ modules: s.modules.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
        },
        deleteModule: (id) => {
          set((s) => ({
            modules: s.modules.filter((m) => m.id !== id),
            entries: s.entries.map((e) => (e.moduleId === id ? { ...e, moduleId: undefined } : e)),
          }));
        },

        addEntry: async (entry) => {
          const id = generateId();
          const newEntry: ScheduleEntry = { ...entry, id };
          // Save first: a scheduling failure must not lose the activity.
          set((s) => ({ entries: [...s.entries, newEntry] }));
          await enqueue(() => scheduleForEntry(id));
        },

        updateEntry: async (id, patch) => {
          const existing = get().entries.find((e) => e.id === id);
          if (!existing) return;
          const merged: ScheduleEntry = { ...existing, ...patch };
          set((s) => ({ entries: s.entries.map((e) => (e.id === id ? merged : e)) }));
          await enqueue(() => scheduleForEntry(id));
        },

        deleteEntry: async (id) => {
          // Re-read the entry inside the queued task (not before) so it reflects
          // whatever an earlier queued update/reschedule already wrote — otherwise
          // we'd cancel a stale snapshot's notification ids and orphan the new ones.
          await enqueue(async () => {
            const existing = get().entries.find((e) => e.id === id);
            if (!existing) return;
            try {
              await cancelEntryNotifications(existing);
            } catch (err) {
              console.warn(`Falha ao cancelar notificações da atividade ${id}`, err);
            }
          });
          set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
        },

        rescheduleAllNotifications: () =>
          enqueue(async () => {
            const ids = get().entries.map((e) => e.id);
            for (const id of ids) await scheduleForEntry(id);
          }),

        resetAllData: () =>
          enqueue(async () => {
            const { entries, profile } = get();
            for (const entry of entries) {
              try {
                await cancelEntryNotifications(entry);
              } catch (err) {
                console.warn(`Falha ao cancelar notificações da atividade ${entry.id}`, err);
              }
            }
            // Photo files live outside AsyncStorage (Paths.document), so clearing
            // the profile field alone would leak the file on disk.
            const photoUri = profile.photoUri;
            if (
              photoUri &&
              photoUri.startsWith('file://') &&
              photoUri.startsWith(Paths.document.uri)
            ) {
              try {
                new File(photoUri).delete();
              } catch (err) {
                console.warn('Falha ao remover foto do perfil durante o reset.', err);
              }
            }
            // Only clear the entries captured above (the ones just canceled) —
            // an entry added concurrently while this awaited isn't in that set
            // and must survive, even though it was queued after this task.
            const resetIds = new Set(entries.map((e) => e.id));
            set((s) => ({
              profile: defaultProfile,
              locations: [],
              modules: [],
              entries: s.entries.filter((e) => !resetIds.has(e.id)),
              onboarded: false,
            }));
          }),

        checkTimeZone: async () => {
          const current = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (get().timeZone === current || timeZoneCheckPending) return;
          timeZoneCheckPending = true;
          try {
            await get().rescheduleAllNotifications();
            set({ timeZone: current });
          } finally {
            timeZoneCheckPending = false;
          }
        },
      };
    },
    {
      name: 'cronograma-storage',
      version: 1,
      storage: createJSONStorage(() => guardedStorage),
      migrate: (persistedState) => {
        const state = (persistedState ?? {}) as {
          profile?: Partial<Profile>;
          entries?: Record<string, unknown>[];
          [key: string]: unknown;
        };

        const profile: Profile = { ...defaultProfile, ...(state.profile ?? {}) };

        const rawEntries = state.entries ?? [];
        const entries = rawEntries
          .map((entry) => {
            const { date, ...rest } = entry as {
              date?: string;
              startDate?: string;
              endDate?: string;
            };
            let startDate = typeof rest.startDate === 'string' ? rest.startDate : date;
            let endDate = typeof rest.endDate === 'string' ? rest.endDate : date;
            if (!startDate && endDate) startDate = endDate;
            if (!endDate && startDate) endDate = startDate;
            return { ...rest, startDate, endDate };
          })
          .filter((entry) => isValidISODate(entry.startDate) && isValidISODate(entry.endDate));

        if (entries.length < rawEntries.length) {
          console.warn(
            `Migração descartou ${rawEntries.length - entries.length} atividade(s) com datas inválidas.`
          );
        }

        return { ...state, profile, entries };
      },
      partialize: (state) => ({
        onboarded: state.onboarded,
        profile: state.profile,
        locations: state.locations,
        modules: state.modules,
        entries: state.entries,
        timeZone: state.timeZone,
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.warn('Falha ao carregar dados salvos; iniciando com o estado padrão.', error);
        } else {
          canPersist = true;
        }
        // Set imperatively (hydrated is excluded from persisted state) and
        // unconditionally, so a hydration error never leaves the app stuck loading.
        useStore.setState({ hydrated: true });
      },
    }
  )
);
