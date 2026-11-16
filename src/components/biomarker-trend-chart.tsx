import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { Badge, Inset, Segmented, Spinner } from '@/components/neu';
import { useLabResults, type LabReading } from '@/hooks/use-lab-results';
import { useNeuTheme } from '@/hooks/use-theme-preference';
import {
  BIOMARKER_DEFINITIONS,
  BIOMARKER_LABELS,
  formatBiomarker,
  type BiomarkerFlag,
  type BiomarkerKey,
} from '@/lib/report-parser';
import { RADIUS, type Palette } from '@/theme/neu';

/*
 * Biomarker trends from saved lab results (WatermelonDB `lab_results`, live). Points sit on a real
 * time axis, since lab tests are taken at irregular intervals. Each dot is colored by its flag, and
 * the generic "high" threshold is drawn as a dashed rule. Blood pressure plots systolic and diastolic.
 *
 * Drawn with react-native-svg rather than gifted-charts: gifted-charts spaces points evenly, which
 * would make three readings over two years look like three consecutive days.
 */

const TRACKED: { value: BiomarkerKey; label: string }[] = [
  { value: 'blood_pressure', label: 'BP' },
  { value: 'total_cholesterol', label: 'Cholesterol' },
  { value: 'glucose_fasting', label: 'Glucose' },
  { value: 'hba1c', label: 'HbA1c' },
];

const PLOT_HEIGHT = 140;
const X_LABELS_HEIGHT = 20;
const Y_AXIS_WIDTH = 38;
// Keeps the first and last dots (and their outlines) inside the plot.
const EDGE = 10;
// A gentle, obviously-illustrative wave in 0–1 coordinates, shown before there is any history.
const GHOST = [0.55, 0.42, 0.5, 0.36, 0.44, 0.3, 0.38];

function highThreshold(key: BiomarkerKey) {
  if (key === 'blood_pressure') return 130; // systolic
  return BIOMARKER_DEFINITIONS.find((d) => d.key === key)?.high;
}

function flagColor(p: Palette, flag: BiomarkerFlag) {
  return flag === 'high' ? p.danger : flag === 'low' ? p.warning : p.accent;
}

function formatNumber(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function formatDate(ms: number, withYear: boolean) {
  return new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: '2-digit' } : {}),
  });
}

function describeChange(readings: LabReading[]) {
  const first = readings[0];
  const last = readings[readings.length - 1];
  const delta = Math.round((last.value - first.value) * 10) / 10;
  const since = formatDate(first.measuredAt, true);
  if (delta === 0) return `No change since ${since}`;
  const unit = last.unit === '%' ? ' points' : ` ${last.unit}`;
  return `${delta > 0 ? 'Up' : 'Down'} ${formatNumber(Math.abs(delta))}${unit} since ${since}`;
}

export function BiomarkerTrendChart() {
  const [selected, setSelected] = useState<BiomarkerKey>('blood_pressure');
  const readings = useLabResults(selected);
  const latest = readings?.[readings.length - 1];
  const label = BIOMARKER_LABELS[selected];

  const description = !readings?.length
    ? `${label} trend. No saved readings yet.`
    : readings.length === 1
      ? `${label}: one reading, ${formatBiomarker(readings[0])} on ${formatDate(readings[0].measuredAt, true)}.`
      : `${label} trend over ${readings.length} readings. Latest ${formatBiomarker(latest!)} on ${formatDate(
          latest!.measuredAt,
          true,
        )}. ${describeChange(readings)}.`;

  return (
    <View className="gap-3">
      <Segmented options={TRACKED} value={selected} onChange={setSelected} accessibilityLabel="Biomarker" />
      <Inset radius={RADIUS.lg} className="gap-3 px-4 py-4" accessible accessibilityRole="image" accessibilityLabel={description}>
        <View className="flex-row items-center justify-between gap-2">
          <Text
            numberOfLines={1}
            className="flex-1 text-xs font-semibold uppercase tracking-wide text-muted dark:text-muted-dark">
            {label} over time
          </Text>
          {latest ? <Badge label={`Latest ${formatBiomarker(latest)}`} tone="accent" /> : null}
        </View>

        {readings === undefined ? (
          <View className="items-center justify-center" style={{ height: PLOT_HEIGHT + X_LABELS_HEIGHT }}>
            <Spinner />
          </View>
        ) : readings.length ? (
          <Plot biomarker={selected} readings={readings} />
        ) : (
          <Ghost />
        )}

        <Text className="text-center text-sm text-muted dark:text-muted-dark">
          {readings === undefined
            ? ' '
            : readings.length === 0
              ? 'Save the results of a scanned report to start this trend.'
              : readings.length === 1
                ? 'One reading so far. Save another report to see the trend.'
                : describeChange(readings)}
        </Text>
      </Inset>
      {readings?.length ? <Legend bloodPressure={selected === 'blood_pressure'} /> : null}
    </View>
  );
}

