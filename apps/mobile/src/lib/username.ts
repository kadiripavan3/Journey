import { words } from '@/words';

/** The same rules as the API (app.journey.api.profile.Usernames). The API has the final say; this gives instant feedback. */
export function normalizeUsername(raw: string): string {
  const value = raw.trim().toLowerCase();
  return value.startsWith('@') ? value.slice(1) : value;
}

/** Null when the name is allowed; otherwise a plain sentence saying why not. */
export function usernameProblem(username: string): string | null {
  if (username.length < 3) return words.profile.username.tooShort;
  if (username.length > 20) return words.profile.username.tooLong;
  if (!/^[a-z0-9._]+$/.test(username)) return words.profile.username.badCharacters;
  if (username.startsWith('.') || username.endsWith('.') || username.includes('..')) return words.profile.username.badDots;
  return null;
}

/** Up to two initials for the picture placeholder: "Nora Lind" gives "NL". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
}
