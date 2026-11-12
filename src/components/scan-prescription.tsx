import { useDatabase } from '@nozbe/watermelondb/react';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { cssInterop } from 'nativewind';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Text, View } from 'react-native';

import { Card, Inset, NeuButton, SectionTitle } from '@/components/neu';
import { extractMedications, type ExtractedMedication } from '@/lib/gemini';
import { savePrescription } from '@/lib/prescriptions';

// expo-image isn't a core component, so tell NativeWind to turn its className into style.
cssInterop(Image, { className: 'style' });

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.8,
};

type Picked = { uri: string; width: number; height: number; mimeType?: string };

type SaveState = 'idle' | 'saving' | 'saved';
type Item = ExtractedMedication & { key: string; state: SaveState; error?: string };

function firstAsset(result: ImagePicker.ImagePickerResult): Picked | null {
  if (result.canceled || !result.assets?.length) return null;
  const { uri, width, height, mimeType } = result.assets[0];
  return { uri, width, height, mimeType: mimeType ?? undefined };
}

function showSettingsPrompt(what: string) {
  Alert.alert(
    `${what} access needed`,
    `Allow ${what.toLowerCase()} access in Settings to scan a prescription.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ],
  );
}

/**
 * "Scan Prescription" button: take a photo or pick one from the gallery, preview it, send it to
 * Gemini, and list every medication found, each with its own Save button. `visitId` links saved
 * medications to the visit they came from.
 */
export function ScanPrescription({ visitId }: { visitId?: string }) {
  const database = useDatabase();
  const [image, setImage] = useState<Picked | null>(null);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  // Only the most recent scan may update the results.
  const scanId = useRef(0);

  async function analyze(picked: Picked) {
    const id = ++scanId.current;
    setImage(picked);
    setItems([]);
    setProcessing(true);
    setStatus(null);
    try {
      const meds = await extractMedications(picked.uri, picked.mimeType);
      if (id !== scanId.current) return;
      if (!meds.length) {
        setStatus('Could not find any medications in this photo. Try a clearer, well-lit photo.');
      } else {
        setItems(meds.map((m, i) => ({ ...m, key: `${id}-${i}`, state: 'idle' })));
        setStatus(
          `Found ${meds.length} medication${meds.length === 1 ? '' : 's'}. Check each one before saving.`,
        );
      }
    } catch (e) {
      if (id !== scanId.current) return;
      setStatus(e instanceof Error ? e.message : 'Could not read the prescription.');
    } finally {
      if (id === scanId.current) setProcessing(false);
    }
  }

  function updateItem(key: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  async function saveItem(item: Item) {
    updateItem(item.key, { state: 'saving', error: undefined });
    try {
      await savePrescription(database, { medication: item.medication, dosage: item.dosage, visitId });
      updateItem(item.key, { state: 'saved' });
    } catch (e) {
      updateItem(item.key, {
        state: 'idle',
        error: e instanceof Error ? e.message : 'Could not save.',
      });
    }
  }

  function clear() {
    scanId.current++;
    setImage(null);
    setItems([]);
    setProcessing(false);
    setStatus(null);
  }

  // Android can kill the app while the camera is open; recover the photo it took.
  const onPendingResult = useEffectEvent(
    (pending: Awaited<ReturnType<typeof ImagePicker.getPendingResultAsync>>) => {
      if (pending && 'canceled' in pending) {
        const asset = firstAsset(pending);
        if (asset) void analyze(asset);
      }
    },
  );
  useEffect(() => {
    ImagePicker.getPendingResultAsync()
      .then((pending) => onPendingResult(pending))
      .catch(() => {});
  }, []);

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      if (!permission.canAskAgain) showSettingsPrompt('Camera');
      return;
    }
    const asset = firstAsset(await ImagePicker.launchCameraAsync(PICKER_OPTIONS));
    if (asset) void analyze(asset);
  }

  async function pickFromGallery() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      if (!permission.canAskAgain) showSettingsPrompt('Photo');
      return;
    }
    const asset = firstAsset(await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS));
    if (asset) void analyze(asset);
  }

  function scan() {
    Alert.alert('Scan Prescription', 'Choose where the prescription photo comes from.', [
      { text: 'Take Photo', onPress: () => void takePhoto().catch(reportError) },
      { text: 'Choose from Gallery', onPress: () => void pickFromGallery().catch(reportError) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <View className="gap-3">
      <SectionTitle>From a prescription photo</SectionTitle>
      <NeuButton
        title={processing ? 'Reading prescription…' : 'Scan Prescription'}
        subtitle={processing ? undefined : 'Photo or gallery · read with AI'}
        variant="primary"
        loading={processing}
        onPress={scan}
      />

      {image && (
        <Card className="gap-3 p-3">
          <Inset radius={16} className="h-48 overflow-hidden p-0">
            <Image
              source={{ uri: image.uri }}
              className="h-48 w-full"
              contentFit="contain"
              accessibilityLabel="Selected prescription photo"
            />
            {processing && (
              <View className="absolute inset-0 items-center justify-center bg-black/40">
                <ActivityIndicator size="large" color="#ffffff" />
                <Text className="mt-2 text-sm font-medium text-white">Analyzing with AI…</Text>
              </View>
            )}
          </Inset>
          <View className="flex-row items-center justify-between px-1">
            <Text className="text-sm text-muted dark:text-muted-dark">
              Captured {image.width}×{image.height}
            </Text>
            <NeuButton size="sm" title="Remove" onPress={clear} />
          </View>
        </Card>
      )}

      {status && (
        <Text accessibilityLiveRegion="polite" className="px-1 text-sm text-muted dark:text-muted-dark">
          {status}
        </Text>
      )}

      {items.map((item) => (
        <ExtractedRow key={item.key} item={item} onSave={() => saveItem(item)} />
      ))}
    </View>
  );
}

function ExtractedRow({ item, onSave }: { item: Item; onSave: () => void }) {
  const missingDosage = !item.dosage;
  const saved = item.state === 'saved';
  return (
    <Card tone={saved ? 'success' : 'default'} className="flex-row items-center gap-3 px-4 py-3">
      <View className="flex-1">
        <Text className="text-base font-semibold text-ink dark:text-ink-dark">{item.medication}</Text>
        <Text className="text-sm text-muted dark:text-muted-dark">
          {missingDosage ? 'Dosage not readable — add it by hand below.' : item.dosage}
        </Text>
        {item.error && <Text className="mt-1 text-sm text-danger dark:text-danger-dark">{item.error}</Text>}
      </View>
      <NeuButton
        size="sm"
        title={saved ? 'Saved ✓' : 'Save'}
        variant={saved ? 'raised' : 'primary'}
        accessibilityLabel={`Save ${item.medication}`}
        loading={item.state === 'saving'}
        disabled={item.state !== 'idle' || missingDosage}
        onPress={onSave}
      />
    </Card>
  );
}

function reportError(e: unknown) {
  Alert.alert('Could not open camera or gallery', e instanceof Error ? e.message : 'Something went wrong.');
}
