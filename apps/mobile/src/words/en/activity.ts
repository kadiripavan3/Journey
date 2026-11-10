/** 8.1 Activity: the tabs, and what each kind of line says. */
import { mark, type Rich } from '../rich';
import { plural } from './plural';

export const activity = {
  title: 'Activity',
  tabs: { all: 'All', journeys: 'Journeys', comments: 'Comments', followers: 'People' },

  // The weekly digest's card at the top
  week: {
    title: 'This week in the journeys you follow',
    count: (entries: number, journeys: number) => `${plural(entries, 'new entry', 'new entries')} in ${plural(journeys, 'journey')}`,
    spoken: (entries: number, journeys: number) => `This week: ${plural(entries, 'new entry', 'new entries')} in ${plural(journeys, 'journey')}. Open the weekly digest.`,
  },

  none: {
    all: 'Nothing new yet',
    underTab: 'Nothing here yet',
    body: 'New entries from journeys you follow, and likes, comments and followers on yours, arrive here.',
  },
  groups: { fresh: 'New', earlier: 'Earlier', thisMonth: 'This month' },

  /**
   * Who a line is about: "Alex", "Alex and Nora", "Alex, Nora and 3 others". `count` is how many people did it.
   * Names are marked "bold".
   */
  who: (first: string, second: string | null, count: number): Rich =>
    count <= 1 || !second
      ? [mark('bold', first)]
      : count === 2
        ? [mark('bold', first), ' and ', mark('bold', second)]
        : [mark('bold', `${first}, ${second}`), ` and ${count - 2} ${count === 3 ? 'other' : 'others'}`],

  /**
   * One whole line for each kind of notification, by the API's name for the kind. `who` comes from `who` above;
   * titles are marked "bold", and "emoji" marks a picture drawn in the line.
   */
  says: {
    new_entries: (who: Rich, count: number, journey: string): Rich => [...who, ` added ${count === 1 ? 'an entry' : `${count} entries`} to `, mark('bold', journey)],
    journey_completed: (who: Rich, journey: string): Rich => [...who, ' completed ', mark('bold', journey), ' ', mark('emoji', '🎉')],
    likes: (who: Rich, entry: string): Rich => [...who, ' liked ', mark('bold', entry)],
    comment: (who: Rich, text: string): Rich => [...who, ` commented: “${text}”`],
    reply: (who: Rich, text: string): Rich => [...who, ` replied to your comment: “${text}”`],
    invitation: (who: Rich, journey: string): Rich => [...who, ' invited you to add to ', mark('bold', journey)],
    friend_joined: (who: Rich, journey: string): Rich => [...who, ' joined ', mark('bold', journey)],
    journey_follow: (who: Rich, journey: string): Rich => [...who, ' started following ', mark('bold', journey)],
    profile_follow: (who: Rich): Rich => [...who, ' started following you'],
  },
} as const;
