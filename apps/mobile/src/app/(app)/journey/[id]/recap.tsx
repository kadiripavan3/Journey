import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BookOpen, Share2, X } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGetRecap } from '@/api/generated/journey';
import { useLeave } from '@/features/navigation/useLeave';
import { JourneyShareSheet } from '@/features/sharing/ShareSheet';
import { PageProblem } from '@/features/states/PageProblem';
import { formatDay } from '@/lib/dates';
import { wentAway } from '@/lib/loading';
import { darkTheme, layout, radius, withAlpha } from '@/theme';
import { Button } from '@/ui/Button';
import { Emoji } from '@/ui/Emoji';
import { LightStatusBar } from '@/ui/LightStatusBar';
import { Loading } from '@/ui/Loading';
import { Photo } from '@/ui/Photo';
import { Pill } from '@/ui/Pill';
import { RoundButton } from '@/ui/RoundButton';
import { Stat } from '@/ui/Stat';
import { Txt } from '@/ui/Txt';

const STAGE = darkTheme.colors.stage;
const ON = darkTheme.colors.onPhoto;

/** 5.8 Recap: a finished journey gets a recap, made automatically: days, entries, places, photos and its best moments. */
export default function Recap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const recap = useGetRecap(id);
  const r = recap.data;
  const [sharing, setSharing] = useState(false);
  const leave = useLeave(`/journey/${id}`);

  return (
    <View style={{ flex: 1, backgroundColor: STAGE }}>
      <LightStatusBar />
      {r?.journey.coverUrl ? <Image source={{ uri: r.journey.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} /> : null}
      <LinearGradient colors={[withAlpha(STAGE, 0.5), withAlpha(STAGE, 0.1), withAlpha(STAGE, 0.75), withAlpha(STAGE, 0.96)]} locations={[0, 0.25, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1, justifyContent: 'space-between', paddingHorizontal: layout.rowGutter }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, marginHorizontal: -4 }}>
          <RoundButton tone="photo" label="Close" onPress={leave} icon={(c) => <X size={20} color={c} />} />
          <Emoji char="🎉" size={40} />
          <View style={{ width: 40 }} />
        </View>
        {!r || wentAway(recap) ? (
          recap.isError ? <PageProblem inset={false} tone="onPhoto" error={recap.error} onRetry={() => void recap.refetch()} retrying={recap.isFetching} /> : <Loading tone="onPhoto" offline={recap.isPaused} />
        ) : (
          <View style={{ gap: 12, paddingBottom: 12 }}>
            <Pill tone="photo" frost="blur" label={r.journey.status === 'completed' ? 'Journey complete' : 'So far'} />
            <Txt variant="displayLarge" accessibilityRole="header" style={{ color: ON }}>
              {r.journey.title}
            </Txt>
            <Txt variant="control" weight={500} style={{ color: ON, opacity: 0.84 }}>
              {r.journey.owner.displayName}
              {r.lastDay ? (r.lastDay === r.journey.startDate ? ` · ${formatDay(r.lastDay)}` : ` · ${formatDay(r.journey.startDate)} to ${formatDay(r.lastDay)}`) : ''}
            </Txt>
            <View style={{ flexDirection: 'row', marginTop: 4, paddingVertical: 14, borderRadius: radius.card, backgroundColor: darkTheme.colors.photoGlass, borderWidth: 1, borderColor: darkTheme.colors.photoGlassLine }}>
              <Stat size="title" color={ON} value={r.dayCount} label={r.dayCount === 1 ? 'day' : 'days'} />
              <Stat size="title" color={ON} value={r.entryCount} label={r.entryCount === 1 ? 'entry' : 'entries'} />
              <Stat size="title" color={ON} value={r.placeCount} label={r.placeCount === 1 ? 'place' : 'places'} onPress={r.placeCount > 0 ? () => router.push(`/journey/${id}/map`) : undefined} />
              <Stat size="title" color={ON} value={r.photoCount} label={r.photoCount === 1 ? 'photo' : 'photos'} />
            </View>
            {r.momentUrls.length > 0 ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {r.momentUrls.map((url) => (
                  <Photo key={url} uri={url} radius="field" style={{ flex: 1, height: 92, backgroundColor: darkTheme.colors.fill }} />
                ))}
              </View>
            ) : null}
            {r.journey.closingNote ? (
              <Txt variant="bodyLarge" italic style={{ color: ON, marginVertical: 4 }}>
                “{r.journey.closingNote}”
              </Txt>
            ) : null}
            {r.journey.shareUrl ? <Button label="Share recap" size="lg" block icon={(c) => <Share2 size={18} color={c} />} onPress={() => setSharing(true)} /> : null}
            <Button label="Read the whole journey" size="lg" variant={r.journey.shareUrl ? 'glass' : 'primary'} block icon={(c) => <BookOpen size={19} color={c} />} onPress={() => router.push(`/journey/${id}/timeline`)} />
          </View>
        )}
      </SafeAreaView>
      {r ? <JourneyShareSheet journey={r.journey} visible={sharing} onClose={() => setSharing(false)} recap={r} /> : null}
    </View>
  );
}
