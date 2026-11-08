import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'
import { schema } from './schema'
import migrations from './migrations'
import User from './User'
import Prescription from './Prescription'
import InteractionPair from './InteractionPair'
import DoseEvent from './DoseEvent'

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: true, // Enables the fast C++ synchronous engine
  onSetUpError: error => {
    console.error("Database failed to load", error)
  }
})

export const database = new Database({
  adapter,
  modelClasses: [User, Prescription, InteractionPair, DoseEvent],
})
