import { Model } from '@nozbe/watermelondb'
import { field, readonly, date, text } from '@nozbe/watermelondb/decorators'

/**
 * One biomarker reading read from a lab report and saved by the patient. Synced to Supabase
 * (public.lab_results). Feeds the trend charts in Reports › Tests.
 */
export default class LabResult extends Model {
  static table = 'lab_results'

  @text('user_id') userId
  @text('biomarker') biomarker
  @field('value') value
  @field('value2') value2
  @text('unit') unit
  @text('flag') flag
  @field('measured_at') measuredAt
  @text('report_name') reportName
  @readonly @date('created_at') createdAt
}
