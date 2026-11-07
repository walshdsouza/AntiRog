import { appSchema, tableSchema } from '@nozbe/watermelondb'

export const schema = appSchema({
  version: 4,
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
