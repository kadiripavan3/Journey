/**
 * Every word a person reads or hears in the app, in one typed catalog.
 *
 * A message is a plain string, or, when it has a number, a name or any other moving part, a function that
 * takes the parts and returns the sentence. So each language keeps its own plurals and word order, and a
 * screen never glues pieces of a sentence together.
 *
 * To add a language (German, say):
 * 1. Write `src/words/de/`, with the same files as `src/words/en/`, and an `index.ts` that ends in
 *    `export const de: Words = { common, signIn, … };`. The type refuses a missing or misspelt key.
 * 2. Add it to `catalogs` below: `{ en, de }`. A regional variant is keyed by its full tag (`'pt-BR'`).
 * Nothing else changes: the phone's language picks the catalog once, when the app starts.
 */
import { en } from './en';

export type { Marked, Rich } from './rich';

/** The same shape with every exact English sentence widened to "some text", so another language fits it. */
type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends (...args: infer A) => infer R
        ? (...args: A) => Widen<R>
        : T extends readonly (infer U)[]
          ? readonly Widen<U>[]
          : T extends object
            ? { readonly [K in keyof T]: Widen<T[K]> }
            : T;

/** The catalog's shape: what every language has to say. */
export type Words = Widen<typeof en>;

const FALLBACK = 'en';
const catalogs: Record<string, Words> = { en };

/** The phone's language as a BCP 47 tag ("en-GB"). English when the phone won't say. */
function phoneLanguage(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || FALLBACK;
  } catch {
    return FALLBACK;
  }
}

const phone = phoneLanguage();
const language = phone.split('-')[0]!.toLowerCase();
const chosen = phone in catalogs ? phone : language in catalogs ? language : FALLBACK;

/** The words of the phone's language, or English when there is no catalog for it. */
export const words: Words = catalogs[chosen]!;

/**
 * The language the words are in, as a BCP 47 tag, for anything `Intl` formats: the phone's own tag when it is
 * that language ("en-GB"), otherwise the catalog's ("en"), so numbers and dates never disagree with the words.
 */
export const locale: string = language === chosen.split('-')[0]!.toLowerCase() ? phone : chosen;
