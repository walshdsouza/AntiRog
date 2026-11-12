import { Q, type Database, type Model } from '@nozbe/watermelondb';
import { Directory, File, Paths } from 'expo-file-system';

import { supabase } from '@/lib/supabase';
import { syncData } from '@/lib/sync';

/*
 * Visits (hospital and clinic) and the documents attached to them.
 *
 * Visit and document RECORDS sync to Supabase like prescriptions. Document FILES never leave the
 * phone: each is copied into app storage at `visit-documents/<document id><extension>`, so the path
 * can be rebuilt from the synced record without storing a device-specific URI. On another phone the
 * record syncs but the file is missing, and the UI says so.
 */

export type DocumentKind = 'prescription' | 'lab_report' | 'other';

export const DOCUMENT_KINDS: { kind: DocumentKind; label: string }[] = [
  { kind: 'prescription', label: 'Prescription' },
  { kind: 'lab_report', label: 'Lab report' },
  { kind: 'other', label: 'Other' },
];

// The model classes are plain JS (database/Visit.js, database/VisitDocument.js); describe their fields.
export type VisitRecord = Model & {
  userId: string;
  /** ms, local midnight of the visit day. */
  visitedAt: number;
  facility: string;
  doctor: string;
  reason: string;
  notes: string;
  createdAt: Date;
};

export type VisitDocumentRecord = Model & {
  visitId: string;
  userId: string;
  kind: DocumentKind;
  name: string;
  mimeType: string;
  size: number;
  extension: string;
  /** ms, when the document was attached. */
  uploadedAt: number;
};

export type VisitInput = {
  visitedAt: number;
  facility: string;
  doctor: string;
  reason: string;
  notes: string;
};

async function currentUserId() {
  // getSession() reads the session cached on the device, so this works offline.
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Sign in again to save visits.');
  return userId;
}

function clean(input: VisitInput): VisitInput {
  const out = {
    visitedAt: input.visitedAt,
    facility: input.facility.trim(),
    doctor: input.doctor.trim(),
    reason: input.reason.trim(),
    notes: input.notes.trim(),
  };
  if (!out.facility && !out.doctor) throw new Error('Enter the hospital, clinic or doctor you saw.');
  return out;
}

/** Saves a new visit. Throws an Error with a user-facing message. Returns the new visit's id. */
export async function createVisit(database: Database, input: VisitInput): Promise<string> {
  const values = clean(input);
  const userId = await currentUserId();
  const visit = await database.write(() =>
    database.get<VisitRecord>('visits').create((r) => {
      Object.assign(r, values);
      r.userId = userId;
    }),
  );
  void syncData();
  return visit.id;
}

export async function updateVisit(database: Database, visit: VisitRecord, input: VisitInput) {
  const values = clean(input);
  await database.write(() => visit.update((r) => Object.assign(r, values)));
  void syncData();
}

/**
 * Soft-deletes a visit and its documents (so the deletion syncs) and removes the document files from
 * this phone. Prescriptions added from the visit stay in Medications.
 */
export async function deleteVisit(database: Database, visit: VisitRecord) {
  const documents = await database
    .get<VisitDocumentRecord>('visit_documents')
    .query(Q.where('visit_id', visit.id))
    .fetch();
  await database.write(async () => {
    await database.batch([
      ...documents.map((d) => d.prepareMarkAsDeleted()),
      visit.prepareMarkAsDeleted(),
    ]);
  });
  documents.forEach(deleteLocalFile);
  void syncData();
}

// ---- Document files -----------------------------------------------------------------------------

function documentsDirectory() {
  return new Directory(Paths.document, 'visit-documents');
}

/** Where this document's file lives on the phone (it may not exist here; see hasLocalFile). */
export function documentFile(document: Pick<VisitDocumentRecord, 'id' | 'extension'>) {
  return new File(documentsDirectory(), `${document.id}${document.extension}`);
}

export function hasLocalFile(document: Pick<VisitDocumentRecord, 'id' | 'extension'>) {
  try {
    return documentFile(document).exists;
  } catch {
    return false;
  }
}

function deleteLocalFile(document: Pick<VisitDocumentRecord, 'id' | 'extension'>) {
  try {
    const file = documentFile(document);
    if (file.exists) file.delete();
  } catch (e) {
    console.log('[visits] Could not delete document file:', e instanceof Error ? e.message : e);
  }
}

/** Deletes every document file on this phone. Called when the local database is wiped (sign-out). */
export function deleteAllDocumentFiles() {
  try {
    const dir = documentsDirectory();
    if (dir.exists) dir.delete();
  } catch (e) {
    console.log('[visits] Could not delete document files:', e instanceof Error ? e.message : e);
  }
}

function extensionOf(name: string, mimeType: string) {
  const match = /\.[A-Za-z0-9]{1,8}$/.exec(name);
  if (match) return match[0].toLowerCase();
  if (mimeType === 'application/pdf') return '.pdf';
  if (mimeType === 'image/png') return '.png';
  if (mimeType.startsWith('image/')) return '.jpg';
  return '';
}

/** Max size of one attached document. Large scans are fine; whole videos are not. */
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Copies a picked file into app storage and records it against the visit. `source` is a temporary
 * file from the picker or camera; the copy is what the app keeps.
 */
export async function attachDocument(
  database: Database,
  {
    visitId,
    source,
    name,
    mimeType,
    kind,
  }: { visitId: string; source: File; name: string; mimeType: string; kind: DocumentKind },
) {
  const size = source.size ?? 0;
  if (size > MAX_BYTES) throw new Error('That file is larger than 25 MB. Attach a smaller copy.');

  const userId = await currentUserId();
  const extension = extensionOf(name, mimeType);
  const collection = database.get<VisitDocumentRecord>('visit_documents');
  // Pick the id first so the file can be named after it before the record exists.
  const draft = collection.prepareCreate((r) => {
    r.visitId = visitId;
    r.userId = userId;
    r.kind = kind;
    r.name = name || `Document${extension}`;
    r.mimeType = mimeType;
    r.size = size;
    r.extension = extension;
    r.uploadedAt = Date.now();
  });

  const dir = documentsDirectory();
  if (!dir.exists) dir.create({ intermediates: true });
  const target = documentFile(draft);
  await source.copy(target);

  try {
    await database.write(() => database.batch(draft));
  } catch (e) {
    deleteLocalFile(draft);
    throw e;
  }
  void syncData();
}

/** Removes a document: soft-deletes the record (synced) and deletes the file on this phone. */
export async function deleteDocument(database: Database, document: VisitDocumentRecord) {
  await database.write(() => document.markAsDeleted());
  deleteLocalFile(document);
  void syncData();
}

/** Opens the system viewer (Quick Look on iOS, an "open with" app on Android). */
export async function previewDocument(document: VisitDocumentRecord) {
  const file = documentFile(document);
  if (!file.exists) throw new Error('This document is stored on another device.');
  const options = { title: document.name, mimeType: document.mimeType || undefined };
  if (!(await file.canPreview({ mimeType: options.mimeType }))) {
    throw new Error('No app on this phone can open this kind of file.');
  }
  await file.preview(options);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatVisitDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function visitTitle(visit: Pick<VisitRecord, 'facility' | 'doctor'>) {
  return visit.facility || visit.doctor || 'Visit';
}
