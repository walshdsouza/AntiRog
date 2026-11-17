import { Column, Row, Spacer, Text } from '@expo/ui/jetpack-compose';
import { background, fillMaxSize, fillMaxWidth, padding, weight } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import { EMPTY_WIDGET_PROPS, type EmergencyWidgetProps } from './emergency-widget.types';

/*
 * Android Medical ID widget (Glance via expo-widgets + Jetpack Compose components from @expo/ui).
 *
 * Rules for the function below (expo-widgets runs it in an isolated runtime): it must stay pure and
 * synchronous and reference nothing from module scope except imports. Android widgets support only
 * a subset of components (Box, Column, Row, Spacer, Text, Image, buttons…) and modifiers; anything
 * else renders "View not found". The name passed to createWidget must match `widgets[].name` in
 * app.json.
 */
const EmergencyWidget = (props: EmergencyWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const dark = environment.colorScheme === 'dark';
  const bg = dark ? '#1C1E21' : '#E9E0CE';
  const ink = dark ? '#EEE5D3' : '#232528';
  const muted = dark ? '#B8B1A4' : '#55524B';
  const red = dark ? '#FF8E8E' : '#A61E2D';
  const root = [fillMaxSize(), background(bg), padding(16, 14, 16, 14)];

  if (props.state !== 'ready') {
    return (
      <Column modifiers={root} verticalArrangement={{ spacedBy: 6 }}>
        <Text color={red} style={{ fontSize: 13, fontWeight: '800' }}>✚ MEDICAL ID</Text>
        <Text color={ink} style={{ fontSize: 15, fontWeight: '600' }}>
          {props.state === 'hidden' ? 'Hidden' : 'Not set up'}
        </Text>
        <Text color={muted} style={{ fontSize: 12 }} maxLines={3}>
          {props.state === 'hidden'
            ? 'Turn on “Show on Home Screen” in AntiRog › Profile › Medical ID.'
            : 'Add your details in AntiRog › Profile › Medical ID.'}
        </Text>
      </Column>
    );
  }

  return (
    <Column modifiers={root} verticalArrangement={{ spacedBy: 4 }}>
      <Row modifiers={[fillMaxWidth()]}>
        <Text color={red} style={{ fontSize: 12, fontWeight: '800' }} modifiers={[weight(1)]}>
          ✚ MEDICAL ID
        </Text>
        {props.bloodType ? (
          <Text color={red} style={{ fontSize: 18, fontWeight: '900' }}>{props.bloodType}</Text>
        ) : null}
      </Row>
      <Text color={ink} style={{ fontSize: 17, fontWeight: '700' }} maxLines={1}>
        {props.name}
      </Text>
      {props.born ? (
        <Text color={muted} style={{ fontSize: 12 }} maxLines={1}>
          {props.born}
        </Text>
      ) : null}
      <Text color={ink} style={{ fontSize: 12, fontWeight: '600' }} maxLines={2}>
        {`Allergies: ${props.allergies || 'None known'}`}
      </Text>
      {props.conditions ? (
        <Text color={ink} style={{ fontSize: 12 }} maxLines={2}>
          {`Conditions: ${props.conditions}`}
        </Text>
      ) : null}
      <Spacer modifiers={[weight(1)]} />
      {props.contact ? (
        <Text color={red} style={{ fontSize: 13, fontWeight: '700' }} maxLines={1}>
          {`ICE ${props.contact}`}
        </Text>
      ) : null}
    </Column>
  );
};

export default createWidget('EmergencyWidget', EmergencyWidget, EMPTY_WIDGET_PROPS);
