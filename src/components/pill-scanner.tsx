import { useDatabase } from '@nozbe/watermelondb/react';
import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission, useFrameOutput } from 'react-native-vision-camera';
import { createSynchronizable, scheduleOnRN } from 'react-native-worklets';

import { usePillModel } from '@/hooks/use-pill-model';
import { useNow, useTodaysDoses } from '@/hooks/use-todays-doses';
import { isDoseDue, logDose } from '@/lib/doses';
import { checkDrugAgainstVault, type ScanCheck } from '@/lib/interactions';
import type { PrescriptionRecord } from '@/lib/prescriptions';
import { decodeTopK, drugForLabel, drugGroups, inputByteLength, packPixels } from '@/lib/pill-model';

/** Run the model at most this often. The camera delivers ~30 fps; 5 predictions a second is plenty. */
const INFERENCE_INTERVAL_MS = 200;
/** Push results to React at most this often, so the overlay doesn't re-render on every inference. */
const UI_INTERVAL_MS = 250;
const TOP_K = 3;

type Prediction = { label: string; score: number };
type ScanResult = { predictions: Prediction[]; inferenceMs: number };

/** A locked-on result. `drug` is '' when the label isn't a medication AntiRog knows. */
type Lock = {
  label: string;
  score: number;
  drug: string;
  check: { status: 'checking' } | ScanCheck | { status: 'error'; message: string };
};

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function titleCase(name: string) {
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

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
 * Once a match is confident and steady, the scanner locks onto it, pauses the camera and checks the
 * drug against the vault with the offline interaction table. Frames are never stored or uploaded.
 */
export function PillScanner({ onClose, onDoseLogged }: { onClose: () => void; onDoseLogged: () => void }) {
  const database = useDatabase();
  const permission = useCameraPermission();
  const device = useCameraDevice('back');
  const pill = usePillModel();
  const focused = useIsFocused();
  const appActive = useAppActive();

  const [result, setResult] = useState<ScanResult | null>(null);
  const [frameError, setFrameError] = useState<string | null>(null);
  const [lock, setLock] = useState<Lock | null>(null);
  // Bumped on every lock and rescan, so a vault check that finishes late can't overwrite a newer scan.
  const lockId = useRef(0);
  // Shared with the frame thread: when the model last ran, when React was last updated, the current
  // streak of confident inferences for one class, and whether the scanner is locked (1) or not (0).
  const [clock] = useState(() => ({
    lastRun: createSynchronizable(0, { fixedType: true }),
    lastUi: createSynchronizable(0, { fixedType: true }),
    streakClass: createSynchronizable(-1, { fixedType: true }),
    streakCount: createSynchronizable(0, { fixedType: true }),
    locked: createSynchronizable(0, { fixedType: true }),
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

  function lockOn(index: number, score: number) {
    if (!ready) return;
    const id = ++lockId.current;
    const label = ready.config.labels[index] ?? `Class ${index}`;
    const drug = drugForLabel(ready.config, label);
    setLock({ label, score, drug, check: { status: 'checking' } });
    if (__DEV__) console.log(`[pill-scanner] Locked on "${label}" (${Math.round(score * 100)}%) -> drug "${drug}"`);
    if (!drug) return;

    checkDrugAgainstVault(database, drug)
      .catch((e: unknown) => ({ status: 'error' as const, message: e instanceof Error ? e.message : String(e) }))
      .then((check) => {
        if (lockId.current !== id) return;
        setLock({ label, score, drug, check });
        if (__DEV__) {
          const summary =
            check.status === 'checked'
              ? `${check.conflicts.length} conflict(s) across ${check.checkedCount} medication(s)`
              : check.status === 'error'
                ? check.message
                : check.status;
          console.log(`[pill-scanner] Vault check for ${drug}: ${summary}`);
        }
        if (check.status === 'checked' && check.conflicts.length > 0) {
          AccessibilityInfo.announceForAccessibility(
            `Warning. ${titleCase(drug)} interacts with ${check.conflicts.length} of your medications.`,
          );
        }
      });
  }

  function rescan() {
    lockId.current++;
    setLock(null);
    setResult(null);
    setFrameError(null);
    clock.streakClass.setBlocking(-1);
    clock.streakCount.setBlocking(0);
    clock.locked.setBlocking(0);
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
  const lockConfidence = ready?.config.lockConfidence ?? 1;
  const lockFrames = ready?.config.lockFrames ?? 1;
  // Small (one number per class), so it's fine to copy to the frame thread, unlike the labels.
  const config = ready?.config;
  const groups = useMemo(() => (config ? drugGroups(config) : []), [config]);
  const { lastRun, lastUi, streakClass, streakCount, locked } = clock;

  const frameOutput = useFrameOutput({
    // The resizer needs YUV on iOS and accepts anything on Android; YUV is the cheapest to stream.
    pixelFormat: 'yuv',
    // Smaller buffers: the model only needs 224×224 anyway.
    enablePreviewSizedOutputBuffers: true,
    dropFramesWhileBusy: true,
    onFrame(frame) {
      'worklet';
      try {
        // Locked: ignore the few frames that arrive before the camera pauses.
        if (model == null || resizer == null || locked.getDirty() === 1) return;
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

          // Score each drug by adding up its classes in the top K, so a drug split across
          // look-alike classes still counts as one confident match.
          let best = -1;
          let bestScore = 0;
          for (let i = 0; i < top.indices.length; i++) {
            const group = groups[top.indices[i]] ?? top.indices[i];
            let score = 0;
            for (let j = 0; j < top.indices.length; j++) {
              if ((groups[top.indices[j]] ?? top.indices[j]) === group) score += top.scores[j];
            }
            if (score > bestScore) {
              best = group;
              bestScore = score;
            }
          }

          // Count consecutive confident inferences of the same drug; lock once there are enough.
          if (best >= 0 && bestScore >= lockConfidence) {
            const streak = best === streakClass.getDirty() ? streakCount.getDirty() + 1 : 1;
            streakClass.setDirty(best);
            streakCount.setDirty(streak);
            if (streak >= lockFrames) {
              locked.setDirty(1);
              scheduleOnRN(lockOn, best, bestScore);
              return;
            }
          } else {
            streakClass.setDirty(-1);
            streakCount.setDirty(0);
          }

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

  const isStandIn = ready?.config.isStandIn ?? false;

  return (
    <View className="flex-1 bg-black">
      {!blocker && device != null && (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          // Paused while locked, so the result holds still and the camera stops using battery.
          isActive={focused && appActive && lock == null}
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
            {/* Aiming guide. Turns red when the locked pill conflicts with the vault. */}
            <View pointerEvents="none" className="items-center">
              <View className={`h-56 w-56 rounded-3xl ${frameBorder(lock)}`} />
            </View>
            {lock ? (
              <LockPanel lock={lock} isStandIn={isStandIn} onRescan={rescan} onDoseLogged={onDoseLogged} />
            ) : (
              <ResultPanel
                loading={pill.state === 'loading'}
                isStandIn={isStandIn}
                minConfidence={ready?.config.minConfidence ?? 0}
                lockConfidence={lockConfidence}
                result={result}
                frameError={frameError}
              />
            )}
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

function hasConflicts(lock: Lock | null) {
  return lock?.check.status === 'checked' && lock.check.conflicts.length > 0;
}

function frameBorder(lock: Lock | null) {
  if (hasConflicts(lock)) return 'border-4 border-red-500';
  if (lock?.check.status === 'checked') return 'border-2 border-emerald-400';
  return 'border-2 border-white/80';
}

function ResultPanel({
  loading,
  isStandIn,
  minConfidence,
  lockConfidence,
  result,
  frameError,
}: {
  loading: boolean;
  isStandIn: boolean;
  minConfidence: number;
  lockConfidence: number;
  result: ScanResult | null;
  frameError: string | null;
}) {
  const top = result?.predictions[0];
  const confident = top != null && top.score >= minConfidence;
  const steady = top != null && top.score >= lockConfidence;

  return (
    <View className="mx-4 mb-2 gap-3 rounded-2xl bg-black/70 px-4 py-4">
      {isStandIn && <StandInNote />}

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
            {steady ? 'Hold steady…' : confident ? 'Best match' : 'No confident match yet'}
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

function StandInNote() {
  return (
    <View className="rounded-lg bg-amber-500/20 px-3 py-2">
      <Text className="text-sm text-amber-300">
        Demo model: it recognises everyday objects, not pills. A few objects stand in for medications so the
        interaction check can be tested.
      </Text>
    </View>
  );
}

const SEVERITY = {
  contraindicated: { label: 'Do not combine', badge: 'bg-red-600' },
  major: { label: 'Major', badge: 'bg-amber-600' },
} as const;

/** The locked result: what was identified and how it fits with the user's vault. */
function LockPanel({
  lock,
  isStandIn,
  onRescan,
  onDoseLogged,
}: {
  lock: Lock;
  isStandIn: boolean;
  onRescan: () => void;
  onDoseLogged: () => void;
}) {
  const { check } = lock;
  const danger = hasConflicts(lock);

  let body: React.ReactNode;
  if (!lock.drug) {
    body = (
      <Text className="text-base text-amber-300">
        AntiRog doesn’t recognise this as a medication, so it wasn’t checked against your vault.
      </Text>
    );
  } else if (check.status === 'checking') {
    body = (
      <View className="flex-row items-center gap-2">
        <ActivityIndicator color="#fff" />
        <Text className="text-base text-white">Checking against your medications…</Text>
      </View>
    );
  } else if (check.status === 'error') {
    body = <Text className="text-base text-red-300">Couldn’t check your medications: {check.message}</Text>;
  } else if (check.status === 'unavailable') {
    body = (
      <Text className="text-base text-amber-300">
        AntiRog is still preparing its interaction list, so nothing was checked. Scan again in a moment.
      </Text>
    );
  } else {
    body = <CheckResult drug={lock.drug} check={check} onDoseLogged={onDoseLogged} />;
  }

  return (
    <View
      className={`mx-4 mb-2 max-h-[70%] rounded-2xl px-4 py-4 ${
        danger ? 'border-2 border-red-500 bg-red-950/95' : 'bg-black/80'
      }`}>
      <ScrollView contentContainerClassName="gap-3" showsVerticalScrollIndicator={false}>
        {isStandIn && <StandInNote />}

        <View>
          <Text className="text-xs uppercase tracking-wide text-gray-300">Identified</Text>
          <Text className="text-xl font-semibold text-white">{lock.drug ? titleCase(lock.drug) : lock.label}</Text>
          <Text className="text-sm text-gray-300">
            {lock.drug && isStandIn ? `Stand-in for “${lock.label}” · ` : ''}
            {Math.round(lock.score * 100)}% match
          </Text>
        </View>

        {body}

        <Pressable
          accessibilityRole="button"
          accessibilityHint="Starts the camera again to identify another pill"
          onPress={onRescan}
          className="items-center rounded-xl bg-white px-5 py-3 active:opacity-80">
          <Text className="text-base font-semibold text-black">Scan Again</Text>
        </Pressable>
        <Text className="text-xs text-gray-400">
          A camera match can be wrong, and AntiRog checks a short list of well-known interactions only. Always
          confirm with your pharmacist before taking a pill.
        </Text>
      </ScrollView>
    </View>
  );
}

function CheckResult({
  drug,
  check,
  onDoseLogged,
}: {
  drug: string;
  check: Extract<ScanCheck, { status: 'checked' }>;
  onDoseLogged: () => void;
}) {
  const alreadyTaking = check.alreadyTaking.length > 0 && (
    <Text className="text-sm text-gray-200">
      Already in your vault as {check.alreadyTaking.map((p) => p.medication).join(', ')}. Make sure you aren’t
      taking a double dose.
    </Text>
  );

  if (check.conflicts.length === 0) {
    return (
      <View className="gap-2">
        <Text className="text-base font-semibold text-emerald-300">
          {check.checkedCount > 0
            ? `No high-risk combinations with your ${check.checkedCount} checked medication${check.checkedCount === 1 ? '' : 's'}`
            : 'None of your medications could be checked yet'}
        </Text>
        {check.alreadyTaking.length > 0 && (
          <ScanToLog prescriptions={check.alreadyTaking} fallback={alreadyTaking} onLogged={onDoseLogged} />
        )}
      </View>
    );
  }

  const count = check.conflicts.length;
  const severe = check.conflicts.some((c) => c.pair.severity === 'contraindicated');
  return (
    <View accessibilityLiveRegion="assertive" className="gap-3">
      <View className="rounded-xl bg-red-600 px-4 py-3">
        <Text accessibilityRole="header" className="text-lg font-bold text-white">
          ⚠ {severe ? 'Do not take this pill' : 'Dangerous combination'}
        </Text>
        <Text className="text-base text-white">
          {titleCase(drug)} interacts with {count} of your medication{count === 1 ? '' : 's'}. Talk to your doctor
          or pharmacist before taking it.
        </Text>
      </View>

      {check.conflicts.map(({ pair, otherDrug, yourMeds }) => {
        const style = SEVERITY[pair.severity] ?? SEVERITY.major;
        return (
          <View key={pair.id} className="gap-1 rounded-xl bg-black/40 px-3 py-3">
            <View className="flex-row items-start justify-between gap-3">
              <Text className="flex-1 text-base font-semibold text-white">
                With your {yourMeds.map((p) => p.medication).join(', ') || titleCase(otherDrug)}
              </Text>
              <View className={`rounded-full px-2.5 py-1 ${style.badge}`}>
                <Text className="text-xs font-semibold text-white">{style.label}</Text>
              </View>
            </View>
            <Text className="text-sm text-white">{pair.summary}</Text>
            <Text className="text-sm text-red-200">{pair.advice}</Text>
          </View>
        );
      })}

      {alreadyTaking}
    </View>
  );
}

/**
 * Scan-to-log: when the scanned drug is in the vault and today's dose is due, offers to log it as
 * taken. Only shown on the no-conflict result. Warns instead if today's dose was already taken.
 */
function ScanToLog({
  prescriptions,
  fallback,
  onLogged,
}: {
  prescriptions: PrescriptionRecord[];
  /** Shown when no dose is due or taken today (e.g. no reminder set, or it's due later). */
  fallback: React.ReactNode;
  onLogged: () => void;
}) {
  const database = useDatabase();
  const { doses, dayStart } = useTodaysDoses();
  const now = useNow();
  const [busy, setBusy] = useState(false);

  if (!doses) return null;
  const ids = new Set(prescriptions.map((p) => p.id));
  const mine = doses.filter((d) => ids.has(d.prescription.id));
  const due = mine.filter((d) => isDoseDue(d.scheduledAt, d.logged?.status, now));
  const taken = mine.filter((d) => d.logged?.status === 'taken');
  const later = mine.filter((d) => !d.logged && !due.includes(d));

  async function markTaken(prescription: PrescriptionRecord) {
    if (busy) return;
    setBusy(true);
    try {
      await logDose(database, { prescription, dayStart, status: 'taken' });
      onLogged();
    } catch (e) {
      Alert.alert('Could not log dose', e instanceof Error ? e.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  if (due.length === 0 && taken.length === 0) {
    return (
      <View className="gap-1">
        {fallback}
        {later.map((d) => (
          <Text key={d.prescription.id} className="text-sm text-gray-300">
            {d.medication} is next due at {formatTime(d.scheduledAt)}.
          </Text>
        ))}
      </View>
    );
  }

  return (
    <View className="gap-3">
      {taken.map((d) => (
        <View key={d.prescription.id} className="rounded-xl bg-amber-500/20 px-3 py-3">
          <Text className="text-base font-semibold text-amber-300">
            Already taken today at {formatTime(d.logged!.recordedAt)}
          </Text>
          <Text className="text-sm text-amber-200">
            {d.medication} {d.dosage}. Don’t take another dose unless your doctor told you to.
          </Text>
        </View>
      ))}
      {due.map((d) => (
        <Pressable
          key={d.prescription.id}
          accessibilityRole="button"
          accessibilityLabel={`Mark ${d.medication} ${d.dosage} as taken`}
          accessibilityHint="Logs today's dose and returns to your Vault"
          accessibilityState={{ disabled: busy, busy }}
          disabled={busy}
          onPress={() => void markTaken(d.prescription)}
          className={`items-center gap-0.5 rounded-xl bg-emerald-500 px-5 py-4 active:opacity-80 ${busy ? 'opacity-60' : ''}`}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-lg font-bold text-white">Mark as Taken</Text>
          )}
          <Text className="text-sm text-emerald-50">
            {d.medication} {d.dosage} · due {formatTime(d.scheduledAt)}
          </Text>
        </Pressable>
      ))}
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
