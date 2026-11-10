import type { MapPinResponse } from '@/api/generated/journey';

import type { Stop } from './stops';

/** The map library only draws on phones. In a browser the map screen shows the same stops as a list, in order. */
export const hasMap = false;

type Props = {
  pins: MapPinResponse[];
  stops: Stop[];
  selected: string | null;
  onSelect: (key: string | null) => void;
  inset: { top: number; bottom: number };
};

export function JourneyMap(_props: Props) {
  return null;
}
