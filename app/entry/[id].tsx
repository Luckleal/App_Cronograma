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
import { DateTimeField } from '../../src/components/DateTimeField';
import { EmptyState } from '../../src/components/EmptyState';
import { describeReminderPlan } from '../../src/notifications';
import { useStore } from '../../src/store/useStore';
import { colors } from '../../src/theme';
import {
  combineDateAndTime,
  compareISODate,
  formatDateFullPt,
  formatTimeRange,
  isValidISODate,
  isValidTime,
  toISODate,
  todayISO,
  weekdayLong,
} from '../../src/utils/date';
import { confirmAsync, showAlert } from '../../src/utils/dialog';

export default function EntryForm() {
  const params = useLocalSearchParams<{ id: string; date?: string; moduleId?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const isNew = params.id === 'new';

  const entries = useStore((s) => s.entries);
  const locations = useStore((s) => s.locations);
  const modules = useStore((s) => s.modules);
  const profile = useStore((s) => s.profile);
  const addEntry = useStore((s) => s.addEntry);
  const updateEntry = useStore((s) => s.updateEntry);
  const deleteEntry = useStore((s) => s.deleteEntry);

  const existing = useMemo(() => entries.find((e) => e.id === params.id), [entries, params.id]);
  const validParamDate = params.date && isValidISODate(params.date) ? params.date : undefined;
  const validParamModuleId =
    params.moduleId && modules.some((m) => m.id === params.moduleId) ? params.moduleId : undefined;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [startDate, setStartDate] = useState(existing?.startDate ?? validParamDate ?? todayISO());
  const [endDate, setEndDate] = useState(existing?.endDate ?? validParamDate ?? todayISO());
  const [startTime, setStartTime] = useState(existing?.startTime);
  const [endTime, setEndTime] = useState(existing?.endTime);
  const [locationId, setLocationId] = useState(existing?.locationId);
  const [moduleId, setModuleId] = useState(existing?.moduleId ?? validParamModuleId);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isNew ? 'Nova atividade' : 'Editar atividade' });
  }, [navigation, isNew]);

  if (!isNew && !existing) {
    return (
      <View style={styles.notFoundWrap}>
        <EmptyState title="Atividade não encontrada" subtitle="Ela pode ter sido excluída." />
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

  const canSave = title.trim().length > 0;
  const sameDayTimeWarning =
    startDate === endDate && !!startTime && !!endTime && endTime < startTime;

  async function handleSave() {
    if (saving) return;
    if (!isValidISODate(startDate) || !isValidISODate(endDate)) {
      showAlert('Data inválida', 'Verifique as datas de início e fim.');
      return;
    }
    if ((startTime && !isValidTime(startTime)) || (endTime && !isValidTime(endTime))) {
      showAlert('Horário inválido', 'Verifique os horários de início e fim.');
      return;
    }

    const normalizedEndDate = compareISODate(endDate, startDate) < 0 ? startDate : endDate;
    const payload = {
      title: title.trim(),
      startDate,
      endDate: normalizedEndDate,
      startTime,
      endTime,
      locationId,
      moduleId,
      notes: notes.trim() || undefined,
    };

    if (!isNew) {
      if (!existing) {
        router.back();
        return;
      }
      setSaving(true);
      try {
        await updateEntry(existing.id, payload);
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

    const location = locations.find((l) => l.id === locationId);
    const dateLine =
      payload.startDate === payload.endDate
        ? `${weekdayLong(payload.startDate)}, ${formatDateFullPt(payload.startDate)}`
        : `${formatDateFullPt(payload.startDate)} a ${formatDateFullPt(payload.endDate)}`;
    const summaryLines = [
      payload.title,
      dateLine,
      formatTimeRange(payload.startTime, payload.endTime),
      location?.name,
    ].filter(Boolean);
    const reminderText = describeReminderPlan(profile, !!payload.startTime);

    const confirmed = await confirmAsync(
      'Confirmar nova atividade',
      `${summaryLines.join('\n')}\n\n${reminderText}`,
      { confirmText: 'Criar atividade' }
    );
    if (!confirmed) return;
    setSaving(true);
    try {
      await addEntry(payload);
      router.back();
    } catch (error) {
      showAlert(
        'Não foi possível salvar',
        error instanceof Error ? error.message : 'Tente novamente.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!existing || saving) return;
    const confirmed = await confirmAsync(
      'Excluir atividade',
      `Tem certeza que deseja excluir "${existing.title}"?`,
      { confirmText: 'Excluir', destructive: true }
    );
    if (!confirmed) return;
    setSaving(true);
    try {
      await deleteEntry(existing.id);
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
        <Text style={styles.label}>Título da atividade</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Ex: Plantão SAMU, Aula de Radiologia..."
          placeholderTextColor={colors.textMuted}
        />

        <View style={styles.timeRowWrap}>
          <View style={styles.timeCol}>
            <Text style={styles.label}>Data de início</Text>
            <DateTimeField
              mode="date"
              value={combineDateAndTime(startDate)}
              style={styles.input}
              accessibilityLabel={`Data de início: ${formatDateFullPt(startDate)}`}
              onChange={(selected) => {
                const newStart = toISODate(selected);
                setStartDate(newStart);
                if (compareISODate(endDate, newStart) < 0) setEndDate(newStart);
              }}
            >
              <Text style={styles.inputText}>{formatDateFullPt(startDate)}</Text>
            </DateTimeField>
          </View>
          <View style={styles.timeCol}>
            <Text style={styles.label}>Data de fim</Text>
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
          </View>
        </View>

        <View style={styles.timeRowWrap}>
          <View style={styles.timeCol}>
            <Text style={styles.label}>Início</Text>
            <DateTimeField
              mode="time"
              value={combineDateAndTime(startDate, startTime ?? '08:00')}
              is24Hour
              empty={!startTime}
              style={styles.input}
              containerStyle={styles.timeInputRow}
              accessibilityLabel={
                startTime ? `Horário de início: ${startTime}` : 'Definir horário de início'
              }
              onChange={(selected) => {
                setStartTime(
                  `${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`
                );
              }}
              trailing={
                startTime && (
                  <Pressable
                    style={styles.clearButton}
                    onPress={() => setStartTime(undefined)}
                    accessibilityRole="button"
                    accessibilityLabel="Limpar horário de início"
                  >
                    <Text style={styles.clearButtonText}>×</Text>
                  </Pressable>
                )
              }
            >
              <Text style={styles.inputText}>{startTime ?? 'Definir'}</Text>
            </DateTimeField>
          </View>
          <View style={styles.timeCol}>
            <Text style={styles.label}>Fim</Text>
            <DateTimeField
              mode="time"
              value={combineDateAndTime(startDate, endTime ?? startTime ?? '09:00')}
              is24Hour
              empty={!endTime}
              style={styles.input}
              containerStyle={styles.timeInputRow}
              accessibilityLabel={endTime ? `Horário de fim: ${endTime}` : 'Definir horário de fim'}
              onChange={(selected) => {
                setEndTime(
                  `${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`
                );
              }}
              trailing={
                endTime && (
                  <Pressable
                    style={styles.clearButton}
                    onPress={() => setEndTime(undefined)}
                    accessibilityRole="button"
                    accessibilityLabel="Limpar horário de fim"
                  >
                    <Text style={styles.clearButtonText}>×</Text>
                  </Pressable>
                )
              }
            >
              <Text style={styles.inputText}>{endTime ?? 'Definir'}</Text>
            </DateTimeField>
          </View>
        </View>

        {sameDayTimeWarning && (
          <Text style={styles.warningText}>
            O horário de fim é antes do início. Se for um plantão que passa da meia-noite, use datas
            diferentes.
          </Text>
        )}

        <Text style={styles.label}>Local</Text>
        <View style={styles.chipsWrap}>
          <Pressable
            style={[styles.chip, !locationId && styles.chipSelected]}
            onPress={() => setLocationId(undefined)}
            accessibilityRole="button"
            accessibilityLabel="Nenhum local"
            accessibilityState={{ selected: !locationId }}
          >
            <Text style={[styles.chipText, !locationId && styles.chipTextSelected]}>Nenhum</Text>
          </Pressable>
          {locations.map((loc) => (
            <Pressable
              key={loc.id}
              style={[
                styles.chip,
                locationId === loc.id && { backgroundColor: loc.color, borderColor: loc.color },
              ]}
              onPress={() => setLocationId(loc.id)}
              accessibilityRole="button"
              accessibilityLabel={loc.name}
              accessibilityState={{ selected: locationId === loc.id }}
            >
              <Text style={[styles.chipText, locationId === loc.id && styles.chipTextSelected]}>
                {loc.name}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={styles.chipAdd}
            onPress={() => router.push('/location/new')}
            accessibilityRole="button"
            accessibilityLabel="Novo local"
          >
            <Text style={styles.chipAddText}>+ Novo local</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Módulo (opcional)</Text>
        <View style={styles.chipsWrap}>
          <Pressable
            style={[styles.chip, !moduleId && styles.chipSelected]}
            onPress={() => setModuleId(undefined)}
            accessibilityRole="button"
            accessibilityLabel="Nenhum módulo"
            accessibilityState={{ selected: !moduleId }}
          >
            <Text style={[styles.chipText, !moduleId && styles.chipTextSelected]}>Nenhum</Text>
          </Pressable>
          {modules.map((mod) => (
            <Pressable
              key={mod.id}
              style={[
                styles.chip,
                moduleId === mod.id && { backgroundColor: mod.color, borderColor: mod.color },
              ]}
              onPress={() => setModuleId(mod.id)}
              accessibilityRole="button"
              accessibilityLabel={mod.name}
              accessibilityState={{ selected: moduleId === mod.id }}
            >
              <Text style={[styles.chipText, moduleId === mod.id && styles.chipTextSelected]}>
                {mod.name}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={styles.chipAdd}
            onPress={() => router.push('/module/new')}
            accessibilityRole="button"
            accessibilityLabel="Novo módulo"
          >
            <Text style={styles.chipAddText}>+ Novo módulo</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Observações (opcional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Detalhes extras sobre a atividade"
          placeholderTextColor={colors.textMuted}
          multiline
        />

        <Pressable
          style={[styles.saveButton, (!canSave || saving) && styles.saveButtonDisabled]}
          disabled={!canSave || saving}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>
            {isNew ? 'Adicionar atividade' : 'Salvar alterações'}
          </Text>
        </Pressable>

        {!isNew && (
          <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={saving}>
            <Text style={styles.deleteButtonText}>Excluir atividade</Text>
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
  textArea: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  timeRowWrap: { flexDirection: 'row', gap: 12 },
  timeCol: { flex: 1 },
  timeInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clearButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: { fontSize: 18, color: colors.textMuted, lineHeight: 20 },
  warningText: { color: colors.danger, fontSize: 12, marginTop: 8 },
  notFoundWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  notFoundButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  notFoundButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipSelected: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: 13, color: colors.text },
  chipTextSelected: { color: '#fff', fontWeight: '700' },
  chipAdd: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  chipAddText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
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
});
