import DatePicker from '@expo/ui/community/datetime-picker';
import { useDatabase } from '@nozbe/watermelondb/react';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, ScrollView, Text, View } from 'react-native';

import { Badge, Card, FieldLabel, NeuButton, NeuInput, NeuSwitch, Note, Spinner } from '@/components/neu';
import { useEmergencyProfile } from '@/hooks/use-emergency-profile';
import {
  BLOOD_TYPES,
  dateToIso,
  EMPTY_PROFILE,
  formatDateOfBirth,
  isoToDate,
  saveEmergencyProfile,
  type EmergencyProfileInput,
} from '@/lib/emergency-profile';

/*
 * Profile › Medical ID: create or edit the emergency profile. Saved to WatermelonDB (offline),
 * synced, and mirrored to the home screen widget when "Show on Home Screen" is on.
 */
export default function EmergencyProfileScreen() {
  const router = useRouter();
  const database = useDatabase();
  const profile = useEmergencyProfile();
  // The patient's edits; until the first edit the form shows the saved profile.
  const [draft, setDraft] = useState<EmergencyProfileInput | null>(null);
  const [saving, setSaving] = useState(false);
  // Android shows the date picker as a dialog that is open while mounted.
  const [pickerOpen, setPickerOpen] = useState(false);

  const saved = profile === undefined ? null : (profile ?? EMPTY_PROFILE);
  const form = draft ?? saved;

  if (!form) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <Spinner />
      </View>
    );
  }

  const base = form;
  const set = (patch: Partial<EmergencyProfileInput>) => setDraft((prev) => ({ ...(prev ?? base), ...patch }));
  const dob = isoToDate(form.dateOfBirth);

  function pickDate(date: Date) {
    setPickerOpen(false);
    set({ dateOfBirth: dateToIso(date) });
  }

  async function save() {
    if (saving || !form) return;
    setSaving(true);
    try {
      await saveEmergencyProfile(database, form);
      router.back();
    } catch (e) {
      Alert.alert('Could not save Medical ID', e instanceof Error ? e.message : 'Something went wrong.');
      setSaving(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-canvas dark:bg-canvas-dark"
      contentContainerClassName="gap-5 px-5 pb-10 pt-5"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      contentInsetAdjustmentBehavior="automatic">
      <Note>
        What a paramedic or doctor needs to know if you can&apos;t tell them yourself. Saved on this phone and
        backed up to your account.
      </Note>

      <Card className="gap-5 px-4 py-5">
        <View>
          <FieldLabel>Full name</FieldLabel>
          <NeuInput
            placeholder="As on your ID"
            value={form.fullName}
            onChangeText={(fullName) => set({ fullName })}
            autoComplete="name"
            textContentType="name"
            accessibilityLabel="Full name"
          />
        </View>

        <View>
          <FieldLabel>Date of birth</FieldLabel>
          {Platform.OS === 'ios' ? (
            <View className="flex-row items-center justify-between">
              <Text className="text-base text-ink dark:text-ink-dark">
                {dob ? formatDateOfBirth(form.dateOfBirth) : 'Not set'}
              </Text>
              <DatePicker
                mode="date"
                display="compact"
                value={dob ?? new Date(1990, 0, 1)}
                maximumDate={new Date()}
                onValueChange={(_event, date) => pickDate(date)}
              />
            </View>
          ) : (
            <>
              <NeuButton
                size="sm"
                title={dob ? formatDateOfBirth(form.dateOfBirth) : 'Set date of birth'}
                accessibilityHint="Opens a date picker"
                onPress={() => setPickerOpen(true)}
              />
              {pickerOpen && (
                <DatePicker
                  mode="date"
                  value={dob ?? new Date(1990, 0, 1)}
                  maximumDate={new Date()}
                  onValueChange={(_event, date) => pickDate(date)}
                  onDismiss={() => setPickerOpen(false)}
                />
              )}
            </>
          )}
        </View>

        <View>
          <FieldLabel>Blood type</FieldLabel>
          <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup" accessibilityLabel="Blood type">
            {BLOOD_TYPES.map((type) => (
              <NeuButton
                key={type}
                size="sm"
                title={type}
                className="min-w-[68px]"
                selected={form.bloodType === type}
                selectedTone="danger"
                accessibilityRole="radio"
                accessibilityLabel={`Blood type ${type}`}
                onPress={() => set({ bloodType: form.bloodType === type ? '' : type })}
              />
            ))}
            <NeuButton
              size="sm"
              title="Unknown"
              selected={!form.bloodType}
              accessibilityRole="radio"
              onPress={() => set({ bloodType: '' })}
            />
          </View>
        </View>

        <View>
          <FieldLabel>Known allergies</FieldLabel>
          <NeuInput
            placeholder="e.g. Penicillin, peanuts. Leave empty if none."
            value={form.knownAllergies}
            onChangeText={(knownAllergies) => set({ knownAllergies })}
            multiline
            textAlignVertical="top"
            className="min-h-20"
            accessibilityLabel="Known allergies"
          />
        </View>

        <View>
          <FieldLabel>Chronic conditions</FieldLabel>
          <NeuInput
            placeholder="e.g. Type 2 diabetes, asthma"
            value={form.chronicConditions}
            onChangeText={(chronicConditions) => set({ chronicConditions })}
            multiline
            textAlignVertical="top"
            className="min-h-20"
            accessibilityLabel="Chronic conditions"
          />
        </View>

        <View>
          <FieldLabel>Emergency contact number</FieldLabel>
          <NeuInput
            placeholder="+91 98765 43210"
            value={form.emergencyContactNumber}
            onChangeText={(emergencyContactNumber) => set({ emergencyContactNumber })}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            accessibilityLabel="Emergency contact number"
          />
        </View>
      </Card>

      <Card className="gap-3 px-4 py-5">
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <Text className="text-base font-semibold text-ink dark:text-ink-dark">Show on Home Screen</Text>
            <Text className="text-sm text-muted dark:text-muted-dark">Add the “Medical ID” widget to your home screen.</Text>
          </View>
          <NeuSwitch
            value={form.showOnWidget}
            onValueChange={(showOnWidget) => set({ showOnWidget })}
            accessibilityLabel="Show Medical ID on the home screen widget"
          />
        </View>
        {form.showOnWidget ? (
          <View className="flex-row items-start gap-2">
            <Badge label="Visible when locked" tone="warning" />
            <Text className="flex-1 text-xs text-muted dark:text-muted-dark">
              Anyone holding your phone can read the widget without unlocking it. That&apos;s what makes it useful in
              an emergency.
            </Text>
          </View>
        ) : null}
      </Card>

      <NeuButton title="Save Medical ID" variant="primary" loading={saving} onPress={save} />
    </ScrollView>
  );
}
