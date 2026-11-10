/** 3.2 The Following feed and 8.3 the weekly digest: what is new in the journeys a person follows. */
import { plural } from './plural';

export const following = {
  // 3.2 Following
  title: 'Following',
  none: {
    title: "You don't follow any journeys yet",
    body: 'Follow a journey and its new entries land here, newest first.',
    explore: 'Explore journeys',
  },
  all: 'All',
  caughtUp: (following: number) => `That's every new entry from the ${plural(following, 'journey')} you follow.`,
  findMore: 'Find more in Discover',
  nothingNewIn: 'Nothing new in',
  /** What a screen reader says for a journey's group of new entries. */
  groupSpoken: (title: string, owner: string, newCount: number) => `${title}, by ${owner}. ${newCount} new.`,
  moreEntries: (count: number) => plural(count, 'more entry', 'more entries'),
  moreEntriesSpoken: (count: number) => `${plural(count, 'more entry', 'more entries')}. Open the story.`,

  // 8.3 Weekly digest
  digest: {
    title: 'This week',
    quiet: {
      title: 'A quiet week',
      body: 'Nothing new in the journeys you follow. When there is, it shows up here.',
    },
    moment: 'Moment of the week',
    movedOn: (journeys: number) => plural(journeys, 'journey moved on', 'journeys moved on'),
    finished: 'Finished this week',
    seeRecap: 'see the recap',
    end: "That's your week",
    catchUp: (entries: number) => `Catch up on ${plural(entries, 'entry', 'entries')}`,
  },
} as const;
