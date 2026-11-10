/** 7.2 Place: saying where an entry happened. */

export const places = {
  title: 'Where was this?',
  search: 'Search for a place',
  here: { label: 'Where you are now', note: "Uses the phone's location, only when you tap here" },
  fromPhoto: 'Where the first photo was taken',
  remove: 'Remove the place',
  /** Keeps what was typed as the place's name. `name` is that name, tidied up. */
  useTyped: (name: string) => `Use "${name}"`,
  useTypedNote: 'Just the name, without a spot on the map',
  footnote: 'Other people see the area around a place, not the exact point, unless you choose to show the exact spot.',
  /** Under a place that was found: the town it is in. */
  near: (area: string) => `Near ${area}`,

  // When a place couldn't be found
  hereUnknown: "The phone couldn't tell where it is. Search for the place instead.",
  photoUnknown: "We couldn't tell where that photo was taken. Search for the place instead.",
  locationOff: "Journey isn't allowed to use the phone's location. You can switch it on in the phone's Settings, or search for the place instead.",
  lookupOff: "Journey isn't allowed to use the phone's location, so it can't look places up. You can still use the name as you typed it.",
} as const;
