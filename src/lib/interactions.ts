import { type Database, type Model } from '@nozbe/watermelondb';

import { DATA_VERSION, DRUGS, PAIRS, type Severity } from '@/lib/interaction-data';
import type { PrescriptionRecord } from '@/lib/prescriptions';

export type InteractionPairRecord = Model & {
  drugA: string;
  drugB: string;
  severity: Severity;
  summary: string;
  advice: string;
};

type ExpandedPair = Pick<InteractionPairRecord, 'drugA' | 'drugB' | 'severity' | 'summary' | 'advice'>;

/** Version of the curated data seeded into this device's table. A sign-out wipe clears it, forcing a re-seed. */
const SEED_KEY = 'interaction_seed_version';

const SEVERITY_RANK: Record<Severity, number> = { contraindicated: 2, major: 1 };

function expandSide(side: string): string[] {
  if (!side.startsWith('class:')) return [side];
  const cls = side.slice('class:'.length);
  return DRUGS.filter((d) => d.classes?.includes(cls)).map((d) => d.name);
}

/** Turns class rules into concrete drug pairs, stored once each with drugA < drugB. */
function expandPairs(): ExpandedPair[] {
  const byKey = new Map<string, ExpandedPair>();
  for (const pair of PAIRS) {
    for (const a of expandSide(pair.a)) {
      for (const b of expandSide(pair.b)) {
        if (a === b) continue;
        const [drugA, drugB] = a < b ? [a, b] : [b, a];
        const key = `${drugA}|${drugB}`;
        const existing = byKey.get(key);
        // If two rules cover the same pair, keep the more severe one.
        if (!existing || SEVERITY_RANK[pair.severity] > SEVERITY_RANK[existing.severity]) {
          byKey.set(key, { drugA, drugB, severity: pair.severity, summary: pair.summary, advice: pair.advice });
        }
      }
    }
  }
  return [...byKey.values()];
}

const EXPANDED_PAIRS = expandPairs();
const HIGH_RISK_DRUGS = new Set(EXPANDED_PAIRS.flatMap((p) => [p.drugA, p.drugB]));

if (__DEV__) {
  // Catch typos in the curated data early: every pair side must name a known drug or a non-empty class.
  const known = new Set(DRUGS.map((d) => d.name));
  for (const { a, b } of PAIRS) {
    for (const side of [a, b]) {
      const ok = side.startsWith('class:') ? expandSide(side).length > 0 : known.has(side);
      if (!ok) console.warn(`[interactions] Unknown drug or empty class in curated data: ${side}`);
    }
  }
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Longest terms first, so "isosorbide mononitrate" wins over any shorter term inside it.
const MATCHERS = DRUGS.flatMap((drug) =>
  [drug.name, ...(drug.aliases ?? [])].map((term) => ({
    term,
    name: drug.name,
    pattern: new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}($|[^a-z0-9])`),
  })),
).sort((x, y) => y.term.length - x.term.length);

/**
 * Matches free-text medication (e.g. "Brufen 400 mg") to a standard drug name from the curated list.
 * Returns empty values when the medication isn't recognized.
 */
export function matchDrug(medication: string): { standardName: string; isHighRisk: boolean } {
  const text = medication.toLowerCase();
  const hit = MATCHERS.find((m) => m.pattern.test(text));
  if (!hit) return { standardName: '', isHighRisk: false };
  return { standardName: hit.name, isHighRisk: HIGH_RISK_DRUGS.has(hit.name) };
}

/**
 * Seeds the local interaction_pairs table from the curated data, once per DATA_VERSION. Rows are
 * written as already "synced" so sync never pushes them and they never count as unsynced changes.
 */
export async function ensureInteractionTable(database: Database) {
  if ((await database.localStorage.get<string>(SEED_KEY)) === DATA_VERSION) return;

  const collection = database.get<InteractionPairRecord>('interaction_pairs');
  await database.write(async () => {
    const existing = await collection.query().fetch();
    await database.batch([
      // Permanent deletes leave no tombstones for sync to push.
      ...existing.map((record) => record.prepareDestroyPermanently()),
      // An explicit id is required for the "synced" status to stick; versioned so it never collides
      // with a row deleted in this same batch.
      ...EXPANDED_PAIRS.map((p) =>
        collection.prepareCreateFromDirtyRaw({
          id: `v${DATA_VERSION}:${p.drugA}|${p.drugB}`,
          _status: 'synced',
          _changed: '',
          drug_a: p.drugA,
          drug_b: p.drugB,
          severity: p.severity,
          summary: p.summary,
          advice: p.advice,
        }),
      ),
    ]);
  });
  await database.localStorage.set(SEED_KEY, DATA_VERSION);
}

/**
 * Sets standard_name and is_high_risk on every prescription whose stored values don't match the
 * curated data (new records from other devices, or after the data changes). Returns how many changed;
 * the changes sync to Supabase like any other edit.
 */
export async function matchPrescriptions(database: Database): Promise<number> {
  return database.write(async () => {
    const records = await database.get<PrescriptionRecord>('prescriptions').query().fetch();
    const updates = records.flatMap((record) => {
      const match = matchDrug(record.medication);
      if (match.standardName === (record.standardName ?? '') && match.isHighRisk === !!record.isHighRisk) {
        return [];
      }
      return [
        record.prepareUpdate((r) => {
          r.standardName = match.standardName;
          r.isHighRisk = match.isHighRisk;
        }),
      ];
    });
    if (updates.length) await database.batch(updates);
    return updates.length;
  });
}

export type Conflict = {
  pair: InteractionPairRecord;
  /** The user's prescriptions on each side of the pair. */
  medsA: PrescriptionRecord[];
  medsB: PrescriptionRecord[];
};

/** Pairs the user's prescriptions with the matching interaction rows, most severe first. */
export function buildConflicts(pairs: InteractionPairRecord[], prescriptions: PrescriptionRecord[]): Conflict[] {
  return pairs
    .map((pair) => ({
      pair,
      medsA: prescriptions.filter((p) => p.standardName === pair.drugA),
      medsB: prescriptions.filter((p) => p.standardName === pair.drugB),
    }))
    .filter((c) => c.medsA.length > 0 && c.medsB.length > 0)
    .sort(
      (x, y) =>
        SEVERITY_RANK[y.pair.severity] - SEVERITY_RANK[x.pair.severity] ||
        x.pair.drugA.localeCompare(y.pair.drugA),
    );
}
