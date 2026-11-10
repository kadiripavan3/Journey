/** Asking to send notifications, and what this phone does with them. (What each notification says comes from the API.) */

export const notifications = {
  // 2.4 The question: during sign-up, and once more inside the app for someone who never saw it
  ask: {
    title: "Know when there's a new chapter",
    body: "Only for journeys you follow, grouped so you're never flooded. Turn off any type whenever you like.",
    bodyInApp: "New entries from the journeys you follow, and likes and comments on yours. Grouped so you're never flooded; turn off any type whenever you like.",
    turnOn: 'Turn on notifications',
    /** The two made-up notifications drawn on the photo. */
    examples: {
      trip: { title: 'Southeast Asia by motorbike', line: 'Maya posted Day 23: “Roads that look like rivers”', when: 'now' },
      challenge: { title: '30 days of guitar', line: 'Lea checked in for day 12 · 46 cheering', when: '2h ago' },
    },
    exampleSpoken: (title: string, line: string) => `Example notification. ${title}. ${line}`,
  },

  /** Where notifications can't work. Nothing a person follows is lost: it is all in Activity. */
  whyNot: {
    browser: 'Notifications arrive on your phone. In the browser, everything new shows in Activity.',
    expoGo: 'Notifications need the installed Journey app. In Expo Go, everything new shows in Activity.',
  },

  // Under the switches in Settings: whether this phone lets Journey tell them
  thisPhone: {
    on: 'This phone gets the notifications you switched on. Everything also shows in Activity.',
    blocked: "Notifications for Journey are off in your phone's settings. Until you turn them on there, everything shows in Activity.",
    off: 'Notifications are off on this phone. Your choices above are saved for when you turn them on; until then everything shows in Activity.',
    openSettings: "Open the phone's settings",
  },
} as const;
