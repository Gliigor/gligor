/**
 * The person's Vee settings: who they are and how their Vee looks and talks.
 *
 * Stored in this browser only (localStorage) until real accounts arrive in
 * the onboarding phase. The server re-validates everything it receives.
 */

export type Personality = "cheerful" | "calm" | "straight";
export type Language = "auto" | "nl" | "en";

export interface VeeProfile {
  userName: string;
  veeName: string;
  color: string;
  personality: Personality;
  language: Language;
}

export const COLORS: { value: string; label: string }[] = [
  { value: "#F0997B", label: "Coral" },
  { value: "#5DCAA5", label: "Mint" },
  { value: "#9B8CE8", label: "Lilac" },
  { value: "#6AB4E8", label: "Sky" },
  { value: "#F2C14E", label: "Sunny" },
];

export const PERSONALITIES: { value: Personality; label: string; hint: string }[] = [
  { value: "cheerful", label: "Cheerful", hint: "Upbeat and playful" },
  { value: "calm", label: "Calm", hint: "Gentle and reassuring" },
  { value: "straight", label: "Straight to the point", hint: "Short and efficient" },
];

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: "auto", label: "Match my language" },
  { value: "nl", label: "Nederlands" },
  { value: "en", label: "English" },
];

export const DEFAULT_PROFILE: VeeProfile = {
  userName: "",
  veeName: "Vee",
  color: COLORS[0].value,
  personality: "cheerful",
  language: "auto",
};

const PROFILE_KEY = "vee.profile";
const SESSION_KEY = "vee.loggedIn";

export function loadProfile(): VeeProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VeeProfile>;
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch {
    return null;
  }
}

export function saveProfile(profile: VeeProfile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* private mode etc. */
  }
}

export function isLoggedIn(): boolean {
  try {
    return localStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function setLoggedIn(value: boolean) {
  try {
    if (value) localStorage.setItem(SESSION_KEY, "1");
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* private mode etc. */
  }
}
