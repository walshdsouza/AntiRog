import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import { useEffect, useState } from 'react';

import { visitTitle, type VisitDocumentRecord, type VisitRecord } from '@/lib/visits';

// Observables emit the same model instances on change; snapshot the fields so React re-renders.
export type LabDocument = Pick<VisitDocumentRecord, 'id' | 'name' | 'mimeType' | 'extension' | 'uploadedAt'> & {
  record: VisitDocumentRecord;
  visitId: string;
  visitTitle: string;
  visitedAt: number | null;
};

/**
 * The most recent lab reports attached to visits, newest first, with their visit's name and date.
 * Live: updates on local and synced changes. `undefined` while loading.
 */
export function useLabDocuments(limit = 10) {
  const database = useDatabase();
  const [documents, setDocuments] = useState<LabDocument[] | undefined>(undefined);

  useEffect(() => {
    let docs: VisitDocumentRecord[] | undefined;
    let visits: Map<string, VisitRecord> | undefined;

    const publish = () => {
      if (!docs || !visits) return;
      setDocuments(
        docs.map((record) => {
          const visit = visits!.get(record.visitId);
          return {
            id: record.id,
            name: record.name,
            mimeType: record.mimeType,
            extension: record.extension,
            uploadedAt: record.uploadedAt,
            record,
            visitId: record.visitId,
            visitTitle: visit ? visitTitle(visit) : 'Visit',
            visitedAt: visit?.visitedAt ?? null,
          };
        }),
      );
    };

    const docSubscription = database
      .get<VisitDocumentRecord>('visit_documents')
      .query(Q.where('kind', 'lab_report'), Q.sortBy('uploaded_at', Q.desc), Q.take(limit))
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
  }, [database, limit]);

  return documents;
}
