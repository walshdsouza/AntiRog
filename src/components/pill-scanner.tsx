import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission, useFrameOutput } from 'react-native-vision-camera';
import { createSynchronizable, scheduleOnRN } from 'react-native-worklets';

import { usePillModel } from '@/hooks/use-pill-model';
import { decodeTopK, inputByteLength, packPixels } from '@/lib/pill-model';

/** Run the model at most this often. The camera delivers ~30 fps; 5 predictions a second is plenty. */
const INFERENCE_INTERVAL_MS = 200;
/** Push results to React at most this often, so the overlay doesn't re-render on every inference. */
const UI_INTERVAL_MS = 250;
const TOP_K = 3;

type Prediction = { label: string; score: number };
type ScanResult = { predictions: Prediction[]; inferenceMs: number };

function useAppActive() {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  return active;
}

/**
 * Live, on-device pill identification: camera frames → GPU resize → TFLite model → top matches.
 * Everything runs on the phone; frames are never stored or uploaded.
 */
export function PillScanner({ onClose }: { onClose: () => void }) {
  const permission = useCameraPermission();
  const device = useCameraDevice('back');
  const pill = usePillModel();
  const focused = useIsFocused();
  const appActive = useAppActive();

  const [result, setResult] = useState<ScanResult | null>(null);
  const [frameError, setFrameError] = useState<string | null>(null);
  // Shared with the frame thread: when the model last ran, and when React was last updated.
  const [clock] = useState(() => ({
    lastRun: createSynchronizable(0, { fixedType: true }),
    lastUi: createSynchronizable(0, { fixedType: true }),
  }));

  const { hasPermission, canRequestPermission, requestPermission } = permission;
  useEffect(() => {
    if (!hasPermission && canRequestPermission) void requestPermission();
  }, [hasPermission, canRequestPermission, requestPermission]);

  const ready = pill.state === 'ready' ? pill : null;
  const labels = ready?.config.labels;

  function showResult(indices: number[], scores: number[], inferenceMs: number) {
    if (!labels) return;
    setResult({
      predictions: indices.map((index, i) => ({ label: labels[index] ?? `Class ${index}`, score: scores[i] })),
      inferenceMs,
    });
  }

  function showFrameError(message: string) {
    console.log('[pill-scanner] Frame processing failed:', message);
    setFrameError(message);
  }

  // Plain values for the frame thread. (Capturing `ready.config` would copy every label into it.)
  const model = ready?.model;
  const resizer = ready?.resizer;
  const expectedBytes = ready ? inputByteLength(ready.config) : 0;
  const rows = ready
    ? ready.config.input.height * (ready.config.input.pixelLayout === 'planar' ? 3 : 1)
    : 0;
  const outType = ready?.config.output.dataType ?? 'uint8';
  const outScale = ready?.config.output.scale ?? 1;
  const outZero = ready?.config.output.zeroPoint ?? 0;
  const softmax = ready?.config.output.activation === 'softmax';
  const { lastRun, lastUi } = clock;

  const frameOutput = useFrameOutput({
    // The resizer needs YUV on iOS and accepts anything on Android; YUV is the cheapest to stream.
    pixelFormat: 'yuv',
    // Smaller buffers: the model only needs 224×224 anyway.
    enablePreviewSizedOutputBuffers: true,
    dropFramesWhileBusy: true,
    onFrame(frame) {
      'worklet';
      try {
        if (model == null || resizer == null) return;
        const now = Date.now();
        if (now - lastRun.getDirty() < INFERENCE_INTERVAL_MS) return;
        lastRun.setDirty(now);

        const resized = resizer.resize(frame);
        try {
          const input = packPixels(resized.getPixelBuffer(), expectedBytes, rows);
          if (input == null) {
            scheduleOnRN(showFrameError, 'Resized frame has an unexpected size.');
            return;
          }
          const [output] = model.runSync([input]);
          const top = decodeTopK(output, TOP_K, outType, outScale, outZero, softmax);
          const done = Date.now();
          if (done - lastUi.getDirty() >= UI_INTERVAL_MS) {
            lastUi.setDirty(done);
            scheduleOnRN(showResult, top.indices, top.scores, done - now);
          }
        } finally {
          resized.dispose();
        }
      } catch (e) {
        scheduleOnRN(showFrameError, String(e));
      } finally {
        // Always release the frame, or the camera pipeline stalls.
        frame.dispose();
      }
    },
  });

  // ---- States before the camera can run --------------------------------------------------

  let blocker: React.ReactNode = null;
  if (!hasPermission) {
    blocker = canRequestPermission ? (
      <Message text="Allow camera access to identify pills." />
    ) : (
      <Message
        text="Camera access is off. Allow it for AntiRog in Settings to identify pills."
        action={{ label: 'Open Settings', onPress: () => void Linking.openSettings() }}
      />
    );
  } else if (device == null) {
    blocker = <Message text="No back camera found on this device." />;
  } else if (pill.state === 'unsupported' || pill.state === 'error') {
    blocker = <Message text={pill.message} />;
  }

  return (
    <View className="flex-1 bg-black">
      {!blocker && device != null && (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={focused && appActive}
          outputs={[frameOutput]}
        />
      )}

      <SafeAreaView className="flex-1 justify-between" edges={['top', 'bottom']}>
        <View className="flex-row items-center justify-between px-4 pt-2">
          <Text className="text-lg font-semibold text-white">Identify a Pill</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close pill scanner"
            onPress={onClose}
            hitSlop={12}
            className="rounded-full bg-black/50 px-3 py-1.5 active:opacity-70">
            <Text className="text-base font-semibold text-white">Close</Text>
          </Pressable>
        </View>

        {blocker ?? (
          <>
            {/* Aiming guide */}
            <View pointerEvents="none" className="items-center">
              <View className="h-56 w-56 rounded-3xl border-2 border-white/80" />
            </View>
            <ResultPanel
              loading={pill.state === 'loading'}
              isStandIn={ready?.config.isStandIn ?? false}
              minConfidence={ready?.config.minConfidence ?? 0}
              result={result}
              frameError={frameError}
            />
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

function ResultPanel({
  loading,
  isStandIn,
  minConfidence,
  result,
  frameError,
}: {
  loading: boolean;
  isStandIn: boolean;
  minConfidence: number;
  result: ScanResult | null;
  frameError: string | null;
}) {
  const top = result?.predictions[0];
  const confident = top != null && top.score >= minConfidence;

  return (
    <View className="mx-4 mb-2 gap-3 rounded-2xl bg-black/70 px-4 py-4">
      {isStandIn && (
        <View className="rounded-lg bg-amber-500/20 px-3 py-2">
          <Text className="text-sm text-amber-300">
            Demo model: it recognises everyday objects, not pills yet. A trained pill model replaces it later.
          </Text>
        </View>
      )}

      {loading && (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator color="#fff" />
          <Text className="text-base text-white">Loading on-device model…</Text>
        </View>
      )}

      {!loading && !result && !frameError && (
        <Text className="text-base text-white">Point the camera at a single pill on a plain surface.</Text>
      )}

      {frameError && <Text className="text-sm text-red-300">Scanning failed: {frameError}</Text>}

      {result && (
        <View accessibilityLiveRegion="polite" className="gap-2">
          <Text className="text-xs uppercase tracking-wide text-gray-300">
            {confident ? 'Best match' : 'No confident match yet'}
          </Text>
          {result.predictions.map((p, i) => (
            <View key={`${i}-${p.label}`} className="gap-1">
              <View className="flex-row justify-between">
                <Text
                  numberOfLines={1}
                  className={`flex-1 pr-2 text-white ${i === 0 && confident ? 'text-lg font-semibold' : 'text-sm'}`}>
                  {p.label}
                </Text>
                <Text className="text-sm tabular-nums text-gray-300">{Math.round(p.score * 100)}%</Text>
              </View>
              <View className="h-1.5 overflow-hidden rounded-full bg-white/20">
                <View className="h-full rounded-full bg-blue-400" style={{ width: `${Math.round(p.score * 100)}%` }} />
              </View>
            </View>
          ))}
        </View>
      )}

      <Text className="text-xs text-gray-400">
        Runs on your phone; nothing is uploaded{result ? ` · ${result.inferenceMs} ms` : ''}. Always confirm a
        pill with your pharmacist before taking it.
      </Text>
    </View>
  );
}

function Message({ text, action }: { text: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View className="mx-6 items-center gap-4">
      <Text className="text-center text-base text-white">{text}</Text>
      {action && (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          className="rounded-xl bg-blue-500 px-5 py-3 active:opacity-80">
          <Text className="text-base font-semibold text-white">{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}
