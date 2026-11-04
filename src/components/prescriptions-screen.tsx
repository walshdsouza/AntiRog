import { useDatabase } from '@nozbe/watermelondb/react';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ObservedPrescriptionList } from '@/components/prescription-list';
import { supabase } from '@/lib/supabase';
import { syncData } from '@/lib/sync';

export function PrescriptionsScreen() {
  const database = useDatabase();
  const [medication, setMedication] = useState('');
  const [dosage, setDosage] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  async function save() {
    const med = medication.trim();
    const dose = dosage.trim();
    if (!med || !dose) {
      Alert.alert('Missing details', 'Enter both a medication and a dosage.');
      return;
    }
    try {
      // getUser() asks the server, which fails offline; fall back to the session cached on the device.
      let userId: string | undefined;
      const { data: userData } = await supabase.auth.getUser();
      userId = userData.user?.id;
      if (!userId) {
        const { data: sessionData } = await supabase.auth.getSession();
        userId = sessionData.session?.user.id;
      }
      if (!userId) {
        Alert.alert('Not signed in', 'Sign in again to save prescriptions.');
        return;
      }

      await database.write(async () => {
        await database.get('prescriptions').create((record: any) => {
          record.medication = med;
          record.dosage = dose;
          record.userId = userId;
        });
      });
      setMedication('');
      setDosage('');
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  async function sync() {
    setSyncing(true);
    setSyncMessage(null);
    const result = await syncData();
    setSyncing(false);
    if (result.ok) setSyncMessage('Synced just now.');
    else if (result.offline) setSyncMessage('You are offline. Your changes are saved and will sync later.');
    else if (result.skipped) setSyncMessage('Sign in to sync.');
    else setSyncMessage(`Sync failed: ${result.error instanceof Error ? result.error.message : 'unknown error'}`);
  }

  const inputClass =
    'mb-3 rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-base text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white';

  return (
    <SafeAreaView className="flex-1 bg-white px-6 pt-4 dark:bg-black">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-gray-900 dark:text-white">Prescriptions</Text>
        <Pressable onPress={() => supabase.auth.signOut()} accessibilityRole="button">
          <Text className="text-sm font-medium text-blue-500">Sign out</Text>
        </Pressable>
      </View>

      <TextInput
        className={inputClass}
        placeholder="Medication"
        placeholderTextColor="#9ca3af"
        value={medication}
        onChangeText={setMedication}
      />
      <TextInput
        className={inputClass}
        placeholder="Dosage (e.g. 500 mg twice daily)"
        placeholderTextColor="#9ca3af"
        value={dosage}
        onChangeText={setDosage}
      />

      <View className="mb-2 flex-row gap-3">
        <Pressable
          accessibilityRole="button"
          onPress={save}
          className="flex-1 items-center rounded-xl bg-blue-500 py-3.5 active:opacity-80">
          <Text className="text-base font-semibold text-white">Save</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={syncing}
          onPress={sync}
          className={`flex-1 items-center rounded-xl border border-blue-500 py-3.5 active:opacity-80 ${syncing ? 'opacity-60' : ''}`}>
          {syncing ? (
            <ActivityIndicator color="#3b82f6" />
          ) : (
            <Text className="text-base font-semibold text-blue-500">Sync Data</Text>
          )}
        </Pressable>
      </View>

      <Text className="mb-4 min-h-5 text-sm text-gray-500 dark:text-gray-400">{syncMessage ?? ' '}</Text>

      <ObservedPrescriptionList database={database} />
    </SafeAreaView>
  );
}
