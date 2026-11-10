/** The English catalog, one file per area. `src/words/index.ts` says how another language is added. */
import { activity } from './activity';
import { common } from './common';
import { dates } from './dates';
import { discover } from './discover';
import { following } from './following';
import { home } from './home';
import { journey } from './journey';
import { journeys } from './journeys';
import { map } from './map';
import { media } from './media';
import { newJourney } from './newJourney';
import { notifications } from './notifications';
import { onboarding } from './onboarding';
import { profile } from './profile';
import { shared } from './shared';
import { signIn } from './signIn';
import { states } from './states';
import { story } from './story';

export const en = {
  activity,
  common,
  dates,
  discover,
  following,
  home,
  journey,
  journeys,
  map,
  media,
  newJourney,
  notifications,
  onboarding,
  profile,
  shared,
  signIn,
  states,
  story,
} as const;
