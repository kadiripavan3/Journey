/** What is said about a journey wherever one appears: on a card, in a row, in a menu, in the form that describes it. */
import { compact, plural } from './plural';

export const journeys = {
  /** What each state of a journey is called. */
  status: { active: 'Active', paused: 'Paused', completed: 'Completed' },

  /**
   * The three ways a journey can be seen. `note` says who sees it in a few words, `longNote` adds one more
   * thought (shown where a new journey's visibility is chosen), `badge` stands on a card in place of a follower count.
   */
  visibility: {
    public: { label: 'Public', note: 'Anyone. It can appear in Discover.', longNote: 'Anyone. It can appear in Discover.', badge: 'Public' },
    unlisted: { label: 'Unlisted', note: 'Only people with the link.', longNote: 'Only people with the link. Good for family.', badge: 'Unlisted' },
    private: { label: 'Private', note: 'Only you and friends you invite.', longNote: 'Only you and friends you invite. A journal you can publish later.', badge: 'Private' },
  },

  /** "1.2k following": how many people follow a journey. */
  following: (count: number) => `${compact(count)} following`,
  /** In place of a count when nobody follows yet. */
  beFirstToFollow: 'Be the first to follow',
  /** The same for a challenge: "46 cheering". */
  cheering: (count: number) => `${compact(count)} cheering`,
  /** What a challenge's own author reads: "46 people cheering you on". */
  cheeringYouOn: (count: number) => `${plural(count, 'person', 'people')} cheering you on`,
  /** "3 new": entries since the last visit. */
  newCount: (count: number) => `${count} new`,
  /** "Day 12 of 30": how far along a challenge is. `progress` is the journey's own label. */
  progressOf: (progress: string, target: number) => `${progress} of ${target}`,
  /** Where a feed ends. */
  caughtUp: "You're all caught up",

  // A journey as a card or a row: what a screen reader says
  card: {
    shared: 'Shared',
    /** `line` is what stands under the title; `label` is the pill on the photo, if there is one. */
    spoken: (title: string, line: string, label: string | null, shared: boolean) => `${title}. ${line}.${label ? ` ${label}.` : ''}${shared ? ' Shared.' : ''}`,
  },
  rowSpoken: (title: string, badge: string | null | undefined, detail: string) => `${title}. ${badge ? `${badge}. ` : ''}${detail}`,

  // The bar at the bottom of a journey's page, with its one next step
  bar: {
    yours: 'Your journey',
    youWrite: 'You write in this journey',
    youFollow: (firstName: string) => `You follow ${firstName}'s journey`,
    follow: (firstName: string) => `Follow ${firstName}'s journey`,
    completed: 'Completed',
    paused: 'Paused. A new entry starts it again.',
    addFirst: 'Add the first entry',
    soFar: (entries: number) => `${plural(entries, 'entry', 'entries')} so far`,
    readerCompleted: 'This journey is completed',
    readerActive: 'New entries land on your Home',
    entry: 'Entry',
  },

  // A paused journey says so on its page
  paused: {
    title: 'This journey is paused',
    titleAutomatic: 'Paused after 30 quiet days',
    writer: "Followers can still read it. Add an entry whenever you're ready and it picks up again.",
    reader: (owner: string) => `You can still read it. You'll hear when ${owner} picks it up again.`,
    addEntry: 'Add an entry',
    complete: 'Complete it',
  },

  // A challenge's days on its page
  challenge: {
    daysDone: (done: number, target: number) => `${done} of ${target} days`,
    /** "40% there · 18 days to go". `left` is null once the journey is completed. */
    progress: (percent: number, left: number | null) => `${percent}% there${left === null ? '' : left > 0 ? ` · ${left} ${left === 1 ? 'day' : 'days'} to go` : ' · last day'}`,
    checkedInSpoken: (done: number, target: number) => `Checked in on ${done} of ${target} days`,
    noStreaks: 'Missed a day? No streaks to lose.',
  },

  // 7.1 The + button
  add: {
    spoken: 'Add an entry or start a journey',
    title: 'Add to a journey',
    titleFirst: 'Start your first journey',
    lead: 'Every entry belongs to a journey: a trip, a challenge, anything with a story.',
    /** After a journey's progress on the same line. `ago` is already written out. */
    paused: 'paused',
    lastEntry: (ago: string) => `last entry ${ago}`,
    entry: 'Entry',
    startNew: 'Start a new journey',
    startNewNote: 'A trip, a challenge, anything with a story',
    drafts: 'Drafts and uploads',
    waitingToUpload: (entries: number) => `${plural(entries, 'entry', 'entries')} waiting to upload`,
    draftCount: (drafts: number) => plural(drafts, 'draft'),
  },

  // The form that describes a journey, when starting and when changing it
  details: {
    cover: "The journey's cover",
    changeCover: 'Change cover',
    addCover: 'Add a cover',
    coverNote: 'Optional. Your first photo is the cover until you choose one.',
    title: 'Title',
    starts: 'Starts',
    category: 'Category',
    chooseCategory: 'Choose',
    about: "What's it about? · optional",
    tags: 'Tags · up to 5',
    tagsHint: 'iceland roadtrip vanlife',
    tagsNote: 'Separate tags with spaces.',
  },

  // Journey options
  menu: {
    edit: 'Edit details',
    editNote: 'Title, cover, start date, who can see it',
    people: 'People on this journey',
    peopleNote: 'Invite friends to add their own entries',
    peopleNoteMember: 'See who writes here, or leave',
    complete: 'Complete journey',
    completeNote: 'Add a closing note and get the recap',
    pause: 'Pause journey',
    pauseNote: "Followers see it's on hold. A new entry starts it again.",
    resume: 'Resume journey',
    delete: 'Delete journey',
    report: 'Report this journey',
    confirmDelete: {
      title: 'Delete this journey?',
      body: (title: string, entries: number) => `"${title}" and its ${plural(entries, 'entry', 'entries')} will be gone for good, for you and everyone following.`,
    },
  },
} as const;
