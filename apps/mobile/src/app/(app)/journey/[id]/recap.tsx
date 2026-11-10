import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BookOpen, X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGetRecap } from '@/api/generated/journey';
import { formatDay } from '@/lib/dates';
import { darkTheme } from '@/theme';
import { Loading, Photo, Pill, Problem } from '@/ui/Bits';
import { Button } from '@/ui/Button';
import { Emoji } from '@/ui/Emoji';
import { RoundButton } from '@/ui/RoundButton';
import { Txt } from '@/ui/Txt';

const STAGE = '#08080A';
const ON = darkTheme.colors.onPhoto;

/** 5.8 Recap: a finished journey gets a recap, made automatically: days, entries, places, photos and its best moments. */
export default function Recap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const recap = useGetRecap(id);
  const r = recap.data;
  const leave = () => (router.canGoBack() ? router.back() : router.replace(`/journey/${id}` as never));

  return (
    <View style={{ flex: 1, backgroundColor: STAGE }}>
      <StatusBar style="light" />
      {r?.journey.coverUrl ? <Image source={{ uri: r.journey.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} /> : null}
      <LinearGradient colors={['rgba(8,8,10,0.5)', 'rgba(8,8,10,0.1)', 'rgba(8,8,10,0.75)', 'rgba(8,8,10,0.96)']} locations={[0, 0.25, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1, justifyContent: 'space-between', paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, marginHorizontal: -4 }}>
          <RoundButton tone="photo" label="Close" onPress={leave} icon={(c) => <X size={20} color={c} />} />
          <Emoji char="🎉" size={40} />
          <View style={{ width: 40 }} />
        </View>
        {recap.isError ? (
          <Problem error={recap.error} onRetry={() => void recap.refetch()} retrying={recap.isRefetching} />
        ) : !r ? (
          <Loading />
        ) : (
          <View style={{ gap: 12, paddingBottom: 12 }}>
            <Pill tone="photo" label={r.journey.status === 'completed' ? 'Journey complete' : 'So far'} />
            <Txt accessibilityRole="header" weight={800} style={{ fontSize: 36, lineHeight: 38, letterSpacing: -1.3, color: ON }}>
              {r.journey.title}
            </Txt>
            <Txt style={{ fontSize: 14.5, lineHeight: 20, color: ON, opacity: 0.84 }}>
              {r.journey.owner.displayName}
              {r.lastDay ? (r.lastDay === r.journey.startDate ? ` · ${formatDay(r.lastDay)}` : ` · ${formatDay(r.journey.startDate)} to ${formatDay(r.lastDay)}`) : ''}
            </Txt>
            <View style={{ flexDirection: 'row', marginTop: 4, paddingVertical: 14, borderRadius: 20, backgroundColor: darkTheme.colors.photoGlass, borderWidth: 1, borderColor: darkTheme.colors.photoGlassLine }}>
              <Stat value={r.dayCount} label={r.dayCount === 1 ? 'day' : 'days'} />
              <Stat value={r.entryCount} label={r.entryCount === 1 ? 'entry' : 'entries'} />
              <Stat value={r.placeCount} label={r.placeCount === 1 ? 'place' : 'places'} />
              <Stat value={r.photoCount} label={r.photoCount === 1 ? 'photo' : 'photos'} />
            </View>
            {r.momentUrls.length > 0 ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {r.momentUrls.map((url) => (
                  <Photo key={url} uri={url} radius={16} style={{ flex: 1, height: 92, backgroundColor: darkTheme.colors.fill }} />
                ))}
              </View>
            ) : null}
            {r.journey.closingNote ? (
              <Txt weight={600} style={{ fontSize: 16, lineHeight: 24, color: ON, marginVertical: 4 }}>
                “{r.journey.closingNote}”
              </Txt>
            ) : null}
            <Button label="Read the whole journey" size="lg" block icon={(c) => <BookOpen size={19} color={c} />} onPress={() => router.push(`/journey/${id}/timeline` as never)} />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View accessible accessibilityLabel={`${value} ${label}`} style={{ flex: 1, alignItems: 'center' }}>
      <Txt weight={800} style={{ fontSize: 22, lineHeight: 27, letterSpacing: -0.5, color: ON }}>
        {value}
      </Txt>
      <Txt weight={600} style={{ fontSize: 12, lineHeight: 16, color: ON, opacity: 0.8 }}>
        {label}
      </Txt>
    </View>
  );
}
