import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useLayoutEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ColorPicker } from '../../src/components/ColorPicker';
import { EmptyState } from '../../src/components/EmptyState';
import { useStore } from '../../src/store/useStore';
import { colors, locationPalette } from '../../src/theme';
import { confirmAsync, showAlert } from '../../src/utils/dialog';

export default function LocationForm() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const isNew = params.id === 'new';

  const locations = useStore((s) => s.locations);
  const addLocation = useStore((s) => s.addLocation);
  const updateLocation = useStore((s) => s.updateLocation);
  const deleteLocation = useStore((s) => s.deleteLocation);

  const existing = useMemo(() => locations.find((l) => l.id === params.id), [locations, params.id]);

  const [name, setName] = useState(existing?.name ?? '');
  const [address, setAddress] = useState(existing?.address ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [color, setColor] = useState(
    existing?.color ?? locationPalette[locations.length % locationPalette.length]
  );
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isNew ? 'Novo local' : 'Editar local' });
  }, [navigation, isNew]);

  if (!isNew && !existing) {
    return (
      <View style={styles.notFoundWrap}>
        <EmptyState title="Local não encontrado" subtitle="Ele pode ter sido excluído." />
        <Pressable
          style={styles.notFoundButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Text style={styles.notFoundButtonText}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  const canSave = name.trim().length > 0;

  async function handleSave() {
    if (saving) return;
    const payload = {
      name: name.trim(),
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
      color,
    };

    if (!isNew) {
      if (!existing) {
        router.back();
        return;
      }
      setSaving(true);
      try {
        await updateLocation(existing.id, payload);
        router.back();
      } catch (error) {
        showAlert(
          'Não foi possível salvar',
          error instanceof Error ? error.message : 'Tente novamente.'
        );
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    const confirmed = await confirmAsync(
      'Confirmar novo local',
      `Adicionar "${payload.name}"${payload.address ? ` (${payload.address})` : ''} como local de estudo?`,
      { confirmText: 'Adicionar' }
    );
    if (!confirmed) {
      setSaving(false);
      return;
    }
    addLocation(payload);
    router.back();
  }

  async function handleDelete() {
    if (!existing || saving) return;
    const confirmed = await confirmAsync(
      'Excluir local',
      `Excluir "${existing.name}"? As atividades vinculadas ficarão sem local.`,
      { confirmText: 'Excluir', destructive: true }
    );
    if (!confirmed) return;
    setSaving(true);
    try {
      await deleteLocation(existing.id);
      router.back();
    } catch (error) {
      showAlert(
        'Não foi possível excluir',
        error instanceof Error ? error.message : 'Tente novamente.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Nome do local</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Ex: SAMU, UPA, Hospital..."
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Endereço (opcional)</Text>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          placeholder="Rua, número, bairro"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Observações (opcional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Contato, instruções de acesso, etc."
          placeholderTextColor={colors.textMuted}
          multiline
        />

        <Text style={styles.label}>Cor</Text>
        <ColorPicker value={color} onChange={setColor} />

        <Pressable
          style={[styles.saveButton, (!canSave || saving) && styles.saveButtonDisabled]}
          disabled={!canSave || saving}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>
            {isNew ? 'Adicionar local' : 'Salvar alterações'}
          </Text>
        </Pressable>

        {!isNew && (
          <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={saving}>
            <Text style={styles.deleteButtonText}>Excluir local</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 60 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 14, marginBottom: 6 },
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
  textArea: { minHeight: 70, textAlignVertical: 'top', paddingTop: 12 },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  deleteButton: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  deleteButtonText: { color: colors.danger, fontWeight: '600' },
  notFoundWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  notFoundButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  notFoundButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
