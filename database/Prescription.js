import { Model } from '@nozbe/watermelondb'
import { field, text, readonly, date } from '@nozbe/watermelondb/decorators'

export default class Prescription extends Model {
  static table = 'prescriptions'

  @text('medication') medication
  @text('dosage') dosage
  @text('user_id') userId
  @text('standard_name') standardName
  @field('is_high_risk') isHighRisk
  @field('reminder_enabled') reminderEnabled
  @field('reminder_minutes') reminderMinutes
  @readonly @date('created_at') createdAt
}
