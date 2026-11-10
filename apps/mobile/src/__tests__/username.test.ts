import { initials, normalizeUsername, usernameProblem } from '@/lib/username';

describe('usernames', () => {
  it('tidies what a person typed', () => {
    expect(normalizeUsername('  @Nora.Lind ')).toBe('nora.lind');
  });

  it('accepts ordinary names', () => {
    expect(usernameProblem('nora.lind')).toBeNull();
    expect(usernameProblem('maya_rides2')).toBeNull();
  });

  it('explains each rule in plain words', () => {
    expect(usernameProblem('no')).toBe('Use at least 3 characters.');
    expect(usernameProblem('a'.repeat(21))).toBe('Use 20 characters or fewer.');
    expect(usernameProblem('nora lind')).toBe('Use only letters, numbers, dots and underscores.');
    expect(usernameProblem('.nora')).toBe("Dots can't be first, last or doubled.");
    expect(usernameProblem('nora..lind')).toBe("Dots can't be first, last or doubled.");
  });

  it('makes initials for the picture placeholder', () => {
    expect(initials('Nora Lind')).toBe('NL');
    expect(initials(' maya ')).toBe('M');
    expect(initials('Ana Maria Costa')).toBe('AM');
    expect(initials('')).toBe('');
  });
});
