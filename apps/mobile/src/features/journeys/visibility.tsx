import { Globe, Link as LinkIcon, Lock } from 'lucide-react-native';
import type { ReactNode } from 'react';

/** Who can see a journey. */
export type Visibility = 'public' | 'unlisted' | 'private';

type Choice = {
  id: Visibility;
  label: string;
  /** Who sees it, in a few words. */
  note: string;
  /** One more thought, shown where a new journey's visibility is chosen. */
  hint: string;
  /** What a card says in place of a follower count. */
  badge: string;
  icon: (color: string) => ReactNode;
};

/** The three ways a journey can be seen, in the words the app uses everywhere. */
export const VISIBILITY: readonly Choice[] = [
  { id: 'public', label: 'Public', note: 'Anyone. It can appear in Discover.', hint: '', badge: 'Public', icon: (c) => <Globe size={20} color={c} /> },
  { id: 'unlisted', label: 'Unlisted', note: 'Only people with the link.', hint: 'Good for family.', badge: 'Unlisted', icon: (c) => <LinkIcon size={20} color={c} /> },
  { id: 'private', label: 'Private', note: 'Only you.', hint: 'A journal you can publish later.', badge: 'Only you', icon: (c) => <Lock size={20} color={c} /> },
];

export function visibility(id: string): Choice {
  return VISIBILITY.find((choice) => choice.id === id) ?? VISIBILITY[0]!;
}
