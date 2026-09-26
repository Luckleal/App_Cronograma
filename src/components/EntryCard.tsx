import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../store/useStore';
import { colors } from '../theme';
import { ScheduleEntry } from '../types';
import { formatDatePt, formatTimeRange } from '../utils/date';
import { isMultiDay } from '../utils/schedule';

export function EntryCard({ entry, highlight }: { entry: ScheduleEntry; highlight?: boolean }) {
  const router = useRouter();
  const location = useStore((s) => s.locations.find((l) => l.id === entry.locationId));
  const timeRange = formatTimeRange(entry.startTime, entry.endTime);

  return (
    <Pressable
      onPress={() => router.push(`/entry/${entry.id}`)}
      style={[styles.card, highlight && styles.cardHighlight]}
    >
      <View style={[styles.colorBar, { backgroundColor: location?.color ?? colors.primaryLight }]} />
      <View style={styles.content}>
        <View style={styles.topRow}>
          {!!timeRange && <Text style={styles.time}>{timeRange}</Text>}
          {!!location && (
            <View style={styles.locationChip}>
              <Text style={styles.locationChipText}>{location.name}</Text>
            </View>
          )}
        </View>
        <Text style={styles.title}>{entry.title}</Text>
        {isMultiDay(entry) && (
          <Text style={styles.rangeText}>
            {formatDatePt(entry.startDate)} - {formatDatePt(entry.endDate)}
          </Text>
        )}
        {!!location?.address && <Text style={styles.address}>{location.address}</Text>}
        {!!entry.notes && <Text style={styles.notes}>{entry.notes}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHighlight: {
    borderColor: colors.todayBorder,
    backgroundColor: colors.today,
  },
  colorBar: { width: 5 },
  content: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, gap: 3 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  time: { fontWeight: '700', color: colors.text, fontSize: 13 },
  locationChip: { backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  locationChipText: { fontSize: 11, fontWeight: '600', color: colors.primaryDark },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  rangeText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  address: { fontSize: 12, color: colors.textMuted },
  notes: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
});
