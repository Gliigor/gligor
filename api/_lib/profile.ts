/**
 * The choices a person makes on the "Customize Vee" screen, as the server
 * sees them. Everything is validated against fixed lists so a visitor can't
 * smuggle their own instructions into the system prompt.
 */

export const PERSONALITIES = ["cheerful", "calm", "straight"] as const;
export const LANGUAGES = ["auto", "nl", "en"] as const;

export type Personality = (typeof PERSONALITIES)[number];
export type Language = (typeof LANGUAGES)[number];

export interface VeeProfile {
  userName: string;
  veeName: string;
  personality: Personality;
  language: Language;
}

const MAX_NAME = 30;

/** Keep letters, digits, spaces and a little punctuation; nothing else. */
function cleanName(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value
    .replace(/[^\p{L}\p{N} .'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME);
  return cleaned || fallback;
}

/** Returns a safe profile, or null when the request carried none. */
export function parseProfile(raw: unknown): VeeProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  return {
    userName: cleanName(p.userName, ""),
    veeName: cleanName(p.veeName, "Vee"),
    personality: PERSONALITIES.includes(p.personality as Personality) ? (p.personality as Personality) : "cheerful",
    language: LANGUAGES.includes(p.language as Language) ? (p.language as Language) : "auto",
  };
}

const PERSONALITY_TEXT: Record<Personality, string> = {
  cheerful: "Be upbeat and warm, with a little playful energy. An occasional emoji is fine.",
  calm: "Be calm, gentle and reassuring. Unhurried sentences, no exclamation marks, no emoji.",
  straight: "Be direct and efficient. Get to the point quickly, skip small talk and emoji, stay kind.",
};

const LANGUAGE_TEXT: Record<Language, string> = {
  auto: "Reply in the language the person writes in.",
  nl: "Always reply in Dutch (Nederlands), even if the person writes in another language.",
  en: "Always reply in English, even if the person writes in another language.",
};

/**
 * Per-person instructions. Sent as a separate block AFTER the stable system
 * prompt, so the shared prefix stays cacheable.
 */
export function profilePrompt(profile: VeeProfile): string {
  const lines = [
    `Your name for this person is "${profile.veeName}". Introduce yourself by that name.`,
    profile.userName ? `The person's name is "${profile.userName}". Use it now and then, not in every message.` : "",
    PERSONALITY_TEXT[profile.personality],
    LANGUAGE_TEXT[profile.language],
  ];
  return lines.filter(Boolean).join("\n");
}
