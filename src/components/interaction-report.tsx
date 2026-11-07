import { Q, type Database } from '@nozbe/watermelondb';
import { withObservables } from '@nozbe/watermelondb/react';
import { Text, View } from 'react-native';

import { buildConflicts, type Conflict, type InteractionPairRecord } from '@/lib/interactions';
import type { PrescriptionRecord } from '@/lib/prescriptions';

const cardClass =
  'rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-gray-900';

function titleCase(name: string) {
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

// --- Step 1: observe the vault -------------------------------------------------------------------

function VaultObserver({ database, prescriptions }: { database: Database; prescriptions: PrescriptionRecord[] }) {
  // observeWithColumns emits a new array whenever medication or standard_name changes, so this re-renders.
  const names = [...new Set(prescriptions.map((p) => p.standardName).filter(Boolean))].sort();

  if (prescriptions.length === 0) {
    return (
      <View className={cardClass}>
        <Text className="text-base font-semibold text-gray-900 dark:text-white">No medications yet</Text>
        <Text className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Add medications from the Scan tab and AntiRog will check them against each other here.
        </Text>
      </View>
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
          <Text accessibilityRole="header" className="text-base font-semibold text-red-600 dark:text-red-400">
            {conflicts.length} high-risk combination{conflicts.length === 1 ? '' : 's'} found
          </Text>
          {conflicts.map((conflict) => (
            <ConflictCard key={conflict.pair.id} conflict={conflict} />
          ))}
        </>
      ) : (
        <View className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 dark:border-emerald-900 dark:bg-emerald-950">
          <Text className="text-base font-semibold text-emerald-800 dark:text-emerald-200">
            No high-risk combinations found
          </Text>
          <Text className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
            {checkedCount > 0
              ? `Checked ${checkedCount} medication${checkedCount === 1 ? '' : 's'} against AntiRog's interaction list.`
              : 'None of your medications are in AntiRog’s interaction list yet.'}
          </Text>
        </View>
      )}

      {unmatched.length > 0 && <UnmatchedCard prescriptions={unmatched} />}

      <Text className="text-xs text-gray-500 dark:text-gray-400">
        AntiRog checks a short list of well-known dangerous combinations, on your phone and offline. It is
        not a complete check and does not replace advice from your doctor or pharmacist. Do not stop or
        change a medication without talking to them.
      </Text>
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
  contraindicated: {
    label: 'Do not combine',
    badge: 'bg-red-600',
    card: 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950',
  },
  major: {
    label: 'Major',
    badge: 'bg-amber-600',
    card: 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950',
  },
} as const;

function ConflictCard({ conflict: { pair, medsA, medsB } }: { conflict: Conflict }) {
  const style = SEVERITY_STYLE[pair.severity] ?? SEVERITY_STYLE.major;
  const yourMeds = [...medsA, ...medsB].map((p) => p.medication).join(' · ');

  return (
    <View className={`rounded-xl border px-4 py-4 ${style.card}`}>
      <View className="flex-row items-start justify-between gap-3">
        <Text className="flex-1 text-base font-semibold text-gray-900 dark:text-white">
          {titleCase(pair.drugA)} + {titleCase(pair.drugB)}
        </Text>
        <View className={`rounded-full px-2.5 py-1 ${style.badge}`}>
          <Text className="text-xs font-semibold text-white">{style.label}</Text>
        </View>
      </View>
      <Text className="mt-1 text-sm text-gray-600 dark:text-gray-400">Your medications: {yourMeds}</Text>
      <Text className="mt-3 text-base text-gray-900 dark:text-white">{pair.summary}</Text>
      <Text className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">What to do</Text>
      <Text className="text-sm text-gray-700 dark:text-gray-300">{pair.advice}</Text>
    </View>
  );
}

function UnmatchedCard({ prescriptions }: { prescriptions: PrescriptionRecord[] }) {
  return (
    <View className={cardClass}>
      <Text className="text-base font-semibold text-gray-900 dark:text-white">
        Not checked ({prescriptions.length})
      </Text>
      <Text className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        AntiRog doesn’t recognize these yet, so they weren’t checked for interactions:
      </Text>
      <View className="mt-2 gap-1">
        {prescriptions.map((p) => (
          <Text key={p.id} className="text-base text-gray-900 dark:text-white">
            • {p.medication}
          </Text>
        ))}
      </View>
    </View>
  );
}
