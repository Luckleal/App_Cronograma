import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

type IconName = keyof typeof Ionicons.glyphMap;

export function IconBadge({
  name,
  active,
  size = 34,
}: {
  name: IconName;
  active: boolean;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 2 },
        active ? styles.badgeActive : styles.badgeInactive,
      ]}
    >
      <Ionicons name={name} size={size * 0.56} color={active ? '#FFFFFF' : colors.textMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
  badgeActive: { backgroundColor: colors.primary },
  badgeInactive: { backgroundColor: 'transparent' },
});
