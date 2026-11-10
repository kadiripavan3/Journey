import { catalogFor, locale, type Words, words } from '@/words';
import { en } from '@/words/en';

/** Every plain sentence in a catalog, by where it is kept: "common.back" → "Back". */
function sentences(value: unknown, path: string, into: Record<string, string> = {}): Record<string, string> {
  if (typeof value === 'string') into[path] = value;
  else if (value && typeof value === 'object') for (const [key, inner] of Object.entries(value)) sentences(inner, path ? `${path}.${key}` : key, into);
  return into;
}

describe('the catalog of words', () => {
  it('is English until another language is added', () => {
    expect(words).toBe(en);
    expect(locale.startsWith('en')).toBe(true);
    expect(words.common.back).toBe('Back');
  });

  it('picks a catalog by the language of the phone, and English when it has none', () => {
    // German words: the type makes it say everything English says, in whatever words it likes.
    const de: Words = { ...en, common: { ...en.common, back: 'Zurück' } };
    const available = { en, de };

    expect(catalogFor('de-AT', available)).toEqual({ words: de, locale: 'de-AT' });
    expect(catalogFor('de', available).words.common.back).toBe('Zurück');
    expect(catalogFor('en-GB', available)).toEqual({ words: en, locale: 'en-GB' });
    // No French yet: English, and dates and numbers written the English way too.
    expect(catalogFor('fr-FR', available)).toEqual({ words: en, locale: 'en' });
    // A regional catalog is for its region only.
    expect(catalogFor('pt-BR', { en, 'pt-BR': de }).words).toBe(de);
    expect(catalogFor('pt-PT', { en, 'pt-BR': de }).words).toBe(en);
  });

  it('has something to say under every key', () => {
    const all = sentences(en, '');
    expect(Object.keys(all).length).toBeGreaterThan(500);
    // The one row of "who can do what" that needs no second line.
    const empty = Object.entries(all).filter(([, text]) => text.trim() === '');
    expect(empty.map(([path]) => path)).toEqual(['shared.people.rules.2.note']);
  });

  it('keeps plurals and word order inside the sentence', () => {
    expect(words.story.quietDays(1)).toBe('1 quiet day');
    expect(words.story.quietDays(3)).toBe('3 quiet days');
    expect(words.journey.complete.summary(1, 2, 1)).toBe('1 day · 2 entries · 1 place');
    expect(words.home.caughtUp.all(1)).toBe("That's every new entry from the 1 journey you follow.");
    expect(words.entry.position(3, 14)).toBe('Entry 3 of 14');
    expect(words.entry.position(3, null)).toBe('Entry 3');
    expect(words.common.compact(1200)).toBe('1.2k');
  });

  it('joins facts that stand side by side, leaving out the ones that are missing', () => {
    expect(words.common.join(['Day 14', null, 'Hoi An', undefined, false, ''])).toBe('Day 14 · Hoi An');
    expect(words.common.spoken(['Start date', '', '3 Apr'])).toBe('Start date. 3 Apr');
  });

  it('marks the parts of a sentence that are drawn differently', () => {
    expect(words.activity.says.likes(words.activity.who('Alex', 'Nora', 2), 'Black sand')).toEqual([
      { mark: 'bold', text: 'Alex' },
      ' and ',
      { mark: 'bold', text: 'Nora' },
      ' liked ',
      { mark: 'bold', text: 'Black sand' },
    ]);
    expect(words.signIn.code.sentTo('maya@example.com')).toEqual(['Enter the code we sent to ', { mark: 'email', text: 'maya@example.com' }, '.']);
  });

  it('writes days and times the English way', () => {
    expect(words.dates.day(3, 3)).toBe('3 Apr');
    expect(words.dates.day(3, 3, 2025)).toBe('3 Apr 2025');
    expect(words.dates.dayLong(1, 3)).toBe('1 April');
    expect(words.dates.month(3, 2026)).toBe('April 2026');
    expect(words.dates.hour(19)).toBe('7:00 pm');
    expect(words.dates.hour(0)).toBe('12:00 am');
  });
});
