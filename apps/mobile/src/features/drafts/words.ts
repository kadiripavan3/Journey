import { timeAgo } from '@/lib/dates';
import { words } from '@/words';

import type { Draft, Progress } from './types';

/** What to call a draft in a list: its title, or how its text starts, or what it holds. */
export function draftTitle(draft: Pick<Draft, 'title' | 'body' | 'media'>): string {
  const title = draft.title.trim();
  if (title) return title;
  const body = draft.body.trim().replace(/\s+/g, ' ');
  if (body) return body.length > 60 ? `${body.slice(0, 57).trimEnd()}…` : body;
  return draft.media.length > 0 ? draftContents(draft) : words.drafts.untitled;
}

/** "2 photos · 1 clip", or "Text only". */
export function draftContents(draft: Pick<Draft, 'media'>): string {
  const photos = draft.media.filter((media) => media.kind === 'photo').length;
  return words.drafts.contents(photos, draft.media.length - photos);
}

/** "Iceland ring road · Day 7": which journey a draft is for, and its day. */
export function draftWhere(draft: Pick<Draft, 'journey' | 'dayLabel'>): string {
  return words.common.join([draft.journey.title, draft.dayLabel]);
}

/** "Text only · saved 2h ago". */
export function draftSaved(draft: Pick<Draft, 'media' | 'savedAt'>, now: Date = new Date()): string {
  return words.drafts.saved(draftContents(draft), timeAgo(draft.savedAt, now));
}

/** "4 of 6 photos · then 1 clip": what is going up right now. Without progress yet, what it is waiting for. */
export function progressLine(progress: Progress | undefined, online: boolean): string {
  const say = words.drafts.progress;
  if (!progress) return online ? say.waitingTurn : say.waitingConnection;
  if (progress.kind === 'entry') return say.posting;
  // A clip is made smaller on the phone before it goes up; on a long one that takes a moment worth naming.
  if (progress.preparing) return say.preparing(progress.at, progress.of);
  const photo = progress.kind === 'photo';
  const now = say.uploading(photo, progress.at, progress.of);
  return progress.then > 0 ? say.then(now, progress.then, photo) : now;
}
