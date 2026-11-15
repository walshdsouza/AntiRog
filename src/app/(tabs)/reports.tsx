import { useDatabase } from '@nozbe/watermelondb/react';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { AdherenceChart } from '@/components/adherence-chart';
import { Badge, Card, EmptyState, Inset, NeuButton, Note, Screen, SectionTitle, Spinner, type Tone } from '@/components/neu';
import { useAdherence } from '@/hooks/use-adherence';
import { useSession } from '@/hooks/use-session';
import { useNeuTheme } from '@/hooks/use-theme-preference';
import { adherenceTone, formatShortDate, type AdherenceSummary, type MedicationAdherence } from '@/lib/adherence';
import { formatReminderTime } from '@/lib/reminders';
import { exportReportPdf } from '@/lib/report-pdf';
import { RADIUS } from '@/theme/neu';

/*
 * Reports: 30-day adherence from the local dose log, a daily trend chart, a per-medication
 * breakdown, and a PDF export for the patient's doctor. Everything is computed on the phone.
 */

function toneFor(percent: number | null): Tone {
  const tone = adherenceTone(percent);
  return tone === 'none' ? 'default' : tone;
}

function verdict(percent: number | null) {
  switch (adherenceTone(percent)) {
    case 'success':
      return 'On track';
    case 'warning':
      return 'Needs attention';
    case 'danger':
      return 'Off track';
    default:
      return 'No data';
  }
}

export default function ReportsScreen() {
  const database = useDatabase();
  const session = useSession();
  const summary = useAdherence();
  const [exporting, setExporting] = useState(false);

  const exportPdf = async () => {
    if (!summary || exporting) return;
    setExporting(true);
    try {
      const meta = session?.user.user_metadata as { full_name?: string; name?: string } | undefined;
      const patient = meta?.full_name || meta?.name || session?.user.email || undefined;
      await exportReportPdf(database, { summary, patient });
    } catch (e) {
      Alert.alert('Could not export report', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setExporting(false);
    }
  };

  if (!summary) {
    return (
      <Screen title="Reports" subtitle="Your health over time">
        <View className="items-center py-16">
          <Spinner />
        </View>
      </Screen>
    );
  }

  const due = summary.taken + summary.skipped + summary.missed;
  const pendingToday = summary.days[summary.days.length - 1]?.pending ?? 0;

  return (
    <Screen title="Reports" subtitle={`${formatShortDate(summary.from)} – ${formatShortDate(summary.to)}`}>
      {due === 0 ? (
        <EmptyState
          glyph="◔"
          title="No adherence data yet"
          body={
            summary.medications.length
              ? 'Turn on a daily reminder for your medications and log each dose as taken or skipped. Your 30-day trend will build up here.'
              : 'Add a medication with a daily reminder and log your doses. Your 30-day trend will build up here.'
          }
        />
      ) : (
        <>
          <SummaryCard summary={summary} pendingToday={pendingToday} />

          <SectionTitle>Daily trend</SectionTitle>
          <AdherenceChart days={summary.days} />
        </>
      )}

      {summary.medications.length ? (
        <>
          <SectionTitle>By medication</SectionTitle>
          <Card className="gap-5 px-4 py-5">
            {summary.medications.map((m) => (
              <MedicationRow key={m.prescriptionId} item={m} />
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle>Share with your doctor</SectionTitle>
      <Card className="gap-4 px-4 py-5">
        <Text className="text-sm text-muted dark:text-muted-dark">
          A PDF with your active medications, 30-day adherence and your logged hospital and clinic visits. You
          choose where to send it.
        </Text>
        <NeuButton
          title="Export to PDF"
          variant="primary"
          loading={exporting}
          accessibilityHint="Creates a PDF report and opens the share sheet"
          onPress={exportPdf}
        />
      </Card>

      <Note>
        Adherence is doses taken out of doses due. A scheduled dose with nothing logged by the end of its day counts
        as missed; doses still to come today aren&apos;t counted yet. Reports are built on your phone from your own
        data.
      </Note>
    </Screen>
  );
}

function SummaryCard({ summary, pendingToday }: { summary: AdherenceSummary; pendingToday: number }) {
  const { palette } = useNeuTheme();
  const tone = toneFor(summary.percent);
  const color = tone === 'default' ? palette.ink : palette[tone];

  return (
    <Card className="gap-5 px-5 py-5">
      <View
        className="flex-row items-end justify-between gap-3"
        accessible
        accessibilityLabel={`30-day adherence ${summary.percent ?? 0} percent. ${verdict(summary.percent)}.`}>
        <View>
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted dark:text-muted-dark">
            30-day adherence
          </Text>
          <Text style={{ color }} className="mt-1 text-5xl font-bold tracking-tight">
            {summary.percent ?? 0}%
          </Text>
        </View>
        <View className="pb-2">
          <Badge label={verdict(summary.percent)} tone={tone} />
        </View>
      </View>

      <View className="flex-row gap-3">
        <StatTile label="Taken" value={summary.taken} color={palette.success} />
        <StatTile label="Skipped" value={summary.skipped} color={palette.warning} />
        <StatTile label="Missed" value={summary.missed} color={palette.danger} />
      </View>

      {pendingToday ? (
        <Text className="text-xs text-muted dark:text-muted-dark">
          {pendingToday} {pendingToday === 1 ? 'dose' : 'doses'} still due today, not counted yet.
        </Text>
      ) : null}
    </Card>
  );
}

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Inset radius={RADIUS.md} className="flex-1 items-center px-2 py-3" accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={{ color }} className="text-2xl font-bold">
        {value}
      </Text>
      <Text className="mt-0.5 text-xs font-medium text-muted dark:text-muted-dark">{label}</Text>
    </Inset>
  );
}

function MedicationRow({ item }: { item: MedicationAdherence }) {
  const { palette } = useNeuTheme();
  const tone = toneFor(item.percent);
  const fill = tone === 'default' ? palette.outline : palette[tone];
  const due = item.taken + item.skipped + item.missed;
  const schedule = item.reminderMinutes == null ? 'No reminder' : `Daily, ${formatReminderTime(item.reminderMinutes)}`;

  return (
    <View
      className="gap-2"
      accessible
      accessibilityLabel={`${item.medication} ${item.dosage}. ${
        item.percent == null ? 'No doses due' : `${item.percent} percent, ${item.taken} of ${due} doses taken`
      }.`}>
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text numberOfLines={1} className="text-base font-semibold text-ink dark:text-ink-dark">
            {item.medication}
          </Text>
          <Text numberOfLines={1} className="text-sm text-muted dark:text-muted-dark">
            {[item.dosage, schedule].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Text style={{ color: tone === 'default' ? palette.muted : fill }} className="text-base font-bold">
          {item.percent == null ? '—' : `${item.percent}%`}
        </Text>
      </View>
      {/* Progress track: an inset groove with the taken share raised in the status color. */}
      <Inset radius={RADIUS.pill} className="h-3 justify-center px-0.5 py-0.5">
        {item.percent ? (
          <View style={{ width: `${item.percent}%`, height: '100%', borderRadius: RADIUS.pill, backgroundColor: fill }} />
        ) : null}
      </Inset>
      {due ? (
        <Text className="text-xs text-muted dark:text-muted-dark">
          {item.taken} taken · {item.skipped} skipped · {item.missed} missed
        </Text>
      ) : null}
    </View>
  );
}
