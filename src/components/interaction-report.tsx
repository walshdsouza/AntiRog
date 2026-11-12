import { Q, type Database } from '@nozbe/watermelondb';
import { withObservables } from '@nozbe/watermelondb/react';
import { Text, View } from 'react-native';

import { Badge, Card, EmptyState, Note } from '@/components/neu';

import { buildConflicts, type Conflict, type InteractionPairRecord } from '@/lib/interactions';
import type { PrescriptionRecord } from '@/lib/prescriptions';

function titleCase(name: string) {
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

// --- Step 1: observe the vault -------------------------------------------------------------------

function VaultObserver({ database, prescriptions }: { database: Database; prescriptions: PrescriptionRecord[] }) {
  // observeWithColumns emits a new array whenever medication or standard_name changes, so this re-renders.
  const names = [...new Set(prescriptions.map((p) => p.standardName).filter(Boolean))].sort();

  if (prescriptions.length === 0) {
    return (
      <EmptyState
        glyph="⚖"
        title="Nothing to check yet"
        body="Add your medications and AntiRog will check them against each other here, offline."
      />
    );
  }

  return (
    <ObservedConflicts
      database={database}
      names={names}
      namesKey={names.join('|')}
      prescriptions={prescriptions}
    />
  );
}

const withVault = withObservables([], ({ database }: { database: Database }) => ({
  prescriptions: database
    .get<PrescriptionRecord>('prescriptions')
    .query(Q.sortBy('created_at', Q.desc))
    .observeWithColumns(['medication', 'standard_name']),
}));

/** The full interaction report for everything in the vault. Updates live as the vault changes. */
export const InteractionReport = withVault(VaultObserver);

// --- Step 2: look up pairs in SQLite where both drugs are in the vault ---------------------------

type ConflictProps = {
  database: Database;
  names: string[];
  namesKey: string;
  prescriptions: PrescriptionRecord[];
  pairs: InteractionPairRecord[];
};

function ConflictView({ prescriptions, pairs }: ConflictProps) {
  const conflicts = buildConflicts(pairs, prescriptions);
  const unmatched = prescriptions.filter((p) => !p.standardName);
  const checkedCount = prescriptions.length - unmatched.length;

  return (
    <View className="gap-4">
      {conflicts.length > 0 ? (
        <>
          <Text accessibilityRole="header" className="px-1 text-base font-semibold text-danger dark:text-danger-dark">
            {conflicts.length} high-risk combination{conflicts.length === 1 ? '' : 's'} found
          </Text>
          {conflicts.map((conflict) => (
            <ConflictCard key={conflict.pair.id} conflict={conflict} />
          ))}
        </>
      ) : (
        <Card tone="success">
          <Text className="text-base font-semibold text-success dark:text-success-dark">
            No high-risk combinations found
          </Text>
          <Text className="mt-1 text-sm text-ink dark:text-ink-dark">
            {checkedCount > 0
              ? `Checked ${checkedCount} medication${checkedCount === 1 ? '' : 's'} against AntiRog's interaction list.`
              : 'None of your medications are in AntiRog’s interaction list yet.'}
          </Text>
        </Card>
      )}

      {unmatched.length > 0 && <UnmatchedCard prescriptions={unmatched} />}

      <Note>
        AntiRog checks a short list of well-known dangerous combinations, on your phone and offline. It is
        not a complete check and does not replace advice from your doctor or pharmacist. Do not stop or
        change a medication without talking to them.
      </Note>
    </View>
  );
}

const withPairs = withObservables(['namesKey'], ({ database, names }: Omit<ConflictProps, 'pairs'>) => ({
  pairs: database
    .get<InteractionPairRecord>('interaction_pairs')
    .query(Q.where('drug_a', Q.oneOf(names)), Q.where('drug_b', Q.oneOf(names)))
    .observe(),
}));

const ObservedConflicts = withPairs(ConflictView);

// --- Cards --------------------------------------------------------------------------------------

const SEVERITY_STYLE = {
  contraindicated: { label: 'Do not combine', tone: 'danger' },
  major: { label: 'Major', tone: 'warning' },
} as const;

function ConflictCard({ conflict: { pair, medsA, medsB } }: { conflict: Conflict }) {
  const style = SEVERITY_STYLE[pair.severity] ?? SEVERITY_STYLE.major;
  const yourMeds = [...medsA, ...medsB].map((p) => p.medication).join(' · ');

  return (
    <Card tone={style.tone}>
      <View className="flex-row items-start justify-between gap-3">
        <Text className="flex-1 text-base font-semibold text-ink dark:text-ink-dark">
          {titleCase(pair.drugA)} + {titleCase(pair.drugB)}
        </Text>
        <Badge label={style.label} tone={style.tone} />
      </View>
      <Text className="mt-1 text-sm text-muted dark:text-muted-dark">Your medications: {yourMeds}</Text>
      <Text className="mt-3 text-base text-ink dark:text-ink-dark">{pair.summary}</Text>
      <Text className="mt-3 text-sm font-semibold text-ink dark:text-ink-dark">What to do</Text>
      <Text className="text-sm text-ink dark:text-ink-dark">{pair.advice}</Text>
    </Card>
  );
}

function UnmatchedCard({ prescriptions }: { prescriptions: PrescriptionRecord[] }) {
  return (
    <Card>
      <Text className="text-base font-semibold text-ink dark:text-ink-dark">Not checked ({prescriptions.length})</Text>
      <Text className="mt-1 text-sm text-muted dark:text-muted-dark">
        AntiRog doesn’t recognize these yet, so they weren’t checked for interactions:
      </Text>
      <View className="mt-2 gap-1">
        {prescriptions.map((p) => (
          <Text key={p.id} className="text-base text-ink dark:text-ink-dark">
            • {p.medication}
          </Text>
        ))}
      </View>
    </Card>
  );
}
