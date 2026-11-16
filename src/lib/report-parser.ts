/*
 * Reads common biomarkers out of raw OCR text from a lab report. Pure functions, no I/O: the text
 * comes from on-device OCR (src/lib/ocr.ts) and the result stays on the phone.
 *
 * Approach: walk the report line by line, find a known test name, then take the first number after
 * it (lab tables put the result before the reference range). When OCR splits a table row so the name
 * and the value land on separate lines, the next line is tried too. Values are converted to one
 * canonical unit per biomarker and anything physiologically implausible is dropped as an OCR misread.
 *
 * Flags use generic adult ranges and are only a hint. The lab's own reference range on the report is
 * what counts, and the UI must say so.
 */

export type BiomarkerKey =
  | 'blood_pressure'
  | 'total_cholesterol'
  | 'ldl'
  | 'hdl'
  | 'triglycerides'
  | 'glucose_fasting'
  | 'glucose_random'
  | 'hba1c'
  | 'hemoglobin'
  | 'tsh'
  | 'creatinine'
  | 'vitamin_d'
  | 'vitamin_b12';

export type BiomarkerFlag = 'low' | 'normal' | 'high';

export type Biomarker = {
  key: BiomarkerKey;
  label: string;
  /** In the canonical `unit`. For blood pressure, systolic. */
  value: number;
  /** Diastolic, for blood pressure only. */
  value2?: number;
  unit: string;
  flag: BiomarkerFlag;
  /** The OCR line(s) the value was read from, for showing the user what was matched. */
  source: string;
};

type UnitRule = { pattern: RegExp; toCanonical: (v: number) => number };

type Definition = {
  key: BiomarkerKey;
  label: string;
  unit: string;
  /** Matches the test name on a line. */
  name: RegExp;
  /** Lines that match `name` but are a different test (e.g. "Non-HDL" for HDL). */
  exclude?: RegExp;
  /** Units other than the canonical one, with conversions. */
  units?: UnitRule[];
  plausible: [number, number];
  /** Generic adult range: below `low` is low, at or above `high` is high. */
  low?: number;
  high?: number;
};

const NUMBER = /[<>]?\s*(\d{1,4}(?:[.,]\d{1,3})?)/;
const MMOL = /mmol\s*\/\s*l/i;

const round = (v: number, digits = 1) => Math.round(v * 10 ** digits) / 10 ** digits;

