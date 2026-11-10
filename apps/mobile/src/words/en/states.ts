/** Loading, offline, and what the app itself says when something didn't work. (The API's own sentences are shown as they are.) */

export const states = {
  loading: 'Loading',
  loadingMore: 'Loading more',

  offline: {
    title: "You're offline",
    body: "This hasn't been loaded on this phone yet. It shows up by itself when you're back online.",
  },

  // A part of a page, or a whole page, that couldn't be fetched
  problem: {
    title: "That didn't load",
    pageTitle: 'We lost the trail',
  },

  // A screen that broke
  broken: {
    title: 'Something went wrong',
    body: "That's on us, not you. Try again. If it keeps happening, close Journey and open it again.",
  },

  // Requests the API never answered, or answered without a sentence
  unreachable: "Can't reach Journey right now. Check your connection and try again.",
  tooSlow: 'Journey is taking too long to answer. Check your connection and try again.',
  onOurSide: 'Something went wrong on our side. Try again.',
  unknown: 'Something went wrong. Try again.',
} as const;
