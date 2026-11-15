import { useState } from 'react';
import { Text, View } from 'react-native';
import { BarChart, type barDataItem } from 'react-native-gifted-charts';

import { Inset } from '@/components/neu';
import { useNeuTheme } from '@/hooks/use-theme-preference';
import { adherenceTone, formatShortDate, type DayAdherence } from '@/lib/adherence';
import { RADIUS, type Palette } from '@/theme/neu';

/*
 * 30-day adherence: one bar per day, height = % of that day's due doses taken, colored by the same
 * thresholds as the PDF. Days with nothing due have no bar. The chart is set into an inset well so it
 * reads as part of the surface rather than a floating graphic.
 */

const CHART_HEIGHT = 140;
const Y_AXIS_WIDTH = 34;
const PADDING_X = 12;

function toneColor(p: Palette, percent: number | null) {
  switch (adherenceTone(percent)) {
    case 'success':
      return p.success;
    case 'warning':
      return p.warning;
    case 'danger':
      return p.danger;
    default:
      return 'transparent';
  }
}

export function AdherenceChart({ days }: { days: DayAdherence[] }) {
  const { palette } = useNeuTheme();
  const [width, setWidth] = useState(0);

  const plotWidth = Math.max(width - PADDING_X * 2 - Y_AXIS_WIDTH, 0);
  const slot = days.length ? plotWidth / days.length : 0;
  const barWidth = Math.max(slot * 0.62, 2);
  const spacing = Math.max(slot - barWidth, 1);

  const labelStyle = { color: palette.muted, fontSize: 10, width: 44, marginLeft: -16, textAlign: 'center' as const };
  const data: barDataItem[] = days.map((d, i) => ({
    // A 0% day keeps a sliver so it reads as "nothing taken", not "nothing due".
    value: d.percent == null ? 0 : Math.max(d.percent, 3),
    frontColor: toneColor(palette, d.percent),
    label: i % 7 === 0 || i === days.length - 1 ? formatShortDate(d.dayStart) : '',
    labelTextStyle: labelStyle,
  }));

  const due = days.filter((d) => d.percent != null);
  const description = due.length
    ? `Daily adherence over ${days.length} days. ${due.filter((d) => d.percent === 100).length} days fully on track, ${
        due.filter((d) => adherenceTone(d.percent) === 'danger').length
      } days under 50 percent.`
    : 'No doses were due in this period.';

  return (
    <View className="gap-3">
      <Inset
        radius={RADIUS.md}
        className="py-4"
        style={{ paddingHorizontal: PADDING_X }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={description}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <BarChart
              data={data}
              height={CHART_HEIGHT}
              width={plotWidth}
              barWidth={barWidth}
              spacing={spacing}
              initialSpacing={spacing / 2}
              endSpacing={0}
              maxValue={100}
              noOfSections={4}
              yAxisLabelSuffix="%"
              yAxisLabelWidth={Y_AXIS_WIDTH}
              yAxisTextStyle={{ color: palette.muted, fontSize: 10 }}
              yAxisThickness={0}
              xAxisThickness={1}
              xAxisColor={palette.outline}
              rulesType="dashed"
              rulesColor={palette.hairline}
              barBorderRadius={Math.min(barWidth / 2, 4)}
              disableScroll
              disablePress
              isAnimated
            />
          </View>
        ) : (
          <View style={{ height: CHART_HEIGHT + 30 }} />
        )}
      </Inset>

      <View className="flex-row flex-wrap gap-x-4 gap-y-1 px-1">
        <LegendItem color={palette.success} label="80%+" />
        <LegendItem color={palette.warning} label="50–79%" />
        <LegendItem color={palette.danger} label="Under 50%" />
        <Text className="text-xs text-muted dark:text-muted-dark">No bar: nothing due</Text>
      </View>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Text className="text-xs text-muted dark:text-muted-dark">{label}</Text>
    </View>
  );
}
