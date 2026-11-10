/** One entry: its card in a list, the entry viewer, its likes and comments, and its options. */
import { plural } from './plural';

export const entry = {
  milestone: 'Milestone',
  edited: 'Edited',

  // 6.1 Entry
  /** "Entry 3 of 14"; without a total while it isn't known. */
  position: (position: number, total: number | null | undefined) => (total ? `Entry ${position} of ${total}` : `Entry ${position}`),
  options: 'Entry options',
  commentOn: (author: string) => `Comment on this entry by ${author}`,
  sayNice: (firstName: string) => `Say something nice to ${firstName}…`,
  /** What a screen reader says for the entry's first photo or clip. `count` is how many it has. */
  openMedia: (clipFirst: boolean, count: number) =>
    clipFirst ? (count > 1 ? `A clip and ${count - 1} more. Open them full screen.` : 'Open the clip full screen') : count > 1 ? `${count} photos. Open them full screen.` : 'Open the photo full screen',
  /** `eyebrow` is the entry's "Day 14 · Hoi An". */
  showOnMap: (eyebrow: string) => `${eyebrow}. Show it on the map`,

  // An entry's card or row in a list: what a screen reader says
  cardSpoken: (headline: string, isNew: boolean) => `${headline}${isNew ? '. New' : ''}`,
  rowSpoken: (eyebrow: string, headline: string) => `${eyebrow}. ${headline}`,
  photosSwipe: (count: number) => `${count} photos. Swipe to see the next one.`,

  // Likes and comments under an entry: what a screen reader says
  like: (likes: number) => `Like. ${likes} likes`,
  unlike: (likes: number) => `Unlike. ${likes} likes`,
  commentsSpoken: (comments: number) => `Comments. ${comments}`,
  countsSpoken: (likes: number, comments: number) => `${likes} likes, ${comments} comments`,

  // 6.5 Entry options
  menu: {
    share: 'Share entry',
    report: 'Report this entry',
    edit: 'Edit entry',
    delete: 'Delete entry',
    confirmDelete: {
      title: 'Delete this entry?',
      body: 'It will be gone for good, for you and everyone following.',
    },
  },

  // 6.4 Comments
  comments: {
    title: (total: number) => (total === 0 ? 'Comments' : plural(total, 'comment')),
    close: 'Close comments',
    /** Marks a comment written by the journey's own author. */
    creator: 'Creator',
    reply: 'Reply',
    replyTo: (name: string) => `Reply to ${name}`,
    delete: 'Delete',
    deleteBy: (name: string) => `Delete the comment by ${name}`,
    report: 'Report',
    reportBy: (name: string) => `Report the comment by ${name}`,
    replyingTo: (name: string) => `Replying to ${name}`,
    stopReplying: 'Stop replying',
    add: 'Add a comment',
    addHint: (firstName: string) => `Add a comment for ${firstName}…`,
    replyHint: (firstName: string) => `Reply to ${firstName}…`,
    send: 'Send comment',
    none: (firstName: string) => `No comments yet. Say something nice to ${firstName}.`,
    showMore: 'Show more comments',
    confirmDelete: {
      title: 'Delete this comment?',
      body: 'It will be gone for good.',
      bodyWithReplies: 'It will be gone for good, and so will the replies to it.',
      confirm: 'Delete comment',
    },
  },
} as const;
