import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Profile, ScheduleEntry, StudyLocation } from './types';
import { combineDateAndTime } from './utils/date';

const CHANNEL_ID = 'cronograma-lembretes';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Memoized so concurrent callers (app boot + permission request) await the
// same in-flight channel creation instead of racing duplicate calls.
let channelReadyPromise: Promise<void> | null = null;

export function setupNotificationChannel(): Promise<void> {
  if (!channelReadyPromise) {
    channelReadyPromise = (async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
          name: 'Lembretes do cronograma',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
        });
      }
    })().catch((err) => {
      // Don't cache a rejected promise: let the next caller retry instead of
      // failing forever until the app restarts.
      channelReadyPromise = null;
      throw err;
    });
  }
  return channelReadyPromise;
}

export async function requestNotificationPermission(): Promise<boolean> {
  await setupNotificationChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const result = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return !!result.granted;
}

async function cancelIfExists(id?: string) {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (err) {
    console.warn(`Falha ao cancelar notificação ${id}`, err);
  }
}

export async function cancelEntryNotifications(entry: ScheduleEntry) {
  await cancelIfExists(entry.nightBeforeNotificationId);
  await cancelIfExists(entry.sameDayNotificationId);
}

function locationLabel(location?: StudyLocation) {
  return location ? ` em ${location.name}` : '';
}

export async function scheduleEntryNotifications(
  entry: ScheduleEntry,
  location: StudyLocation | undefined,
  profile: Profile
): Promise<{ nightBeforeNotificationId?: string; sameDayNotificationId?: string }> {
  await cancelEntryNotifications(entry);

  if (!profile.notificationsEnabled) {
    return {};
  }

  const result: { nightBeforeNotificationId?: string; sameDayNotificationId?: string } = {};
  const timeLabel = entry.startTime ? ` às ${entry.startTime}` : '';

  try {
    if (profile.nightBeforeEnabled) {
      const fireDate = combineDateAndTime(entry.startDate, profile.nightBeforeTime);
      fireDate.setDate(fireDate.getDate() - 1);
      if (fireDate.getTime() > Date.now()) {
        result.nightBeforeNotificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Amanhã você tem atividade',
            body: `${entry.title}${locationLabel(location)}${timeLabel}`,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: fireDate,
            channelId: CHANNEL_ID,
          },
        });
      }
    }

    if (profile.sameDayMinutesBefore > 0 && entry.startTime) {
      const fireDate = combineDateAndTime(entry.startDate, entry.startTime);
      fireDate.setMinutes(fireDate.getMinutes() - profile.sameDayMinutesBefore);
      if (fireDate.getTime() > Date.now()) {
        result.sameDayNotificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Sua atividade está próxima',
            body: `${entry.title}${locationLabel(location)}${timeLabel}`,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: fireDate,
            channelId: CHANNEL_ID,
          },
        });
      }
    }

    return result;
  } catch (err) {
    // Don't leave an orphaned reminder behind when the second schedule call fails.
    await cancelIfExists(result.nightBeforeNotificationId);
    await cancelIfExists(result.sameDayNotificationId);
    throw err;
  }
}

export function describeReminderPlan(profile: Profile, hasStartTime: boolean): string {
  if (!profile.notificationsEnabled) {
    return 'As notificações estão desativadas. Ative em Perfil para receber lembretes.';
  }

  const parts: string[] = [];
  if (profile.nightBeforeEnabled) {
    parts.push(`na noite anterior (às ${profile.nightBeforeTime})`);
  }
  if (profile.sameDayMinutesBefore > 0) {
    if (hasStartTime) {
      parts.push(`${profile.sameDayMinutesBefore} minutos antes do início`);
    } else {
      parts.push(`${profile.sameDayMinutesBefore} minutos antes (defina um horário de início para ativar este lembrete)`);
    }
  }

  if (parts.length === 0) {
    return 'Nenhum lembrete será enviado para esta atividade. Ative os lembretes em Perfil se quiser ser avisado.';
  }
  return `Você será lembrado ${parts.join(' e ')}.`;
}
