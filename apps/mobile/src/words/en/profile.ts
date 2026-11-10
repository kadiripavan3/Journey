/** A person: their profile, your own page ("You"), the lists of followers, and changing your profile. */

export const profile = {
  // 9.1 Your profile
  you: {
    share: 'Share your profile',
    /** The word under how many journeys you have. (Followers and Following are `people` below.) */
    journeys: 'Journeys',
    edit: 'Edit profile',
    newJourney: 'New journey',
    first: {
      title: 'Start your first journey',
      body: "A trip, a 30-day challenge, something you're building. Add to it as it happens.",
      start: 'Start a journey',
    },
    /** What an empty shelf says, by shelf. */
    emptyShelf: {
      active: 'No active journeys right now.',
      completed: 'Journeys you complete show up here.',
      private: 'Journeys only you can see show up here.',
    },
  },

  /** The shelves of journeys on a profile. Private is on your own only. */
  shelves: { active: 'Active', completed: 'Completed', private: 'Private' },

  // 9.2 Someone's profile. `firstName` is what to call them.
  page: {
    followsYou: 'Follows you',
    blocked: (firstName: string) => `You've blocked ${firstName}. Neither of you sees the other's journeys in the app.`,
    following: (firstName: string) => `You'll get ${firstName}'s next journeys.`,
    notFollowing: (firstName: string) => `Following ${firstName} also brings their next journeys.`,
    emptyShelf: {
      active: (firstName: string) => `${firstName} has no journeys in progress.`,
      completed: (firstName: string) => `${firstName} hasn't completed a journey yet.`,
    },
    more: 'More options',
    block: (firstName: string) => `Block ${firstName}`,
    report: (firstName: string) => `Report ${firstName}`,
  },

  // 9.3 Followers and following
  people: {
    followers: 'Followers',
    following: 'Following',
    none: {
      followers: 'No followers yet.',
      yourFollowers: 'Nobody follows you yet. Share a journey and they will.',
      following: 'Not following anyone yet.',
      yourFollowing: "You don't follow anyone yet.",
    },
  },

  // 9.4 Edit profile (the first three are also asked for when the profile is made)
  name: 'Name',
  username: {
    label: 'Username',
    available: (username: string) => `${username} is available`,
    // Why a username isn't allowed. The same rules as the API, said at once while typing.
    tooShort: 'Use at least 3 characters.',
    tooLong: 'Use 20 characters or fewer.',
    badCharacters: 'Use only letters, numbers, dots and underscores.',
    badDots: "Dots can't be first, last or doubled.",
  },
  photo: { add: 'Add a photo', change: 'Change your photo', remove: 'Remove photo' },
  edit: {
    title: 'Edit profile',
    /** The field's label, with how much of the room is used. */
    bio: (length: number, most: number) => `Bio · ${length} of ${most}`,
    link: 'Link',
    linkHint: 'yoursite.com',
    interests: 'Interests',
  },
} as const;
