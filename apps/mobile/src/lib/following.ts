import type { JourneyResponse } from '@/api/generated/journey';
import { words } from '@/words';

/** "1.2k following": how many people follow a journey. The one way this is written. */
export function followingLabel(count: number): string {
  return words.journeys.following(count);
}

/** The same, or an invitation when nobody follows yet. */
export function followersLabel(count: number): string {
  return count === 0 ? words.journeys.beFirstToFollow : followingLabel(count);
}

/**
 * The same for a journey, in the words that fit it: people following a trip, people cheering on a challenge
 * (a journey with a number of days to reach).
 */
export function audienceLabel(journey: Pick<JourneyResponse, 'followerCount' | 'targetDays'>): string {
  return journey.targetDays ? words.journeys.cheering(journey.followerCount) : followingLabel(journey.followerCount);
}