// Order matters: more specific names first (HbA1c before hemoglobin, fasting before plain glucose).
export const BIOMARKER_DEFINITIONS: readonly Definition[] = [
  {
    key: 'hba1c',
    label: 'HbA1c',
    unit: '%',
    name: /\b(?:hba1c|hb\s*a1c|a1c|glyc(?:at|osyl)ated\s+ha?emoglobin)\b/i,
    units: [{ pattern: /mmol\s*\/\s*mol/i, toCanonical: (v) => round(v / 10.929 + 2.15) }],
    plausible: [3, 20],
    high: 5.7,
  },
  {
    key: 'hemoglobin',
    label: 'Hemoglobin',
    unit: 'g/dL',
    name: /\b(?:ha?emoglobin|hgb|hb)\b/i,
    exclude: /a1c|glyc|mean\s+corpuscular|mch/i,
    units: [{ pattern: /\bg\s*\/\s*l\b/i, toCanonical: (v) => round(v / 10) }],
    plausible: [3, 25],
    low: 12,
    high: 17.5,
  },
  {
    key: 'ldl',
    label: 'LDL cholesterol',
    unit: 'mg/dL',
    name: /\bLDL\b|low[\s-]+density/i,
    exclude: /ratio|\bvldl\b|very\s+low/i,
    units: [{ pattern: MMOL, toCanonical: (v) => Math.round(v * 38.67) }],
    plausible: [10, 500],
    high: 130,
  },
  {
    key: 'hdl',
    label: 'HDL cholesterol',
    unit: 'mg/dL',
    name: /\bHDL\b|high[\s-]+density/i,
    exclude: /ratio|non[\s-]*hdl/i,
    units: [{ pattern: MMOL, toCanonical: (v) => Math.round(v * 38.67) }],
    plausible: [5, 200],
    low: 40,
  },
  {
    key: 'total_cholesterol',
    label: 'Total cholesterol',
    unit: 'mg/dL',
    name: /\b(?:total\s+)?cholesterol\b|\bs\.?\s*chol\b/i,
    exclude: /\b(?:v?ldl|hdl|non)\b|density|ratio/i,
    units: [{ pattern: MMOL, toCanonical: (v) => Math.round(v * 38.67) }],
    plausible: [50, 800],
    high: 200,
  },
  {
    key: 'triglycerides',
    label: 'Triglycerides',
    unit: 'mg/dL',
    name: /\btriglycerides?\b|\btg\b/i,
    units: [{ pattern: MMOL, toCanonical: (v) => Math.round(v * 88.57) }],
    plausible: [10, 5000],
    high: 150,
  },
  {
    key: 'glucose_fasting',
    label: 'Fasting glucose',
    unit: 'mg/dL',
    name: /\bfbs\b|\bfpg\b|fasting\s+(?:blood\s+|plasma\s+)?(?:glucose|sugar)|(?:glucose|sugar)\s*[,(-]?\s*fasting/i,
    units: [{ pattern: MMOL, toCanonical: (v) => Math.round(v * 18.016) }],
    plausible: [20, 800],
    low: 70,
    high: 100,
  },
  {
    key: 'glucose_random',
    label: 'Blood glucose',
    unit: 'mg/dL',
    name: /\brbs\b|\bppbs\b|\b(?:blood|plasma|serum)?\s*(?:glucose|sugar)\b/i,
    exclude: /fasting|\bfbs\b|urine/i,
    units: [{ pattern: MMOL, toCanonical: (v) => Math.round(v * 18.016) }],
    plausible: [20, 1000],
    low: 70,
    high: 200,
  },
  {
    key: 'tsh',
    label: 'TSH',
    unit: 'mIU/L',
    // µIU/mL is the same quantity as mIU/L, so no conversion is needed.
    name: /\bTSH\b|thyroid[\s-]+stimulating/i,
    plausible: [0.005, 150],
    low: 0.4,
    high: 4.5,
  },
  {
    key: 'creatinine',
    label: 'Creatinine',
    unit: 'mg/dL',
    name: /\bcreatinine\b/i,
    exclude: /clearance|ratio|urine|kinase/i,
    units: [{ pattern: /[µu]mol\s*\/\s*l/i, toCanonical: (v) => round(v / 88.42, 2) }],
    plausible: [0.1, 20],
    low: 0.6,
    high: 1.3,
  },
  {
    key: 'vitamin_d',
    label: 'Vitamin D',
    unit: 'ng/mL',
    name: /vitamin\s*d\b|vit\.?\s*d\d?\b|25[\s-]*(?:oh|hydroxy)/i,
    units: [{ pattern: /nmol\s*\/\s*l/i, toCanonical: (v) => round(v / 2.496) }],
    plausible: [2, 200],
    low: 20,
    high: 100,
  },
  {
    key: 'vitamin_b12',
    label: 'Vitamin B12',
    unit: 'pg/mL',
    name: /vitamin\s*b\s*12|vit\.?\s*b\s*12|\bcobalamin\b/i,
    units: [{ pattern: /pmol\s*\/\s*l/i, toCanonical: (v) => Math.round(v * 1.355) }],
    plausible: [30, 3000],
    low: 200,
    high: 900,
  },
];

export const BIOMARKER_LABELS: Record<BiomarkerKey, string> = {
  blood_pressure: 'Blood pressure',
  ...(Object.fromEntries(BIOMARKER_DEFINITIONS.map((d) => [d.key, d.label])) as Record<
    Exclude<BiomarkerKey, 'blood_pressure'>,
    string
  >),
};

/** Fixes common OCR confusions inside numbers and normalizes whitespace. */
export function normalizeOcrLine(line: string) {
  return (
    line
      .replace(/[ \t]+/g, ' ')
      .replace(/[：﹕]/g, ':')
      .replace(/[–—]/g, '-')
      // Table rules ("Hb | 13.2 | g/dL") are separators, not the digit 1.
      .replace(/\s*[|¦]\s*/g, ' ')
      // "1O2" / "12O" / "1l.5" → "102" / "120" / "11.5". Only where a letter can't be meant, so units
      // like "mmol" or "IU" are left alone.
      .replace(/(?<=\d)[Oo](?=\d|[^A-Za-z]|$)|(?<![A-Za-z])[Oo](?=\d)/g, '0')
      .replace(/(?<=\d)[lI](?=\d)|(?<=\d[.,])[lI]|[lI](?=[.,]\d)/g, '1')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function flagFor(value: number, low?: number, high?: number): BiomarkerFlag {
  if (low != null && value < low) return 'low';
  if (high != null && value >= high) return 'high';
  return 'normal';
}

const BP_NAME = /\b(?:b\.?\s*p\.?|blood\s+pressure)\b/i;
const BP_VALUE = /\b(\d{2,3})\s*\/\s*(\d{2,3})\b/;

function readBloodPressure(line: string, next: string | undefined): Biomarker | null {
  // Either a labelled reading ("BP: 128/84") or any "128/84 mmHg" on its own.
  const labelled = BP_NAME.exec(line);
  const candidates = labelled
    ? [line.slice(labelled.index + labelled[0].length), next ?? '']
    : /mm\s*hg/i.test(line)
      ? [line]
      : [];
  for (const text of candidates) {
    const m = BP_VALUE.exec(text);
    if (!m) continue;
    const systolic = Number(m[1]);
    const diastolic = Number(m[2]);
    if (systolic < 60 || systolic > 260 || diastolic < 30 || diastolic > 160 || diastolic >= systolic) continue;
    const flag: BiomarkerFlag =
      systolic >= 130 || diastolic >= 80 ? 'high' : systolic < 90 || diastolic < 60 ? 'low' : 'normal';
    return {
      key: 'blood_pressure',
      label: BIOMARKER_LABELS.blood_pressure,
      value: systolic,
      value2: diastolic,
      unit: 'mmHg',
      flag,
      source: text === line ? line : `${line} ${text}`,
    };
  }
  return null;
}

/** The first number in `text`, with the unit written after it (if any) converted to canonical. */
function readValue(def: Definition, text: string): number | null {
  const m = NUMBER.exec(text);
  if (!m) return null;
  let value = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  // Only look for a unit right after the number, so a reference-range unit further on can't leak in.
  const after = text.slice(m.index + m[0].length, m.index + m[0].length + 16);
  const rule = def.units?.find((u) => u.pattern.test(after));
  if (rule) value = rule.toCanonical(value);
  const [min, max] = def.plausible;
  return value >= min && value <= max ? value : null;
}

function readDefinition(def: Definition, line: string, next: string | undefined): Biomarker | null {
  const name = def.name.exec(line);
  if (!name || def.exclude?.test(line)) return null;
  // Skip a qualifier right after the name, e.g. "Vitamin D (25-OH)" or "Glucose [Fasting]".
  const rest = line.slice(name.index + name[0].length).replace(/^[\s:=-]*(?:[([][^)\]]*[)\]]\s*)+/, ' ');
  // A value on the same line wins; otherwise try the next line if it starts with a number
  // (the name and the value were split into separate OCR blocks).
  let value = readValue(def, rest);
  let source = line;
  if (value == null && next && /^[<>]?\s*\d/.test(next)) {
    value = readValue(def, next);
    source = `${line} ${next}`;
  }
  if (value == null) return null;
  return { key: def.key, label: def.label, value, unit: def.unit, flag: flagFor(value, def.low, def.high), source };
}

/**
 * Extracts biomarkers from OCR output. Accepts the raw string or the array of text blocks the OCR
 * returns. Each biomarker is reported once (its first occurrence), in report order.
 */
export function parseLabReport(raw: string | string[]): Biomarker[] {
  const lines = (Array.isArray(raw) ? raw.join('\n') : raw)
    .split(/\r?\n/)
    .map(normalizeOcrLine)
    .filter(Boolean);

  const found = new Map<BiomarkerKey, Biomarker>();
  lines.forEach((line, i) => {
    const next = lines[i + 1];
    if (!found.has('blood_pressure')) {
      const bp = readBloodPressure(line, next);
      if (bp) {
        found.set(bp.key, bp);
        return;
      }
    }
    // One biomarker per line: the first (most specific) definition that matches the name wins.
    for (const def of BIOMARKER_DEFINITIONS) {
      if (!def.name.test(line) || def.exclude?.test(line)) continue;
      if (!found.has(def.key)) {
        const result = readDefinition(def, line, next);
        if (result) found.set(def.key, result);
      }
      break;
    }
  });
  return [...found.values()];
}

/** "128/84 mmHg", "5.9 %", "182 mg/dL". */
export function formatBiomarker(b: { value: number; value2?: number | null; unit: string }) {
  const value = b.value2 != null ? `${b.value}/${b.value2}` : String(b.value);
  return b.unit === '%' ? `${value}%` : `${value} ${b.unit}`;
}
