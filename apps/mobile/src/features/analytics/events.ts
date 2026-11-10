/**
 * The few things the beta counts, and nothing else. They are the numbers in docs/06-engagement.md ("How we'll
 * know it works") and in the success metrics of docs/01-requirements.md:
 *
 *  - creators keep posting: `journey_created`, `entry_posted`, `journey_completed`
 *  - followers come back:   `notification_opened`, `app_opened`
 *  - new people arrive:     `signed_up`, `sign_up_finished`, `journey_followed`, `person_followed`,
 *                           `invitation_sent`, `invitation_accepted`
 *
 * What goes with an event is a kind or a count: a template, how many photos, which type of notification.
 * Never a name, an email address, a title, an address that names a person, or anything a person wrote.
 *
 * Every event is named in this file, once:
 *  - A change the API accepted is counted by the API call that made it happen (`CALLS` below). The app's
 *    one way to the API tells `eventFor` about every call it said yes to (`countChanges` in `analytics.ts`),
 *    so no screen has to remember to count, and none can forget.
 *  - The four that are not a change in the API are counted where they happen, with `track`: `app_opened`
 *    (`useTelemetry`), `notifications_answered` and `notification_opened` (`features/notifications`), and
 *    `sign_up_finished` (the last sign-up step).
 */
export type EventName =
  | 'app_opened'
  | 'signed_up'
  | 'sign_up_finished'
  | 'notifications_answered'
  | 'notification_opened'
  | 'journey_created'
  | 'entry_posted'
  | 'journey_completed'
  | 'journey_followed'
  | 'person_followed'
  | 'invitation_sent'
  | 'invitation_accepted'
  | 'comment_added';

export type EventProps = Record<string, string | number | boolean>;
export type Counted = [EventName, EventProps];

type Bag = Record<string, unknown>;

const bag = (value: unknown): Bag => (typeof value === 'object' && value !== null ? (value as Bag) : {});
const word = (value: unknown): string => (typeof value === 'string' ? value : 'unknown');

/** What was sent with a request, when it was JSON; an empty bag otherwise. */
function sentBag(sent: unknown): Bag {
  if (typeof sent !== 'string') return bag(sent);
  try {
    return bag(JSON.parse(sent));
  } catch {
    return {};
  }
}

type Call = {
  method: 'POST' | 'PUT';
  /** The call's address, with `*` where an id, a username or a token stands. */
  path: string;
  /** `answer` is what the API sent back, `sent` what the app sent. Null when this particular call isn't counted. */
  event: (answer: Bag, sent: Bag) => Counted | null;
};

/** The changes that are counted, each named by the API call that makes it happen. */
const CALLS: Call[] = [
  // The profile is made once, with the confirmation of age. Changing it later sends no confirmation.
  { method: 'PUT', path: '/v1/me/profile', event: (_answer, sent) => (sent.ageConfirmed === true ? ['signed_up', {}] : null) },
  { method: 'POST', path: '/v1/journeys', event: (journey) => ['journey_created', { template: word(journey.template), category: word(journey.category), visibility: word(journey.visibility) }] },
  {
    method: 'POST',
    path: '/v1/journeys/*/entries',
    event: (entry) => {
      const media = Array.isArray(entry.media) ? entry.media.map(bag) : [];
      return [
        'entry_posted',
        {
          photos: media.filter((item) => item.kind === 'photo').length,
          clips: media.filter((item) => item.kind === 'video').length,
          has_place: typeof entry.placeName === 'string' && entry.placeName.length > 0,
          milestone: entry.isMilestone === true,
        },
      ];
    },
  },
  { method: 'POST', path: '/v1/journeys/*/complete', event: (journey) => ['journey_completed', { template: word(journey.template), entries: typeof journey.entryCount === 'number' ? journey.entryCount : 0 }] },
  { method: 'PUT', path: '/v1/journeys/*/follow', event: (journey) => ['journey_followed', { category: word(journey.category) }] },
  { method: 'PUT', path: '/v1/profiles/*/follow', event: () => ['person_followed', {}] },
  // An invitation goes to a person on Journey, or out as a link for someone who isn't yet.
  { method: 'POST', path: '/v1/journeys/*/members', event: () => ['invitation_sent', { by: 'name' }] },
  { method: 'POST', path: '/v1/journeys/*/invite-link', event: () => ['invitation_sent', { by: 'link' }] },
  { method: 'POST', path: '/v1/journeys/*/invitation/accept', event: () => ['invitation_accepted', { by: 'name' }] },
  { method: 'POST', path: '/v1/invites/*/accept', event: () => ['invitation_accepted', { by: 'link' }] },
  { method: 'POST', path: '/v1/entries/*/comments', event: (comment) => ['comment_added', { reply: typeof comment.parentId === 'string' }] },
];

const matches = (pattern: string, path: string): boolean => {
  const want = pattern.split('/');
  const have = path.split('/');
  return want.length === have.length && want.every((part, index) => (part === '*' ? have[index] !== '' : part === have[index]));
};

/**
 * The event for a call the API said yes to, or null when that call isn't counted. `path` is the address
 * without the API's own ("/v1/journeys/…"), `answer` what the API sent back, `sent` what the app sent.
 */
export function eventFor(method: string, path: string, answer: unknown, sent?: unknown): Counted | null {
  const address = path.split(/[?#]/)[0] ?? '';
  const call = CALLS.find((known) => known.method === method.toUpperCase() && matches(known.path, address));
  return call ? call.event(bag(answer), sentBag(sent)) : null;
}
