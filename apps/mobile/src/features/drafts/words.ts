import { timeAgo } from '@/lib/dates';
import { plural } from '@/lib/plural';

import type { Draft, Progress } from './types';

/** What to call a draft in a list: its title, or how its text starts, or what it holds. */
export function draftTitle(draft: Pick<Draft, 'title' | 'body' | 'media'>): string {
  const title = draft.title.trim();
  if (title) return title;
  const body = draft.body.trim().replace(/\s+/g, ' ');
  if (body) return body.length > 60 ? `${body.slice(0, 57).trimEnd()}…` : body;
  return draft.media.length > 0 ? draftContents(draft) : 'Untitled entry';
}

/** "2 photos · 1 clip", or "Text only". */
export function draftContents(draft: Pick<Draft, 'media'>): string {
  const photos = draft.media.filter((media) => media.kind === 'photo').length;
  const clips = draft.media.length - photos;
  const parts = [photos > 0 ? plural(photos, 'photo') : null, clips > 0 ? plural(clips, 'clip') : null].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Text only';
}

/** "Iceland ring road · Day 7": which journey a draft is for, and its day. */
export function draftWhere(draft: Pick<Draft, 'journey' | 'dayLabel'>): string {
  return `${draft.journey.title} · ${draft.dayLabel}`;
}

/** "Text only · saved 2h ago". */
export function draftSaved(draft: Pick<Draft, 'media' | 'savedAt'>, now: Date = new Date()): string {
  return `${draftContents(draft)} · saved ${timeAgo(draft.savedAt, now)}`;
}

/** "4 of 6 photos · then 1 clip": what is going up right now. Without progress yet, what it is waiting for. */
export function progressLine(progress: Progress | undefined, online: boolean): string {
  if (!progress) return online ? 'Waiting for its turn' : 'Waiting for a connection';
  if (progress.kind === 'entry') return 'Posting';
  // A clip is made smaller on the phone before it goes up; on a long one that takes a moment worth naming.
  if (progress.preparing) return progress.of > 1 ? `Getting clip ${progress.at} of ${progress.of} ready` : 'Getting the clip ready';
  const photo = progress.kind === 'photo';
  const now = progress.of > 1 ? (photo ? `${progress.at} of ${progress.of} photos` : `Clip ${progress.at} of ${progress.of}`) : photo ? 'Uploading the photo' : 'Uploading the clip';
  return progress.then > 0 ? `${now} · then ${plural(progress.then, photo ? 'clip' : 'photo')}` : now;
}
