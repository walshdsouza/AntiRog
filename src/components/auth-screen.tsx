import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, FieldLabel, Glyph, NeuButton, NeuInput } from '@/components/neu';
import { supabase } from '@/lib/supabase';

type Mode = 'sign-in' | 'sign-up';

export function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<Mode | null>(null);

  async function submit(mode: Mode) {
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Enter your email and password.');
      return;
    }
    setLoading(mode);
    try {
      if (mode === 'sign-in') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        if (!data.session) {
          Alert.alert('Check your inbox', 'Confirm your email address, then sign in.');
        }
      }
    } catch (e) {
      Alert.alert(
        mode === 'sign-in' ? 'Sign in failed' : 'Sign up failed',
        e instanceof Error ? e.message : 'Something went wrong.',
      );
    } finally {
      setLoading(null);
    }
  }

  const busy = loading !== null;

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center gap-8 px-5">
        <View className="items-center gap-4">
          <Glyph size={72}>℞</Glyph>
          <View className="items-center">
            <Text className="text-3xl font-bold text-ink dark:text-ink-dark">Welcome</Text>
            <Text className="mt-1 text-base text-muted dark:text-muted-dark">
              Sign in or create an account to continue.
            </Text>
          </View>
        </View>

        <Card className="gap-4 px-4 py-5">
          <View>
            <FieldLabel>Email</FieldLabel>
            <NeuInput
              placeholder="you@example.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
              editable={!busy}
              accessibilityLabel="Email"
            />
          </View>
          <View>
            <FieldLabel>Password</FieldLabel>
            <NeuInput
              placeholder="Your password"
              autoCapitalize="none"
              autoComplete="password"
              secureTextEntry
              textContentType="password"
              value={password}
              onChangeText={setPassword}
              editable={!busy}
              accessibilityLabel="Password"
            />
          </View>
        </Card>

        <View className="gap-4">
          <NeuButton
            title="Sign In"
            variant="primary"
            loading={loading === 'sign-in'}
            disabled={busy}
            onPress={() => submit('sign-in')}
          />
          <NeuButton
            title="Create Account"
            loading={loading === 'sign-up'}
            disabled={busy}
            onPress={() => submit('sign-up')}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
