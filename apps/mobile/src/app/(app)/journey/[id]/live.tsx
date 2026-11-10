import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Camera, X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGetJourney } from '@/api/generated/journey';
import { darkTheme } from '@/theme';
import { Loading, Pill, Problem } from '@/ui/Bits';
import { Button } from '@/ui/Button';
import { RoundButton } from '@/ui/RoundButton';
import { Txt } from '@/ui/Txt';

const STAGE = '#08080A';
const WHO = {
  public: { pill: 'Public', title: 'is live', note: "Add your first entry to get it going. Once it has a cover and three entries, people can find it in Discover." },
  unlisted: { pill: 'Unlisted', title: 'is ready', note: 'Add your first entry to get it going. Only people you give the link to will see it.' },
  private: { pill: 'Private', title: 'is ready', note: 'Add your first entry to get it going. Only you can see it until you decide to publish.' },
} as const;

/** 7.7 Journey is live: the journey exists. The next step is the first entry. Sharing the link arrives with share pages. */
export default function JourneyLive() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const journey = useGetJourney(id);
  const j = journey.data;
  const leave = () => router.replace(`/journey/${id}` as never);

  return (
    <View style={{ flex: 1, backgroundColor: STAGE }}>
      <StatusBar style="light" />
      {j?.coverUrl ? <Image source={{ uri: j.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} /> : null}
      <LinearGradient
        colors={j?.coverUrl ? ['rgba(8,8,10,0.45)', 'rgba(8,8,10,0)', 'rgba(8,8,10,0)', 'rgba(8,8,10,0.82)', 'rgba(8,8,10,0.95)'] : [darkTheme.colors.accentSoft, STAGE, STAGE, STAGE, STAGE]}
        locations={[0, 0.22, 0.36, 0.64, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={{ flex: 1, justifyContent: 'space-between', paddingHorizontal: 20 }}>
        <View style={{ paddingTop: 8, marginLeft: -4 }}>
          <RoundButton tone="photo" label="Close" onPress={leave} icon={(c) => <X size={20} color={c} />} />
        </View>
        {journey.isError ? (
          <Problem error={journey.error} onRetry={() => void journey.refetch()} retrying={journey.isRefetching} />
        ) : !j ? (
          <Loading />
        ) : (
          <View style={{ gap: 12, paddingBottom: 12 }}>
            <Pill tone="photo" label={`${j.labelStyle === 'day' ? 'Day 1' : 'Part 1'} · ${WHO[j.visibility].pill}`} />
            <Txt accessibilityRole="header" weight={800} style={{ fontSize: 36, lineHeight: 38, letterSpacing: -1.3, color: darkTheme.colors.onPhoto }}>
              {j.title} {WHO[j.visibility].title}
            </Txt>
            <Txt style={{ fontSize: 15.5, lineHeight: 23, color: darkTheme.colors.onPhoto, opacity: 0.84, marginBottom: 8 }}>{WHO[j.visibility].note}</Txt>
            <Button label="Add your first entry" size="lg" block icon={(c) => <Camera size={19} color={c} strokeWidth={2.4} />} onPress={() => router.replace(`/journey/${id}/add` as never)} />
            <Button label="Maybe later" size="lg" variant="glass" block onPress={leave} />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}
