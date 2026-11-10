import { ApiError } from '@/api/fetcher';
import { addEntry, type EntryResponse } from '@/api/generated/journey';
import { uploadPhoto } from '@/api/upload';
import { sendClip } from '@/features/media/sendClip';
import { placeFields } from '@/features/places/place';
import { momentFor } from '@/lib/dates';

import type { Draft, Progress } from './types';

type Hooks = {
  onProgress: (progress: Progress) => void;
  /** A file has gone up. Remembered at once, so trying again after a failure doesn't send it twice. */
  onUploaded: (key: string, mediaId: string) => Promise<void> | void;
};

/** How much of the whole job a clip is, next to a photo: clips are far bigger. */
const WEIGHT = { photo: 1, video: 6 } as const;

/**
 * Posts a draft: sends the photos and clips that haven't gone up yet, one after the other, then the entry.
 * The entry carries the draft's own id, so the API makes one entry however often this runs.
 */
export async function sendDraft(draft: Draft, hooks: Hooks): Promise<EntryResponse> {
  const waiting = draft.media.filter((media) => !media.mediaId);
  const whole = waiting.reduce((sum, media) => sum + WEIGHT[media.kind], 0) + 1;
  let done = 0;
  const ids = new Map<string, string>();

  const count = (kind: 'photo' | 'video', from = 0) => waiting.slice(from).filter((media) => media.kind === kind).length;
  for (const [index, media] of waiting.entries()) {
    const at = count(media.kind) - count(media.kind, index) + 1;
    const then = count(media.kind === 'photo' ? 'video' : 'photo', index);
    const report = (part: number) => hooks.onProgress({ kind: media.kind, at, of: count(media.kind), then, fraction: (done + WEIGHT[media.kind] * part) / whole });
    report(0);
    const mediaId = media.kind === 'video' ? await sendClip(media, report) : await uploadPhoto(media);
    ids.set(media.key, mediaId);
    await hooks.onUploaded(media.key, mediaId);
    done += WEIGHT[media.kind];
  }

  hooks.onProgress({ kind: 'entry', at: 0, of: 0, then: 0, fraction: done / whole });
  return addEntry(draft.journeyId, {
    title: draft.title.trim(),
    body: draft.body.trim(),
    ...placeFields(draft.place),
    isMilestone: draft.milestone,
    happenedOn: draft.day,
    happenedAt: momentFor(draft.day),
    mediaIds: draft.media.map((media) => media.mediaId ?? ids.get(media.key)).filter((id): id is string => !!id),
    clientId: draft.clientId,
  });
}

/** True when nothing answered: no connection, or the API can't be reached. Worth trying again later, as it is. */
export function isUnreachable(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

/**
 * True when the API no longer knows a file this draft had uploaded (uploads that are never attached are
 * cleared out after a while). Sending the files again fixes it.
 */
export function uploadsForgotten(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'unknown_media';
}
