import { View } from 'react-native';

import type { JourneyResponse } from '@/api/generated/journey';
import { daysBetween, today } from '@/lib/dates';
import { radius, useTheme } from '@/theme';
import { Card } from '@/ui/Card';
import { Ring } from '@/ui/Ring';
import { Txt } from '@/ui/Txt';

/** 5.5 Challenge: a progress ring and a grid of days show the arc. A missed day is just a gap, never a lost streak. */
export function ChallengeCard({ journey, days }: { journey: JourneyResponse; days: number[] }) {
  const { colors } = useTheme();
  const target = journey.targetDays ?? 0;
  if (target <= 0) return null;
  // `days` are the day numbers that have an entry, counted from the start date (day 1) by the API. They come
  // from each entry's date, not its label: a journey that counts in parts has "Part 3" on what may be day ten.
  const done = new Set(days.filter((n) => n >= 1 && n <= target));
  const todayNumber = journey.status === 'completed' ? target + 1 : daysBetween(journey.startDate, today()) + 1;
  const percent = Math.round((done.size / target) * 100);
  // Today counts as done once it has a check-in.
  const behind = done.has(todayNumber) ? todayNumber : todayNumber - 1;
  const left = Math.max(target - Math.max(behind, 0), 0);

  return (
    <Card style={{ alignSelf: 'stretch', marginTop: 18, padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Ring progress={done.size / target} emoji="🔥" size={70} />
        <View style={{ flex: 1 }}>
          <Txt variant="subtitle">
            {done.size} of {target} days
          </Txt>
          <Txt variant="caption" weight={500} color="muted" style={{ marginTop: 2 }}>
            {percent}% there{journey.status === 'completed' ? '' : left > 0 ? ` · ${left} ${left === 1 ? 'day' : 'days'} to go` : ' · last day'}
          </Txt>
        </View>
      </View>
      <View accessible accessibilityLabel={`Checked in on ${done.size} of ${target} days`} style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, marginHorizontal: -3 }}>
        {Array.from({ length: target }, (_, i) => i + 1).map((day) => {
          const checked = done.has(day);
          const missed = !checked && day < todayNumber;
          const isToday = day === todayNumber;
          return (
            <View key={day} style={{ width: '10%', aspectRatio: 1, padding: 3 }}>
              <View
                style={{
                  flex: 1,
                  borderRadius: radius.chip,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: checked ? colors.accent : colors.fill,
                  borderWidth: isToday && !checked ? 2 : 0,
                  borderColor: colors.text,
                  opacity: missed ? 0.5 : 1,
                }}>
                <Txt variant="tiny" style={{ color: checked ? colors.onAccent : missed ? colors.muted : colors.text }}>
                  {day}
                </Txt>
              </View>
            </View>
          );
        })}
      </View>
      <Txt variant="small" weight={500} color="muted" style={{ marginTop: 10 }}>
        Missed a day? No streaks to lose.
      </Txt>
    </Card>
  );
}
