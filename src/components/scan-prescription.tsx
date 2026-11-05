import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.8,
};

type Picked = { uri: string; width: number; height: number };

function firstAsset(result: ImagePicker.ImagePickerResult): Picked | null {
  if (result.canceled || !result.assets?.length) return null;
  const { uri, width, height } = result.assets[0];
  return { uri, width, height };
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
 * "Scan Prescription" button: take a photo or pick one from the gallery, then preview it.
 * Phase 2 will hand `image.uri` to the AI scanner; for now the preview just confirms capture.
 */
export function ScanPrescription() {
  const [image, setImage] = useState<Picked | null>(null);

  // Android can kill the app while the camera is open; recover the photo it took.
  useEffect(() => {
    ImagePicker.getPendingResultAsync()
      .then((pending) => {
        if (pending && 'canceled' in pending) {
          const asset = firstAsset(pending);
          if (asset) setImage(asset);
        }
      })
      .catch(() => {});
  }, []);

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      if (!permission.canAskAgain) showSettingsPrompt('Camera');
      return;
    }
    const asset = firstAsset(await ImagePicker.launchCameraAsync(PICKER_OPTIONS));
    if (asset) setImage(asset);
  }

  async function pickFromGallery() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      if (!permission.canAskAgain) showSettingsPrompt('Photo');
      return;
    }
    const asset = firstAsset(await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS));
    if (asset) setImage(asset);
  }

  function scan() {
    Alert.alert('Scan Prescription', 'Choose where the prescription photo comes from.', [
      { text: 'Take Photo', onPress: () => void takePhoto().catch(reportError) },
      { text: 'Choose from Gallery', onPress: () => void pickFromGallery().catch(reportError) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <View className="mb-4">
      <Pressable
        accessibilityRole="button"
        onPress={scan}
        className="items-center rounded-xl bg-emerald-600 py-3.5 active:opacity-80">
        <Text className="text-base font-semibold text-white">Scan Prescription</Text>
      </Pressable>

      {image && (
        <View className="mt-3 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
          <Image
            source={{ uri: image.uri }}
            style={{ width: '100%', aspectRatio: image.width / image.height || 3 / 4, maxHeight: 280 }}
            contentFit="contain"
            accessibilityLabel="Selected prescription photo"
          />
          <View className="flex-row items-center justify-between bg-gray-50 px-4 py-2 dark:bg-gray-900">
            <Text className="text-sm text-gray-600 dark:text-gray-400">
              Captured {image.width}×{image.height}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => setImage(null)} hitSlop={8}>
              <Text className="text-sm font-medium text-red-500">Remove</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function reportError(e: unknown) {
  Alert.alert('Could not open camera or gallery', e instanceof Error ? e.message : 'Something went wrong.');
}
