import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, NeuButton, type Tone } from '@/components/neu';
import { useNeuTheme } from '@/hooks/use-theme-preference';
import { RADIUS } from '@/theme/neu';

/*
 * Neumorphic confirmation dialog, used instead of the system Alert for every "are you sure?" prompt.
 *
 * Two ways to use it:
 *  - `<NeuAlert visible … />`: a controlled dialog for a screen that owns its own state.
 *  - `showNeuConfirm({ … })`: imperative, from anywhere (event handlers, plain functions). Rendered by
 *    the single <NeuAlertHost /> in the root layout. Resolves true when confirmed, false when
 *    cancelled. If `onConfirm` is given, the dialog stays open with a spinner until it settles;
 *    `onConfirm` should handle its own errors.
 */

export type NeuConfirmOptions = {
  title: string;
  message?: string;
  /** Default "Delete". */
  confirmLabel?: string;
  /** Default "Cancel". */
  cancelLabel?: string;
  /** Red confirm button (default). Set false for a neutral action such as "Open Settings". */
  destructive?: boolean;
  onConfirm?: () => void | Promise<void>;
};

// ---- Presentational dialog -----------------------------------------------------------------------

export function NeuAlert({
  visible,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = true,
  busy = false,
  onConfirm,
  onCancel,
}: Omit<NeuConfirmOptions, 'onConfirm'> & {
  visible: boolean;
  /** Shows a spinner on the confirm button and blocks dismissal. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { scheme, palette } = useNeuTheme();
  const cancel = () => {
    if (!busy) onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={cancel}>
      <View className="flex-1 items-center justify-center px-6">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
          accessibilityHint="Closes this dialog"
          disabled={busy}
          onPress={cancel}
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: scheme === 'dark' ? 'rgba(0, 0, 0, 0.6)' : 'rgba(46, 38, 24, 0.38)' },
          ]}
        />
        <Card
          accessibilityViewIsModal
          radius={RADIUS.lg}
          className="w-full max-w-sm gap-5 px-6 pb-6 pt-7"
          style={{ backgroundColor: palette.canvas }}>
          <View className="items-center gap-3">
            <DialogMark tone={destructive ? 'danger' : 'accent'} glyph={destructive ? '!' : '?'} />
            <Text accessibilityRole="header" className="text-center text-xl font-bold text-ink dark:text-ink-dark">
              {title}
            </Text>
            {message ? (
              <Text className="text-center text-base leading-6 text-muted dark:text-muted-dark">{message}</Text>
            ) : null}
          </View>
          <View className="gap-3">
            <NeuButton
              title={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              loading={busy}
              onPress={onConfirm}
            />
            <NeuButton title={cancelLabel} disabled={busy} onPress={cancel} />
          </View>
        </Card>
      </View>
    </Modal>
  );
}

/** A small tinted disc that signals the dialog's intent before the title is read. */
function DialogMark({ tone, glyph }: { tone: Extract<Tone, 'danger' | 'accent'>; glyph: string }) {
  const { palette } = useNeuTheme();
  const bg = tone === 'danger' ? palette.dangerSoft : palette.accentSoft;
  const fg = tone === 'danger' ? palette.danger : palette.accent;
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      className="h-12 w-12 items-center justify-center rounded-full"
      style={{ backgroundColor: bg }}>
      <Text style={{ color: fg }} className="text-2xl font-bold">
        {glyph}
      </Text>
    </View>
  );
}

// ---- Imperative API ------------------------------------------------------------------------------

type Request = NeuConfirmOptions & { resolve: (confirmed: boolean) => void };

// Requests made while a dialog is open wait their turn, like system alerts.
const queue: Request[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Shows a Neumorphic confirmation dialog. Resolves true if confirmed, false if cancelled. */
export function showNeuConfirm(options: NeuConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    queue.push({ ...options, resolve });
    notify();
  });
}

/** Renders dialogs requested with showNeuConfirm. Mount once, near the root. */
export function NeuAlertHost() {
  const [request, setRequest] = useState<Request | null>(queue[0] ?? null);
  // What the dialog shows. Kept after it closes so the text doesn't vanish during the fade-out.
  const [content, setContent] = useState<Request | null>(request);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const update = () => {
      const next = queue[0] ?? null;
      setRequest(next);
      if (next) setContent(next);
    };
    listeners.add(update);
    update();
    return () => {
      listeners.delete(update);
    };
  }, []);

  function finish(confirmed: boolean) {
    const current = queue.shift();
    setBusy(false);
    current?.resolve(confirmed);
    notify();
  }

  async function confirm() {
    if (!request || busy) return;
    if (request.onConfirm) {
      setBusy(true);
      try {
        await request.onConfirm();
      } catch (e) {
        console.log('[neu-alert] onConfirm failed:', e instanceof Error ? e.message : e);
      }
    }
    finish(true);
  }

  return (
    <NeuAlert
      visible={request != null}
      title={content?.title ?? ''}
      message={content?.message}
      confirmLabel={content?.confirmLabel}
      cancelLabel={content?.cancelLabel}
      destructive={content?.destructive}
      busy={busy}
      onConfirm={() => void confirm()}
      onCancel={() => finish(false)}
    />
  );
}
