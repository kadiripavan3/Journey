import { searchLocalPlaces } from '@/api/generated/journey';

import type { FoundPlace } from './place';

/** A browser can't name the spot it is at, so the preview doesn't offer "where you are now". */
export const canLocate = false;

/** Thrown when the person said no to location. A browser never asks, so this is never thrown here. */
export class LocationDenied extends Error {}

/**
 * Places matching what the person typed. A browser has no place search of its own, so the web preview asks
 * the API's local stand-in, which knows a short list of places. Where that isn't switched on, nothing is found
 * and the typed name can still be used as it is.
 */
export async function searchPlaces(typed: string): Promise<FoundPlace[]> {
  const query = typed.trim();
  if (query.length < 2) return [];
  try {
    return await searchLocalPlaces({ q: query });
  } catch {
    return [];
  }
}

export async function placeHere(): Promise<FoundPlace | null> {
  return null;
}

export async function placeAt(_lat: number, _lng: number): Promise<FoundPlace | null> {
  return null;
}
