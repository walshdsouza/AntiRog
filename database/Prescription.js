import { Model } from '@nozbe/watermelondb'
import { field, text, readonly, date } from '@nozbe/watermelondb/decorators'

export default class Prescription extends Model {
  static table = 'prescriptions'

  @text('medication') medication
  @text('dosage') dosage
  @text('user_id') userId
  @readonly @date('created_at') createdAt
}
