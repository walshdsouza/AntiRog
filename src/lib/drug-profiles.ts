/**
 * Static drug profiles, keyed by the standard name from the curated interaction table (Step 3.3).
 * Temporary: only a few common medications, listing their best-known common side effects. Not a
 * complete list and not medical advice; the UI says so.
 */
export type DrugProfile = {
  sideEffects: string[];
};

const PROFILES: Record<string, DrugProfile> = {
  amoxicillin: { sideEffects: ['Diarrhea', 'Nausea', 'Skin rash'] },
  atorvastatin: { sideEffects: ['Muscle aches', 'Joint pain', 'Diarrhea'] },
  ibuprofen: { sideEffects: ['Upset stomach', 'Heartburn', 'Nausea', 'Dizziness'] },
  lisinopril: { sideEffects: ['Dry cough', 'Dizziness', 'Headache'] },
  metformin: { sideEffects: ['Nausea', 'Diarrhea', 'Stomach upset', 'Metallic taste'] },
  warfarin: { sideEffects: ['Bruising easily', 'Bleeding that takes longer to stop'] },
};

/** Profile for a standard drug name, or null if there is none yet. Case-insensitive. */
export function getDrugProfile(standardName: string): DrugProfile | null {
  return PROFILES[standardName.trim().toLowerCase()] ?? null;
}
