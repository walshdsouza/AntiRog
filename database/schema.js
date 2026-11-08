import { appSchema, tableSchema } from '@nozbe/watermelondb'

export const schema = appSchema({
  version: 6,
  tables: [
    tableSchema({
      name: 'users',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'role', type: 'string' },
      ]
    }),
    tableSchema({
      name: 'prescriptions',
      columns: [
        { name: 'medication', type: 'string' },
        { name: 'dosage', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'user_id', type: 'string' },
        // Filled from the curated interaction table (Step 3.3); defaults until then.
        { name: 'standard_name', type: 'string' },
        { name: 'is_high_risk', type: 'boolean', isIndexed: true },
        // Daily reminder. Minutes after local midnight (e.g. 540 = 9:00); null until first set.
        { name: 'reminder_enabled', type: 'boolean' },
        { name: 'reminder_minutes', type: 'number', isOptional: true },
      ]
    }),
    // One outcome per scheduled dose, synced to Supabase (public.dose_events). The id is
    // `${prescription_id}_${scheduled_at}`, so the same dose logged on two devices is one record.
    tableSchema({
      name: 'dose_events',
      columns: [
        { name: 'prescription_id', type: 'string', isIndexed: true },
        { name: 'user_id', type: 'string' },
        // ms. The day's reminder time when the dose was logged.
        { name: 'scheduled_at', type: 'number', isIndexed: true },
        // 'taken' | 'skipped' (the server may also hold 'missed').
        { name: 'status', type: 'string' },
        // ms, device clock.
        { name: 'recorded_at', type: 'number' },
      ]
    }),
    // Curated reference data, seeded on the device from src/lib/interaction-data.ts. Never synced.
    // drug_a < drug_b (standard names), so each pair is stored once.
    tableSchema({
      name: 'interaction_pairs',
      columns: [
        { name: 'drug_a', type: 'string', isIndexed: true },
        { name: 'drug_b', type: 'string', isIndexed: true },
        { name: 'severity', type: 'string' },
        { name: 'summary', type: 'string' },
        { name: 'advice', type: 'string' },
      ]
    }),
  ]
})
