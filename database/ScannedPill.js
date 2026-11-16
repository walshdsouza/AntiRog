import { Model } from '@nozbe/watermelondb'
import { field, text } from '@nozbe/watermelondb/decorators'

/**
 * One pill identified with the pill scanner. Synced to Supabase (public.scanned_pills). Listed as
 * "Previously Identified Pills" on the Scan tab.
 */
export default class ScannedPill extends Model {
  static table = 'scanned_pills'

  @text('user_id') userId
  @text('name') name
  @text('label') label
  @text('drug') drug
  @field('confidence') confidence
  @field('scanned_at') scannedAt
}
