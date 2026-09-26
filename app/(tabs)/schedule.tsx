import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '../../src/components/EmptyState';
import { EntryCard } from '../../src/components/EntryCard';
import { Fab } from '../../src/components/Fab';
import { useStore } from '../../src/store/useStore';
import { colors } from '../../src/theme';
import { Module, ScheduleEntry } from '../../src/types';
import {
  formatDatePt,
  isTodayISO,
  parseISODate,
  startOfWeekISO,
  weekdayShort,
} from '../../src/utils/date';
import { showAlert } from '../../src/utils/dialog';
import { exportEntriesAsCsv } from '../../src/utils/export';
import { groupEntriesByWeek, sortEntries } from '../../src/utils/schedule';

const NO_ENTRIES: ScheduleEntry[] = [];

function weekNumberFromModuleStart(moduleStartDate: string, weekStart: string): number {
  const start = parseISODate(startOfWeekISO(moduleStartDate));
  const week = parseISODate(weekStart);
  const diffDays = Math.round((week.getTime() - start.getTime()) / 86400000);
  return Math.floor(diffDays / 7) + 1;
}

function ModuleSection({ module, entries }: { module: Module | null; entries: ScheduleEntry[] }) {
  const router = useRouter();
  const weeks = useMemo(() => groupEntriesByWeek(entries), [entries]);

  return (
    <View style={styles.moduleSection}>
      <Pressable
        style={[styles.moduleHeader, { backgroundColor: module?.color ?? colors.textMuted }]}
        onPress={() => module && router.push(`/module/${module.id}`)}
        accessibilityRole={module ? 'button' : undefined}
        accessibilityLabel={module ? `Editar módulo ${module.name}` : undefined}
      >
        <Text style={styles.moduleHeaderText}>{module ? module.name : 'Outras atividades'}</Text>
        {module && (
          <Text style={styles.moduleHeaderDates}>
            {formatDatePt(module.startDate)} - {formatDatePt(module.endDate)}
          </Text>
        )}
      </Pressable>

      {weeks.length === 0 ? (
        <Text style={styles.emptyModuleText}>Sem atividades</Text>
      ) : (
        weeks.map((week, idx) => (
          <View key={week.weekStart} style={styles.weekBlock}>
            <Text style={styles.weekLabel}>
              Semana{' '}
              {module ? weekNumberFromModuleStart(module.startDate, week.weekStart) : idx + 1} (
              {formatDatePt(week.weekStart)} - {formatDatePt(week.weekEnd)})
            </Text>
            {week.days.map((day) => (
              <View key={day.date} style={styles.dayRow}>
                <View style={styles.dayLabelBox}>
                  <Text style={[styles.dayLabel, isTodayISO(day.date) && styles.dayLabelToday]}>
                    {weekdayShort(day.date)}
                  </Text>
                  <Text style={styles.dayDate}>{formatDatePt(day.date)}</Text>
                </View>
                <View style={styles.dayEntries}>
                  {day.entries.map((entry) => (
                    <EntryCard key={entry.id} entry={entry} highlight={isTodayISO(day.date)} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        ))
      )}
    </View>
  );
}

export default function Schedule() {
  const router = useRouter();
  const modules = useStore((s) => s.modules);
  const entries = useStore((s) => s.entries);
  const locations = useStore((s) => s.locations);
  const [exporting, setExporting] = useState(false);

  const sortedModules = useMemo(
    () => [...modules].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [modules]
  );
  const unassigned = useMemo(() => sortEntries(entries.filter((e) => !e.moduleId)), [entries]);
  const entriesByModule = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>();
    for (const entry of entries) {
      if (!entry.moduleId) continue;
      const list = map.get(entry.moduleId);
      if (list) list.push(entry);
      else map.set(entry.moduleId, [entry]);
    }
    return map;
  }, [entries]);

  const isEmpty = entries.length === 0 && modules.length === 0;

  async function handleExport() {
    setExporting(true);
    try {
      await exportEntriesAsCsv(entries, locations, modules);
    } catch (error) {
      showAlert(
        'Não foi possível exportar',
        error instanceof Error ? error.message : 'Tente novamente.'
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Cronograma</Text>
        <View style={styles.headerButtons}>
          {!isEmpty && (
            <Pressable
              style={styles.exportButton}
              onPress={handleExport}
              disabled={exporting}
              accessibilityRole="button"
              accessibilityLabel="Exportar cronograma"
            >
              {exporting ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.exportButtonText}>Exportar</Text>
              )}
            </Pressable>
          )}
          <Pressable
            style={styles.moduleAddButton}
            onPress={() => router.push('/module/new')}
            accessibilityRole="button"
            accessibilityLabel="Novo módulo"
          >
            <Text style={styles.moduleAddButtonText}>+ Módulo</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isEmpty ? (
          <EmptyState
            title="Seu cronograma está vazio"
            subtitle="Toque no + para adicionar sua primeira atividade, ou crie um módulo (ex: UE 1) para organizar por período."
          />
        ) : (
          <>
            {sortedModules.map((module) => (
              <ModuleSection
                key={module.id}
                module={module}
                entries={entriesByModule.get(module.id) ?? NO_ENTRIES}
              />
            ))}
            {unassigned.length > 0 && <ModuleSection module={null} entries={unassigned} />}
          </>
        )}
      </ScrollView>
      <Fab onPress={() => router.push({ pathname: '/entry/[id]', params: { id: 'new' } })} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  headerButtons: { flexDirection: 'row', gap: 8 },
  exportButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportButtonText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  moduleAddButton: {
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  moduleAddButtonText: { color: colors.primaryDark, fontWeight: '700', fontSize: 12 },
  content: { padding: 16, paddingBottom: 100 },
  moduleSection: { marginBottom: 20 },
  moduleHeader: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 10 },
  moduleHeaderText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  moduleHeaderDates: { color: '#fff', fontSize: 12, opacity: 0.9, marginTop: 2 },
  emptyModuleText: { fontSize: 13, color: colors.textMuted, paddingVertical: 8 },
  weekBlock: { marginBottom: 14 },
  weekLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  dayRow: { flexDirection: 'row', marginBottom: 4 },
  dayLabelBox: { width: 44, alignItems: 'center', paddingTop: 10 },
  dayLabel: { fontSize: 12, fontWeight: '700', color: colors.text },
  dayLabelToday: { color: colors.primary },
  dayDate: { fontSize: 11, color: colors.textMuted },
  dayEntries: { flex: 1 },
});
