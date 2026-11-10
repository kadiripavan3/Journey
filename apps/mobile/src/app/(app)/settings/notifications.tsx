import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { HOURS, hourLabel } from '@/features/notifications/hours';
import { ThisPhone } from '@/features/notifications/ThisPhone';
import { useSettingsEditor } from '@/features/settings/useSettingsEditor';
import { PageProblem } from '@/features/states/PageProblem';
import { layout, useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { GroupLabel } from '@/ui/Heading';
import { Loading } from '@/ui/Loading';
import { Row, RowGroup, ToggleRow } from '@/ui/Rows';
import { Sheet, SheetRow } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

/** 10.2 Notification settings: every type has its own switch, and reminders arrive at the hour you choose. */
export default function NotificationSettings() {
  const { colors } = useTheme();
  const { settings, save, change } = useSettingsEditor();
  const [choosingHour, setChoosingHour] = useState(false);
  const s = settings.data;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppBar title="Notifications" trailing={<View style={{ width: 40 }} />} />
      {!s ? (
        settings.isError ? <PageProblem error={settings.error} onRetry={() => void settings.refetch()} retrying={settings.isFetching} /> : <Loading offline={settings.isPaused} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          {save.isError ? (
            <Txt variant="caption" color="danger" center accessibilityLiveRegion="polite" style={{ marginTop: 8, marginHorizontal: 24 }}>
              {messageFor(save.error)}
            </Txt>
          ) : null}
          <GroupLabel style={{ marginHorizontal: layout.gutter }}>Tell me about</GroupLabel>
          <RowGroup>
            <ToggleRow first label="New entries" note="Grouped per journey" value={s.notifyNewEntries} onChange={(v) => change({ notifyNewEntries: v })} />
            <ToggleRow label="Finished journeys" note="With the recap" value={s.notifyCompleted} onChange={(v) => change({ notifyCompleted: v })} />
            <ToggleRow label="Comments and replies" value={s.notifyComments} onChange={(v) => change({ notifyComments: v })} />
            <ToggleRow label="Followers and invitations" value={s.notifyFollowers} onChange={(v) => change({ notifyFollowers: v })} />
            <ToggleRow label="Likes" note="In one batch, at most once an hour" value={s.notifyLikes} onChange={(v) => change({ notifyLikes: v })} />
          </RowGroup>
          <GroupLabel style={{ marginHorizontal: layout.gutter }}>Once a week</GroupLabel>
          <RowGroup>
            <ToggleRow first label="Weekly digest" note="On Sundays, in one message" value={s.weeklyDigest} onChange={(v) => change({ weeklyDigest: v })} />
            <ToggleRow label="Also send it by email" value={s.digestEmail} onChange={(v) => change({ digestEmail: v })} />
          </RowGroup>
          <GroupLabel style={{ marginHorizontal: layout.gutter }}>Reminders</GroupLabel>
          <RowGroup>
            <ToggleRow first label="Gentle reminders" note="To add an entry. At most one a day." value={s.reminders} onChange={(v) => change({ reminders: v })} />
            <Row label="Challenge check-in time" value={hourLabel(s.reminderHour)} onPress={() => setChoosingHour(true)} />
          </RowGroup>
          <ThisPhone />
          <Sheet visible={choosingHour} onClose={() => setChoosingHour(false)} title="Challenge check-in time" subtitle="Reminders arrive around this time of your day, at most one a day." tall>
            {HOURS.map((hour, index) => (
              <SheetRow
                key={hour}
                first={index === 0}
                label={hourLabel(hour)}
                trailing={hour === s.reminderHour ? <Check size={20} color={colors.text} strokeWidth={2.6} /> : undefined}
                onPress={() => {
                  setChoosingHour(false);
                  if (hour !== s.reminderHour) change({ reminderHour: hour });
                }}
              />
            ))}
          </Sheet>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
