import type { EmergencyWidgetProps } from './emergency-widget.types';

/*
 * Web (and type-checking) fallback: there are no home screen widgets on the web. The real widgets are
 * emergency-widget.ios.tsx and emergency-widget.android.tsx, which Metro picks by platform.
 */
const EmergencyWidget = {
  updateSnapshot(_props: EmergencyWidgetProps) {},
  reload() {},
};

export default EmergencyWidget;
