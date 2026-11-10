import { parseTags } from '@/features/journeys/draft';
import { compact, followersLabel, plural } from '@/lib/plural';

describe('parseTags', () => {
  it('accepts spaces, commas and hashes between tags', () => {
    expect(parseTags('iceland #roadtrip, VanLife')).toEqual(['iceland', 'roadtrip', 'vanlife']);
  });

  it('drops repeats and stops at five', () => {
    expect(parseTags('a b a c d e f g')).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('gives nothing for nothing', () => {
    expect(parseTags('  ,# ')).toEqual([]);
  });
});

describe('counts', () => {
  it('uses the right word for one and many', () => {
    expect(plural(1, 'entry', 'entries')).toBe('1 entry');
    expect(plural(3, 'entry', 'entries')).toBe('3 entries');
    expect(plural(2, 'journey')).toBe('2 journeys');
  });

  it('shortens thousands', () => {
    expect(compact(999)).toBe('999');
    expect(compact(1200)).toBe('1.2k');
    expect(compact(24000)).toBe('24k');
  });

  it('invites the first follower', () => {
    expect(followersLabel(0)).toBe('Be the first to follow');
    expect(followersLabel(46)).toBe('46 following');
  });
});
