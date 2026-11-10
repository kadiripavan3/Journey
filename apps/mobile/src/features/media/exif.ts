/** What a photo says about itself (its EXIF data), as the phone hands it over: loose keys, numbers or text. */
type Exif = Record<string, unknown> | null | undefined;

/** A spot on the map. */
export type Point = { lat: number; lng: number };

/** The day a photo was taken, "2026-04-01", when the photo says so. */
export function photoDay(exif: Exif): string | undefined {
  if (!exif) return undefined;
  for (const key of ['DateTimeOriginal', 'DateTimeDigitized', 'DateTime']) {
    const value = exif[key];
    // "2026:04:01 10:22:33" is how cameras write it; some write dashes.
    const match = typeof value === 'string' ? /^(\d{4})[:-](\d{2})[:-](\d{2})/.exec(value) : null;
    if (!match) continue;
    const [, year, month, day] = match;
    if (Number(year) < 1990 || Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) continue;
    return `${year}-${month}-${day}`;
  }
  return undefined;
}

/**
 * The day a new entry starts on: the day its first photo was taken, when the photo says so and that day can
 * belong to the journey (from its first day until today). Otherwise today.
 */
export function entryDay(takenOn: string | undefined, journeyStart: string, today: string): string {
  return takenOn && takenOn >= journeyStart && takenOn <= today ? takenOn : today;
}

/** Where a photo was taken, when the photo says so. */
export function photoPoint(exif: Exif): Point | undefined {
  if (!exif) return undefined;
  const lat = signed(exif.GPSLatitude, exif.GPSLatitudeRef, 'S');
  const lng = signed(exif.GPSLongitude, exif.GPSLongitudeRef, 'W');
  if (lat === undefined || lng === undefined) return undefined;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  // 0, 0 is what a camera without a fix writes; nobody took the photo in the Gulf of Guinea.
  if (lat === 0 && lng === 0) return undefined;
  return { lat, lng };
}

/** A coordinate as a number. South and west are negative, whether the photo says so with a sign or with a letter. */
function signed(value: unknown, ref: unknown, negative: 'S' | 'W'): number | undefined {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(number)) return undefined;
  return typeof ref === 'string' && ref.trim().toUpperCase().startsWith(negative) ? -Math.abs(number) : number;
}
