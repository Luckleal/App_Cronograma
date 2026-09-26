import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 32, alignItems: 'center', gap: 4 },
  title: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  subtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 24 },
});
