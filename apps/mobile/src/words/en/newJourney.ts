/** Starting a journey, in three steps. (The templates' own names and descriptions come from the API.) */
import { mark, type Rich } from '../rich';

export const newJourney = {
  // 7.4 Choose a template
  template: {
    title: 'What kind of journey?',
    lead: 'Pick a starting point. You can change anything later.',
    popular: 'POPULAR',
    /** The journal's row: its name, marked "bold", then what it is, as the rest of one line. */
    journal: (name: string, description: string): Rich => [mark('bold', name), ` · ${description.charAt(0).toLowerCase()}${description.slice(1)}`],
  },

  // 7.5 Journey details
  details: {
    title: 'Tell us about it',
    challengeTitleHint: '30 days of…',
    dayTitle: 'When does it start?',
  },

  // 7.6 Who can see it
  visibility: {
    lead: 'You can change this any time.',
    create: 'Create journey',
    uploadingCover: 'Uploading the cover',
    creating: 'Creating your journey',
    labelAs: 'Label entries as',
    byDay: 'Day 1, Day 2…',
    byDaySpoken: 'Day 1, Day 2 and so on',
    byPart: 'Part 1, Part 2…',
    byPartSpoken: 'Part 1, Part 2 and so on',
    byDayNote: 'Days count from the start date, so a quiet day leaves a gap.',
    byPartNote: 'Parts count your entries, one after another.',
  },
} as const;
