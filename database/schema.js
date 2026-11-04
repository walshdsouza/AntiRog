import { appSchema, tableSchema } from '@nozbe/watermelondb'

export const schema = appSchema({
  version: 1,
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
      ]
    })
  ]
})
