import { Database, appSchema } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

// Tables are added in later phases (prescriptions, drug profiles, etc.).
const schema = appSchema({
  version: 1,
  tables: [],
});

const adapter = new SQLiteAdapter({
  dbName: 'antirog',
  schema,
  jsi: true,
  onSetUpError: (error) => {
    console.error('WatermelonDB setup failed', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [],
});
