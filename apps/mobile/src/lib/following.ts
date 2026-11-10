import type { JourneyResponse } from '@/api/generated/journey';

import { compact } from './plural';

/** "1.2k following": how many people follow a journey. The one way this is written. */
export function followingLabel(count: number): string {
  return `${compact(count)} following`;
}

/**
 * The same for a journey, in the words that fit it: people following a trip, people cheering on a challenge
 * (a journey with a number of days to reach).
 */
export function audienceLabel(journey: Pick<JourneyResponse, 'followerCount' | 'targetDays'>): string {
  return journey.targetDays ? `${compact(journey.followerCount)} cheering` : followingLabel(journey.followerCount);
}
