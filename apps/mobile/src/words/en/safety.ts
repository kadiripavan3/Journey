/** 11 Safety: reporting, blocking, and what a person sees while something of theirs is being reviewed. */
import { mark } from '../rich';
import { plural } from './plural';

export const safety = {
  // 11.1 Report
  report: {
    /** The question, by what is being reported. */
    title: {
      journey: 'Why are you reporting this journey?',
      entry: 'Why are you reporting this entry?',
      comment: 'Why are you reporting this comment?',
      profile: 'Why are you reporting this person?',
    },
    lead: "Reports are private. The person won't know it was you.",
    /** The reasons, by the API's name for each. */
    reasons: {
      spam: 'Spam or a scam',
      harassment: 'Hate or harassment',
      nudity: 'Nudity or sexual content',
      violence: 'Violence or something dangerous',
      impersonation: 'Pretending to be someone else',
      other: 'Something else',
    },
    send: 'Send report',
    sent: {
      title: 'Thanks for telling us',
      body: 'A person will look at it. Your report stays private.',
    },
  },

  // 11.2 Block
  block: {
    title: (name: string) => `Block ${name}?`,
    points: ["They can't see, follow or comment on your journeys in the app", "You won't see their journeys or comments", "They won't be told"],
    confirm: 'Block',
  },

  // A photo or a comment that only its author sees until a reviewer has decided
  held: {
    photoSpoken: 'This photo is hidden while a person reviews it',
    hidden: 'Hidden for now',
    /** How many photos of an entry are being reviewed. */
    photos: (count: number) => (count === 1 ? 'One photo is being reviewed' : `${plural(count, 'photo')} are being reviewed`),
    /** What a screen reader says for that line. `photos` comes from `photos` above. */
    photosSpoken: (photos: string) => `${photos}. See what this means`,
    onlyYou: 'Only you can see it for now',
    comment: 'Only you can see this for now. A person will read it soon.',
  },

  // 11.3 Held for review
  review: {
    body: (count: number) =>
      count === 1
        ? "Our automatic check flagged it, so it's hidden from everyone but you. A person will look at it soon."
        : "Our automatic check flagged them, so they're hidden from everyone but you. A person will look at them soon.",
    remove: (count: number) => (count === 1 ? 'Remove the photo' : 'Remove the photos'),
    /** "ask" marks the link that asks for a second look. */
    mistake: ["Think it's a mistake? ", mark('ask', 'Ask for a second look')],
    asked: "Thanks. We'll take a second look.",
    nothing: {
      title: 'Nothing is being reviewed',
      body: 'Every photo in this entry can be seen by everyone who can see the journey.',
    },
    back: 'Back to the entry',
  },
} as const;
