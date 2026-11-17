import { appSchema, tableSchema } from '@nozbe/watermelondb'

export const schema = appSchema({
  version: 10,
  tables: [
    tableSchema({
      name: 'users',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'role', type: 'string' },
      ]
    }),
    tableSchema({
      name: 'prescriptions',
      columns: [
        { name: 'medication', type: 'string' },
        { name: 'dosage', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'user_id', type: 'string' },
        // Filled from the curated interaction table (Step 3.3); defaults until then.
        { name: 'standard_name', type: 'string' },
        { name: 'is_high_risk', type: 'boolean', isIndexed: true },
        // Daily reminder. Minutes after local midnight (e.g. 540 = 9:00); null until first set.
        { name: 'reminder_enabled', type: 'boolean' },
        { name: 'reminder_minutes', type: 'number', isOptional: true },
        // The visit this prescription was added from, if any (schema v7).
        { name: 'visit_id', type: 'string', isOptional: true, isIndexed: true },
      ]
    }),
    // One outcome per scheduled dose, synced to Supabase (public.dose_events). The id is
    // `${prescription_id}_${scheduled_at}`, so the same dose logged on two devices is one record.
    tableSchema({
      name: 'dose_events',
      columns: [
        { name: 'prescription_id', type: 'string', isIndexed: true },
        { name: 'user_id', type: 'string' },
        // ms. The day's reminder time when the dose was logged.
        { name: 'scheduled_at', type: 'number', isIndexed: true },
        // 'taken' | 'skipped' (the server may also hold 'missed').
        { name: 'status', type: 'string' },
        // ms, device clock.
        { name: 'recorded_at', type: 'number' },
      ]
    }),
    // Hospital and clinic visits (schema v7). Synced to Supabase (public.visits).
    tableSchema({
      name: 'visits',
      columns: [
        { name: 'user_id', type: 'string' },
        // ms, local midnight of the visit day.
        { name: 'visited_at', type: 'number', isIndexed: true },
        { name: 'facility', type: 'string' },
        { name: 'doctor', type: 'string' },
        { name: 'reason', type: 'string' },
        { name: 'notes', type: 'string' },
        { name: 'created_at', type: 'number' },
      ]
    }),
    // Documents attached to a visit (schema v7). Only metadata is stored and synced
    // (public.visit_documents); the file itself stays on the phone that attached it, at a path built
    // from the record id and extension (src/lib/visits.ts).
    tableSchema({
      name: 'visit_documents',
      columns: [
        { name: 'visit_id', type: 'string', isIndexed: true },
        { name: 'user_id', type: 'string' },
        // 'prescription' | 'lab_report' | 'other'
        { name: 'kind', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'mime_type', type: 'string' },
        { name: 'size', type: 'number' },
        { name: 'extension', type: 'string' },
        // ms, when the document was attached.
        { name: 'uploaded_at', type: 'number' },
      ]
    }),
    // Biomarker readings saved from scanned lab reports (schema v8). Synced to Supabase
    // (public.lab_results). One row per biomarker per report date.
    tableSchema({
      name: 'lab_results',
      columns: [
        { name: 'user_id', type: 'string' },
        // BiomarkerKey from src/lib/report-parser.ts, e.g. 'hba1c', 'blood_pressure'.
        { name: 'biomarker', type: 'string', isIndexed: true },
        // In the biomarker's canonical unit. For blood pressure, systolic.
        { name: 'value', type: 'number' },
        // Diastolic, for blood pressure only.
        { name: 'value2', type: 'number', isOptional: true },
        { name: 'unit', type: 'string' },
        // 'low' | 'normal' | 'high', from generic adult ranges at the time of saving.
        { name: 'flag', type: 'string' },
        // ms, local midnight of the report date.
        { name: 'measured_at', type: 'number', isIndexed: true },
        // File name or label of the report the value was read from.
        { name: 'report_name', type: 'string' },
        { name: 'created_at', type: 'number' },
        // The visit_documents record (the saved report file) these values came from (schema v9).
        // Deleting that report deletes its readings. Null for readings saved before v9.
        { name: 'document_id', type: 'string', isOptional: true, isIndexed: true },
      ]
    }),
    // Pills identified with the pill scanner (schema v9). Synced to Supabase (public.scanned_pills).
    // Only the result is stored; camera frames never are.
    tableSchema({
      name: 'scanned_pills',
      columns: [
        { name: 'user_id', type: 'string' },
        // Display name: the medication's name, or the model's label when it isn't a known medication.
        { name: 'name', type: 'string' },
        // The model's raw class label.
        { name: 'label', type: 'string' },
        // Standard drug name, '' when the label isn't a medication AntiRog knows.
        { name: 'drug', type: 'string' },
        // 0..1, the model's score when the scanner locked on.
        { name: 'confidence', type: 'number' },
        // ms, when the pill was identified.
        { name: 'scanned_at', type: 'number', isIndexed: true },
      ]
    }),
    // Emergency Medical ID (schema v10). Synced to Supabase (public.emergency_profile). At most one
    // record per user: its id is the user's id. date_of_birth is 'YYYY-MM-DD' or ''.
    tableSchema({
      name: 'emergency_profile',
      columns: [
        { name: 'user_id', type: 'string' },
        { name: 'full_name', type: 'string' },
        { name: 'date_of_birth', type: 'string' },
        { name: 'blood_type', type: 'string' },
        { name: 'known_allergies', type: 'string' },
        { name: 'chronic_conditions', type: 'string' },
        { name: 'emergency_contact_number', type: 'string' },
        { name: 'show_on_widget', type: 'boolean' },
        { name: 'updated_at', type: 'number' },
      ]
    }),
    // Curated reference data, seeded on the device from src/lib/interaction-data.ts. Never synced.
    // drug_a < drug_b (standard names), so each pair is stored once.
    tableSchema({
      name: 'interaction_pairs',
      columns: [
        { name: 'drug_a', type: 'string', isIndexed: true },
        { name: 'drug_b', type: 'string', isIndexed: true },
        { name: 'severity', type: 'string' },
        { name: 'summary', type: 'string' },
        { name: 'advice', type: 'string' },
      ]
    }),
  ]
})
