import { Box, Button, Column, Row, Spacer, Text } from '@expo/ui/jetpack-compose';
import {
  background,
  cornerRadius,
  fillMaxSize,
  fillMaxWidth,
  height,
  paddingAll,
  size,
  width,
} from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import { EMPTY_WIDGET_PROPS, type EmergencyWidgetProps } from './emergency-widget.types';

/*
 * Android Medical ID widget (Glance via expo-widgets + Jetpack Compose components from @expo/ui).
 * Fixed 3×2 cells (app.json, resizeMode "none"). A compact card is drawn centred in the cell, so the
 * widget looks smaller than its slot and nothing is cut off:
 *
 *   ┌──────────────────────────────────┐
 *   │ ┌────┐ MEDICAL ID                │
 *   │ │ O+ │ Walsh Francis D'Souza     │
 *   │ └────┘ 20 yrs · 3 May 2006       │
 *   │ ALLERGIES   Chalk dust, peanuts  │
 *   │ CONDITIONS  Asthma               │
 *   │ CONTACT     8805441829           │
 *   └──────────────────────────────────┘
 *
 * Tapping anywhere opens AntiRog: the content sits in one full-size Button with target "open-app",
 * which plugins/with-widget-open-app.js handles in the widget provider.
 *
 * Rules for the function below (expo-widgets runs it in an isolated runtime): it must stay pure and
 * synchronous and reference nothing from module scope except imports. The Glance renderer maps only
 * padding, size/width/height, fillMax*, background and cornerRadius (no weight / spacedBy / letter
 * spacing), so sizes are fixed and gaps are fixed Spacers.
 * The name passed to createWidget must match `widgets[].name` in app.json.
 */
const EmergencyWidget = (props: EmergencyWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const dark = environment.colorScheme === 'dark';
  const bg = dark ? '#1C1E21' : '#E9E0CE';
  const ink = dark ? '#EEE5D3' : '#232528';
  const muted = dark ? '#B8B1A4' : '#55524B';
  const red = dark ? '#FF8E8E' : '#A61E2D';
  const onRed = dark ? '#2A0B0E' : '#FFFFFF';
  const LABEL_WIDTH = 74;

  const content =
    props.state !== 'ready' ? (
      <Column>
        <Text color={red} style={{ fontSize: 10, fontWeight: '800' }}>
          MEDICAL ID
        </Text>
        <Spacer modifiers={[height(4)]} />
        <Text color={ink} style={{ fontSize: 16, fontWeight: '700' }}>
          {props.state === 'hidden' ? 'Hidden' : 'Not set up'}
        </Text>
        <Spacer modifiers={[height(4)]} />
        <Text color={muted} style={{ fontSize: 12 }} maxLines={2}>
          {props.state === 'hidden'
            ? 'Turn on “Show on Home Screen & Lock Screen” in Medical ID.'
            : 'Tap to add your details in AntiRog.'}
        </Text>
      </Column>
    ) : (
      <Column>
        {/* Identity: small blood type badge beside the name. */}
        <Row verticalAlignment="center">
          <Column
            modifiers={[size(52, 52), background(red), cornerRadius(14)]}
            horizontalAlignment="center"
            verticalAlignment="center">
            <Text color={onRed} style={{ fontSize: 8, fontWeight: '800' }}>
              BLOOD
            </Text>
            <Text color={onRed} style={{ fontSize: 18, fontWeight: '900' }}>
              {props.bloodType || '?'}
            </Text>
          </Column>
          <Spacer modifiers={[width(12)]} />
          <Column>
            <Text color={red} style={{ fontSize: 10, fontWeight: '800' }}>
              MEDICAL ID
            </Text>
            <Text color={ink} style={{ fontSize: 15, fontWeight: '700' }} maxLines={1}>
              {props.name}
            </Text>
            {props.born ? (
              <Text color={muted} style={{ fontSize: 11, fontWeight: '500' }} maxLines={1}>
                {props.born}
              </Text>
            ) : null}
          </Column>
        </Row>

        <Spacer modifiers={[height(10)]} />

        <Row verticalAlignment="center">
          <Text color={muted} style={{ fontSize: 10, fontWeight: '800' }} modifiers={[width(LABEL_WIDTH)]}>
            ALLERGIES
          </Text>
          <Text color={props.allergies ? red : ink} style={{ fontSize: 13, fontWeight: '700' }} maxLines={2}>
            {props.allergies || 'None known'}
          </Text>
        </Row>
        {props.conditions ? (
          <>
            <Spacer modifiers={[height(4)]} />
            <Row verticalAlignment="center">
              <Text color={muted} style={{ fontSize: 10, fontWeight: '800' }} modifiers={[width(LABEL_WIDTH)]}>
                CONDITIONS
              </Text>
              <Text color={ink} style={{ fontSize: 13, fontWeight: '600' }} maxLines={1}>
                {props.conditions}
              </Text>
            </Row>
          </>
        ) : null}
        {props.contact ? (
          <>
            <Spacer modifiers={[height(4)]} />
            <Row verticalAlignment="center">
              <Text color={muted} style={{ fontSize: 10, fontWeight: '800' }} modifiers={[width(LABEL_WIDTH)]}>
                CONTACT
              </Text>
              <Text color={ink} style={{ fontSize: 13, fontWeight: '800' }} maxLines={1}>
                {props.contact}
              </Text>
            </Row>
          </>
        ) : null}
      </Column>
    );

  return (
    <Button
      modifiers={[fillMaxSize()]}
      // @ts-expect-error -- `target` is read by the native widget button; @expo/ui's types omit it.
      target="open-app">
      {/* Transparent cell; the card is centred in it. */}
      <Box modifiers={[fillMaxSize()]} contentAlignment="center">
        <Box modifiers={[fillMaxWidth(), background(bg), cornerRadius(22), paddingAll(14)]}>{content}</Box>
      </Box>
    </Button>
  );
};

export default createWidget('EmergencyWidget', EmergencyWidget, EMPTY_WIDGET_PROPS);
