import type { EntryResponse, SaveEntryRequest } from '@/api/generated/journey';
import { placeFields, placeOf } from '@/features/places/place';

/**
 * An entry the way the API takes it when it is saved again: everything it has now, with what should change
 * laid over it. Saving an entry replaces all of it, so a change that names only some fields would wipe the
 * rest (the place's spot on the map, most of all). Every "change one thing" starts from here.
 */
export function saveRequest(entry: EntryResponse, changes: Partial<SaveEntryRequest> = {}): SaveEntryRequest {
  return {
    title: entry.title,
    body: entry.body,
    ...placeFields(placeOf(entry)),
    isMilestone: entry.isMilestone,
    happenedOn: entry.happenedOn,
    happenedAt: entry.happenedAt,
    mediaIds: entry.media.map((m) => m.id),
    ...changes,
  };
}
