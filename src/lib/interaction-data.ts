/**
 * Curated, offline interaction data. This file is the source; it is seeded into the local
 * `interaction_pairs` SQLite table (see interactions.ts).
 *
 * IMPORTANT: this is a short MVP list of well-known, clinically significant interactions. It must be
 * reviewed by a pharmacist or clinician before release, and it is not a complete interaction check.
 * Bump DATA_VERSION whenever DRUGS or PAIRS change so devices re-seed the table.
 */
export const DATA_VERSION = '1';

export type Severity = 'contraindicated' | 'major';

export type DrugEntry = {
  /** Standard (generic) name, lowercase. Stored in prescriptions.standard_name. */
  name: string;
  /** Brand names and other spellings, lowercase, matched as whole words. */
  aliases?: string[];
  classes?: string[];
};

/** A side is a standard drug name, or `class:<name>` for every drug in that class. */
export type PairEntry = {
  a: string;
  b: string;
  severity: Severity;
  summary: string;
  advice: string;
};

export const DRUGS: DrugEntry[] = [
  // Anticoagulants and antiplatelets
  { name: 'warfarin', aliases: ['coumadin', 'jantoven'] },
  { name: 'aspirin', aliases: ['acetylsalicylic acid', 'ecosprin', 'disprin'] },

  // NSAIDs
  { name: 'ibuprofen', aliases: ['advil', 'motrin', 'brufen'], classes: ['nsaid'] },
  { name: 'naproxen', aliases: ['aleve', 'naprosyn'], classes: ['nsaid'] },
  { name: 'diclofenac', aliases: ['voltaren', 'voveran'], classes: ['nsaid'] },

  // Anti-infectives
  { name: 'fluconazole', aliases: ['diflucan'] },
  { name: 'metronidazole', aliases: ['flagyl'] },
  { name: 'clarithromycin', aliases: ['biaxin'] },
  { name: 'ciprofloxacin', aliases: ['cipro', 'ciplox'] },
  { name: 'linezolid', aliases: ['zyvox'] },
  {
    name: 'trimethoprim',
    aliases: ['co-trimoxazole', 'cotrimoxazole', 'sulfamethoxazole-trimethoprim', 'bactrim', 'septra', 'septran'],
  },

  // Heart and blood pressure
  { name: 'amiodarone', aliases: ['cordarone', 'pacerone'] },
  { name: 'digoxin', aliases: ['lanoxin'] },
  { name: 'simvastatin', aliases: ['zocor'] },
  { name: 'nitroglycerin', aliases: ['glyceryl trinitrate', 'nitrostat'], classes: ['nitrate'] },
  { name: 'isosorbide mononitrate', aliases: ['imdur'], classes: ['nitrate'] },
  { name: 'isosorbide dinitrate', aliases: ['isordil', 'sorbitrate'], classes: ['nitrate'] },
  { name: 'lisinopril', aliases: ['zestril', 'prinivil'], classes: ['ace_inhibitor'] },
  { name: 'enalapril', aliases: ['vasotec'], classes: ['ace_inhibitor'] },
  { name: 'ramipril', aliases: ['altace', 'cardace'], classes: ['ace_inhibitor'] },
  { name: 'spironolactone', aliases: ['aldactone'] },
  { name: 'potassium chloride', aliases: ['klor-con'] },

  // Erectile dysfunction / pulmonary hypertension
  { name: 'sildenafil', aliases: ['viagra', 'revatio'], classes: ['pde5_inhibitor'] },
  { name: 'tadalafil', aliases: ['cialis', 'adcirca'], classes: ['pde5_inhibitor'] },

  // Antidepressants (SSRIs)
  { name: 'sertraline', aliases: ['zoloft'], classes: ['ssri'] },
  { name: 'fluoxetine', aliases: ['prozac'], classes: ['ssri'] },
  { name: 'escitalopram', aliases: ['lexapro'], classes: ['ssri'] },

  // Opioids
  { name: 'tramadol', aliases: ['ultram'], classes: ['opioid'] },
  { name: 'oxycodone', aliases: ['oxycontin', 'percocet'], classes: ['opioid'] },
  { name: 'hydrocodone', aliases: ['vicodin', 'norco'], classes: ['opioid'] },
  { name: 'morphine', classes: ['opioid'] },
  { name: 'codeine', classes: ['opioid'] },

  // Benzodiazepines
  { name: 'alprazolam', aliases: ['xanax'], classes: ['benzodiazepine'] },
  { name: 'diazepam', aliases: ['valium'], classes: ['benzodiazepine'] },
  { name: 'lorazepam', aliases: ['ativan'], classes: ['benzodiazepine'] },
  { name: 'clonazepam', aliases: ['klonopin', 'rivotril'], classes: ['benzodiazepine'] },

  // Others
  { name: 'methotrexate' },
  { name: 'lithium' },
  { name: 'allopurinol', aliases: ['zyloprim', 'zyloric'] },
  { name: 'azathioprine', aliases: ['imuran'] },
  { name: 'tizanidine', aliases: ['zanaflex'] },
  { name: 'colchicine' },

  // Recognized (for drug profiles) but not in any pair yet.
  { name: 'amoxicillin', aliases: ['amoxycillin', 'amoxil'] },
  { name: 'atorvastatin', aliases: ['lipitor'] },
  { name: 'metformin', aliases: ['glucophage', 'glycomet'] },
];

