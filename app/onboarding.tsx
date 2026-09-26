import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { requestNotificationPermission } from '../src/notifications';
import { useStore } from '../src/store/useStore';
import { colors } from '../src/theme';

export default function Onboarding() {
  const router = useRouter();
  const setProfile = useStore((s) => s.setProfile);
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const [name, setName] = useState('');
  const [course, setCourse] = useState('');

  const canContinue = name.trim().length > 0;

  async function handleStart() {
    try {
      await setProfile({ name: name.trim(), course: course.trim() });
      const granted = await requestNotificationPermission();
      await setProfile({ notificationsEnabled: granted });
    } catch (error) {
      console.warn('Falha ao concluir configuração inicial', error);
    } finally {
      completeOnboarding();
      router.replace('/(tabs)');
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.content}>
          <View style={styles.logo}>
            <Ionicons name="calendar" size={40} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Meu Cronograma</Text>
          <Text style={styles.subtitle}>
            Organize seus plantões, aulas e estágios em um só lugar e receba lembretes de onde você
            precisa estar.
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>Seu nome</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Ex: Yasmin"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.label}>Curso ou turma (opcional)</Text>
            <TextInput
              style={styles.input}
              value={course}
              onChangeText={setCourse}
              placeholder="Ex: Medicina - Internato"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <Pressable
            style={[styles.button, !canContinue && styles.buttonDisabled]}
            disabled={!canContinue}
            onPress={handleStart}
          >
            <Text style={styles.buttonText}>Começar</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flex: 1, padding: 24, justifyContent: 'center', gap: 8 },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, textAlign: 'center', marginTop: 8 },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 20,
  },
  form: { gap: 6, marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 8 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
