import { clipLength } from '../clips';
import { entryDay, photoDay, photoPoint } from '../exif';
import { type LocalMedia, sortPicked } from '../pick';

describe('what a photo says about itself', () => {
  it('gives the day it was taken, however the camera wrote it', () => {
    expect(photoDay({ DateTimeOriginal: '2026:04:01 10:22:33' })).toBe('2026-04-01');
    expect(photoDay({ DateTime: '2026-04-02T08:00:00' })).toBe('2026-04-02');
    // The moment it was taken wins over the moment the file was last changed.
    expect(photoDay({ DateTime: '2026:05:09 12:00:00', DateTimeOriginal: '2026:04:01 10:22:33' })).toBe('2026-04-01');
  });

  it('gives nothing when the photo has no date, or one that makes no sense', () => {
    expect(photoDay(null)).toBeUndefined();
    expect(photoDay({})).toBeUndefined();
    expect(photoDay({ DateTimeOriginal: '0000:00:00 00:00:00' })).toBeUndefined();
    expect(photoDay({ DateTimeOriginal: 20260401 })).toBeUndefined();
  });

  it('gives where it was taken, with south and west as negative numbers', () => {
    expect(photoPoint({ GPSLatitude: 15.88, GPSLongitude: 108.33, GPSLatitudeRef: 'N', GPSLongitudeRef: 'E' })).toEqual({ lat: 15.88, lng: 108.33 });
    expect(photoPoint({ GPSLatitude: 7.94, GPSLongitude: 112.95, GPSLatitudeRef: 'S', GPSLongitudeRef: 'E' })).toEqual({ lat: -7.94, lng: 112.95 });
    expect(photoPoint({ GPSLatitude: '64.14', GPSLongitude: '21.94', GPSLongitudeRef: 'W' })).toEqual({ lat: 64.14, lng: -21.94 });
    // Some phones already write the sign.
    expect(photoPoint({ GPSLatitude: -7.94, GPSLongitude: 112.95, GPSLatitudeRef: 'S' })).toEqual({ lat: -7.94, lng: 112.95 });
  });

  it('gives no place for a photo without one, a camera without a fix, or numbers off the map', () => {
    expect(photoPoint({})).toBeUndefined();
    expect(photoPoint({ GPSLatitude: 0, GPSLongitude: 0 })).toBeUndefined();
    expect(photoPoint({ GPSLatitude: 95, GPSLongitude: 10 })).toBeUndefined();
    expect(photoPoint({ GPSLatitude: 15.88 })).toBeUndefined();
  });
});

describe('the day a new entry starts on', () => {
  it('is the day the first photo was taken, when that day can belong to the journey', () => {
    expect(entryDay('2026-04-03', '2026-04-01', '2026-04-10')).toBe('2026-04-03');
    expect(entryDay('2026-04-01', '2026-04-01', '2026-04-10')).toBe('2026-04-01');
  });

  it('is today when the photo has no date, or was taken before the journey began, or says a day still to come', () => {
    expect(entryDay(undefined, '2026-04-01', '2026-04-10')).toBe('2026-04-10');
    expect(entryDay('2026-03-20', '2026-04-01', '2026-04-10')).toBe('2026-04-10');
    expect(entryDay('2026-04-11', '2026-04-01', '2026-04-10')).toBe('2026-04-10');
  });
});

describe('what was picked for an entry', () => {
  const photo = (uri: string): LocalMedia => ({ kind: 'photo', uri, width: 10, height: 10 });
  const clip = (uri: string, durationSeconds?: number): LocalMedia => ({ kind: 'video', uri, width: 10, height: 10, durationSeconds });

  it('keeps what fits, in the order it was picked', () => {
    const { picked, leftOut } = sortPicked([photo('a'), clip('b', 12), photo('c')], { photos: 10, clips: 3 });
    expect(picked.map((item) => item.uri)).toEqual(['a', 'b', 'c']);
    expect(leftOut).toBeNull();
  });

  it('leaves out a clip over a minute and says so', () => {
    const { picked, leftOut } = sortPicked([clip('long', 75), clip('ok', 60)], { photos: 10, clips: 3 });
    expect(picked.map((item) => item.uri)).toEqual(['ok']);
    expect(leftOut).toBe('Clips can be up to 60 seconds, so one was left out.');
  });

  it('leaves out what is over the count, of each kind, and says so', () => {
    const { picked, leftOut } = sortPicked([clip('1', 5), clip('2', 5), photo('p1'), photo('p2'), photo('p3')], { photos: 1, clips: 1 });
    expect(picked.map((item) => item.uri)).toEqual(['1', 'p1']);
    expect(leftOut).toBe('An entry holds 3 clips, so one was left out. An entry holds 10 photos, so 2 were left out.');
  });

  it('takes a clip whose length the phone could not tell: the video service checks it', () => {
    expect(sortPicked([clip('unknown')], { photos: 0, clips: 1 }).picked).toHaveLength(1);
  });
});

describe('clip length', () => {
  it('reads like a clock', () => {
    expect(clipLength(42)).toBe('0:42');
    expect(clipLength(60)).toBe('1:00');
    expect(clipLength(7.6)).toBe('0:08');
  });

  it('is empty when the length is not known', () => {
    expect(clipLength(null)).toBe('');
    expect(clipLength(undefined)).toBe('');
    expect(clipLength(Number.NaN)).toBe('');
  });
});
