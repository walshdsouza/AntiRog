import DatePicker from '@expo/ui/community/datetime-picker';
import { useDatabase } from '@nozbe/watermelondb/react';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, Text, View } from 'react-native';

import { BiomarkerTrendChart } from '@/components/biomarker-trend-chart';
import { Badge, Card, Chevron, EmptyState, NeuButton, Note, PressableCard, SectionTitle, Spinner, type Tone } from '@/components/neu';
import { useLabDocuments, type LabDocument } from '@/hooks/use-lab-documents';
import { useNeuTheme } from '@/hooks/use-theme-preference';
import { startOfDay } from '@/lib/doses';
import { saveLabResults } from '@/lib/lab-results';
import { isOcrAvailable, OcrError, recognizeText } from '@/lib/ocr';
import { formatBiomarker, parseLabReport, type Biomarker, type BiomarkerFlag } from '@/lib/report-parser';
import {
  attachDocument,
  deleteDocument,
  documentFile,
  formatVisitDate,
  hasLocalFile,
  previewDocument,
} from '@/lib/visits';

/*
 * Reports › Tests: read lab values from a photo of a report with on-device OCR, show what was found,
 * let the patient date and save them, chart saved readings over time, and list every lab report
 * (scanned here or attached to a visit).
 *
 * Zero-trust: the image is read on the phone (src/lib/ocr.ts) and parsed locally
 * (src/lib/report-parser.ts). Nothing is uploaded. Saving keeps the report file on this phone as a
 * document with no visit (src/lib/visits.ts) and stores the values (src/lib/lab-results.ts); only
 * their records sync, the report image itself never leaves the phone.
 */

type Scan = {
  /** Changes with every read, so the result card resets its date and saved state. */
  id: number;
  name: string;
  biomarkers: Biomarker[];
  /** Suggested report date (ms): the visit's date for an attached report, otherwise today. */
  date: number;
  /** The picked file, saved as a document when the patient saves the scan. */
  uri: string;
  mimeType: string | null;
  /** The saved document this scan belongs to: an existing report, or set once this scan is saved. */
  documentId: string | null;
};

const FLAG_BADGE: Record<BiomarkerFlag, { label: string; tone: Tone } | null> = {
  low: { label: 'Low', tone: 'warning' },
  high: { label: 'High', tone: 'danger' },
  normal: null,
};

type Picked = {
  uri: string;
  name: string;
  mimeType: string | null;
  date?: number | null;
  /** Set when re-reading a report that is already saved. */
  documentId?: string;
};

let scanCount = 0;

function toScan(picked: Picked, blocks: string[]): Scan {
  return {
    id: ++scanCount,
    name: picked.name,
    biomarkers: parseLabReport(blocks),
    date: startOfDay(picked.date ?? Date.now()),
    uri: picked.uri,
    mimeType: picked.mimeType,
    documentId: picked.documentId ?? null,
  };
}

async function takePhoto(): Promise<Picked | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    if (!permission.canAskAgain) {
      Alert.alert('Camera access needed', 'Allow camera access in Settings to photograph lab reports.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ]);
    }
    return null;
  }
  // Full quality: OCR accuracy drops quickly with JPEG compression on small print.
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, name: asset.fileName ?? 'Lab report photo', mimeType: asset.mimeType ?? 'image/jpeg' };
}

async function chooseFile(): Promise<Picked | null> {
  const result = await File.pickFileAsync({ mimeTypes: ['image/*', 'application/pdf'] });
  if (result.canceled) return null;
  const file = result.result;
  return { uri: file.uri, name: file.name, mimeType: file.type || null };
}

