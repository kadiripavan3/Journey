/** 7.2 Writing an entry: a new one, a draft, or a change to one that is posted. */
import { mark, type Rich } from '../rich';

export const composer = {
  // Before the journey's first day there is no day an entry could have
  startsLater: {
    /** `day` is already written out: "1 April". */
    title: (day: string) => `It starts on ${day}`,
    owner: 'You can add entries from that day on. Already on your way? Move the start date.',
    member: 'You can add entries from that day on.',
    changeStart: 'Change the start date',
  },

  heading: { edit: 'Edit entry', draft: 'Draft', fresh: 'New entry' },
  post: 'Post',
  /** Which journey the entry is for. The journey's title is marked "bold". */
  postingTo: (journey: string): Rich => ['Posting to ', mark('bold', journey)],
  inJourney: (journey: string): Rich => ['In ', mark('bold', journey)],

  title: { spoken: 'Title, optional', hint: 'Title' },
  body: { spoken: 'What happened', hint: 'What happened?' },
  /** A prompt offered to start the text with; `prompt` comes from the API. */
  startWith: (prompt: string) => `Start with: ${prompt}`,

  // Photos and clips
  media: {
    /** What a photo or clip in the strip is called, for screen readers: "Photo 2", "Clip 1". */
    name: (isClip: boolean, number: number) => `${isClip ? 'Clip' : 'Photo'} ${number}`,
    photo: 'Photo',
    /** `name` comes from `name` above. */
    remove: (name: string) => `Remove ${name.toLowerCase()}`,
    /** The tile that adds some. `clips` says whether clips can be added too. */
    addSpoken: (clips: boolean, more: boolean) => `${more ? 'Add more' : 'Add'} ${clips ? 'photos or clips' : 'photos'}`,
    add: (clips: boolean, more: boolean) => (more ? 'Add' : clips ? 'Photos or clips' : 'Photos'),
    /** "4 of 10 photos · 1 of 3 clips". `clips` is null where clips don't count. */
    counts: (photos: number, mostPhotos: number, clips: number | null, mostClips: number) => `${photos} of ${mostPhotos} photos${clips === null ? '' : ` · ${clips} of ${mostClips} clips`}`,
    /** The counts, then the sentence about what the picker left out. */
    countsThen: (counts: string, leftOut: string) => `${counts}. ${leftOut}`,
  },

  // The day and the place
  /** "Day 14": the label an entry will get in a journey that counts days. */
  dayNumber: (day: number) => `Day ${day}`,
  day: {
    spoken: (label: string) => `${label}. Change the day`,
    title: 'When did this happen?',
  },
  place: {
    add: 'Add a place',
    spoken: (place: string) => `Place: ${place}. Change the place`,
    fromPhoto: (place: string) => `From your photo: ${place}`,
    use: 'Use',
    useSpoken: (place: string) => `Use ${place}, where the first photo was taken`,
    exact: 'Show the exact spot',
    exactOn: 'People see the exact point on the map.',
    exactOff: 'People see the area, not the exact point.',
  },
  milestone: 'Mark as milestone',

  offline: "You're offline. Post it anyway: it's saved on this phone and goes up when you're back.",

  // What is going on while it is sent or saved
  progress: {
    posting: 'Posting',
    saving: 'Saving',
    /** "Uploading 2 of 5" */
    uploading: (at: number, of: number) => `Uploading ${at} of ${of}`,
    uploadingOne: (isClip: boolean) => `Uploading the ${isClip ? 'clip' : 'photo'}`,
    /** A clip's upload with how far it is: "Uploading the clip · 40%". */
    withPercent: (label: string, percent: number) => `${label} · ${percent}%`,
  },
  cantSave: "This entry couldn't be saved on your phone. Free up some space and try again.",

  // Leaving with something unsaved
  discardChanges: {
    title: 'Discard your changes?',
    body: 'The entry stays as it was.',
    confirm: 'Discard changes',
    cancel: 'Keep editing',
  },
  leave: {
    title: 'Save this for later?',
    titleDraft: 'Keep this draft?',
    body: "A draft stays on this phone until you post it. You'll find it under Drafts and uploads, on your profile.",
    saveAsDraft: 'Save as a draft',
    saveDraft: 'Save draft',
    discard: 'Discard',
    deleteDraft: 'Delete draft',
    keepWriting: 'Keep writing',
  },
} as const;
