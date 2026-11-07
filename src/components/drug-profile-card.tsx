import { Text, View } from 'react-native';

import { getDrugProfile } from '@/lib/drug-profiles';

const cardClass =
  'rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-gray-900';

/**
 * Drug profile for one prescription. Shows a placeholder until the medication has been matched to
 * a standard name (filled in by the curated interaction table in Step 3.3).
 */
export function DrugProfileCard({ standardName, isHighRisk }: { standardName: string; isHighRisk: boolean }) {
  const name = standardName.trim();

  return (
    <View className="gap-3">
      <Text className="text-lg font-semibold text-gray-900 dark:text-white">Drug profile</Text>
      {isHighRisk && <HighRiskBanner />}
      {name ? <MatchedProfile name={name} /> : <UnmatchedProfile />}
    </View>
  );
}

function HighRiskBanner() {
  return (
    <View
      accessibilityRole="alert"
      className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950">
      <Text className="text-base font-semibold text-red-700 dark:text-red-300">High-risk medication</Text>
      <Text className="mt-1 text-sm text-red-700 dark:text-red-300">
        This medication has known dangerous interactions. Check the Interactions tab, and talk to your
        doctor or pharmacist before changing how you take it.
      </Text>
    </View>
  );
}

function MatchedProfile({ name }: { name: string }) {
  const profile = getDrugProfile(name);

  return (
    <View className={cardClass}>
      <Text className="text-sm text-gray-500 dark:text-gray-400">Standard name</Text>
      <Text selectable className="text-base font-semibold capitalize text-gray-900 dark:text-white">
        {name}
      </Text>

      <Text className="mt-4 text-sm text-gray-500 dark:text-gray-400">Common side effects</Text>
      {profile && profile.sideEffects.length > 0 ? (
        <>
          <View className="mt-1 gap-1">
            {profile.sideEffects.map((effect) => (
              <Text key={effect} className="text-base text-gray-900 dark:text-white">
                • {effect}
              </Text>
            ))}
          </View>
          <Text className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Not a complete list. Ask your doctor or pharmacist about any side effect that worries you.
          </Text>
        </>
      ) : (
        <Text className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          No side-effect information for this medication yet.
        </Text>
      )}
    </View>
  );
}

function UnmatchedProfile() {
  return (
    <View className={cardClass}>
      <Text className="text-base font-semibold text-gray-900 dark:text-white">Not matched yet</Text>
      <Text className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Once AntiRog matches this medication to its drug library, its standard name and common side
        effects will appear here.
      </Text>
    </View>
  );
}
