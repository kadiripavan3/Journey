import type { ReactNode } from 'react';

import { Txt } from './Txt';

/** The small capital line above an entry's title: "DAY 14 · HOI AN". */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <Txt variant="label" color="accentText" numberOfLines={1}>
      {children}
    </Txt>
  );
}
