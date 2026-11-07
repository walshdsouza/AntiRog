import { useDatabase } from '@nozbe/watermelondb/react';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { savePrescription } from '@/lib/prescriptions';

const inputClass =
  'mb-3 rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-base text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white';

/** Type a medication and dosage by hand and save it to the vault. */
export function ManualEntryForm() {
  const database = useDatabase();
  const [medication, setMedication] = useState('');
  const [dosage, setDosage] = useState('');
  const [savedName, setSavedName] = useState<string | null>(null);

  async function save() {
    try {
      await savePrescription(database, { medication, dosage });
      setSavedName(medication.trim());
      setMedication('');
      setDosage('');
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  return (
    <View>
      <Text className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Add manually</Text>
      <TextInput
        className={inputClass}
        placeholder="Medication"
        placeholderTextColor="#9ca3af"
        value={medication}
        onChangeText={(value) => {
          setMedication(value);
          setSavedName(null);
        }}
      />
      <TextInput
        className={inputClass}
        placeholder="Dosage (e.g. 500 mg twice daily)"
        placeholderTextColor="#9ca3af"
        value={dosage}
        onChangeText={setDosage}
      />
      <Pressable
        accessibilityRole="button"
        onPress={save}
        className="items-center rounded-xl bg-blue-500 py-3.5 active:opacity-80">
        <Text className="text-base font-semibold text-white">Save</Text>
      </Pressable>
      <Text accessibilityLiveRegion="polite" className="mt-2 min-h-5 text-sm text-gray-500 dark:text-gray-400">
        {savedName ? `${savedName} saved to your vault.` : ' '}
      </Text>
    </View>
  );
}
