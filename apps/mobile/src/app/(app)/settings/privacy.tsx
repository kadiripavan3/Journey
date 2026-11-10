import { useRouter } from 'expo-router';
import { Ban, Eye, ImageOff } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGetBlocked } from '@/api/generated/journey';
import { visibility } from '@/features/journeys/visibility';
import { VisibilitySheet } from '@/features/journeys/VisibilitySheet';
import { useSettingsEditor } from '@/features/settings/useSettingsEditor';
import { PageProblem } from '@/features/states/PageProblem';
import { layout, useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { GroupLabel } from '@/ui/Heading';
import { Loading } from '@/ui/Loading';
import { NoteBox } from '@/ui/NoteBox';
import { Row, RowGroup, ToggleRow } from '@/ui/Rows';

/** 10.3 Privacy and safety: careful defaults, and you choose who sees each journey. */
export default function Privacy() {
  const router = useRouter();
  const { colors } = useTheme();
  const { settings, change } = useSettingsEditor();
  const blocked = useGetBlocked({ limit: 100 });
  const [choosing, setChoosing] = useState(false);
  const s = settings.data;
  const current = visibility(s?.defaultVisibility ?? 'public');

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppBar title="Privacy and safety" trailing={<View style={{ width: 40 }} />} />
      {!s ? (
        settings.isError ? <PageProblem error={settings.error} onRetry={() => void settings.refetch()} retrying={settings.isFetching} /> : <Loading offline={settings.isPaused} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          <GroupLabel style={{ marginHorizontal: layout.gutter }}>New journeys</GroupLabel>
          <RowGroup>
            <Row first icon={(c) => <Eye size={18} color={c} />} label="Start them as" note="You can change it for each journey" value={current.label} onPress={() => setChoosing(true)} />
          </RowGroup>
          <GroupLabel style={{ marginHorizontal: layout.gutter }}>Photos</GroupLabel>
          <RowGroup>
            <ToggleRow first locked label="Remove photo locations" note="Location data is stripped from every photo you upload" value />
          </RowGroup>
          <GroupLabel style={{ marginHorizontal: layout.gutter }}>People</GroupLabel>
          <RowGroup>
            <Row first icon={(c) => <Ban size={18} color={c} />} label="Blocked accounts" value={blocked.data ? `${blocked.data.items.length}${blocked.data.nextCursor ? '+' : ''}` : undefined} onPress={() => router.push('/settings/blocked')} />
          </RowGroup>
          <NoteBox icon={(c) => <ImageOff size={20} color={c} />} title="Never live" style={{ marginTop: 18, marginHorizontal: layout.barGutter }}>
            Journey never shares where you are right now. Places come only from entries you post.
          </NoteBox>
        </ScrollView>
      )}
      <VisibilitySheet visible={choosing} onClose={() => setChoosing(false)} title="Start new journeys as" value={current.id} onChange={(defaultVisibility) => change({ defaultVisibility })} />
    </SafeAreaView>
  );
}
