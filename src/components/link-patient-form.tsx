import { useState } from 'react';
import { Text, View } from 'react-native';

import { NeuButton, NeuInput } from '@/components/neu';

import { requestGuardianAlertPermission, useGuardian } from '@/hooks/use-guardian-context';
import { acceptGuardianInvite, friendlyError, patientLabel, type GuardianLink } from '@/lib/guardian';

const CODE_LENGTH = 8;

function normalize(text: string) {
  return text.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, CODE_LENGTH);
}

function display(raw: string) {
  return raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
}

/** Guardian side: enter a patient's invite code to start following them. */
export function LinkPatientForm({ onLinked }: { onLinked?: (link: GuardianLink) => void }) {
  const { refresh } = useGuardian();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  const complete = code.length === CODE_LENGTH;

  async function submit() {
    if (!complete || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const link = await acceptGuardianInvite(code);
      setCode('');
      setMessage({ error: false, text: `You're now a guardian of ${patientLabel(link)}.` });
      refresh();
      await requestGuardianAlertPermission();
      onLinked?.(link);
    } catch (e) {
      setMessage({ error: true, text: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="gap-3">
      <NeuInput
        value={display(code)}
        onChangeText={(text) => {
          setCode(normalize(text));
          setMessage(null);
        }}
        onSubmitEditing={submit}
        placeholder="ABCD-EFGH"
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        returnKeyType="done"
        maxLength={CODE_LENGTH + 1}
        accessibilityLabel="Invite code"
        accessibilityHint="The 8-character code from the person you want to look after"
        className="text-center font-mono text-2xl tracking-widest"
      />

      <NeuButton title="Link" variant="primary" loading={busy} disabled={!complete} onPress={submit} />

      <Text
        accessibilityLiveRegion="polite"
        className={`min-h-5 text-center text-sm ${
          message?.error ? 'text-danger dark:text-danger-dark' : 'text-success dark:text-success-dark'
        }`}>
        {message?.text ?? ' '}
      </Text>
    </View>
  );
}
