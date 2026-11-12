import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { Badge, Card, Inset, NeuButton, PressableCard, SectionTitle, Segmented, Spinner } from '@/components/neu';
import type { PrescriptionRecord } from '@/lib/prescriptions';
import {
  attachDocument,
  deleteDocument,
  deleteVisit,
  DOCUMENT_KINDS,
  formatBytes,
  formatVisitDate,
  hasLocalFile,
  previewDocument,
  visitTitle,
  type DocumentKind,
  type VisitDocumentRecord,
  type VisitRecord,
} from '@/lib/visits';

// Observables emit the same model instances on change; keep snapshots so React re-renders.
type VisitSnapshot = Pick<VisitRecord, 'visitedAt' | 'facility' | 'doctor' | 'reason' | 'notes'> & {
  record: VisitRecord;
};
type DocumentRow = Pick<VisitDocumentRecord, 'id' | 'kind' | 'name' | 'size' | 'uploadedAt' | 'extension'> & {
  record: VisitDocumentRecord;
  onDevice: boolean;
};
type MedicationRow = { id: string; medication: string; dosage: string };

const KIND_LABEL = Object.fromEntries(DOCUMENT_KINDS.map((k) => [k.kind, k.label])) as Record<DocumentKind, string>;

function formatAttached(ms: number) {
  return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function VisitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const database = useDatabase();
  const router = useRouter();
  // undefined = loading, null = not found (or deleted).
  const [visit, setVisit] = useState<VisitSnapshot | null | undefined>(undefined);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [medications, setMedications] = useState<MedicationRow[]>([]);

  useEffect(() => {
    const visitSub = database
      .get<VisitRecord>('visits')
      .findAndObserve(id)
      .subscribe({
        next: (v) =>
          setVisit({
            record: v,
            visitedAt: v.visitedAt,
            facility: v.facility,
            doctor: v.doctor,
            reason: v.reason,
            notes: v.notes,
          }),
        error: () => setVisit(null),
      });

    const documentSub = database
      .get<VisitDocumentRecord>('visit_documents')
      .query(Q.where('visit_id', id), Q.sortBy('uploaded_at', Q.desc))
      .observeWithColumns(['kind', 'name'])
      .subscribe((records) =>
        setDocuments(
          records.map((d) => ({
            record: d,
            id: d.id,
            kind: d.kind,
            name: d.name,
            size: d.size,
            uploadedAt: d.uploadedAt,
            extension: d.extension,
            onDevice: hasLocalFile(d),
          })),
        ),
      );

    const medicationSub = database
      .get<PrescriptionRecord>('prescriptions')
      .query(Q.where('visit_id', id), Q.sortBy('created_at', Q.asc))
      .observeWithColumns(['medication', 'dosage'])
      .subscribe((records) =>
        setMedications(records.map((p) => ({ id: p.id, medication: p.medication, dosage: p.dosage }))),
      );

    return () => {
      visitSub.unsubscribe();
      documentSub.unsubscribe();
      medicationSub.unsubscribe();
    };
  }, [database, id]);

  if (visit === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <Spinner />
      </View>
    );
  }

  if (visit === null) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas px-6 dark:bg-canvas-dark">
        <Stack.Screen options={{ title: 'Visit' }} />
        <Text className="text-center text-base text-muted dark:text-muted-dark">This visit has been deleted.</Text>
      </View>
    );
  }

  function confirmDelete(target: VisitRecord) {
    Alert.alert(
      'Delete visit?',
      'The visit and its documents will be deleted on all your devices. Medications added from it stay in Medications.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteVisit(database, target);
              router.back();
            } catch (e) {
              Alert.alert('Could not delete', e instanceof Error ? e.message : 'Something went wrong.');
            }
          },
        },
      ],
    );
  }

  const subtitle = [visit.facility ? visit.doctor : '', visit.reason].filter(Boolean).join(' · ');

  return (
    <ScrollView
      className="flex-1 bg-canvas dark:bg-canvas-dark"
      contentContainerClassName="gap-6 px-5 pb-10 pt-4"
      contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen
        options={{
          title: 'Visit',
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.push({ pathname: '/visits/edit', params: { id } })}>
              <Text className="text-base font-semibold text-accent dark:text-accent-dark">Edit</Text>
            </Pressable>
          ),
        }}
      />

      <View className="px-1">
        <Text className="text-sm uppercase tracking-wide text-muted dark:text-muted-dark">
          {formatVisitDate(visit.visitedAt)}
        </Text>
        <Text selectable className="mt-1 text-3xl font-bold text-ink dark:text-ink-dark">
          {visitTitle(visit)}
        </Text>
        {subtitle ? <Text className="mt-1 text-base text-muted dark:text-muted-dark">{subtitle}</Text> : null}
      </View>

      {visit.notes ? (
        <Card>
          <Text className="text-sm text-muted dark:text-muted-dark">Notes</Text>
          <Text selectable className="mt-1 text-base text-ink dark:text-ink-dark">
            {visit.notes}
          </Text>
        </Card>
      ) : null}

      <View className="gap-3">
        <SectionTitle
          right={
            <NeuButton
              size="sm"
              title="＋ Add"
              accessibilityLabel="Add a medication from this visit"
              onPress={() => router.push({ pathname: '/add-medication', params: { visitId: id } })}
            />
          }>
          Medications
        </SectionTitle>
        {medications.length === 0 ? (
          <Inset className="px-4 py-4">
            <Text className="text-sm text-muted dark:text-muted-dark">
              Medications you were given at this visit. Add them here and they also appear in Medications.
            </Text>
          </Inset>
        ) : (
          medications.map((m) => (
            <PressableCard
              key={m.id}
              accessibilityHint="Opens medication details"
              onPress={() => router.push({ pathname: '/prescription/[id]', params: { id: m.id } })}>
              <Text className="text-base font-semibold text-ink dark:text-ink-dark">{m.medication}</Text>
              <Text className="text-sm text-muted dark:text-muted-dark">{m.dosage}</Text>
            </PressableCard>
          ))
        )}
      </View>

      <DocumentsSection visitId={id} documents={documents} />

      <NeuButton title="Delete Visit" variant="danger" onPress={() => confirmDelete(visit.record)} />
    </ScrollView>
  );
}

