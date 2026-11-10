import { createContext, type ReactNode, use, useMemo, useState } from 'react';

import type { LocalPhoto } from '@/api/upload';
import { today } from '@/lib/dates';

/** What the three "new journey" steps collect before the journey is created. */
export type NewJourneyDraft = {
  template: string;
  title: string;
  description: string;
  /** "2026-04-01" */
  startDate: string;
  /** Null until the person picks one; the template's own category is used until then. */
  category: string | null;
  tags: string;
  cover: LocalPhoto | null;
  visibility: 'public' | 'unlisted' | 'private';
  /** Null until the person picks one; the template's own style is used until then. */
  labelStyle: 'day' | 'part' | null;
};

const empty = (): NewJourneyDraft => ({
  template: 'trip',
  title: '',
  description: '',
  startDate: today(),
  category: null,
  tags: '',
  cover: null,
  visibility: 'public',
  labelStyle: null,
});

type Value = { draft: NewJourneyDraft; change: (patch: Partial<NewJourneyDraft>) => void; reset: (template?: string) => void };

const NewJourneyContext = createContext<Value | null>(null);

/** Holds the new journey while the person moves between its steps, so going back never loses what they typed. */
export function NewJourneyProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<NewJourneyDraft>(empty);
  const value = useMemo<Value>(
    () => ({
      draft,
      change: (patch) => setDraft((now) => ({ ...now, ...patch })),
      reset: (template) => setDraft({ ...empty(), ...(template ? { template } : {}) }),
    }),
    [draft],
  );
  return <NewJourneyContext value={value}>{children}</NewJourneyContext>;
}

export function useNewJourney(): Value {
  const value = use(NewJourneyContext);
  if (!value) throw new Error('useNewJourney must be used inside NewJourneyProvider');
  return value;
}

/** "#iceland, roadtrip  #VanLife" becomes ["iceland", "roadtrip", "vanlife"]: up to five, no repeats. */
export function parseTags(text: string): string[] {
  const tags = text
    .toLowerCase()
    .split(/[\s,#]+/)
    .map((tag) => tag.replace(/[^\p{L}\p{N}_-]/gu, ''))
    .filter(Boolean);
  return [...new Set(tags)].slice(0, 5);
}
