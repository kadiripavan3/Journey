/** Other people: a person in a list, following them, and the lists of who follows whom. */

export const people = {
  followBack: 'Follow back',
  /** `name` is a first name. */
  followName: (name: string) => `Follow ${name}`,
  /** What a screen reader says for a person in a list. */
  rowSpoken: (name: string, username: string) => `${name}, @${username}`,
  /** The link on a profile. `link` is the address as shown, without "https://". */
  openLink: (link: string) => `Open ${link}`,
} as const;
