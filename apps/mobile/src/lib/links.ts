import type { Href } from 'expo-router';

/**
 * Shared links are web addresses (journey.app/e/…) that also work for people without the app. When one opens
 * the app instead, this says which screen it is about.
 */
const SCREENS = { j: 'journey', e: 'entry', u: 'profile', i: 'invite' } as const;

/**
 * The screen for a link that opened the app: "https://journey.app/e/123" becomes "/entry/123".
 * Anything that isn't one of the shared pages is handed back as it came.
 */
export function screenFor(link: string): string {
  const path = link.replace(/^https?:\/\/[^/]+/i, '');
  const match = /^\/([jeui])\/([^/?#]+)/.exec(path);
  if (!match) return link;
  return `/${SCREENS[match[1] as keyof typeof SCREENS]}/${match[2]}`;
}

/** True for a link to something inside the app that needs a signed-in person. */
function isAppScreen(path: string): boolean {
  return /^\/(journey|entry|profile|invite)\/[^/?#]+/.test(path);
}

const KEEP_FOR = 30 * 60 * 1000;
let waiting: { path: string; at: number } | null = null;

/**
 * Remembers the screen a link asked for. Someone who opens an invitation before they have signed up would
 * otherwise lose it on the way through sign-up; it is opened once they are in.
 */
export function rememberLink(path: string, now = Date.now()): void {
  if (isAppScreen(path)) waiting = { path: path.replace(/[?#].*$/, ''), at: now };
}

/** The remembered screen, handed over once. Null when there is none or it has been waiting too long to still be meant. */
export function takeLink(now = Date.now()): Href | null {
  const link = waiting;
  waiting = null;
  return link && now - link.at < KEEP_FOR ? (link.path as Href) : null;
}
