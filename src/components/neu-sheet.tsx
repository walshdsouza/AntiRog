import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NeuButton } from '@/components/neu';
import { useNeuTheme } from '@/hooks/use-theme-preference';
import { insetShadow, RADIUS, raisedShadow } from '@/theme/neu';

/*
 * Neumorphic action sheet: a raised panel that slides up from the bottom with a list of choices,
 * replacing the system Alert used as a menu ("Take a Photo / Choose a File", document actions).
 *
 * Call `showNeuSheet({ … })` from anywhere; the single <NeuSheetHost /> in the root layout renders it.
 * A choice's `onPress` runs only after the sheet has fully closed, so it can open the camera, a file
 * picker or another dialog without colliding with the sheet's own modal.
 */

export type NeuSheetOption = {
  label: string;
  onPress: () => void;
  /** Read by screen readers after the label. */
  hint?: string;
  destructive?: boolean;
};

export type NeuSheetOptions = {
  title: string;
  message?: string;
  options: NeuSheetOption[];
  /** Default "Cancel". */
  cancelLabel?: string;
};

type Request = NeuSheetOptions & { id: number };

const queue: Request[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
let nextId = 0;

/** Shows a Neumorphic action sheet. */
export function showNeuSheet(options: NeuSheetOptions) {
  queue.push({ ...options, id: ++nextId });
  notify();
}

/** How long the slide-out runs before the modal itself is hidden. */
const EXIT_MS = 220;

/** Renders sheets requested with showNeuSheet. Mount once, near the root. */
export function NeuSheetHost() {
  const { scheme, palette } = useNeuTheme();
  const insets = useSafeAreaInsets();
  // The request on screen; `open` drives the panel (and its exit animation), `visible` the modal.
  const [request, setRequest] = useState<Request | null>(null);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  // What to run once the modal is fully gone (a choice's onPress, or nothing on cancel).
  const after = useRef<(() => void) | null>(null);
  const closing = useRef(false);
  const showing = useRef(false);

  useEffect(() => {
    const update = () => {
      if (closing.current || showing.current || queue.length === 0) return;
      showing.current = true;
      setRequest(queue[0]);
      setOpen(true);
      setVisible(true);
    };
    listeners.add(update);
    update();
    return () => {
      listeners.delete(update);
    };
  }, []);

  function close(action: (() => void) | null) {
    if (closing.current) return;
    closing.current = true;
    after.current = action;
    setOpen(false);
    setTimeout(() => {
      setVisible(false);
      // iOS reports the end of the dismissal through onDismiss; Android hides synchronously.
      if (Platform.OS !== 'ios') finished();
    }, EXIT_MS);
  }

  function finished() {
    queue.shift();
    closing.current = false;
    showing.current = false;
    setRequest(null);
    const action = after.current;
    after.current = null;
    action?.();
    // Show the next queued sheet, if any.
    if (queue.length) notify();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => close(null)}
      onDismiss={Platform.OS === 'ios' ? finished : undefined}>
      {open && request ? (
        <View className="flex-1 justify-end">
          <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(EXIT_MS)}
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: scheme === 'dark' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(46, 38, 24, 0.38)' },
            ]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={request.cancelLabel ?? 'Cancel'}
              accessibilityHint="Closes this menu"
              onPress={() => close(null)}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <Animated.View
            entering={SlideInDown.springify().damping(22).stiffness(220)}
            exiting={SlideOutDown.duration(EXIT_MS)}
            accessibilityViewIsModal
            style={{
              backgroundColor: palette.canvas,
              borderTopLeftRadius: RADIUS.lg + 4,
              borderTopRightRadius: RADIUS.lg + 4,
              boxShadow: raisedShadow(palette, 'raised'),
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            }}
            className="gap-4 px-5 pt-3">
            {/* Grab handle, pressed into the panel. */}
            <View
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
              className="h-1.5 w-12 self-center rounded-full"
              style={{ backgroundColor: palette.canvas, boxShadow: insetShadow(palette) }}
            />
            <View className="gap-1 px-1">
              <Text accessibilityRole="header" className="text-lg font-bold text-ink dark:text-ink-dark">
                {request.title}
              </Text>
              {request.message ? (
                <Text className="text-sm text-muted dark:text-muted-dark">{request.message}</Text>
              ) : null}
            </View>
            <View className="gap-3">
              {request.options.map((option) => (
                <NeuButton
                  key={option.label}
                  title={option.label}
                  variant={option.destructive ? 'danger' : 'raised'}
                  accessibilityHint={option.hint}
                  onPress={() => close(option.onPress)}
                />
              ))}
            </View>
            <View className="mt-1">
              <NeuButton title={request.cancelLabel ?? 'Cancel'} variant="primary" onPress={() => close(null)} />
            </View>
          </Animated.View>
        </View>
      ) : null}
    </Modal>
  );
}
