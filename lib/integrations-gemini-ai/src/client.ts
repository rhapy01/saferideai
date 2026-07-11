import { GoogleGenAI } from "@google/genai";

/** Hackathon: Gemma 4 via Google AI Studio (not Gemini). */
export const GEMMA_MODEL =
  process.env.GEMMA_MODEL || "gemma-4-26b-a4b-it";

function resolveApiKey(): string {
  const key =
    process.env.GOOGLE_API_KEY ||
    process.env.AI_INTEGRATIONS_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GOOGLE_API_KEY must be set (Google AI Studio key for Gemma 4).",
    );
  }
  return key;
}

let _ai: GoogleGenAI | null = null;

export function getAi(): GoogleGenAI {
  if (!_ai) {
    _ai = new GoogleGenAI({ apiKey: resolveApiKey() });
  }
  return _ai;
}

/** Lazy proxy so importing the module does not crash before env is loaded. */
export const ai = new Proxy({} as GoogleGenAI, {
  get(_target, prop, receiver) {
    return Reflect.get(getAi(), prop, receiver);
  },
});
