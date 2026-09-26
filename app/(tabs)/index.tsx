import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '../../src/components/EmptyState';
import { EntryCard } from '../../src/components/EntryCard';
import { Fab } from '../../src/components/Fab';
import { useStore } from '../../src/store/useStore';
import { colors } from '../../src/theme';
import { compareISODate, formatDateLongPt, todayISO, weekdayLong } from '../../src/utils/date';
import { entriesForDate, isMultiDay, upcomingEntries } from '../../src/utils/schedule';

export default function Home() {
  const router = useRouter();
  const profile = useStore((s) => s.profile);
  const entries = useStore((s) => s.entries);
  const [today, setToday] = useState(todayISO());

  useFocusEffect(
    useCallback(() => {
      setToday(todayISO());
    }, [])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(todayISO());
    });
    return () => subscription.remove();
  }, []);

  const todayEntries = entriesForDate(entries, today);
  const nextEntries = upcomingEntries(entries, 6).filter(
    (e) => compareISODate(e.startDate, today) > 0
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.greeting}>Olá{profile.name ? `, ${profile.name}` : ''}</Text>
        <Text style={styles.date}>
          {weekdayLong(today)}, {formatDateLongPt(today)}
        </Text>

        <Text style={styles.sectionTitle}>Hoje</Text>
        {todayEntries.length === 0 ? (
          <EmptyState
            title="Nenhuma atividade hoje"
            subtitle="Aproveite para descansar ou revisar seu conteúdo."
          />
        ) : (
          todayEntries.map((entry) => <EntryCard key={entry.id} entry={entry} highlight />)
        )}

        <Text style={styles.sectionTitle}>Próximos dias</Text>
        {nextEntries.length === 0 ? (
          <EmptyState
            title="Nada agendado ainda"
            subtitle="Toque no + para adicionar sua próxima atividade."
          />
        ) : (
          nextEntries.map((entry) => (
            <View key={entry.id} style={styles.upcomingRow}>
              <Text style={styles.upcomingDate}>
                {weekdayLong(entry.startDate).slice(0, 3)} · {formatDateLongPt(entry.startDate)}
                {isMultiDay(entry) ? ` a ${formatDateLongPt(entry.endDate)}` : ''}
              </Text>
              <EntryCard entry={entry} />
            </View>
          ))
        )}
      </ScrollView>
      <Fab
        onPress={() => router.push({ pathname: '/entry/[id]', params: { id: 'new', date: today } })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 100 },
  greeting: { fontSize: 22, fontWeight: '700', color: colors.text },
  date: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 20,
    textTransform: 'capitalize',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
    marginTop: 8,
  },
  upcomingRow: { marginBottom: 4 },
  upcomingDate: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 4,
    textTransform: 'capitalize',
  },
});
