import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useNeuTheme } from '@/hooks/use-theme-preference';
import {
  glowShadow,
  insetShadow,
  RADIUS,
  raisedShadow,
  SUPPORTS_INSET,
  SUPPORTS_OUTSET,
  type Depth,
  type Palette,
} from '@/theme/neu';

/*
 * Neumorphic building blocks. Every screen is built from these so depth, radius and color stay
 * consistent and the old-Android fallback (a hairline where shadows can't render) lives in one place.
 * Color roles are documented in src/theme/neu.ts. Controls (inputs, switches, secondary buttons) carry
 * a visible `outline` edge so they never rely on soft shadows alone to be seen.
 */

export type Tone = 'default' | 'primary' | 'accent' | 'danger' | 'success' | 'warning';

/** Surface tint and the text color that reads on it (both AA-checked). */
function toneColors(p: Palette, tone: Tone) {
  switch (tone) {
    case 'primary':
      return { bg: p.primarySoft, fg: p.primary };
    case 'accent':
      return { bg: p.accentSoft, fg: p.accent };
    case 'danger':
      return { bg: p.dangerSoft, fg: p.danger };
    case 'success':
      return { bg: p.successSoft, fg: p.success };
    case 'warning':
      return { bg: p.warningSoft, fg: p.warning };
    default:
      return { bg: p.canvas, fg: p.ink };
  }
}

function raisedStyle(p: Palette, depth: Depth, radius: number, tone: Tone = 'default'): ViewStyle {
  const tinted = tone !== 'default';
  return {
    backgroundColor: toneColors(p, tone).bg,
    borderRadius: radius,
    boxShadow: raisedShadow(p, depth),
    // Tinted cards and phones without boxShadow get a hairline so the edge stays visible.
    ...(tinted || !SUPPORTS_OUTSET ? { borderWidth: StyleSheet.hairlineWidth, borderColor: p.hairline } : null),
  };
}

function insetStyle(p: Palette, radius: number): ViewStyle {
  return {
    backgroundColor: p.canvas,
    borderRadius: radius,
    boxShadow: insetShadow(p),
    ...(!SUPPORTS_INSET ? { borderWidth: 1, borderColor: p.hairline } : null),
  };
}

// ---- Layout -------------------------------------------------------------------------------------

