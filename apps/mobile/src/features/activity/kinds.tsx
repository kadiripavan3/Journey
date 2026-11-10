import type { ReactNode } from 'react';

import type { ActivityItemResponse, ActivityKind } from '@/api/generated/journey';
import { Emoji } from '@/ui/Emoji';
import { rich } from '@/ui/rich';
import { type Rich, words } from '@/words';

/** The tabs of Activity, and which kinds of line each one holds. Every kind is in exactly one. */
export const GROUPS = [
  { id: 'all', label: words.activity.tabs.all },
  { id: 'journeys', label: words.activity.tabs.journeys },
  { id: 'comments', label: words.activity.tabs.comments },
  { id: 'followers', label: words.activity.tabs.followers },
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

/** What a line says, names first, and the path it opens. */
export type Told = { says: ReactNode; path: string };

/**
 * The one table from a kind of notification to its words and its screen. Activity draws its lines from it;
 * the path is the same kind the API sends with a push, and `hrefFor` (features/notifications/target) turns
 * either into a screen, so both open the same place. The words themselves are in the catalog
 * (`words.activity.says`), one whole sentence for each kind.
 *
 * `bold` draws a name or a title. A kind this version doesn't know gives null: the line is left out rather than said wrongly.
 */
export function tell(item: ActivityItemResponse, bold: (text: string | null) => ReactNode): Told | null {
  const [first, second] = item.actors;
  const actor = first?.username ?? '';
  const who = words.activity.who(first?.displayName ?? '', second?.displayName ?? null, item.actorCount);
  const journey = item.journeyTitle ?? '';
  const draw = (line: Rich) => rich(line, { bold, emoji: (char) => <Emoji char={char} size={16} /> });
  const say = words.activity.says;
  const kind = item.kind;
  switch (kind) {
    case 'new_entries':
      return { says: draw(say.new_entries(who, item.count, journey)), path: `/journey/${item.journeyId}/timeline` };
    case 'journey_completed':
      return { says: draw(say.journey_completed(who, journey)), path: `/journey/${item.journeyId}` };
    case 'likes':
      return { says: draw(say.likes(who, item.entryTitle ?? '')), path: `/entry/${item.entryId}` };
    case 'comment':
      return { says: draw(say.comment(who, item.text ?? '')), path: `/entry/${item.entryId}?comments=1` };
    case 'reply':
      return { says: draw(say.reply(who, item.text ?? '')), path: `/entry/${item.entryId}?comments=1` };
    case 'invitation':
      return { says: draw(say.invitation(who, journey)), path: `/invitation/${item.journeyId}` };
    case 'friend_joined':
      return { says: draw(say.friend_joined(who, journey)), path: `/journey/${item.journeyId}` };
    case 'journey_follow':
      return { says: draw(say.journey_follow(who, journey)), path: `/profile/${actor}` };
    case 'profile_follow':
      return { says: draw(say.profile_follow(who)), path: `/profile/${actor}` };
    default: {
      // A new kind added to the API fails to compile here until it has its words.
      const unknown: never = kind;
      void unknown;
      return null;
    }
  }
}
