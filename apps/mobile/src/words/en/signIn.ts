/** Before someone is signed in: welcome, how it works, and signing in with Apple, Google or an emailed code. */
import { mark } from '../rich';

export const signIn = {
  // 1.1 Welcome
  welcome: {
    title: 'Follow the journey, not just the moment.',
    body: 'Trips, challenges and everything in between, told day by day.',
    start: 'Get started',
    haveAccount: 'I already have an account',
    /** "terms" and "privacy" mark the two links. */
    agree: ['By continuing you agree to the ', mark('terms', 'Terms'), ' and ', mark('privacy', 'Privacy Policy'), '.'],
  },

  // 1.2 How it works
  howItWorks: {
    /** The labels on the three example photos. */
    cards: { bromo: 'Day 22 · Mount Bromo', hoiAn: 'Day 14 · Hoi An', hanoi: 'Day 1 · Hanoi' },
    /** What a screen reader says for the picture as a whole. */
    picture: 'Three photos stacked like cards: Day 1 in Hanoi, Day 14 in Hoi An and Day 22 at Mount Bromo.',
    followerCount: '1.2k',
    followingAlong: 'following along',
    title: 'A story, told day by day',
    body: 'Start a journey, add entries as it happens, and people follow along for the next chapter.',
  },

  // 1.3 Log in or sign up
  choose: {
    title: 'Log in or sign up',
    body: "Use an account you already have. There's no password to remember.",
    apple: 'Continue with Apple',
    google: 'Continue with Google',
    email: 'Continue with email',
    /** `name` is "Apple" or "Google". */
    later: (name: string) => `${name} sign-in is switched on later. Use your email for now.`,
    notOnThisPhone: (name: string) => `${name} sign-in isn't available on this phone. Use your email.`,
    /** "terms" and "privacy" mark the two links. */
    agree: ['By continuing you agree to the ', mark('terms', 'Terms'), ' and ', mark('privacy', 'Privacy Policy'), ", and confirm you're 13 or older."],
  },

  // 1.4 Email
  email: {
    title: "What's your email?",
    body: "We'll send a 6-digit code to sign you in. No password needed.",
    field: 'Email',
    send: 'Send code',
  },

  // 1.5 Email code
  code: {
    title: 'Check your email',
    /** "email" marks the address, drawn in bold. */
    sentTo: (email: string) => ['Enter the code we sent to ', mark('email', email), '.'],
    sending: 'Sending…',
    sentAgain: 'Code sent again',
    sendAgain: 'Send the code again',
    testMode: (code: string) => `Test mode: no email is sent. The code is ${code}.`,
  },

  // What the app says when signing in itself didn't work
  problems: {
    notSetUp: "Sign-in isn't set up in this build yet.",
    failed: "That didn't sign you in. Try again.",
    appleFailed: "Apple didn't sign you in. Try again, or use your email.",
    googleNeedsApp: 'Google sign-in needs the installed app. Use your email for now.',
    googleFailed: "Google didn't sign you in. Try again, or use your email.",
    wrongCode: "That code isn't right, or it has run out. Check it or ask for a new one.",
    tooManyCodes: "That's a lot of codes. Wait a minute and try again.",
    badEmail: "That email doesn't look right.",
    didntWork: "That didn't work. Try again in a moment.",
  },
} as const;
