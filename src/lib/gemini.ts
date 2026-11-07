import { GoogleGenAI } from '@google/genai';
import { File } from 'expo-file-system';

// Google-maintained aliases that always point at the current Flash models, so no version number is
// hard-coded. If the primary is overloaded (503/504 under high demand) or rate-limited, fall back to
// the Flash-Lite alias, which runs on separate capacity.
const MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
const TIMEOUT_MS = 30_000;

const SYSTEM_INSTRUCTION = `You are a medical assistant that reads photos of medical prescriptions.
Extract every medication prescribed in the image, in the order they appear. For each one, give the
medication name and its dosage exactly as written, including strength and frequency when present
(e.g. "500 mg twice daily").
Respond with strictly a JSON array of objects, each with exactly two string keys: "medication" and "dosage".
Example: [{"medication": "Amoxicillin", "dosage": "500 mg three times daily"}]
If a dosage is not readable, use an empty string for it. Return an empty array if no medication is
readable. Do not guess or invent values, and do not include anything that is not a prescribed medication.`;

const RESPONSE_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      medication: { type: 'string', description: 'Name of the medication.' },
      dosage: { type: 'string', description: 'Dosage as written, including strength and frequency.' },
    },
    required: ['medication', 'dosage'],
  },
};

export type ExtractedMedication = { medication: string; dosage: string };

let client: GoogleGenAI | null = null;

function getClient() {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing EXPO_PUBLIC_GEMINI_API_KEY. Set it in .env and restart the dev server.');
  }
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

function isOverloaded(error: unknown) {
  return /\b(429|500|503|504)\b|UNAVAILABLE|DEADLINE_EXCEEDED|RESOURCE_EXHAUSTED|high demand|timed? ?out|abort/i.test(
    String((error as Error)?.message ?? error),
  );
}

/** Reads a local image (file:// or content:// URI) as a base64 string. */
export async function imageUriToBase64(uri: string): Promise<string> {
  return new File(uri).base64();
}

/** Sends a prescription photo to Gemini and returns every medication it can read, in order. */
export async function extractMedications(
  uri: string,
  mimeType = 'image/jpeg',
): Promise<ExtractedMedication[]> {
  const data = await imageUriToBase64(uri);
  const ai = getClient();

  let text: string | undefined;
  for (let i = 0; i < MODELS.length; i++) {
    try {
      const response = await ai.models.generateContent({
        model: MODELS[i],
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType, data } },
              { text: 'Extract all medications and their dosages from this prescription.' },
            ],
          },
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseJsonSchema: RESPONSE_SCHEMA,
          httpOptions: { timeout: TIMEOUT_MS },
        },
      });
      text = response.text;
      break;
    } catch (error) {
      const last = i === MODELS.length - 1;
      if (last || !isOverloaded(error)) {
        throw new Error(
          isOverloaded(error)
            ? 'The AI service is busy right now. Try again in a moment.'
            : `Could not read the prescription: ${(error as Error)?.message ?? 'unknown error'}`,
        );
      }
    }
  }

  if (!text) throw new Error('The AI returned no result. Try a clearer photo.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('The AI returned an unexpected response. Try again.');
  }
  // Expect an array; tolerate a single object or a { medications: [...] } wrapper.
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { medications?: unknown })?.medications)
      ? (parsed as { medications: unknown[] }).medications
      : parsed && typeof parsed === 'object'
        ? [parsed]
        : [];

  return list
    .map((item) => {
      const { medication, dosage } = (item ?? {}) as Record<string, unknown>;
      return {
        medication: typeof medication === 'string' ? medication.trim() : '',
        dosage: typeof dosage === 'string' ? dosage.trim() : '',
      };
    })
    .filter((m) => m.medication);
}
