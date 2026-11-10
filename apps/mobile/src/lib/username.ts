/** The same rules as the API (app.journey.api.profile.Usernames). The API has the final say; this gives instant feedback. */
export function normalizeUsername(raw: string): string {
  const value = raw.trim().toLowerCase();
  return value.startsWith('@') ? value.slice(1) : value;
}

/** Null when the name is allowed; otherwise a plain sentence saying why not. */
export function usernameProblem(username: string): string | null {
  if (username.length < 3) return 'Use at least 3 characters.';
  if (username.length > 20) return 'Use 20 characters or fewer.';
  if (!/^[a-z0-9._]+$/.test(username)) return 'Use only letters, numbers, dots and underscores.';
  if (username.startsWith('.') || username.endsWith('.') || username.includes('..')) return "Dots can't be first, last or doubled.";
  return null;
}

/** Up to two initials for the picture placeholder: "Nora Lind" gives "NL". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
}
