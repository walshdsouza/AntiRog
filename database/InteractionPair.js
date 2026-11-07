import { Model } from '@nozbe/watermelondb'
import { text } from '@nozbe/watermelondb/decorators'

/** One curated high-risk drug pair. Reference data: seeded locally, never synced. */
export default class InteractionPair extends Model {
  static table = 'interaction_pairs'

  @text('drug_a') drugA
  @text('drug_b') drugB
  @text('severity') severity
  @text('summary') summary
  @text('advice') advice
}
