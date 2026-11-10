import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { useSettingsEditor } from '@/journey/settings';
import { useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { Loading, Problem } from '@/ui/Bits';
import { GroupLabel } from '@/ui/Heading';
import { RowGroup, ToggleRow } from '@/ui/Rows';
import { Txt } from '@/ui/Txt';

/** 10.2 Notification settings: every type has its own switch. */
export default function NotificationSettings() {
  const { colors } = useTheme();
  const { settings, save, change } = useSettingsEditor();
  const s = settings.data;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppBar title="Notifications" trailing={<View style={{ width: 40 }} />} />
      {settings.isPending ? (
        <Loading />
      ) : settings.isError || !s ? (
        <Problem error={settings.error} onRetry={() => void settings.refetch()} retrying={settings.isRefetching} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          {save.isError ? (
            <Txt variant="caption" color="danger" center accessibilityLiveRegion="polite" style={{ marginTop: 8, marginHorizontal: 24 }}>
              {messageFor(save.error)}
            </Txt>
          ) : null}
          <GroupLabel style={{ marginHorizontal: 22 }}>Tell me about</GroupLabel>
          <RowGroup>
            <ToggleRow first label="New entries" note="Grouped per journey" value={s.notifyNewEntries} onChange={(v) => change({ notifyNewEntries: v })} />
            <ToggleRow label="Finished journeys" note="With the recap" value={s.notifyCompleted} onChange={(v) => change({ notifyCompleted: v })} />
            <ToggleRow label="Comments and replies" value={s.notifyComments} onChange={(v) => change({ notifyComments: v })} />
            <ToggleRow label="Followers" value={s.notifyFollowers} onChange={(v) => change({ notifyFollowers: v })} />
            <ToggleRow label="Likes" note="In one batch" value={s.notifyLikes} onChange={(v) => change({ notifyLikes: v })} />
          </RowGroup>
          <GroupLabel style={{ marginHorizontal: 22 }}>Once a week</GroupLabel>
          <RowGroup>
            <ToggleRow first label="Weekly digest" note="In one message" value={s.weeklyDigest} onChange={(v) => change({ weeklyDigest: v })} />
            <ToggleRow label="Also send it by email" value={s.digestEmail} onChange={(v) => change({ digestEmail: v })} />
          </RowGroup>
          <GroupLabel style={{ marginHorizontal: 22 }}>Reminders</GroupLabel>
          <RowGroup>
            <ToggleRow first label="Gentle reminders" note="To add an entry. At most one a day." value={s.reminders} onChange={(v) => change({ reminders: v })} />
          </RowGroup>
          <Txt color="muted" style={{ fontSize: 12.5, lineHeight: 18, marginTop: 14, marginHorizontal: 22 }}>
            Your choices are saved now. Notifications on your phone arrive when push is connected; until then everything shows in Activity.
          </Txt>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