/** A full screen on the canvas color with an optional large title row. Scrolls by default. */
export function Screen({
  title,
  subtitle,
  right,
  children,
  scroll = true,
  edges = ['top'],
  contentClassName = '',
  keyboardShouldPersistTaps = 'handled',
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentClassName?: string;
  keyboardShouldPersistTaps?: 'always' | 'handled' | 'never';
}) {
  const header = title ? <ScreenHeader title={title} subtitle={subtitle} right={right} /> : null;
  return (
    <SafeAreaView edges={edges} className="flex-1 bg-canvas dark:bg-canvas-dark">
      {scroll ? (
        <ScrollView
          contentContainerClassName={`gap-5 px-5 pb-10 pt-4 ${contentClassName}`}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          automaticallyAdjustKeyboardInsets>
          {header}
          {children}
        </ScrollView>
      ) : (
        <View className={`flex-1 gap-5 px-5 pt-4 ${contentClassName}`}>
          {header}
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="flex-1">
        <Text accessibilityRole="header" className="text-3xl font-bold tracking-tight text-ink dark:text-ink-dark">
          {title}
        </Text>
        {subtitle ? <Text className="mt-0.5 text-sm text-muted dark:text-muted-dark">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between gap-3 px-1">
      <Text accessibilityRole="header" className="text-lg font-semibold text-ink dark:text-ink-dark">
        {children}
      </Text>
      {right}
    </View>
  );
}

// ---- Surfaces -----------------------------------------------------------------------------------

/** A raised surface. `tone` tints it for status (danger, success…). */
export function Card({
  children,
  tone = 'default',
  depth = 'raised',
  radius = RADIUS.lg,
  className = 'px-4 py-4',
  style,
  ...rest
}: ViewProps & { tone?: Tone; depth?: Depth; radius?: number; className?: string }) {
  const { palette } = useNeuTheme();
  return (
    <View {...rest} className={className} style={[raisedStyle(palette, depth, radius, tone), style]}>
      {children}
    </View>
  );
}

/** A pressed-in well: input fields, tracks, empty states, image frames. */
export function Inset({
  children,
  radius = RADIUS.md,
  className = 'px-4 py-3',
  style,
  ...rest
}: ViewProps & { radius?: number; className?: string }) {
  const { palette } = useNeuTheme();
  return (
    <View {...rest} className={className} style={[insetStyle(palette, radius), style]}>
      {children}
    </View>
  );
}

/*
 * NativeWind rule for this file: never put `className` on a Pressable whose `style` is a function.
 * NativeWind writes class styles into `props.style`, and when that is a function it replaces it with an
 * object, silently dropping the background, radius and shadows. Class names go on a plain View instead,
 * and those Pressables opt out of NativeWind with `cssInterop={false}`.
 */

/** A raised card that presses in when tapped (list rows, choice tiles). */
export function PressableCard({
  children,
  tone = 'default',
  radius = RADIUS.lg,
  className = 'px-4 py-4',
  style,
  disabled,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  tone?: Tone;
  radius?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette } = useNeuTheme();
  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      // Bypass NativeWind entirely so the style function is always used as-is.
      cssInterop={false}
      disabled={disabled}
      style={({ pressed }) => [
        pressed
          ? { ...insetStyle(palette, radius), backgroundColor: toneColors(palette, tone).bg }
          : raisedStyle(palette, 'raised', radius, tone),
        disabled ? { opacity: 0.6 } : null,
        style,
      ]}>
      <View className={className}>{children}</View>
    </Pressable>
  );
}

/** A "›" that marks a row as navigable. */
export function Chevron() {
  return <Text className="text-2xl text-muted dark:text-muted-dark">›</Text>;
}

// ---- Controls -----------------------------------------------------------------------------------

type ButtonVariant = 'raised' | 'primary' | 'accent' | 'danger' | 'success';

const PADDING = {
  sm: { paddingHorizontal: 16, paddingVertical: 10 },
  md: { paddingHorizontal: 20, paddingVertical: 16 },
  lg: { paddingHorizontal: 24, paddingVertical: 20 },
} as const;

function buttonColors(p: Palette, variant: ButtonVariant) {
  switch (variant) {
    case 'primary':
      return { fill: p.primary, text: p.onPrimary };
    case 'accent':
      return { fill: p.accent, text: p.onAccent };
    case 'danger':
      return { fill: p.danger, text: p.onDanger };
    case 'success':
      return { fill: p.success, text: p.onSuccess };
    default:
      return { fill: p.canvas, text: p.accent };
  }
}

/**
 * Buttons.
 * - `primary` (charcoal, or sand in dark mode; filled): the main action on a screen.
 * - `raised` (canvas with an outline, electric-blue text): secondary actions.
 * - `accent` / `success` / `danger` (filled): emphasis and status actions.
 * `selected` shows a chosen state as pressed in, with `selectedTone` coloring its text.
 */
export function NeuButton({
  title,
  onPress,
  variant = 'raised',
  size = 'md',
  loading = false,
  disabled = false,
  selected = false,
  selectedTone = 'accent',
  subtitle,
  className = '',
  ...rest
}: Omit<PressableProps, 'style' | 'children' | 'onPress'> & {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  selected?: boolean;
  selectedTone?: Tone;
  subtitle?: string;
  className?: string;
}) {
  const { palette } = useNeuTheme();
  const filled = variant !== 'raised' && !selected;
  const colors = buttonColors(palette, selected ? 'raised' : variant);
  const textColor = selected ? toneColors(palette, selectedTone).fg : colors.text;
  const radius = size === 'sm' ? RADIUS.sm : RADIUS.md;
  const padding = PADDING[size];
  const inactive = disabled || loading;

  return (
    <View className={className}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: inactive, busy: loading, selected }}
        {...rest}
        // Bypass NativeWind entirely so the style function is always used as-is.
        cssInterop={false}
        disabled={inactive}
        onPress={onPress}
        style={({ pressed }) => [
          { backgroundColor: colors.fill, borderRadius: radius, alignItems: 'center', justifyContent: 'center', ...padding },
          selected || (pressed && !filled)
            ? insetStyle(palette, radius)
            : pressed
              ? { transform: [{ scale: 0.985 }] }
              : {
                  boxShadow: filled
                    ? [...raisedShadow(palette, 'low'), ...glowShadow(colors.fill)]
                    : raisedShadow(palette, 'low'),
                },
          !filled ? { borderWidth: 1, borderColor: selected ? palette.hairline : palette.outline } : null,
          // Disabled keeps its shape but drops the color, so it can't be mistaken for an active button.
          disabled && !loading ? { opacity: 0.45 } : null,
        ]}>
        {loading ? (
          <ActivityIndicator color={textColor} />
        ) : (
          <>
            <Text
              style={{ color: textColor }}
              className={`text-center font-semibold ${size === 'lg' ? 'text-lg' : size === 'sm' ? 'text-sm' : 'text-base'}`}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={{ color: textColor }} className="mt-0.5 text-center text-sm opacity-90">
                {subtitle}
              </Text>
            ) : null}
          </>
        )}
      </Pressable>
    </View>
  );
}

