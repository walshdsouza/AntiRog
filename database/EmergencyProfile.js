import { Model } from '@nozbe/watermelondb'
import { field, text } from '@nozbe/watermelondb/decorators'

/**
 * Emergency Medical ID. One per user (the record id is the user id). Synced to Supabase
 * (public.emergency_profile). Shown in Profile › Medical ID and, when opted in, on the home screen
 * widget (src/widgets/emergency-widget).
 */
export default class EmergencyProfile extends Model {
  static table = 'emergency_profile'

  @text('user_id') userId
  @text('full_name') fullName
  @text('date_of_birth') dateOfBirth
  @text('blood_type') bloodType
  @text('known_allergies') knownAllergies
  @text('chronic_conditions') chronicConditions
  @text('emergency_contact_number') emergencyContactNumber
  @field('show_on_widget') showOnWidget
  @field('updated_at') updatedAt
}