export function LabTestsReport() {
  const router = useRouter();
  const database = useDatabase();
  const documents = useLabDocuments();
  const [reading, setReading] = useState(false);
  const [scan, setScan] = useState<Scan | null>(null);
  const ocrReady = isOcrAvailable();

  async function read(pick: () => Promise<Picked | null>) {
    if (reading) return;
    setReading(true);
    try {
      const picked = await pick();
      if (!picked) return;
      const { blocks } = await recognizeText(picked);
      setScan(toScan(picked, blocks));
    } catch (e) {
      const title = e instanceof OcrError && e.reason === 'unsupported-file' ? 'PDFs not supported yet' : 'Could not read report';
      Alert.alert(title, e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setReading(false);
    }
  }

  function chooseSource() {
    Alert.alert('Scan or upload a lab report', 'The report is read on this phone and never uploaded.', [
      { text: 'Take a Photo', onPress: () => void read(takePhoto) },
      { text: 'Choose a File', onPress: () => void read(chooseFile) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function openDocument(doc: LabDocument) {
    const local = hasLocalFile(doc);
    const actions: Parameters<typeof Alert.alert>[2] = [];
    if (local && ocrReady) {
      actions.push({
        text: 'Read Lab Values',
        onPress: () =>
          void read(async () => ({
            uri: documentFile(doc).uri,
            name: doc.name,
            mimeType: doc.mimeType,
            date: doc.visitedAt ?? doc.uploadedAt,
            documentId: doc.id,
          })),
      });
    }
    if (local) {
      actions.push({
        text: 'Open Document',
        onPress: () =>
          void previewDocument(doc.record).catch((e: unknown) =>
            Alert.alert('Could not open document', e instanceof Error ? e.message : 'Something went wrong.'),
          ),
      });
    }
    const { visitId } = doc;
    if (visitId) {
      actions.push({ text: 'Go to Visit', onPress: () => router.push({ pathname: '/visits/[id]', params: { id: visitId } }) });
    }
    actions.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(doc.name, local ? undefined : 'This document is stored on another device.', actions);
  }

  function confirmDelete(doc: LabDocument) {
    const fromVisit = doc.visitTitle ? ` It will also be removed from ${doc.visitTitle}.` : '';
    Alert.alert(
      'Delete lab report?',
      `Are you sure? “${doc.name}” and the test values saved from it will be deleted from your trends on all your devices.${fromVisit}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDocument(database, doc.record);
              // A result card still showing this report would otherwise save values against it.
              setScan((current) => (current?.documentId === doc.id ? null : current));
            } catch (e) {
              Alert.alert('Could not delete report', e instanceof Error ? e.message : 'Something went wrong.');
            }
          },
        },
      ],
    );
  }

  function documentSaved(scanId: number, documentId: string) {
    setScan((current) => (current?.id === scanId ? { ...current, documentId } : current));
  }

  return (
    <>
      <Card className="gap-4 px-4 py-5">
        <View className="flex-row items-center justify-between gap-3">
          <Text className="flex-1 text-base font-semibold text-ink dark:text-ink-dark">Checkup &amp; test analysis</Text>
          <Badge label="On-device" tone="success" />
        </View>
        <Text className="text-sm text-muted dark:text-muted-dark">
          Photograph a lab report and AntiRog reads values like blood pressure, cholesterol, glucose and HbA1c, so you
          don&apos;t have to type them in. The report never leaves your phone.
        </Text>
        <NeuButton
          title="Scan / Upload Lab Report"
          variant="primary"
          loading={reading}
          disabled={!ocrReady}
          accessibilityHint="Take a photo or choose a file to read lab values from"
          onPress={chooseSource}
        />
        {!ocrReady ? (
          <Text className="text-xs text-muted dark:text-muted-dark">
            Report reading needs the latest version of the app.
          </Text>
        ) : null}
      </Card>

      {scan ? <ScanResult key={scan.id} scan={scan} onDocumentSaved={documentSaved} /> : null}

      <SectionTitle>Trends</SectionTitle>
      <BiomarkerTrendChart />

      <SectionTitle>Lab Reports</SectionTitle>
      {documents === undefined ? (
        <View className="items-center py-8">
          <Spinner />
        </View>
      ) : documents.length ? (
        <View className="gap-3">
          {documents.map((doc) => (
            <PressableCard
              key={doc.id}
              accessibilityLabel={`${doc.name}, ${doc.visitTitle ? `from ${doc.visitTitle}` : 'scanned in Reports'}`}
              accessibilityHint="Shows options for this lab report"
              onPress={() => openDocument(doc)}>
              <View className="flex-row items-center gap-3">
                <View className="flex-1">
                  <Text numberOfLines={1} className="text-base font-semibold text-ink dark:text-ink-dark">
                    {doc.name}
                  </Text>
                  <Text numberOfLines={1} className="text-sm text-muted dark:text-muted-dark">
                    {doc.visitTitle
                      ? [doc.visitTitle, doc.visitedAt != null ? formatVisitDate(doc.visitedAt) : null]
                          .filter(Boolean)
                          .join(' · ')
                      : `Scanned · ${formatVisitDate(doc.uploadedAt)}`}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${doc.name}`}
                  accessibilityHint="Deletes this report and the test values saved from it"
                  hitSlop={10}
                  onPress={() => confirmDelete(doc)}>
                  <Text className="text-sm font-semibold text-danger dark:text-danger-dark">Delete</Text>
                </Pressable>
                <Chevron />
              </View>
            </PressableCard>
          ))}
        </View>
      ) : (
        <EmptyState
          glyph="⚗"
          title="No lab reports yet"
          body="Reports you scan above or attach to a hospital or clinic visit appear here."
          action={<NeuButton title="Go to Visits" onPress={() => router.navigate('/visits')} />}
        />
      )}

      <Note>
        Values are read automatically and can be wrong. Check them against the report. &quot;High&quot; and
        &quot;Low&quot; use typical adult ranges; the reference range printed on your report is the one that counts.
      </Note>
    </>
  );
}

