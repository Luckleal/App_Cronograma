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
import { DateTimeField } from '../../src/components/DateTimeField';
import { EmptyState } from '../../src/components/EmptyState';
import { useStore } from '../../src/store/useStore';
import { colors, locationPalette } from '../../src/theme';
import {
  addDays,
  combineDateAndTime,
  formatDateFullPt,
  isValidISODate,
  toISODate,
  todayISO,
} from '../../src/utils/date';
import { confirmAsync, showAlert } from '../../src/utils/dialog';

export default function ModuleForm() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const isNew = params.id === 'new';

  const modules = useStore((s) => s.modules);
  const addModule = useStore((s) => s.addModule);
  const updateModule = useStore((s) => s.updateModule);
  const deleteModule = useStore((s) => s.deleteModule);

  const existing = useMemo(() => modules.find((m) => m.id === params.id), [modules, params.id]);

  const [name, setName] = useState(existing?.name ?? '');
  const [startDate, setStartDate] = useState(existing?.startDate ?? todayISO());
  const [endDate, setEndDate] = useState(existing?.endDate ?? addDays(todayISO(), 27));
  const [color, setColor] = useState(
    existing?.color ?? locationPalette[modules.length % locationPalette.length]
  );
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isNew ? 'Novo módulo' : 'Editar módulo' });
  }, [navigation, isNew]);

  if (!isNew && !existing) {
    return (
      <View style={styles.notFoundWrap}>
        <EmptyState title="Módulo não encontrado" subtitle="Ele pode ter sido excluído." />
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
    if (!isValidISODate(startDate) || !isValidISODate(endDate)) {
      showAlert('Data inválida', 'Verifique as datas de início e fim.');
      return;
    }

    const payload = {
      name: name.trim(),
      startDate,
      endDate: endDate < startDate ? startDate : endDate,
      color,
    };

    if (!isNew) {
      setSaving(true);
      if (existing) updateModule(existing.id, payload);
      router.back();
      return;
    }

    setSaving(true);
    const confirmed = await confirmAsync(
      'Confirmar novo módulo',
      `Criar o módulo "${payload.name}" de ${formatDateFullPt(payload.startDate)} a ${formatDateFullPt(payload.endDate)}?`,
      { confirmText: 'Criar módulo' }
    );
    if (!confirmed) {
      setSaving(false);
      return;
    }
    addModule(payload);
    router.back();
  }

  async function handleDelete() {
    if (!existing || saving) return;
    const confirmed = await confirmAsync(
      'Excluir módulo',
      `Excluir "${existing.name}"? As atividades vinculadas ficarão sem módulo.`,
      { confirmText: 'Excluir', destructive: true }
    );
    if (!confirmed) return;
    deleteModule(existing.id);
    router.back();
  }

  return (
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Nome do módulo</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Ex: UE 1"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={styles.label}>Início</Text>
        <DateTimeField
          mode="date"
          value={combineDateAndTime(startDate)}
          style={styles.input}
          accessibilityLabel={`Data de início: ${formatDateFullPt(startDate)}`}
          onChange={(selected) => {
            const newStart = toISODate(selected);
            setStartDate(newStart);
            if (newStart > endDate) setEndDate(newStart);
          }}
        >
          <Text style={styles.inputText}>{formatDateFullPt(startDate)}</Text>
        </DateTimeField>

        <Text style={styles.label}>Fim</Text>
        <DateTimeField
          mode="date"
          value={combineDateAndTime(endDate)}
          minimumDate={combineDateAndTime(startDate)}
          style={styles.input}
          accessibilityLabel={`Data de fim: ${formatDateFullPt(endDate)}`}
          onChange={(selected) => setEndDate(toISODate(selected))}
        >
          <Text style={styles.inputText}>{formatDateFullPt(endDate)}</Text>
        </DateTimeField>

        <Text style={styles.label}>Cor</Text>
        <ColorPicker value={color} onChange={setColor} />

        <Pressable
          style={[styles.saveButton, (!canSave || saving) && styles.saveButtonDisabled]}
          disabled={!canSave || saving}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>
            {isNew ? 'Adicionar módulo' : 'Salvar alterações'}
          </Text>
        </Pressable>

        {!isNew && (
          <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={saving}>
            <Text style={styles.deleteButtonText}>Excluir módulo</Text>
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
    justifyContent: 'center',
  },
  inputText: { fontSize: 15, color: colors.text },
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