function DocumentsSection({ visitId, documents }: { visitId: string; documents: DocumentRow[] }) {
  const database = useDatabase();
  const [kind, setKind] = useState<DocumentKind>('prescription');
  const [busy, setBusy] = useState(false);

  async function attach(pick: () => Promise<{ source: File; name: string; mimeType: string } | null>) {
    if (busy) return;
    setBusy(true);
    try {
      const picked = await pick();
      if (picked) await attachDocument(database, { visitId, kind, ...picked });
    } catch (e) {
      Alert.alert('Could not attach document', e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      if (!permission.canAskAgain) {
        Alert.alert('Camera access needed', 'Allow camera access in Settings to photograph documents.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => void Linking.openSettings() },
        ]);
      }
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.length) return null;
    const asset = result.assets[0];
    return {
      source: new File(asset.uri),
      name: asset.fileName ?? `${KIND_LABEL[kind]} photo.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
    };
  }

  async function chooseFile() {
    const result = await File.pickFileAsync({ mimeTypes: ['image/*', 'application/pdf'] });
    if (result.canceled) return null;
    const file = result.result;
    return { source: file, name: file.name, mimeType: file.type || 'application/octet-stream' };
  }

  async function open(doc: DocumentRow) {
    try {
      await previewDocument(doc.record);
    } catch (e) {
      Alert.alert('Could not open document', e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  function confirmRemove(doc: DocumentRow) {
    Alert.alert('Remove document?', `${doc.name} will be removed from this visit on all your devices.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          void deleteDocument(database, doc.record).catch((e: unknown) =>
            Alert.alert('Could not remove', e instanceof Error ? e.message : 'Something went wrong.'),
          ),
      },
    ]);
  }

  return (
    <View className="gap-3">
      <SectionTitle>Documents</SectionTitle>

      <Card className="gap-4 px-4 py-4">
        <Text className="text-sm text-muted dark:text-muted-dark">
          Attach prescriptions and lab reports (photos or PDFs). Files stay on this phone.
        </Text>
        <Segmented
          options={DOCUMENT_KINDS.map((k) => ({ value: k.kind, label: k.label }))}
          value={kind}
          onChange={setKind}
          accessibilityLabel="Document type"
        />
        <View className="flex-row gap-3">
          <NeuButton className="flex-1" size="sm" title="Take Photo" disabled={busy} onPress={() => void attach(takePhoto)} />
          <NeuButton className="flex-1" size="sm" title="Choose File" disabled={busy} onPress={() => void attach(chooseFile)} />
        </View>
        {busy && <Spinner />}
      </Card>

      {documents.map((doc) => (
        <PressableCard
          key={doc.id}
          disabled={!doc.onDevice}
          accessibilityHint={doc.onDevice ? 'Opens the document' : undefined}
          onPress={() => void open(doc)}
          onLongPress={() => confirmRemove(doc)}
          className="gap-1 px-4 py-4">
          <View className="flex-row items-start gap-3">
            <Text numberOfLines={1} className="flex-1 text-base font-semibold text-ink dark:text-ink-dark">
              {doc.name}
            </Text>
            <Badge label={KIND_LABEL[doc.kind] ?? 'Other'} tone={doc.kind === 'lab_report' ? 'success' : 'accent'} />
          </View>
          <Text className="text-sm text-muted dark:text-muted-dark">
            Added {formatAttached(doc.uploadedAt)} · {formatBytes(doc.size)}
          </Text>
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-muted dark:text-muted-dark">
              {doc.onDevice ? 'Tap to open' : 'Stored on another device'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${doc.name}`}
              hitSlop={8}
              onPress={() => confirmRemove(doc)}>
              <Text className="text-sm font-semibold text-danger dark:text-danger-dark">Remove</Text>
            </Pressable>
          </View>
        </PressableCard>
      ))}
    </View>
  );
}
