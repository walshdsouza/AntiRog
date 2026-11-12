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
    {
      toVersion: 7,
      steps: [
        addColumns({
          table: 'prescriptions',
          columns: [{ name: 'visit_id', type: 'string', isOptional: true, isIndexed: true }],
        }),
        createTable({
          name: 'visits',
          columns: [
            { name: 'user_id', type: 'string' },
            { name: 'visited_at', type: 'number', isIndexed: true },
            { name: 'facility', type: 'string' },
            { name: 'doctor', type: 'string' },
            { name: 'reason', type: 'string' },
            { name: 'notes', type: 'string' },
            { name: 'created_at', type: 'number' },
          ],
        }),
        createTable({
          name: 'visit_documents',
          columns: [
            { name: 'visit_id', type: 'string', isIndexed: true },
            { name: 'user_id', type: 'string' },
            { name: 'kind', type: 'string' },
            { name: 'name', type: 'string' },
            { name: 'mime_type', type: 'string' },
            { name: 'size', type: 'number' },
            { name: 'extension', type: 'string' },
            { name: 'uploaded_at', type: 'number' },
          ],
        }),
      ],
    },
  ],
})
