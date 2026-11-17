/**
 * What the Medical ID home screen widget shows. Pushed from the app with `updateSnapshot`
 * (src/hooks/use-emergency-widget.ts): widget code runs in its own runtime and can't read
 * WatermelonDB, so it only ever sees these plain strings.
 */
export type EmergencyWidgetProps = {
  /** 'ready': show the details. 'hidden': the patient turned the widget off. 'empty': no Medical ID. */
  state: 'ready' | 'hidden' | 'empty';
  name: string;
  /** e.g. 'O+', or '' when unknown. */
  bloodType: string;
  /** e.g. '42 yrs · 3 Mar 1983', or ''. */
  born: string;
  allergies: string;
  conditions: string;
  contact: string;
};

export const EMPTY_WIDGET_PROPS: EmergencyWidgetProps = {
  state: 'empty',
  name: '',
  bloodType: '',
  born: '',
  allergies: '',
  conditions: '',
  contact: '',
};
