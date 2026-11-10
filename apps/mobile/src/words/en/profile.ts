/** A person: their profile, their own page ("You"), and changing it. */

export const profile = {
  // 9.1 Your profile
  you: {
    share: 'Share your profile',
    settings: 'Settings',
    stats: { journeys: 'Journeys', followers: 'Followers', following: 'Following' },
    edit: 'Edit profile',
    newJourney: 'New journey',
    shelves: { active: 'Active', completed: 'Completed', private: 'Private' },
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

  name: 'Name',
  username: {
    label: 'Username',
    // Why a username isn't allowed. The same rules as the API, said at once while typing.
    tooShort: 'Use at least 3 characters.',
    tooLong: 'Use 20 characters or fewer.',
    badCharacters: 'Use only letters, numbers, dots and underscores.',
    badDots: "Dots can't be first, last or doubled.",
  },
} as const;
