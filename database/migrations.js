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
  ],
})
