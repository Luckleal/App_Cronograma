import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setupNotificationChannel } from '../src/notifications';
import { useStore } from '../src/store/useStore';
import { colors } from '../src/theme';

export default function RootLayout() {
  const hydrated = useStore((s) => s.hydrated);

  useEffect(() => {
    setupNotificationChannel();
  }, []);

  // Fuso segue o celular: ao iniciar e sempre que o app volta ao primeiro
  // plano, compara com o fuso do ultimo agendamento e reagenda se mudou.
  useEffect(() => {
    if (!hydrated) return;
    useStore.getState().checkTimeZone();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') useStore.getState().checkTimeZone();
    });
    return () => subscription.remove();
  }, [hydrated]);

  if (!hydrated) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerTintColor: colors.primary }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="entry/[id]" options={{ presentation: 'modal', title: 'Atividade' }} />
        <Stack.Screen name="location/[id]" options={{ presentation: 'modal', title: 'Local' }} />
        <Stack.Screen name="module/[id]" options={{ presentation: 'modal', title: 'Módulo' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
