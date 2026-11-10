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
import { words } from '@/words';

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
      <AppBar title={words.settings.privacyPage.title} trailing={<View style={{ width: 40 }} />} />
      {!s ? (
        settings.isError ? <PageProblem error={settings.error} onRetry={() => void settings.refetch()} retrying={settings.isFetching} /> : <Loading offline={settings.isPaused} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          <GroupLabel style={{ marginHorizontal: layout.gutter }}>{words.settings.privacyPage.newJourneys}</GroupLabel>
          <RowGroup>
            <Row first icon={(c) => <Eye size={18} color={c} />} label={words.settings.privacyPage.startAs.label} note={words.settings.privacyPage.startAs.note} value={current.label} onPress={() => setChoosing(true)} />
          </RowGroup>
          <GroupLabel style={{ marginHorizontal: layout.gutter }}>{words.settings.privacyPage.photos}</GroupLabel>
          <RowGroup>
            <ToggleRow first locked label={words.settings.privacyPage.removeLocations.label} note={words.settings.privacyPage.removeLocations.note} value />
          </RowGroup>
          <GroupLabel style={{ marginHorizontal: layout.gutter }}>{words.settings.privacyPage.people}</GroupLabel>
          <RowGroup>
            <Row first icon={(c) => <Ban size={18} color={c} />} label={words.settings.privacyPage.blocked} value={blocked.data ? `${blocked.data.items.length}${blocked.data.nextCursor ? '+' : ''}` : undefined} onPress={() => router.push('/settings/blocked')} />
          </RowGroup>
          <NoteBox icon={(c) => <ImageOff size={20} color={c} />} title={words.settings.privacyPage.neverLive.title} style={{ marginTop: 18, marginHorizontal: layout.barGutter }}>
            {words.settings.privacyPage.neverLive.body}
          </NoteBox>
        </ScrollView>
      )}
      <VisibilitySheet visible={choosing} onClose={() => setChoosing(false)} title={words.settings.privacyPage.startAs.title} value={current.id} onChange={(defaultVisibility) => change({ defaultVisibility })} />
    </SafeAreaView>
  );
}
