import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
    <SafeAreaView className="flex-1 bg-white dark:bg-black">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-gray-900 dark:text-white">Welcome</Text>
        <Text className="mb-8 mt-1 text-base text-gray-500 dark:text-gray-400">
          Sign in or create an account to continue.
        </Text>

        <Text className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Email</Text>
        <TextInput
          className="mb-4 rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-base text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          placeholder="you@example.com"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
          editable={!busy}
        />

        <Text className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Password</Text>
        <TextInput
          className="mb-6 rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-base text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          placeholder="Your password"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          autoComplete="password"
          secureTextEntry
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          editable={!busy}
        />

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => submit('sign-in')}
          className={`mb-3 items-center rounded-xl bg-blue-500 py-3.5 active:opacity-80 ${busy ? 'opacity-60' : ''}`}>
          {loading === 'sign-in' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-semibold text-white">Sign In</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => submit('sign-up')}
          className={`items-center rounded-xl border border-blue-500 py-3.5 active:opacity-80 ${busy ? 'opacity-60' : ''}`}>
          {loading === 'sign-up' ? (
            <ActivityIndicator color="#3b82f6" />
          ) : (
            <Text className="text-base font-semibold text-blue-500">Sign Up</Text>
          )}
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
