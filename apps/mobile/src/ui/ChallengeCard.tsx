import { View } from 'react-native';

import type { EntryResponse, JourneyResponse } from '@/api/generated/journey';
import { daysBetween, today } from '@/lib/dates';
import { useTheme } from '@/theme';

import { Card } from './Bits';
import { Ring } from './Ring';
import { Txt } from './Txt';

/** 5.5 Challenge: a progress ring and a grid of days show the arc. A missed day is just a gap, never a lost streak. */
export function ChallengeCard({ journey, entries }: { journey: JourneyResponse; entries: EntryResponse[] }) {
  const { colors } = useTheme();
  const target = journey.targetDays ?? 0;
  if (target <= 0) return null;
  const done = new Set(entries.map((entry) => entry.number).filter((n) => n >= 1 && n <= target));
  // Day 1 is the start date, so today's number is the days since then plus one.
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
          <Txt weight={800} style={{ fontSize: 19, lineHeight: 24, letterSpacing: -0.4 }}>
            {done.size} of {target} days
          </Txt>
          <Txt color="muted" style={{ fontSize: 13, lineHeight: 18, marginTop: 2 }}>
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
                  borderRadius: 9,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: checked ? colors.accent : colors.fill,
                  borderWidth: isToday && !checked ? 2 : 0,
                  borderColor: colors.text,
                  opacity: missed ? 0.5 : 1,
                }}>
                <Txt weight={700} style={{ fontSize: 11.5, lineHeight: 14, color: checked ? colors.onAccent : missed ? colors.muted : colors.text }}>
                  {day}
                </Txt>
              </View>
            </View>
          );
        })}
      </View>
      <Txt color="muted" style={{ fontSize: 12, lineHeight: 17, marginTop: 10 }}>
        Missed a day? No streaks to lose.
      </Txt>
    </Card>
  );
}
