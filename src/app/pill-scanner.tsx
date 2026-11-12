import { useRouter } from 'expo-router';

import { PillScanner } from '@/components/pill-scanner';

export default function PillScannerScreen() {
  const router = useRouter();
  return (
    <PillScanner
      onClose={() => router.back()}
      // Close the scanner and show Medications, where the logged dose now appears as taken.
      onDoseLogged={() => router.dismissTo('/')}
    />
  );
}
