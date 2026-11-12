import DatePicker from '@expo/ui/community/datetime-picker';
import { useDatabase } from '@nozbe/watermelondb/react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, Text, View } from 'react-native';

import { Card, FieldLabel, NeuButton, NeuInput, Spinner } from '@/components/neu';
import { startOfDay } from '@/lib/doses';
import { createVisit, formatVisitDate, updateVisit, type VisitInput, type VisitRecord } from '@/lib/visits';

const EMPTY: VisitInput = { visitedAt: startOfDay(), facility: '', doctor: '', reason: '', notes: '' };

/** New visit, or edit an existing one with ?id=. */
export default function EditVisitScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const database = useDatabase();
  const router = useRouter();
  const [record, setRecord] = useState<VisitRecord | null>(null);
  const [form, setForm] = useState<VisitInput>(EMPTY);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  // Android shows the date picker as a dialog that is open while mounted.
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    database
      .get<VisitRecord>('visits')
      .find(id)
      .then((v) => {
        if (!active) return;
        setRecord(v);
        setForm({ visitedAt: v.visitedAt, facility: v.facility, doctor: v.doctor, reason: v.reason, notes: v.notes });
      })
      .catch(() => Alert.alert('Visit not found', 'It may have been deleted.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [database, id]);

  const set = (patch: Partial<VisitInput>) => setForm((prev) => ({ ...prev, ...patch }));

  function pickDate(date: Date) {
    setPickerOpen(false);
    set({ visitedAt: startOfDay(date.getTime()) });
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      if (record) {
        await updateVisit(database, record, form);
        router.back();
      } else {
        const newId = await createVisit(database, form);
        // Open the new visit so documents and medications can be added straight away.
        router.replace({ pathname: '/visits/[id]', params: { id: newId } });
      }
    } catch (e) {
      Alert.alert('Could not save visit', e instanceof Error ? e.message : 'Something went wrong.');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <Spinner />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-canvas dark:bg-canvas-dark"
      contentContainerClassName="gap-5 px-5 pb-10 pt-5"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets>
      <Stack.Screen options={{ title: id ? 'Edit Visit' : 'New Visit' }} />

      <Card className="gap-4 px-4 py-5">
        <View>
          <FieldLabel>Date</FieldLabel>
          {Platform.OS === 'ios' ? (
            <View className="flex-row items-center justify-between">
              <Text className="text-base text-ink dark:text-ink-dark">{formatVisitDate(form.visitedAt)}</Text>
              <DatePicker
                mode="date"
                display="compact"
                value={new Date(form.visitedAt)}
                maximumDate={new Date()}
                onValueChange={(_event, date) => pickDate(date)}
              />
            </View>
          ) : (
            <>
              <NeuButton
                size="sm"
                title={formatVisitDate(form.visitedAt)}
                accessibilityHint="Changes the visit date"
                onPress={() => setPickerOpen(true)}
              />
              {pickerOpen && (
                <DatePicker
                  mode="date"
                  value={new Date(form.visitedAt)}
                  maximumDate={new Date()}
                  onValueChange={(_event, date) => pickDate(date)}
                  onDismiss={() => setPickerOpen(false)}
                />
              )}
            </>
          )}
        </View>
        <View>
          <FieldLabel>Hospital or clinic</FieldLabel>
          <NeuInput
            placeholder="e.g. City Hospital"
            value={form.facility}
            onChangeText={(facility) => set({ facility })}
            accessibilityLabel="Hospital or clinic"
          />
        </View>
        <View>
          <FieldLabel>Doctor</FieldLabel>
          <NeuInput
            placeholder="e.g. Dr. Rao"
            value={form.doctor}
            onChangeText={(doctor) => set({ doctor })}
            accessibilityLabel="Doctor"
          />
        </View>
        <View>
          <FieldLabel>Reason</FieldLabel>
          <NeuInput
            placeholder="e.g. Diabetes follow-up"
            value={form.reason}
            onChangeText={(reason) => set({ reason })}
            accessibilityLabel="Reason for visit"
          />
        </View>
        <View>
          <FieldLabel>Notes</FieldLabel>
          <NeuInput
            placeholder="What the doctor said, next steps…"
            value={form.notes}
            onChangeText={(notes) => set({ notes })}
            multiline
            textAlignVertical="top"
            className="min-h-28"
            accessibilityLabel="Notes"
          />
        </View>
      </Card>

      <NeuButton title={id ? 'Save Changes' : 'Save Visit'} variant="primary" loading={saving} onPress={save} />
    </ScrollView>
  );
}
