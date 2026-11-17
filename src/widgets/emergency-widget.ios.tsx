import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, lineLimit, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import { EMPTY_WIDGET_PROPS, type EmergencyWidgetProps } from './emergency-widget.types';

/*
 * iOS Medical ID widget (WidgetKit via expo-widgets + SwiftUI from @expo/ui).
 *
 * Rules for the function below (expo-widgets runs it in an isolated runtime): it must stay pure and
 * synchronous, use only @expo/ui components and modifiers, and reference nothing from module scope
 * except those imports. Every value comes in through `props` / `environment`.
 * The name passed to createWidget must match `widgets[].name` in app.json.
 */
const EmergencyWidget = (props: EmergencyWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const dark = environment.colorScheme === 'dark';
  const bg = dark ? '#1C1E21' : '#E9E0CE';
  const ink = dark ? '#EEE5D3' : '#232528';
  const muted = dark ? '#B8B1A4' : '#55524B';
  const red = dark ? '#FF8E8E' : '#A61E2D';
  const family = environment.widgetFamily ?? 'systemSmall';

  // Lock Screen: one dense line, readable at a glance.
  if (family === 'accessoryRectangular' || family === 'accessoryInline') {
    const line =
      props.state === 'ready'
        ? [props.bloodType && `Blood ${props.bloodType}`, props.allergies && `Allergies: ${props.allergies}`]
            .filter(Boolean)
            .join(' · ') || props.name
        : 'Medical ID';
    return (
      <VStack alignment="leading" spacing={1} modifiers={[containerBackground('clear', 'widget')]}>
        <Text modifiers={[font({ size: 13, weight: 'bold' })]}>✚ MEDICAL ID</Text>
        <Text modifiers={[font({ size: 13 }), lineLimit(2)]}>{line}</Text>
      </VStack>
    );
  }

  if (props.state !== 'ready') {
    return (
      <VStack alignment="leading" spacing={6} modifiers={[containerBackground(bg, 'widget')]}>
        <Text modifiers={[font({ size: 13, weight: 'heavy' }), foregroundStyle(red)]}>✚ MEDICAL ID</Text>
        <Spacer />
        <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(ink)]}>
          {props.state === 'hidden' ? 'Hidden' : 'Not set up'}
        </Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(muted), lineLimit(3)]}>
          {props.state === 'hidden'
            ? 'Turn on “Show on Home Screen” in AntiRog › Profile › Medical ID.'
            : 'Add your details in AntiRog › Profile › Medical ID.'}
        </Text>
      </VStack>
    );
  }

  const small = family === 'systemSmall';
  return (
    <VStack alignment="leading" spacing={small ? 4 : 6} modifiers={[containerBackground(bg, 'widget')]}>
      <HStack spacing={6}>
        <Text modifiers={[font({ size: 12, weight: 'heavy' }), foregroundStyle(red)]}>✚ MEDICAL ID</Text>
        <Spacer />
        {props.bloodType ? (
          <Text modifiers={[font({ size: small ? 16 : 18, weight: 'black' }), foregroundStyle(red)]}>
            {props.bloodType}
          </Text>
        ) : null}
      </HStack>
      <Text modifiers={[font({ size: small ? 15 : 17, weight: 'bold' }), foregroundStyle(ink), lineLimit(1)]}>
        {props.name}
      </Text>
      {props.born && !small ? (
        <Text modifiers={[font({ size: 12 }), foregroundStyle(muted), lineLimit(1)]}>{props.born}</Text>
      ) : null}
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(ink), lineLimit(2)]}>
        {`Allergies: ${props.allergies || 'None known'}`}
      </Text>
      {!small && props.conditions ? (
        <Text modifiers={[font({ size: 12 }), foregroundStyle(ink), lineLimit(2)]}>{`Conditions: ${props.conditions}`}</Text>
      ) : null}
      <Spacer />
      {props.contact ? (
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(red), lineLimit(1), padding({ top: 2 })]}>
          {`ICE ${props.contact}`}
        </Text>
      ) : null}
    </VStack>
  );
};

export default createWidget('EmergencyWidget', EmergencyWidget, EMPTY_WIDGET_PROPS);
