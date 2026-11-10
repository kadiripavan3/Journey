import type { ReactNode } from 'react';

import type { ActivityItemResponse, ActivityKind } from '@/api/generated/journey';
import { Emoji } from '@/ui/Emoji';

/** The tabs of Activity, and which kinds of line each one holds. Every kind is in exactly one. */
export const GROUPS = [
  { id: 'all', label: 'All' },
  { id: 'journeys', label: 'Journeys' },
  { id: 'comments', label: 'Comments' },
  { id: 'followers', label: 'People' },
] as const;
export type ActivityGroup = (typeof GROUPS)[number]['id'];

const GROUP_OF: Record<ActivityKind, Exclude<ActivityGroup, 'all'>> = {
  new_entries: 'journeys',
  journey_completed: 'journeys',
  likes: 'comments',
  comment: 'comments',
  reply: 'comments',
  journey_follow: 'followers',
  profile_follow: 'followers',
  invitation: 'followers',
  friend_joined: 'followers',
};

/** Whether a line belongs under a tab. A kind this version doesn't know belongs nowhere. */
export function inGroup(item: ActivityItemResponse, group: ActivityGroup): boolean {
  return item.kind in GROUP_OF && (group === 'all' || GROUP_OF[item.kind] === group);
}

/** What a line says after the names, and the path it opens. */
export type Told = { what: ReactNode; path: string };

/**
 * The one table from a kind of notification to its words and its screen. Activity draws its lines from it;
 * the path is the same kind the API sends with a push, and `hrefFor` (features/notifications/target) turns
 * either into a screen, so both open the same place.
 *
 * `bold` marks a title. A kind this version doesn't know gives null: the line is left out rather than said wrongly.
 */
export function tell(item: ActivityItemResponse, bold: (text: string | null) => ReactNode): Told | null {
  const actor = item.actors[0]?.username ?? '';
  const kind = item.kind;
  switch (kind) {
    case 'new_entries':
      return {
        what: (
          <>
            {' '}
            added {item.count === 1 ? 'an entry' : `${item.count} entries`} to {bold(item.journeyTitle)}
          </>
        ),
        path: `/journey/${item.journeyId}/timeline`,
      };
    case 'journey_completed':
      return {
        what: (
          <>
            {' '}
            completed {bold(item.journeyTitle)} <Emoji char="🎉" size={16} />
          </>
        ),
        path: `/journey/${item.journeyId}`,
      };
    case 'likes':
      return { what: <> liked {bold(item.entryTitle)}</>, path: `/entry/${item.entryId}` };
    case 'comment':
      return { what: <> commented: “{item.text}”</>, path: `/entry/${item.entryId}?comments=1` };
    case 'reply':
      return { what: <> replied to your comment: “{item.text}”</>, path: `/entry/${item.entryId}?comments=1` };
    case 'invitation':
      return { what: <> invited you to add to {bold(item.journeyTitle)}</>, path: `/invitation/${item.journeyId}` };
    case 'friend_joined':
      return { what: <> joined {bold(item.journeyTitle)}</>, path: `/journey/${item.journeyId}` };
    case 'journey_follow':
      return { what: <> started following {bold(item.journeyTitle)}</>, path: `/profile/${actor}` };
    case 'profile_follow':
      return { what: <> started following you</>, path: `/profile/${actor}` };
    default: {
      // A new kind added to the API fails to compile here until it has its words.
      const unknown: never = kind;
      void unknown;
      return null;
    }
  }
}
