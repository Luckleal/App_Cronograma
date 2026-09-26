import DateTimePicker from '@react-native-community/datetimepicker';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { requestNotificationPermission } from '../../src/notifications';
import { useStore } from '../../src/store/useStore';
import { colors } from '../../src/theme';
import { combineDateAndTime, isValidTime, todayISO } from '../../src/utils/date';
import { confirmAsync, showAlert } from '../../src/utils/dialog';

const REMINDER_OPTIONS = [
  { label: 'Desativado', value: 0 },
  { label: '15 min antes', value: 15 },
  { label: '30 min antes', value: 30 },
  { label: '1 hora antes', value: 60 },
  { label: '2 horas antes', value: 120 },
];

export default function Profile() {
  const profile = useStore((s) => s.profile);
  const setProfile = useStore((s) => s.setProfile);
  const resetAllData = useStore((s) => s.resetAllData);
  const [name, setName] = useState(profile.name);
  const [course, setCourse] = useState(profile.course);
  const [showTimePicker, setShowTimePicker] = useState(false);

  function deleteLocalPhotoFile(uri: string | undefined) {
    if (!uri || !uri.startsWith('file://') || !uri.startsWith(Paths.document.uri)) return;
    try {
      new File(uri).delete();
    } catch {
      // arquivo já pode ter sido removido; ignorar
    }
  }

  async function resizeImageForWeb(uri: string, maxDim = 480, quality = 0.7): Promise<string> {
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
        img.src = uri;
      });
      const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
      const width = Math.round(image.width * scale) || 1;
      const height = Math.round(image.height * scale) || 1;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas não suportado neste navegador.');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      return canvas.toDataURL('image/jpeg', quality);
    } finally {
      URL.revokeObjectURL(uri);
    }
  }

  async function pickPhoto() {
    let dest: File | undefined;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled || !result.assets[0]) return;
      const uri = result.assets[0].uri;
      const previousPhotoUri = profile.photoUri;
      if (Platform.OS === 'web') {
        const dataUri = await resizeImageForWeb(uri);
        await setProfile({ photoUri: dataUri });
        deleteLocalPhotoFile(previousPhotoUri);
        return;
      }
      const source = new File(uri);
      dest = new File(Paths.document, `profile-${Date.now()}${source.extension || '.jpg'}`);
      source.copy(dest);
      await setProfile({ photoUri: dest.uri });
      deleteLocalPhotoFile(previousPhotoUri);
    } catch (error) {
      deleteLocalPhotoFile(dest?.uri);
      showAlert('Não foi possível salvar a foto', error instanceof Error ? error.message : 'Tente novamente.');
    }
  }

  async function toggleNotifications(value: boolean) {
    try {
      if (!value) {
        await setProfile({ notificationsEnabled: false });
        return;
      }
      const granted = await requestNotificationPermission();
      if (!granted) {
        showAlert(
          'Permissão negada',
          'Ative as notificações do app nas configurações do celular para receber lembretes.'
        );
      }
      await setProfile({ notificationsEnabled: granted });
    } catch (error) {
      showAlert('Não foi possível atualizar', error instanceof Error ? error.message : 'Tente novamente.');
    }
  }

  async function confirmReset() {
    const confirmed = await confirmAsync(
      'Limpar todos os dados',
      'Isso vai apagar seu perfil, locais, módulos e todas as atividades do cronograma. Essa ação não pode ser desfeita.',
      { confirmText: 'Limpar tudo', destructive: true }
    );
    if (!confirmed) return;
    resetAllData();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Perfil</Text>

        <Pressable
          style={styles.avatarWrap}
          onPress={pickPhoto}
          accessibilityRole="button"
          accessibilityLabel="Alterar foto de perfil"
        >
          {profile.photoUri ? (
            <Image source={{ uri: profile.photoUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>{(profile.name || '?').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.avatarHint}>Toque para alterar a foto</Text>
        </Pressable>

        <Text style={styles.label}>Nome</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          onBlur={() => setProfile({ name: name.trim() })}
          placeholder="Seu nome"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Curso ou turma</Text>
        <TextInput
          style={styles.input}
          value={course}
          onChangeText={setCourse}
          onBlur={() => setProfile({ course: course.trim() })}
          placeholder="Ex: Medicina - Internato"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.sectionTitle}>Notificações</Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Ativar notificações</Text>
          <Switch
            value={profile.notificationsEnabled}
            onValueChange={toggleNotifications}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={colors.border}
          />
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Lembrete na noite anterior</Text>
          <Switch
            value={profile.nightBeforeEnabled}
            onValueChange={(v) => setProfile({ nightBeforeEnabled: v })}
            disabled={!profile.notificationsEnabled}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={colors.border}
          />
        </View>

        {profile.nightBeforeEnabled && profile.notificationsEnabled && (
          <Pressable
            style={styles.timeRow}
            onPress={() => setShowTimePicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`Horário do lembrete: ${profile.nightBeforeTime}`}
          >
            <Text style={styles.rowLabel}>Horário do lembrete</Text>
            <Text style={styles.timeValue}>{profile.nightBeforeTime}</Text>
          </Pressable>
        )}

        {showTimePicker && (
          <DateTimePicker
            value={combineDateAndTime(todayISO(), profile.nightBeforeTime)}
            mode="time"
            is24Hour
            onChange={(event, selected) => {
              setShowTimePicker(Platform.OS === 'ios');
              if (event.type === 'set' && selected) {
                const hh = String(selected.getHours()).padStart(2, '0');
                const mm = String(selected.getMinutes()).padStart(2, '0');
                const time = `${hh}:${mm}`;
                if (isValidTime(time)) setProfile({ nightBeforeTime: time });
              }
            }}
          />
        )}

        <Text style={[styles.rowLabel, styles.optionsLabel]}>Lembrete no dia da atividade</Text>
        <View style={styles.optionsWrap}>
          {REMINDER_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.option, profile.sameDayMinutesBefore === opt.value && styles.optionSelected]}
              onPress={() => setProfile({ sameDayMinutesBefore: opt.value })}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              accessibilityState={{ selected: profile.sameDayMinutesBefore === opt.value }}
            >
              <Text
                style={[styles.optionText, profile.sameDayMinutesBefore === opt.value && styles.optionTextSelected]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Dados</Text>
        <Pressable style={styles.dangerButton} onPress={confirmReset}>
          <Text style={styles.dangerButtonText}>Limpar todos os dados</Text>
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 60 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 16 },
  avatarWrap: { alignItems: 'center', marginBottom: 20, gap: 6 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarPlaceholder: { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 32, fontWeight: '700', color: colors.primaryDark },
  avatarHint: { fontSize: 12, color: colors.textMuted },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 12, marginBottom: 6 },
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
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 24, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  rowLabel: { fontSize: 14, color: colors.text, fontWeight: '500' },
  timeValue: { fontSize: 14, color: colors.primary, fontWeight: '700' },
  optionsLabel: { marginTop: 8 },
  optionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { fontSize: 13, color: colors.text },
  optionTextSelected: { color: '#fff', fontWeight: '700' },
  dangerButton: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dangerButtonText: { color: colors.danger, fontWeight: '700' },
});
