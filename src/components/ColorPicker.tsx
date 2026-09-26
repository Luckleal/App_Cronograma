import { Pressable, StyleSheet, View } from 'react-native';
import { locationPalette } from '../theme';

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <View style={styles.row}>
      {locationPalette.map((color) => (
        <Pressable
          key={color}
          onPress={() => onChange(color)}
          style={[styles.swatch, { backgroundColor: color }, value === color && styles.selected]}
          accessibilityRole="button"
          accessibilityLabel={`Cor ${color}`}
          accessibilityState={{ selected: value === color }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
  selected: { borderColor: '#000' },
});