/** An on/off switch: an inset track with a raised knob; the track fills electric blue when on. */
export function NeuSwitch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const { palette } = useNeuTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onValueChange(!value)}
      style={[
        value
          ? { backgroundColor: palette.accent, borderRadius: RADIUS.pill, boxShadow: insetShadow(palette) }
          : { ...insetStyle(palette, RADIUS.pill), borderWidth: 1.5, borderColor: palette.outline },
        { width: 56, height: 32, padding: 4, justifyContent: 'center' },
        disabled ? { opacity: 0.45 } : null,
      ]}>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          alignSelf: value ? 'flex-end' : 'flex-start',
          backgroundColor: value ? palette.onAccent : palette.outline,
          boxShadow: raisedShadow(palette, 'low'),
        }}
      />
    </Pressable>
  );
}

/** A text field set into the surface. */
export function NeuInput({ className = '', style, ...rest }: TextInputProps & { className?: string }) {
  const { palette } = useNeuTheme();
  return (
    <TextInput
      placeholderTextColor={palette.placeholder}
      selectionColor={palette.accent}
      cursorColor={palette.accent}
      {...rest}
      className={`px-4 py-3.5 text-base ${className}`}
      style={[insetStyle(palette, RADIUS.md), { color: palette.ink, borderWidth: 1, borderColor: palette.outline }, style]}
    />
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <Text className="mb-2 ml-1 text-sm font-semibold text-ink dark:text-ink-dark">{children}</Text>;
}

/** A segmented switch: an inset track with the selected option raised out of it in electric blue. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}) {
  const { palette } = useNeuTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      className="flex-row gap-1 p-1.5"
      style={insetStyle(palette, RADIUS.md)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            className="flex-1 items-center py-2.5"
            style={selected ? raisedStyle(palette, 'low', RADIUS.sm) : { borderRadius: RADIUS.sm }}>
            <Text
              numberOfLines={1}
              style={{ color: selected ? palette.accent : palette.muted }}
              className={`text-sm ${selected ? 'font-bold' : 'font-medium'}`}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A small status label. */
export function Badge({ label, tone = 'accent' }: { label: string; tone?: Tone }) {
  const { palette } = useNeuTheme();
  const { bg, fg } = toneColors(palette, tone === 'default' ? 'primary' : tone);
  return (
    <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: bg }}>
      <Text style={{ color: fg }} className="text-xs font-bold">
        {label}
      </Text>
    </View>
  );
}

/** A raised round "icon" made of a glyph, for empty states and choice tiles. */
export function Glyph({ children, tone = 'accent', size = 56 }: { children: string; tone?: Tone; size?: number }) {
  const { palette } = useNeuTheme();
  const { fg } = toneColors(palette, tone);
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      className="items-center justify-center"
      style={[raisedStyle(palette, 'raised', size / 2), { width: size, height: size }]}>
      <Text style={{ color: fg, fontSize: size * 0.42 }} className="font-bold">
        {children}
      </Text>
    </View>
  );
}

/** Centered empty state inside an inset well. */
export function EmptyState({
  glyph,
  title,
  body,
  action,
}: {
  glyph: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Inset radius={RADIUS.lg} className="items-center gap-3 px-6 py-8">
      <Glyph>{glyph}</Glyph>
      <Text className="mt-1 text-center text-lg font-semibold text-ink dark:text-ink-dark">{title}</Text>
      <Text className="text-center text-sm text-muted dark:text-muted-dark">{body}</Text>
      {action}
    </Inset>
  );
}

/** A row inside a card: label on the left, value or control on the right. */
export function Row({ label, detail, right }: { label: string; detail?: string; right?: ReactNode }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="flex-1">
        <Text className="text-base font-semibold text-ink dark:text-ink-dark">{label}</Text>
        {detail ? <Text className="text-sm text-muted dark:text-muted-dark">{detail}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** Muted footnote text. */
export function Note({ children }: { children: ReactNode }) {
  return <Text className="px-1 text-xs leading-5 text-muted dark:text-muted-dark">{children}</Text>;
}

/** A spinner in the accent color. */
export function Spinner({ className = '' }: { className?: string }) {
  const { palette } = useNeuTheme();
  return <ActivityIndicator color={palette.accent} className={className} />;
}
