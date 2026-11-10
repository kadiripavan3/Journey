/** The steps of sign-up, after signing in for the first time. */
import { mark } from '../rich';
import { plural } from './plural';

export const onboarding = {
  // 2.1 Create your profile
  profile: {
    title: 'Create your profile',
    body: 'This is how people see you when you share a journey.',
    differentEmail: 'Use a different email',
    bio: 'Bio · optional',
    oldEnough: "I'm 13 or older",
    /** "terms" and "privacy" mark the two links. */
    agree: ['By continuing you agree to the ', mark('terms', 'terms'), ' and the ', mark('privacy', 'privacy policy'), '.'],
  },

  // 2.2 Interests
  interests: {
    title: 'What are you into?',
    body: "Pick at least three. We'll suggest journeys to match.",
    continuePicked: (picked: number) => `Continue · ${picked} picked`,
    pickMore: (missing: number) => `Pick ${missing} more`,
  },

  // 2.3 Journeys to follow
  suggested: {
    title: 'Follow a few journeys',
    body: 'New chapters from them will show up on your Home.',
    findMore: 'Find more any time in Discover.',
    none: 'No journeys to suggest yet. You can start the first one.',
  },

  // (2.4 Notifications is in notifications.ts: the same question is asked again later, inside the app.)

  // 2.5 All set
  ready: {
    later: 'Maybe later, take me Home',
    title: (firstName: string) => (firstName ? `You're all set, ${firstName}` : "You're all set"),
    body: (following: number) => (following > 0 ? `Your Home already has ${plural(following, 'journey')} to follow. Want to start your own?` : 'Want to start a journey of your own?'),
    trip: { name: 'A trip', description: "Day by day, with a map of where you've been" },
    challenge: { name: 'A 30-day challenge', description: 'A check-in a day, with people cheering' },
    somethingElse: 'Something else: learn a skill, build something, keep a journal',
  },
} as const;
