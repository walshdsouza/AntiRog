import { addColumns, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations'

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
  ],
})
