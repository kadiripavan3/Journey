/** The English catalog, one file per area. `src/words/index.ts` says how another language is added. */
import { activity } from './activity';
import { common } from './common';
import { composer } from './composer';
import { dates } from './dates';
import { discover } from './discover';
import { drafts } from './drafts';
import { entry } from './entry';
import { following } from './following';
import { home } from './home';
import { journey } from './journey';
import { journeys } from './journeys';
import { map } from './map';
import { media } from './media';
import { newJourney } from './newJourney';
import { notifications } from './notifications';
import { onboarding } from './onboarding';
import { people } from './people';
import { places } from './places';
import { profile } from './profile';
import { safety } from './safety';
import { search } from './search';
import { settings } from './settings';
import { shared } from './shared';
import { sharing } from './sharing';
import { signIn } from './signIn';
import { states } from './states';
import { story } from './story';

export const en = {
  activity,
  common,
  composer,
  dates,
  discover,
  drafts,
  entry,
  following,
  home,
  journey,
  journeys,
  map,
  media,
  newJourney,
  notifications,
  onboarding,
  people,
  places,
  profile,
  safety,
  search,
  settings,
  shared,
  sharing,
  signIn,
  states,
  story,
} as const;
