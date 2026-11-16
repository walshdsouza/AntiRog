import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import { useEffect, useState } from 'react';

import { visitTitle, type VisitDocumentRecord, type VisitRecord } from '@/lib/visits';

// Observables emit the same model instances on change; snapshot the fields so React re-renders.
export type LabDocument = Pick<VisitDocumentRecord, 'id' | 'name' | 'mimeType' | 'extension' | 'uploadedAt'> & {
  record: VisitDocumentRecord;
  /** null for a report scanned in Reports › Tests rather than attached to a visit. */
  visitId: string | null;
  visitTitle: string | null;
  visitedAt: number | null;
};

/**
 * Every lab report, newest first: those attached to visits (with the visit's name and date) and
 * those scanned in Reports › Tests. Live: updates on local and synced changes. `undefined` while
 * loading.
 */
export function useLabDocuments() {
  const database = useDatabase();
  const [documents, setDocuments] = useState<LabDocument[] | undefined>(undefined);

  useEffect(() => {
    let docs: VisitDocumentRecord[] | undefined;
    let visits: Map<string, VisitRecord> | undefined;

    const publish = () => {
      if (!docs || !visits) return;
      setDocuments(
        docs.map((record) => {
          const visitId = record.visitId || null;
          const visit = visitId ? visits!.get(visitId) : undefined;
          return {
            id: record.id,
            name: record.name,
            mimeType: record.mimeType,
            extension: record.extension,
            uploadedAt: record.uploadedAt,
            record,
            visitId,
            visitTitle: visit ? visitTitle(visit) : visitId ? 'Visit' : null,
            visitedAt: visit?.visitedAt ?? null,
          };
        }),
      );
    };

    const docSubscription = database
      .get<VisitDocumentRecord>('visit_documents')
      .query(Q.where('kind', 'lab_report'), Q.sortBy('uploaded_at', Q.desc))
      .observeWithColumns(['name', 'uploaded_at'])
      .subscribe((records) => {
        docs = records;
        publish();
      });

    // Visits are few; observing them all keeps titles current without a query per document.
    const visitSubscription = database
      .get<VisitRecord>('visits')
      .query()
      .observeWithColumns(['facility', 'doctor', 'visited_at'])
      .subscribe((records) => {
        visits = new Map(records.map((v) => [v.id, v]));
        publish();
      });

    return () => {
      docSubscription.unsubscribe();
      visitSubscription.unsubscribe();
    };
  }, [database]);

  return documents;
}
