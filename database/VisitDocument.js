import { Model } from '@nozbe/watermelondb'
import { field, text } from '@nozbe/watermelondb/decorators'

/**
 * A document attached to a visit. Only metadata is synced (public.visit_documents); the file stays on
 * the phone that attached it.
 */
export default class VisitDocument extends Model {
  static table = 'visit_documents'

  @text('visit_id') visitId
  @text('user_id') userId
  @text('kind') kind
  @text('name') name
  @text('mime_type') mimeType
  @field('size') size
  @text('extension') extension
  @field('uploaded_at') uploadedAt
}
