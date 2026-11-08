import { Model } from '@nozbe/watermelondb'
import { field, text } from '@nozbe/watermelondb/decorators'

/** The patient's outcome for one scheduled dose. Synced to Supabase (public.dose_events). */
export default class DoseEvent extends Model {
  static table = 'dose_events'

  @text('prescription_id') prescriptionId
  @text('user_id') userId
  @field('scheduled_at') scheduledAt
  @text('status') status
  @field('recorded_at') recordedAt
}
