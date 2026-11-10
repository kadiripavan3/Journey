/** 10 Settings: the list, and each page behind it. */
import { compact, plural } from './plural';

export const settings = {
  // 10.1 Settings
  title: 'Settings',
  you: 'You',
  /** How many of the notification switches are on: "5 of 8 on". */
  switchesOn: (on: number, of: number) => `${on} of ${of} on`,
  help: 'Help',
  helpAndContact: 'Help and contact',
  guidelines: 'Community guidelines',
  terms: 'Terms of use',
  privacyPolicy: 'Privacy policy',

  // 10.5 Account
  accountPage: {
    title: 'Account',
    signInWith: 'Sign in with',
    signedInAs: 'Signed in as',
    yourAccount: 'Your account',
    delete: 'Delete account',
  },

  // Delete account
  deleteAccount: {
    title: 'Delete your account?',
    lead: "This can't be undone. Everyone will stop seeing your profile, and you'll lose:",
    journeys: (journeys: number, entries: number) => `Your ${plural(journeys, 'journey')} and ${plural(entries, 'entry', 'entries')}, with their photos`,
    people: (followers: number, following: number) => `Your ${compact(followers)} ${followers === 1 ? 'follower' : 'followers'} and the ${plural(following, 'person', 'people')} you follow`,
    likes: 'Your likes and comments',
    confirm: 'Delete my account',
    keep: 'Keep my account',
  },

  // 10.2 Notifications
  notificationsPage: {
    title: 'Notifications',
    tellMeAbout: 'Tell me about',
    newEntries: { label: 'New entries', note: 'Grouped per journey' },
    completed: { label: 'Finished journeys', note: 'With the recap' },
    comments: 'Comments and replies',
    followers: 'Followers and invitations',
    likes: { label: 'Likes', note: 'In one batch, at most once an hour' },
    onceAWeek: 'Once a week',
    digest: { label: 'Weekly digest', note: 'On Sundays, in one message' },
    digestEmail: 'Also send it by email',
    reminders: 'Reminders',
    gentle: { label: 'Gentle reminders', note: 'To add an entry. At most one a day.' },
    checkInTime: 'Challenge check-in time',
    checkInTimeNote: 'Reminders arrive around this time of your day, at most one a day.',
  },

  // 10.3 Privacy and safety
  privacyPage: {
    title: 'Privacy and safety',
    newJourneys: 'New journeys',
    startAs: { label: 'Start them as', note: 'You can change it for each journey', title: 'Start new journeys as' },
    photos: 'Photos',
    removeLocations: { label: 'Remove photo locations', note: 'Location data is stripped from every photo you upload' },
    people: 'People',
    neverLive: { title: 'Never live', body: 'Journey never shares where you are right now. Places come only from entries you post.' },
  },

  // Blocked accounts
  blocked: {
    title: 'Blocked accounts',
    lead: "Blocked people can't see, follow or comment on your journeys in the app, and you won't see theirs. They aren't told.",
    none: "You haven't blocked anyone.",
    /** After the person's @name on the same line. `ago` is already written out. */
    since: (ago: string) => `blocked ${ago}`,
  },

  // 10.4 Appearance
  appearancePage: {
    title: 'Appearance',
    theme: 'Theme',
    choices: {
      system: { label: 'Automatic', note: 'Follows your phone' },
      light: { label: 'Light', note: 'Always light' },
      dark: { label: 'Dark', note: 'Always dark' },
    },
  },
} as const;
