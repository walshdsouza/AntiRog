import { Model } from '@nozbe/watermelondb'
import { field, readonly, date, text } from '@nozbe/watermelondb/decorators'

/** A hospital or clinic visit. Synced to Supabase (public.visits). */
export default class Visit extends Model {
  static table = 'visits'

  @text('user_id') userId
  @field('visited_at') visitedAt
  @text('facility') facility
  @text('doctor') doctor
  @text('reason') reason
  @text('notes') notes
  @readonly @date('created_at') createdAt
}
