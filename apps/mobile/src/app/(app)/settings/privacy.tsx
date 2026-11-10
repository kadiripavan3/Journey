import { useRouter } from 'expo-router';
import { Ban, Check, Eye, ImageOff } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { useGetBlocked } from '@/api/generated/journey';
import { VISIBILITY, visibility } from '@/features/journeys/visibility';
import { useSettingsEditor } from '@/features/settings/useSettingsEditor';
import { layout, radius, useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { GroupLabel } from '@/ui/Heading';
import { Loading } from '@/ui/Loading';
import { Problem } from '@/ui/Problem';
import { Row, RowGroup, ToggleRow } from '@/ui/Rows';
import { Sheet, SheetRow } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

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
      {settings.isPending ? (
        <Loading />
      ) : settings.isError || !s ? (
        <Problem message={messageFor(settings.error)} onRetry={() => void settings.refetch()} retrying={settings.isRefetching} />
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
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 18, marginHorizontal: 16, padding: 14, borderRadius: radius.photo, backgroundColor: colors.fill }}>
            <ImageOff size={20} color={colors.text} />
            <View style={{ flex: 1 }}>
              <Txt variant="control" weight={800}>
                Never live
              </Txt>
              <Txt variant="note">Journey never shares where you are right now. Places come only from entries you post.</Txt>
            </View>
          </View>
        </ScrollView>
      )}
      <Sheet visible={choosing} onClose={() => setChoosing(false)} title="Start new journeys as">
        {VISIBILITY.map((v, index) => (
          <SheetRow
            key={v.id}
            first={index === 0}
            label={v.label}
            note={v.note}
            trailing={v.id === current.id ? <Check size={20} color={colors.text} strokeWidth={2.6} /> : undefined}
            onPress={() => {
              change({ defaultVisibility: v.id });
              setChoosing(false);
            }}
          />
        ))}
      </Sheet>
    </SafeAreaView>
  );
}
