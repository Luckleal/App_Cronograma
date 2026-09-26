import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '../../src/components/EmptyState';
import { Fab } from '../../src/components/Fab';
import { useStore } from '../../src/store/useStore';
import { colors } from '../../src/theme';

export default function Locations() {
  const router = useRouter();
  const locations = useStore((s) => s.locations);
  const entries = useStore((s) => s.entries);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Locais de estudo</Text>
      <FlatList
        data={locations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          <EmptyState
            title="Nenhum local cadastrado"
            subtitle="Adicione os lugares onde você estuda ou trabalha, como SAMU, UPA ou hospital."
          />
        }
        renderItem={({ item }) => {
          const count = entries.filter((e) => e.locationId === item.id).length;
          return (
            <Pressable style={styles.card} onPress={() => router.push(`/location/${item.id}`)}>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                {!!item.address && <Text style={styles.cardSubtitle}>{item.address}</Text>}
                <Text style={styles.cardCount}>{count} atividade{count === 1 ? '' : 's'}</Text>
              </View>
            </Pressable>
          );
        }}
      />
      <Fab onPress={() => router.push('/location/new')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  content: { padding: 16, paddingBottom: 100, flexGrow: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  dot: { width: 14, height: 14, borderRadius: 7 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  cardSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  cardCount: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
});
