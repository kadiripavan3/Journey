/**
 * The few things the beta counts, and nothing else. They are the numbers in docs/06-engagement.md ("How we'll
 * know it works") and in the success metrics of docs/01-requirements.md:
 *
 *  - creators keep posting: `journey_created`, `entry_posted`, `journey_completed`
 *  - followers come back:   `notification_opened`, and opening the app at all (counted by the analytics service)
 *  - new people arrive:     `signed_up`, `journey_followed`, `person_followed`, `invitation_sent`, `invitation_accepted`
 *
 * What goes with an event is a kind or a count: a template, how many photos, which type of notification.
 * Never a name, an email address, a title, or anything a person wrote.
 */
export type EventName =
  | 'signed_up'
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

type Bag = Record<string, unknown>;

const bag = (value: unknown): Bag => (typeof value === 'object' && value !== null ? (value as Bag) : {});
const word = (value: unknown): string => (typeof value === 'string' ? value : 'unknown');

/**
 * Most events are a change the API just accepted. They are named here once, by the API call that makes them
 * happen, so no screen has to remember to count anything. `answer` is what the API sent back.
 */
export function eventFor(call: string, answer: unknown): [EventName, EventProps] | null {
  const data = bag(answer);
  switch (call) {
    case 'createJourney':
      return ['journey_created', { template: word(data.template), category: word(data.category), visibility: word(data.visibility) }];
    case 'addEntry': {
      const media = Array.isArray(data.media) ? data.media.map(bag) : [];
      return [
        'entry_posted',
        {
          photos: media.filter((item) => item.kind === 'photo').length,
          clips: media.filter((item) => item.kind === 'video').length,
          has_place: typeof data.placeName === 'string' && data.placeName.length > 0,
          milestone: data.isMilestone === true,
        },
      ];
    }
    case 'completeJourney':
      return ['journey_completed', { template: word(data.template), entries: typeof data.entryCount === 'number' ? data.entryCount : 0 }];
    case 'followJourney':
      return ['journey_followed', { category: word(data.category) }];
    case 'followProfile':
      return ['person_followed', {}];
    case 'inviteMember':
      return ['invitation_sent', {}];
    case 'acceptInvitation':
      return ['invitation_accepted', {}];
    case 'addComment':
      return ['comment_added', { reply: typeof data.parentId === 'string' }];
    default:
      return null;
  }
}