function ScanResult({
  scan,
  onDocumentSaved,
}: {
  scan: Scan;
  onDocumentSaved: (scanId: number, documentId: string) => void;
}) {
  const database = useDatabase();
  const { palette } = useNeuTheme();
  const [date, setDate] = useState(scan.date);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Android shows the date picker as a dialog that is open while mounted.
  const [pickerOpen, setPickerOpen] = useState(false);
  const hasValues = scan.biomarkers.length > 0;

  function pickDate(picked: Date) {
    setPickerOpen(false);
    setDate(startOfDay(picked.getTime()));
    setSaved(false);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      // Keep the report itself, like a visit document, so it appears in Lab Reports. Only once per
      // scan: saving again (say, after changing the date) reuses it.
      let documentId = scan.documentId;
      if (!documentId) {
        documentId = await attachDocument(database, {
          visitId: null,
          kind: 'lab_report',
          source: new File(scan.uri),
          name: scan.name,
          mimeType: scan.mimeType ?? 'image/jpeg',
        });
        onDocumentSaved(scan.id, documentId);
      }
      if (hasValues) {
        await saveLabResults(database, {
          biomarkers: scan.biomarkers,
          measuredAt: date,
          reportName: scan.name,
          documentId,
        });
      }
      setSaved(true);
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SectionTitle>Latest reading</SectionTitle>
      <Card className="gap-4 px-4 py-5">
        <Text numberOfLines={1} className="text-xs font-semibold uppercase tracking-wide text-muted dark:text-muted-dark">
          {scan.name}
        </Text>
        {hasValues ? (
          scan.biomarkers.map((b) => {
            const badge = FLAG_BADGE[b.flag];
            return (
              <View
                key={b.key}
                className="flex-row items-center gap-3"
                accessible
                accessibilityLabel={`${b.label}: ${formatBiomarker(b)}${badge ? `, ${badge.label}` : ''}`}>
                <Text className="flex-1 text-base font-semibold text-ink dark:text-ink-dark">{b.label}</Text>
                <Text className="text-base font-bold text-ink dark:text-ink-dark">{formatBiomarker(b)}</Text>
                {badge ? <Badge label={badge.label} tone={badge.tone} /> : null}
              </View>
            );
          })
        ) : (
          <Text className="text-sm text-muted dark:text-muted-dark">
            Text was read, but no known test values were found. Try a closer photo of the results table.
          </Text>
        )}

        {hasValues ? (
          <View className="gap-3 pt-4" style={{ borderTopWidth: 1, borderTopColor: palette.hairline }}>
            <View className="flex-row items-center justify-between gap-3">
              <Text className="text-sm font-semibold text-ink dark:text-ink-dark">Report date</Text>
              {Platform.OS === 'ios' ? (
                <DatePicker
                  mode="date"
                  display="compact"
                  value={new Date(date)}
                  maximumDate={new Date()}
                  onValueChange={(_event, picked) => pickDate(picked)}
                />
              ) : (
                <>
                  <NeuButton
                    size="sm"
                    title={formatVisitDate(date)}
                    accessibilityHint="Changes the date these results are saved under"
                    onPress={() => setPickerOpen(true)}
                  />
                  {pickerOpen && (
                    <DatePicker
                      mode="date"
                      value={new Date(date)}
                      maximumDate={new Date()}
                      onValueChange={(_event, picked) => pickDate(picked)}
                      onDismiss={() => setPickerOpen(false)}
                    />
                  )}
                </>
              )}
            </View>
            <NeuButton
              title={saved ? 'Results Saved' : 'Save Results'}
              variant="primary"
              loading={saving}
              disabled={saved}
              accessibilityHint="Saves this report and its values to your trends under the report date"
              onPress={() => void save()}
            />
            <Text className="text-xs text-muted dark:text-muted-dark">
              {saved
                ? 'Added to your trends and Lab Reports below.'
                : 'Check each value against the report first. Saving again for the same date replaces those values.'}
            </Text>
          </View>
        ) : !scan.documentId || saved ? (
          // Nothing to chart, but the patient may still want to keep the report.
          <NeuButton
            title={saved ? 'Report Saved' : 'Save Report Only'}
            loading={saving}
            disabled={saved}
            accessibilityHint="Keeps this report in Lab Reports without any test values"
            onPress={() => void save()}
          />
        ) : null}
      </Card>
    </>
  );
}
