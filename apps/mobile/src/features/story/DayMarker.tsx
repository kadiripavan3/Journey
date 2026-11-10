import { Star } from 'lucide-react-native';
import { View } from 'react-native';

import type { EntryResponse } from '@/api/generated/journey';
import { formatDay } from '@/lib/dates';
import { radius, useTheme } from '@/theme';
import { Txt } from '@/ui/Txt';
import { words } from '@/words';

/** The dot on the line where a day starts: "Day 12", its place and date. A milestone gets a star. */
export function DayMarker({ entry }: { entry: EntryResponse }) {
  const { colors } = useTheme();
  const detail = words.common.join([entry.placeName, formatDay(entry.happenedOn)]);
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={words.story.daySpoken(entry.label, entry.isMilestone, detail)} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingLeft: 34 }}>
      {entry.isMilestone ? (
        <View style={{ position: 'absolute', left: -2, top: -4, width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
          <View style={{ width: 24, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}>
            <Star size={13} color={colors.onAccent} fill={colors.onAccent} />
          </View>
        </View>
      ) : (
        <View style={{ position: 'absolute', left: 4, top: 3, width: 16, height: 16, borderRadius: radius.pill, backgroundColor: colors.bg, borderWidth: 3, borderColor: colors.text }} />
      )}
      <Txt variant="subheading">
        {words.common.join([entry.label, entry.isMilestone ? words.entry.milestone : null])}
      </Txt>
      <Txt variant="footnote" numberOfLines={1} color="muted" style={{ flex: 1 }}>
        {detail}
      </Txt>
    </View>
  );
}
