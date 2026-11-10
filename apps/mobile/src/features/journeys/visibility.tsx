import { Globe, Link as LinkIcon, Lock } from 'lucide-react-native';
import type { ReactNode } from 'react';

import { words } from '@/words';

/** Who can see a journey. */
export type Visibility = 'public' | 'unlisted' | 'private';

type Choice = {
  id: Visibility;
  label: string;
  /** Who sees it, in a few words. */
  note: string;
  /** The same with one more thought, shown where a new journey's visibility is chosen. */
  longNote: string;
  /** What a card says in place of a follower count. */
  badge: string;
  icon: (color: string) => ReactNode;
};

/** The three ways a journey can be seen, in the words the app uses everywhere (`words.journeys.visibility`). */
export const VISIBILITY: readonly Choice[] = [
  { id: 'public', ...words.journeys.visibility.public, icon: (c) => <Globe size={20} color={c} /> },
  { id: 'unlisted', ...words.journeys.visibility.unlisted, icon: (c) => <LinkIcon size={20} color={c} /> },
  { id: 'private', ...words.journeys.visibility.private, icon: (c) => <Lock size={20} color={c} /> },
];

export function visibility(id: string): Choice {
  return VISIBILITY.find((choice) => choice.id === id) ?? VISIBILITY[0]!;
}
