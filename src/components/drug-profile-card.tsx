import { Link } from 'expo-router';
import { Text, View } from 'react-native';

import { Card, SectionTitle } from '@/components/neu';
import { getDrugProfile } from '@/lib/drug-profiles';

/**
 * Drug profile for one prescription. Shows a placeholder until the medication has been matched to
 * a standard name (filled in by the curated interaction table in Step 3.3).
 */
export function DrugProfileCard({ standardName, isHighRisk }: { standardName: string; isHighRisk: boolean }) {
  const name = standardName.trim();

  return (
    <View className="gap-3">
      <SectionTitle>Drug profile</SectionTitle>
      {isHighRisk && <HighRiskBanner />}
      {name ? <MatchedProfile name={name} /> : <UnmatchedProfile />}
    </View>
  );
}

function HighRiskBanner() {
  return (
    <Card tone="danger" accessibilityRole="alert">
      <Text className="text-base font-semibold text-danger dark:text-danger-dark">High-risk medication</Text>
      <Text className="mt-1 text-sm text-ink dark:text-ink-dark">
        This medication has known dangerous interactions. Talk to your doctor or pharmacist before changing
        how you take it.
      </Text>
      <Link href={{ pathname: '/', params: { view: 'interactions' } }} className="mt-2 text-sm font-semibold text-danger dark:text-danger-dark">
        Check interactions ›
      </Link>
    </Card>
  );
}

function MatchedProfile({ name }: { name: string }) {
  const profile = getDrugProfile(name);

  return (
    <Card>
      <Text className="text-sm text-muted dark:text-muted-dark">Standard name</Text>
      <Text selectable className="text-base font-semibold capitalize text-ink dark:text-ink-dark">
        {name}
      </Text>

      <Text className="mt-4 text-sm text-muted dark:text-muted-dark">Common side effects</Text>
      {profile && profile.sideEffects.length > 0 ? (
        <>
          <View className="mt-1 gap-1">
            {profile.sideEffects.map((effect) => (
              <Text key={effect} className="text-base text-ink dark:text-ink-dark">
                • {effect}
              </Text>
            ))}
          </View>
          <Text className="mt-3 text-xs text-muted dark:text-muted-dark">
            Not a complete list. Ask your doctor or pharmacist about any side effect that worries you.
          </Text>
        </>
      ) : (
        <Text className="mt-1 text-sm text-muted dark:text-muted-dark">
          No side-effect information for this medication yet.
        </Text>
      )}
    </Card>
  );
}

function UnmatchedProfile() {
  return (
    <Card>
      <Text className="text-base font-semibold text-ink dark:text-ink-dark">Not matched yet</Text>
      <Text className="mt-1 text-sm text-muted dark:text-muted-dark">
        Once AntiRog matches this medication to its drug library, its standard name and common side
        effects will appear here.
      </Text>
    </Card>
  );
}
