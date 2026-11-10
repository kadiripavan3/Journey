/** The English catalog, one file per area. `src/words/index.ts` says how another language is added. */
import { activity } from './activity';
import { common } from './common';
import { dates } from './dates';
import { discover } from './discover';
import { home } from './home';
import { journeys } from './journeys';
import { media } from './media';
import { notifications } from './notifications';
import { onboarding } from './onboarding';
import { profile } from './profile';
import { signIn } from './signIn';
import { states } from './states';

export const en = {
  activity,
  common,
  dates,
  discover,
  home,
  journeys,
  media,
  notifications,
  onboarding,
  profile,
  signIn,
  states,
} as const;
