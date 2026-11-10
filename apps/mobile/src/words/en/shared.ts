/** Journeys written by more than one person: the people on a journey, inviting them, and being invited. */
import { plural } from './plural';

export const shared = {
  // 8.1 and 8.6 People on a journey
  people: {
    title: 'People',
    onThisJourney: 'On this journey',
    invitedGroup: 'Invited',
    /** Under a person's name. `ago` is already written out. */
    invited: (ago: string) => `Invited ${ago}`,
    owner: (isYou: boolean, entries: number) => `${isYou ? 'You · ' : ''}${plural(entries, 'entry', 'entries')}`,
    member: (isYou: boolean, entries: number) => `${isYou ? 'You · ' : ''}Can add entries · ${entries} so far`,
    ownerBadge: 'Owner',
    cancelInvitation: 'Cancel',
    remove: 'Remove',
    leave: 'Leave',

    addPeople: 'Add people',
    canInvite: (spots: number) => `You can invite ${plural(spots, 'more person', 'more people')}. They add their own entries, and you stay in charge of the journey.`,
    full: (authors: number) => `A journey has up to ${plural(authors, 'author')}. Remove someone to invite another person.`,
    nobodyToInvite: 'You can invite people who follow you. When someone follows you, they show up here.',
    invite: 'Invite',

    whoCanDoWhat: 'Who can do what',
    rules: [
      { what: 'Add entries', note: 'And edit or delete their own', who: 'Everyone' },
      { what: 'Change the journey', note: 'Title, cover, who sees it, completing it', who: 'Only the owner' },
      { what: 'Remove people or entries', note: '', who: 'Only the owner' },
    ],
    leaveNote: 'A friend can leave at any time. Their entries stay unless they delete them.',

    confirmLeave: {
      title: 'Leave this journey?',
      body: "You won't be able to add entries any more. The ones you wrote stay unless you delete them.",
      confirm: 'Leave journey',
      cancel: 'Stay',
    },
    confirmRemove: {
      title: (firstName: string) => `Remove ${firstName} from this journey?`,
      body: "They won't be able to add entries any more. The ones they wrote stay unless they delete them.",
      confirm: 'Remove',
      cancel: 'Keep them',
    },
  },

  // A one-time link for a friend who doesn't have the app
  inviteLink: {
    heading: 'Not on Journey yet?',
    lead: "Make a link for a friend who doesn't have Journey yet. They join when they open it and sign up.",
    make: 'Make an invite link',
    note: 'The link works once, for one person, and for a few days only.',
    /** Under a link that was just made. `until` is a day, already written out. */
    madeNote: (until: string) => `The link works once, for one person, until ${until}. Copy or send it now: it isn't shown again.`,
    send: 'Send the link',
    /** What goes with the link when it is sent. */
    message: (journey: string) => `Add to ${journey} with me on Journey`,
    makeNew: 'Make a new link',
  },

  // 8.2 Invitation
  invitation: {
    invitedYou: (name: string) => `${name} invited you`,
    title: (journey: string) => `Add to ${journey}?`,
    points: {
      post: 'Post your own entries and photos',
      onProfile: 'It shows on your profile as a shared journey',
      /** Who sees the journey, by its visibility. */
      who: { public: "It's public", unlisted: 'Only people with the link see it', private: 'Only its authors see it' },
      publicFollowed: (followers: number) => `It's public, and ${plural(followers, 'person follows', 'people follow')} it`,
      leave: 'Leave whenever you like',
    },
    join: 'Join the journey',
    notNow: 'Not now',
    gone: "This invitation isn't there any more.",
    linkGone: 'This invitation link has been used or has run out. Ask your friend for a new one.',
  },
} as const;
