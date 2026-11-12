import { useDatabase } from '@nozbe/watermelondb/react';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Card, FieldLabel, NeuButton, NeuInput, SectionTitle } from '@/components/neu';
import { savePrescription } from '@/lib/prescriptions';

/** Type a medication and dosage by hand and save it. `visitId` links it to the visit it came from. */
export function ManualEntryForm({ visitId }: { visitId?: string }) {
  const database = useDatabase();
  const [medication, setMedication] = useState('');
  const [dosage, setDosage] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedName, setSavedName] = useState<string | null>(null);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await savePrescription(database, { medication, dosage, visitId });
      setSavedName(medication.trim());
      setMedication('');
      setDosage('');
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="gap-3">
      <SectionTitle>Add by hand</SectionTitle>
      <Card className="gap-4 px-4 py-5">
        <View>
          <FieldLabel>Medication</FieldLabel>
          <NeuInput
            placeholder="e.g. Metformin"
            value={medication}
            onChangeText={(value) => {
              setMedication(value);
              setSavedName(null);
            }}
            accessibilityLabel="Medication"
          />
        </View>
        <View>
          <FieldLabel>Dosage</FieldLabel>
          <NeuInput
            placeholder="e.g. 500 mg twice daily"
            value={dosage}
            onChangeText={setDosage}
            accessibilityLabel="Dosage"
          />
        </View>
        <NeuButton title="Save Medication" variant="primary" loading={saving} onPress={save} />
      </Card>
      <Text accessibilityLiveRegion="polite" className="min-h-5 px-1 text-sm text-success dark:text-success-dark">
        {savedName ? `${savedName} added to your medications.` : ' '}
      </Text>
    </View>
  );
}