const BLEEDING_ADVICE =
  'Do not take these together without your doctor knowing. Watch for unusual bruising, bleeding gums, or dark stools.';

export const PAIRS: PairEntry[] = [
  {
    a: 'warfarin',
    b: 'class:nsaid',
    severity: 'major',
    summary: 'Greatly increases the risk of serious bleeding, including stomach bleeding.',
    advice: BLEEDING_ADVICE,
  },
  {
    a: 'warfarin',
    b: 'aspirin',
    severity: 'major',
    summary: 'Greatly increases the risk of serious bleeding.',
    advice: BLEEDING_ADVICE,
  },
  {
    a: 'warfarin',
    b: 'fluconazole',
    severity: 'major',
    summary: 'Fluconazole can sharply raise warfarin levels and the risk of bleeding.',
    advice: 'Your doctor may need to check your INR more often or adjust your warfarin dose.',
  },
  {
    a: 'warfarin',
    b: 'metronidazole',
    severity: 'major',
    summary: 'Metronidazole can sharply raise warfarin levels and the risk of bleeding.',
    advice: 'Your doctor may need to check your INR more often or adjust your warfarin dose.',
  },
  {
    a: 'warfarin',
    b: 'amiodarone',
    severity: 'major',
    summary: 'Amiodarone raises warfarin levels and the risk of bleeding, sometimes for months.',
    advice: 'Your doctor will usually lower the warfarin dose and check your INR closely.',
  },
  {
    a: 'simvastatin',
    b: 'clarithromycin',
    severity: 'contraindicated',
    summary: 'Can cause severe muscle breakdown (rhabdomyolysis) that may damage the kidneys.',
    advice: 'These should not be taken together. Ask your doctor whether to pause simvastatin.',
  },
  {
    a: 'simvastatin',
    b: 'amiodarone',
    severity: 'major',
    summary: 'Raises the risk of muscle damage, especially at higher simvastatin doses.',
    advice: 'Ask your doctor whether your simvastatin dose is safe with amiodarone. Report muscle pain or weakness.',
  },
  {
    a: 'class:pde5_inhibitor',
    b: 'class:nitrate',
    severity: 'contraindicated',
    summary: 'Can cause a sudden, dangerous drop in blood pressure.',
    advice: 'Never take these together. Seek emergency care for fainting or chest pain.',
  },
  {
    a: 'class:ace_inhibitor',
    b: 'spironolactone',
    severity: 'major',
    summary: 'Can raise blood potassium to dangerous levels.',
    advice: 'Your doctor should check your potassium levels regularly.',
  },
  {
    a: 'class:ace_inhibitor',
    b: 'potassium chloride',
    severity: 'major',
    summary: 'Can raise blood potassium to dangerous levels.',
    advice: 'Your doctor should check your potassium levels regularly.',
  },
  {
    a: 'methotrexate',
    b: 'trimethoprim',
    severity: 'major',
    summary: 'Can severely suppress the bone marrow, lowering blood cell counts.',
    advice: 'Tell your doctor right away. Watch for fever, sore throat, or unusual bruising.',
  },
  {
    a: 'class:ssri',
    b: 'tramadol',
    severity: 'major',
    summary: 'Raises the risk of serotonin syndrome and seizures.',
    advice: 'Seek care for agitation, fever, sweating, shaking, or a racing heart.',
  },
  {
    a: 'class:ssri',
    b: 'linezolid',
    severity: 'major',
    summary: 'Raises the risk of serotonin syndrome.',
    advice: 'Seek care for agitation, fever, sweating, shaking, or a racing heart.',
  },
  {
    a: 'class:opioid',
    b: 'class:benzodiazepine',
    severity: 'major',
    summary: 'Together they can slow breathing dangerously and cause deep sedation or death.',
    advice: 'Only take both if your doctor prescribed them together. Never add alcohol.',
  },
  {
    a: 'digoxin',
    b: 'amiodarone',
    severity: 'major',
    summary: 'Amiodarone raises digoxin levels and the risk of digoxin toxicity.',
    advice: 'Your doctor will usually lower the digoxin dose and check levels.',
  },
  {
    a: 'lithium',
    b: 'class:nsaid',
    severity: 'major',
    summary: 'Can raise lithium to toxic levels.',
    advice: 'Avoid these painkillers unless your doctor approves. Watch for shaking, confusion, or vomiting.',
  },
  {
    a: 'lithium',
    b: 'class:ace_inhibitor',
    severity: 'major',
    summary: 'Can raise lithium to toxic levels.',
    advice: 'Your doctor should check your lithium levels more often.',
  },
  {
    a: 'allopurinol',
    b: 'azathioprine',
    severity: 'major',
    summary: 'Allopurinol raises azathioprine levels and can severely suppress the bone marrow.',
    advice: 'The azathioprine dose usually has to be cut sharply. Check with your doctor.',
  },
  {
    a: 'ciprofloxacin',
    b: 'tizanidine',
    severity: 'contraindicated',
    summary: 'Can cause a dangerous drop in blood pressure and extreme drowsiness.',
    advice: 'These should not be taken together.',
  },
  {
    a: 'colchicine',
    b: 'clarithromycin',
    severity: 'major',
    summary: 'Can cause colchicine poisoning, which can be fatal.',
    advice: 'Tell your doctor before taking both. Colchicine is often paused during clarithromycin.',
  },
];
