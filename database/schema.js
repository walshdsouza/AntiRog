import { appSchema, tableSchema } from '@nozbe/watermelondb'

export const schema = appSchema({
  version: 3,
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
    })
  ]
})
