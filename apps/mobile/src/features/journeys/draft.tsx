import { createContext, type ReactNode, use, useCallback, useMemo, useState } from 'react';

import type { LocalPhoto } from '@/api/upload';
import { today } from '@/lib/dates';
import { newClientId } from '@/lib/ids';

import type { Visibility } from './visibility';

/** What the three "new journey" steps collect before the journey is created. */
export type NewJourneyDraft = {
  /** Made up when the draft starts, and sent with it: creating the same draft twice makes one journey. */
  clientId: string;
  template: string;
  title: string;
  description: string;
  /** "2026-04-01" */
  startDate: string;
  /** Null until the person picks one; the template's own category is used until then. */
  category: string | null;
  tags: string;
  cover: LocalPhoto | null;
  /** Null until the person picks one; what they chose in Privacy and safety is used until then. */
  visibility: Visibility | null;
  /** Null until the person picks one; the template's own style is used until then. */
  labelStyle: 'day' | 'part' | null;
};

const empty = (): NewJourneyDraft => ({
  clientId: newClientId(),
  template: 'trip',
  title: '',
  description: '',
  startDate: today(),
  category: null,
  tags: '',
  cover: null,
  visibility: null,
  labelStyle: null,
});

type Value = { draft: NewJourneyDraft; change: (patch: Partial<NewJourneyDraft>) => void; reset: (template?: string) => void };

const NewJourneyContext = createContext<Value | null>(null);

/** Holds the new journey while the person moves between its steps, so going back never loses what they typed. */
export function NewJourneyProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<NewJourneyDraft>(empty);
  // `change` and `reset` stay the same from one drawing to the next, so a step can depend on them.
  const change = useCallback<Value['change']>((patch) => setDraft((now) => ({ ...now, ...patch })), []);
  const reset = useCallback<Value['reset']>((template) => setDraft({ ...empty(), ...(template ? { template } : {}) }), []);
  const value = useMemo<Value>(() => ({ draft, change, reset }), [draft, change, reset]);
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
