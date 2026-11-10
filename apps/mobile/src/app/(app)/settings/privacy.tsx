import { useRouter } from 'expo-router';
import { Ban, Check, Eye, ImageOff } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGetBlocked } from '@/api/generated/journey';
import { useSettingsEditor } from '@/journey/settings';
import { useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { Loading, Problem } from '@/ui/Bits';
import { GroupLabel } from '@/ui/Heading';
import { Row, RowGroup, ToggleRow } from '@/ui/Rows';
import { Sheet, SheetRow } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

const VISIBILITY = [
  { id: 'public', label: 'Public', note: 'Anyone. They can appear in Discover.' },
  { id: 'unlisted', label: 'Unlisted', note: 'Only people with the link.' },
  { id: 'private', label: 'Private', note: 'Only you.' },
] as const;

/** 10.3 Privacy and safety: careful defaults, and you choose who sees each journey. */
export default function Privacy() {
  const router = useRouter();
  const { colors } = useTheme();
  const { settings, change } = useSettingsEditor();
  const blocked = useGetBlocked();
  const [choosing, setChoosing] = useState(false);
  const s = settings.data;
  const current = VISIBILITY.find((v) => v.id === s?.defaultVisibility) ?? VISIBILITY[0];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppBar title="Privacy and safety" trailing={<View style={{ width: 40 }} />} />
      {settings.isPending ? (
        <Loading />
      ) : settings.isError || !s ? (
        <Problem error={settings.error} onRetry={() => void settings.refetch()} retrying={settings.isRefetching} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          <GroupLabel style={{ marginHorizontal: 22 }}>New journeys</GroupLabel>
          <RowGroup>
            <Row first icon={(c) => <Eye size={18} color={c} />} label="Start them as" note="You can change it for each journey" value={current.label} onPress={() => setChoosing(true)} />
          </RowGroup>
          <GroupLabel style={{ marginHorizontal: 22 }}>Photos</GroupLabel>
          <RowGroup>
            <ToggleRow first locked label="Remove photo locations" note="Location data is stripped from every photo you upload" value />
          </RowGroup>
          <GroupLabel style={{ marginHorizontal: 22 }}>People</GroupLabel>
          <RowGroup>
            <Row first icon={(c) => <Ban size={18} color={c} />} label="Blocked accounts" value={blocked.data ? String(blocked.data.length) : undefined} onPress={() => router.push('/settings/blocked' as never)} />
          </RowGroup>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 18, marginHorizontal: 16, padding: 14, borderRadius: 18, backgroundColor: colors.fill }}>
            <ImageOff size={20} color={colors.text} />
            <View style={{ flex: 1 }}>
              <Txt weight={800} style={{ fontSize: 14.5, lineHeight: 20 }}>
                Never live
              </Txt>
              <Txt style={{ fontSize: 13.5, lineHeight: 19.5 }}>Journey never shares where you are right now. Places come only from entries you post.</Txt>
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
