import { addColumns, createTable, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations'

export default schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'prescriptions',
          columns: [{ name: 'user_id', type: 'string' }],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'prescriptions',
          columns: [
            { name: 'standard_name', type: 'string' },
            { name: 'is_high_risk', type: 'boolean', isIndexed: true },
          ],
        }),
      ],
    },
    {
      toVersion: 4,
      steps: [
        createTable({
          name: 'interaction_pairs',
          columns: [
            { name: 'drug_a', type: 'string', isIndexed: true },
            { name: 'drug_b', type: 'string', isIndexed: true },
            { name: 'severity', type: 'string' },
            { name: 'summary', type: 'string' },
            { name: 'advice', type: 'string' },
          ],
        }),
      ],
    },
    {
      toVersion: 5,
      steps: [
        addColumns({
          table: 'prescriptions',
          columns: [
            { name: 'reminder_enabled', type: 'boolean' },
            { name: 'reminder_minutes', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 6,
      steps: [
        createTable({
          name: 'dose_events',
          columns: [
            { name: 'prescription_id', type: 'string', isIndexed: true },
            { name: 'user_id', type: 'string' },
            { name: 'scheduled_at', type: 'number', isIndexed: true },
            { name: 'status', type: 'string' },
            { name: 'recorded_at', type: 'number' },
          ],
        }),
      ],
    },
  ],
})