function Plot({ biomarker, readings }: { biomarker: BiomarkerKey; readings: LabReading[] }) {
  const { palette } = useNeuTheme();
  const [width, setWidth] = useState(0);

  const threshold = highThreshold(biomarker);
  const values = readings.flatMap((r) => (r.value2 != null ? [r.value, r.value2] : [r.value]));
  // Include the threshold so the "high" rule is always on screen for context.
  let lo = Math.min(...values, ...(threshold != null ? [threshold] : []));
  let hi = Math.max(...values, ...(threshold != null ? [threshold] : []));
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.12;
  lo = Math.max(0, lo - pad);
  hi += pad;

  const plotWidth = Math.max(width - Y_AXIS_WIDTH, 0);
  const t0 = readings[0].measuredAt;
  const t1 = readings[readings.length - 1].measuredAt;
  const x = (t: number) =>
    Y_AXIS_WIDTH + (t1 === t0 ? plotWidth / 2 : EDGE + ((t - t0) / (t1 - t0)) * (plotWidth - EDGE * 2));
  const y = (v: number) => EDGE / 2 + (1 - (v - lo) / (hi - lo)) * (PLOT_HEIGHT - EDGE);

  const ticks = [hi, (hi + lo) / 2, lo].map((v) => Math.round(v * 10) / 10);
  const withYear = new Date(t0).getFullYear() !== new Date(t1).getFullYear();
  const line = (pick: (r: LabReading) => number) => readings.map((r) => `${x(r.measuredAt)},${y(pick(r))}`).join(' ');
  const hasDiastolic = readings.some((r) => r.value2 != null);

  return (
    <View
      style={{ height: PLOT_HEIGHT + X_LABELS_HEIGHT }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden>
      {width ? (
        <Svg width={width} height={PLOT_HEIGHT + X_LABELS_HEIGHT}>
          {ticks.map((v) => (
            <Line key={`rule-${v}`} x1={Y_AXIS_WIDTH} x2={width} y1={y(v)} y2={y(v)} stroke={palette.hairline} strokeWidth={1} />
          ))}
          {ticks.map((v) => (
            <SvgText
              key={`tick-${v}`}
              x={Y_AXIS_WIDTH - 6}
              y={y(v) + 3.5}
              fontSize={10}
              fill={palette.muted}
              textAnchor="end">
              {formatNumber(v)}
            </SvgText>
          ))}

          {threshold != null ? (
            <>
              <Line
                x1={Y_AXIS_WIDTH}
                x2={width}
                y1={y(threshold)}
                y2={y(threshold)}
                stroke={palette.danger}
                strokeOpacity={0.5}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <SvgText x={width - 2} y={y(threshold) - 4} fontSize={9} fill={palette.danger} textAnchor="end">
                High
              </SvgText>
            </>
          ) : null}

          {hasDiastolic && readings.length > 1 ? (
            <Polyline
              points={line((r) => r.value2 ?? r.value)}
              fill="none"
              stroke={palette.primary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {readings.length > 1 ? (
            <Polyline
              points={line((r) => r.value)}
              fill="none"
              stroke={palette.accent}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {hasDiastolic
            ? readings.map((r) =>
                r.value2 != null ? (
                  <Circle
                    key={`d-${r.id}`}
                    cx={x(r.measuredAt)}
                    cy={y(r.value2)}
                    r={3.5}
                    fill={palette.primary}
                    stroke={palette.canvas}
                    strokeWidth={1.5}
                  />
                ) : null,
              )
            : null}
          {readings.map((r) => (
            <Circle
              key={r.id}
              cx={x(r.measuredAt)}
              cy={y(r.value)}
              r={4.5}
              fill={flagColor(palette, r.flag)}
              stroke={palette.canvas}
              strokeWidth={1.5}
            />
          ))}

          <SvgText
            x={readings.length > 1 ? Y_AXIS_WIDTH + EDGE : x(t0)}
            y={PLOT_HEIGHT + X_LABELS_HEIGHT - 4}
            fontSize={10}
            fill={palette.muted}
            textAnchor={readings.length > 1 ? 'start' : 'middle'}>
            {formatDate(t0, withYear)}
          </SvgText>
          {readings.length > 1 ? (
            <SvgText
              x={width - EDGE}
              y={PLOT_HEIGHT + X_LABELS_HEIGHT - 4}
              fontSize={10}
              fill={palette.muted}
              textAnchor="end">
              {formatDate(t1, withYear)}
            </SvgText>
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

function Ghost() {
  const { palette } = useNeuTheme();
  const [width, setWidth] = useState(0);
  const points = GHOST.map((v, i) => `${(i / (GHOST.length - 1)) * width},${v * PLOT_HEIGHT}`).join(' ');
  return (
    <View style={{ height: PLOT_HEIGHT + X_LABELS_HEIGHT }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width ? (
        <Svg width={width} height={PLOT_HEIGHT}>
          {[0.25, 0.5, 0.75].map((v) => (
            <Line key={v} x1={0} x2={width} y1={v * PLOT_HEIGHT} y2={v * PLOT_HEIGHT} stroke={palette.hairline} strokeWidth={1} />
          ))}
          <Polyline
            points={points}
            fill="none"
            stroke={palette.outline}
            strokeWidth={2}
            strokeDasharray="6 6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ) : null}
    </View>
  );
}

function Legend({ bloodPressure }: { bloodPressure: boolean }) {
  const { palette } = useNeuTheme();
  return (
    <View className="flex-row flex-wrap gap-x-4 gap-y-1 px-1">
      {bloodPressure ? (
        <>
          <LegendItem color={palette.accent} label="Systolic" />
          <LegendItem color={palette.primary} label="Diastolic" />
        </>
      ) : (
        <LegendItem color={palette.accent} label="In range" />
      )}
      <LegendItem color={palette.danger} label="High" />
      <LegendItem color={palette.warning} label="Low" />
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text className="text-xs text-muted dark:text-muted-dark">{label}</Text>
    </View>
  );
}
