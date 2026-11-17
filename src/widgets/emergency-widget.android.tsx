import { Box, Column, Row, Spacer, Text } from '@expo/ui/jetpack-compose';
import {
  background,
  cornerRadius,
  fillMaxSize,
  fillMaxWidth,
  height,
  padding,
  paddingAll,
  width,
} from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import { EMPTY_WIDGET_PROPS, type EmergencyWidgetProps } from './emergency-widget.types';

/*
 * Android Medical ID widget (Glance via expo-widgets + Jetpack Compose components from @expo/ui).
 *
 * Rules for the function below (expo-widgets runs it in an isolated runtime): it must stay pure and
 * synchronous and reference nothing from module scope except imports.
 *
 * Layout notes. The Glance renderer in expo-widgets 58 maps only padding, size/width/height,
 * fillMax*, background and cornerRadius, and for text only color, size, weight, style, alignment and
 * decoration. It ignores weight(), the spacedBy / spaceBetween arrangements and letter spacing. So:
 *  - the blood type badge is pinned to the top-end corner by overlaying it in a full-width Box;
 *  - the details card sits in a Box that fills the remaining height, anchored to the bottom, so
 *    the content spans the whole widget at any size;
 *  - gaps are fixed-size Spacers.
 * The name passed to createWidget must match `widgets[].name` in app.json.
 */
const EmergencyWidget = (props: EmergencyWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const dark = environment.colorScheme === 'dark';
  const bg = dark ? '#1C1E21' : '#E9E0CE';
  const card = dark ? '#272A2E' : '#DDD2BC';
  const ink = dark ? '#EEE5D3' : '#232528';
  const muted = dark ? '#B8B1A4' : '#55524B';
  const red = dark ? '#FF8E8E' : '#A61E2D';
  const onRed = dark ? '#2A0B0E' : '#FFFFFF';

  if (props.state !== 'ready') {
    return (
      <Box modifiers={[fillMaxSize(), background(bg), paddingAll(18)]} contentAlignment="centerStart">
        <Column>
          <Text color={red} style={{ fontSize: 11, fontWeight: '800' }}>
            MEDICAL ID
          </Text>
          <Spacer modifiers={[height(4)]} />
          <Text color={ink} style={{ fontSize: 18, fontWeight: '700' }}>
            {props.state === 'hidden' ? 'Hidden' : 'Not set up'}
          </Text>
          <Spacer modifiers={[height(4)]} />
          <Text color={muted} style={{ fontSize: 12 }} maxLines={3}>
            {props.state === 'hidden'
              ? 'Turn on “Show on Home Screen & Lock Screen” in AntiRog › Profile › Medical ID.'
              : 'Add your details in AntiRog › Profile › Medical ID.'}
          </Text>
        </Column>
      </Box>
    );
  }

  return (
    <Column modifiers={[fillMaxSize(), background(bg), padding(18, 16, 16, 16)]}>
      {/* Header: identity on the left, blood type badge pinned to the top-end corner. */}
      <Box modifiers={[fillMaxWidth()]} contentAlignment="topStart">
        {/* End padding keeps a long name clear of the badge. */}
        <Column modifiers={[padding(0, 2, 84, 0)]}>
          <Text color={red} style={{ fontSize: 11, fontWeight: '800' }}>
            MEDICAL ID
          </Text>
          <Spacer modifiers={[height(4)]} />
          <Text color={ink} style={{ fontSize: 20, fontWeight: '700' }} maxLines={1}>
            {props.name}
          </Text>
          {props.born ? (
            <>
              <Spacer modifiers={[height(2)]} />
              <Text color={muted} style={{ fontSize: 12, fontWeight: '500' }} maxLines={1}>
                {props.born}
              </Text>
            </>
          ) : null}
        </Column>
        {props.bloodType ? (
          <Box modifiers={[fillMaxWidth()]} contentAlignment="topEnd">
            <Column
              horizontalAlignment="center"
              modifiers={[background(red), cornerRadius(18), padding(14, 8, 14, 10)]}>
              <Text color={onRed} style={{ fontSize: 9, fontWeight: '800' }}>
                BLOOD
              </Text>
              <Text color={onRed} style={{ fontSize: 26, fontWeight: '900' }}>
                {props.bloodType}
              </Text>
            </Column>
          </Box>
        ) : null}
      </Box>

      {/* Details: fill the remaining height, content anchored to the bottom. */}
      <Box modifiers={[fillMaxSize()]} contentAlignment="bottomStart">
        <Column modifiers={[fillMaxWidth(), background(card), cornerRadius(18), padding(14, 12, 14, 12)]}>
          <Text color={muted} style={{ fontSize: 10, fontWeight: '800' }}>
            ALLERGIES
          </Text>
          <Text color={props.allergies ? red : ink} style={{ fontSize: 14, fontWeight: '700' }} maxLines={2}>
            {props.allergies || 'None known'}
          </Text>
          {props.conditions ? (
            <>
              <Spacer modifiers={[height(8)]} />
              <Text color={muted} style={{ fontSize: 10, fontWeight: '800' }}>
                CONDITIONS
              </Text>
              <Text color={ink} style={{ fontSize: 13, fontWeight: '600' }} maxLines={2}>
                {props.conditions}
              </Text>
            </>
          ) : null}
          {props.contact ? (
            <>
              <Spacer modifiers={[height(8)]} />
              <Row verticalAlignment="center">
                <Text color={muted} style={{ fontSize: 10, fontWeight: '800' }}>
                  EMERGENCY CONTACT
                </Text>
                <Spacer modifiers={[width(8)]} />
                <Text color={ink} style={{ fontSize: 14, fontWeight: '700' }} maxLines={1}>
                  {props.contact}
                </Text>
              </Row>
            </>
          ) : null}
        </Column>
      </Box>
    </Column>
  );
};

export default createWidget('EmergencyWidget', EmergencyWidget, EMPTY_WIDGET_PROPS);
