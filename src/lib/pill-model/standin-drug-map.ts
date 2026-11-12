/**
 * TEST-ONLY placeholder. The stand-in MobileNet model recognises everyday objects, not pills, so this
 * pretends a few easy-to-find objects are medications. That lets the lock → vault → conflict flow be
 * tested end to end before a trained pill model exists. Delete it together with the stand-in model.
 *
 * Every value must be a standard drug name from src/lib/interaction-data.ts. To see a warning, add a
 * prescription that conflicts with the mapped drug (shown in the comment) to the vault first.
 */
export const STANDIN_DRUG_FOR_LABEL: Readonly<Record<string, string>> = {
  'pill bottle': 'ibuprofen', // conflicts with warfarin, lithium
  'coffee mug': 'aspirin', // conflicts with warfarin
  cup: 'aspirin',
  'water bottle': 'clarithromycin', // "do not combine" with simvastatin; conflicts with colchicine
  'remote control': 'sildenafil', // "do not combine" with nitrates (e.g. Imdur)
  'cellular telephone': 'tramadol', // conflicts with SSRIs (e.g. sertraline)
  banana: 'potassium chloride', // conflicts with ACE inhibitors (e.g. lisinopril)
  orange: 'amoxicillin', // no conflicts: tests the "no conflicts" result
  mouse: 'metformin', // no conflicts
};
