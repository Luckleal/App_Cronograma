import { Redirect, Tabs } from 'expo-router';
import { IconBadge } from '../../src/components/IconBadge';
import { useStore } from '../../src/store/useStore';
import { colors } from '../../src/theme';

export default function TabsLayout() {
  const onboarded = useStore((s) => s.onboarded);

  if (!onboarded) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.surface },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hoje',
          tabBarIcon: ({ focused }) => (
            <IconBadge name={focused ? 'home' : 'home-outline'} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Cronograma',
          tabBarIcon: ({ focused }) => (
            <IconBadge name={focused ? 'calendar' : 'calendar-outline'} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="locations"
        options={{
          title: 'Locais',
          tabBarIcon: ({ focused }) => (
            <IconBadge name={focused ? 'location' : 'location-outline'} active={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused }) => (
            <IconBadge name={focused ? 'person' : 'person-outline'} active={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
