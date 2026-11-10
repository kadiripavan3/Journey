/** 3.1 Home. */
import { plural } from './plural';

export const home = {
  forYou: 'For you',
  search: {
    title: 'Find a journey',
    hint: 'Trips, challenges and more, live now',
  },

  // Your own journey in progress, first on the page
  current: {
    /** What a screen reader says for the whole card. */
    spoken: (title: string, progress: string, challenge: boolean) => `${title}. ${progress}. ${challenge ? "Post today's check-in." : 'Add an entry.'}`,
    start: (title: string) => `Start ${title}`,
    /** "Last entry 2h ago". `ago` is already written out. */
    last: (challenge: boolean, ago: string) => `Last ${challenge ? 'check-in' : 'entry'} ${ago}`,
    first: (challenge: boolean) => (challenge ? "Post today's check-in" : 'Add your first entry'),
  },

  newFromFollowed: 'New from journeys you follow',
  /** Following nothing yet. (What it says under the title, and its button, are `following.none`.) */
  quiet: { title: 'Your Home is quiet' },
  caughtUp: {
    inCategory: 'Nothing new here from the journeys you follow.',
    all: (following: number) => `That's every new entry from the ${plural(following, 'journey')} you follow.`,
    seeFollowed: 'See what you follow',
  },
  trending: 'Trending this week',
} as const;
