import { Model } from '@nozbe/watermelondb'
import { field, text } from '@nozbe/watermelondb/decorators'

export default class User extends Model {
  static table = 'users'

  @text('name') name
  @text('role') role
}
