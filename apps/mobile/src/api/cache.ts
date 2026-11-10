import { type QueryClient, useQueryClient } from '@tanstack/react-query';

import {
  type EntryResponse,
  getGetEntryQueryOptions,
  getGetJourneyQueryOptions,
  getGetMeQueryKey,
  getGetProfileQueryKey,
  getGetSettingsQueryKey,
  type JourneyResponse,
  type MeResponse,
  type PublicProfileResponse,
  type SettingsResponse,
} from '@/api/generated/journey';

/**
 * What the app does to what it has already loaded when something changes.
 *
 * Two tools, used by name so a screen never has to know which lists exist:
 *  - `put`: the API just sent back the new journey or entry, so it is written into every list and screen
 *    that holds the old one. Nothing is fetched again.
 *  - `stale`: lists whose membership or order changed are fetched again, and only those.
 *
 * Each function below is one thing that can happen. A screen calls the one that happened.
 */
export function useCache() {
  return cacheFor(useQueryClient());
}

type Bag = Record<string, unknown>;

const isJourney = (value: Bag) => 'progressLabel' in value && 'viewer' in value;
const isEntry = (value: Bag) => 'journeyId' in value && 'happenedAt' in value;

/** Replaces, anywhere inside loaded data, the object with the same id and kind. Returns the same data when nothing matched. */
function swap(value: unknown, is: (value: Bag) => boolean, next: { id: string }, depth = 0): unknown {
  if (value === null || typeof value !== 'object' || depth > 8) return value;
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((item) => {
      const swapped = swap(item, is, next, depth + 1);
      if (swapped !== item) changed = true;
      return swapped;
    });
    return changed ? out : value;
  }
  const bag = value as Bag;
  if (bag.id === next.id && is(bag)) return next;
  let changed = false;
  const out: Bag = {};
  for (const key of Object.keys(bag)) {
    out[key] = swap(bag[key], is, next, depth + 1);
    if (out[key] !== bag[key]) changed = true;
  }
  return changed ? out : value;
}

export function cacheFor(client: QueryClient) {
  /** Fetches again every loaded list whose address starts with one of these. */
  const stale = (...addresses: string[]) =>
    client.invalidateQueries({
      predicate: (query) => query.queryKey.some((part) => typeof part === 'string' && addresses.some((address) => part.startsWith(address))),
    });
  /**
   * Writes the object into every loaded answer that holds the old one. An answer that doesn't hold it is not
   * touched at all, and a list that does is no fresher for it: whether it still has to be fetched again
   * stays as it was. Only the object's own page ("this journey", "this entry") counts as just read.
   */
  const put = (is: (value: Bag) => boolean, next: { id: string }) => {
    for (const query of client.getQueryCache().getAll()) {
      const data: unknown = query.state.data;
      const swapped = swap(data, is, next);
      if (swapped === data) continue;
      if (swapped === next) client.setQueryData(query.queryKey, swapped);
      else query.setState({ data: swapped });
    }
  };
  const putJourney = (journey: JourneyResponse) => put(isJourney, journey);
  const putEntry = (entry: EntryResponse) => put(isEntry, entry);
  /** Asks for a journey again and shows the answer everywhere: its counts, cover and progress changed. */
  const refreshJourney = async (id: string) => putJourney(await client.fetchQuery({ ...getGetJourneyQueryOptions(id), staleTime: 0 }));
  const refreshEntry = async (id: string) => putEntry(await client.fetchQuery({ ...getGetEntryQueryOptions(id), staleTime: 0 }));
  const inJourney = (id: string) => `/v1/journeys/${id}/`;

  return {
    /** A like or its removal: the API sent the entry back. */
    entryReacted: (entry: EntryResponse) => putEntry(entry),

    /**
     * A journey was followed or unfollowed: the API sent it back. Home and the list of followed journeys
     * change, and so does what counts as new in the journey itself.
     */
    journeyFollowed: (journey: JourneyResponse) => {
      putJourney(journey);
      return stale(inJourney(journey.id), '/v1/feed', '/v1/me/following', '/v1/journeys/suggested');
    },

    /** An entry was added, changed or removed. The journey's own numbers changed with it. */
    entrySaved: (journeyId: string, entryId?: string) =>
      Promise.all([
        refreshJourney(journeyId),
        stale(inJourney(journeyId), ...(entryId ? [`/v1/entries/${entryId}`] : []), '/v1/feed', '/v1/profiles/'),
      ]),

    /** A comment was added or removed: the thread, and the entry's count wherever the entry is shown. */
    commented: (entryId: string) => Promise.all([refreshEntry(entryId).catch(() => undefined), stale(`/v1/entries/${entryId}/`)]),

    /** A journey was started. */
    journeyStarted: () => stale('/v1/me/journeys', '/v1/profiles/'),

    /** A journey's details, visibility or status changed, or it was completed: the API sent it back. */
    journeyChanged: (journey: JourneyResponse) => {
      putJourney(journey);
      return stale(inJourney(journey.id), '/v1/me/journeys', '/v1/discover', '/v1/profiles/');
    },

    /** A journey is gone: every list that could hold it. */
    journeyDeleted: (id: string) => {
      client.removeQueries({ predicate: (query) => query.queryKey.some((part) => typeof part === 'string' && part.startsWith(`/v1/journeys/${id}`)) });
      return stale('/v1/me/', '/v1/feed', '/v1/discover', '/v1/profiles/', '/v1/search', '/v1/activity', '/v1/digest');
    },

    /** Who writes in a journey changed: an invitation sent, taken back, accepted or declined, or someone left. */
    membersChanged: (journeyId: string) =>
      Promise.all([
        refreshJourney(journeyId).catch(() => undefined),
        stale(inJourney(journeyId), '/v1/me/invitations', '/v1/me/journeys', '/v1/feed', '/v1/activity', '/v1/profiles/'),
      ]),

    /** The reader caught up with a journey: nothing in it is new any more. */
    journeyRead: (journeyId: string) => Promise.all([refreshJourney(journeyId), stale('/v1/feed', `/v1/journeys/${journeyId}/summary`)]),

    /** A person was followed or unfollowed: the API sent their profile back. */
    personFollowed: (profile: PublicProfileResponse) => {
      client.setQueryData(getGetProfileQueryKey(profile.username), profile);
      return stale('/v1/profiles/', '/v1/activity', '/v1/search', '/v1/journeys/');
    },

    /** The person's own profile was saved. */
    profileSaved: (profile: NonNullable<MeResponse['profile']>) => {
      client.setQueryData<MeResponse>(getGetMeQueryKey(), (me) => (me ? { ...me, profile } : me));
      return stale('/v1/me', '/v1/profiles/', '/v1/journeys/suggested');
    },

    /** Settings were saved. A notification switched off also leaves Activity. */
    settingsSaved: (settings: SettingsResponse) => {
      client.setQueryData(getGetSettingsQueryKey(), settings);
      return stale('/v1/activity');
    },

    /** Activity was opened: nothing in it is new any more. */
    activitySeen: () => stale('/v1/activity'),

    /** Someone was blocked or unblocked. That changes what can be seen everywhere, so everything is fetched again. */
    blockChanged: () => client.invalidateQueries(),

    /** The first thing after signing up: load everything fresh. */
    everything: () => client.invalidateQueries(),
  };
}
