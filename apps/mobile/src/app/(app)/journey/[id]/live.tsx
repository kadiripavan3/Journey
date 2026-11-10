import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, Share2, X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { useGetJourney } from '@/api/generated/journey';
import { visibility } from '@/features/journeys/visibility';
import { shareLink } from '@/lib/share';
import { darkTheme, layout, withAlpha } from '@/theme';
import { Button } from '@/ui/Button';
import { LightStatusBar } from '@/ui/LightStatusBar';
import { Loading } from '@/ui/Loading';
import { Pill } from '@/ui/Pill';
import { Problem } from '@/ui/Problem';
import { RoundButton } from '@/ui/RoundButton';
import { Txt } from '@/ui/Txt';

const STAGE = darkTheme.colors.stage;
const WHO = {
  public: { title: 'is live', note: 'Share the link so friends can follow from day one. Once it has a cover and three entries, people can also find it in Discover.' },
  unlisted: { title: 'is ready', note: 'Only people you give the link to will see it. Share it with the ones you want along.' },
  private: { title: 'is ready', note: 'Add your first entry to get it going. Only you can see it until you decide to publish.' },
} as const;

/** 7.7 Journey is live: the journey exists and has a link. Two next steps: add the first entry, or share the link. */
export default function JourneyLive() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const journey = useGetJourney(id);
  const j = journey.data;
  const leave = () => router.replace(`/journey/${id}`);

  return (
    <View style={{ flex: 1, backgroundColor: STAGE }}>
      <LightStatusBar />
      {j?.coverUrl ? <Image source={{ uri: j.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} /> : null}
      <LinearGradient
        colors={j?.coverUrl ? [withAlpha(STAGE, 0.45), withAlpha(STAGE, 0), withAlpha(STAGE, 0), withAlpha(STAGE, 0.82), withAlpha(STAGE, 0.95)] : [darkTheme.colors.accentSoft, STAGE, STAGE, STAGE, STAGE]}
        locations={[0, 0.22, 0.36, 0.64, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={{ flex: 1, justifyContent: 'space-between', paddingHorizontal: layout.rowGutter }}>
        <View style={{ paddingTop: 8, marginLeft: -4 }}>
          <RoundButton tone="photo" label="Close" onPress={leave} icon={(c) => <X size={20} color={c} />} />
        </View>
        {journey.isError ? (
          <Problem message={messageFor(journey.error)} onRetry={() => void journey.refetch()} retrying={journey.isRefetching} />
        ) : !j ? (
          <Loading />
        ) : (
          <View style={{ gap: 12, paddingBottom: 12 }}>
            <Pill tone="photo" frost="blur" label={`${j.labelStyle === 'day' ? 'Day 1' : 'Part 1'} · ${visibility(j.visibility).label}`} />
            <Txt variant="displayLarge" accessibilityRole="header" style={{ color: darkTheme.colors.onPhoto }}>
              {j.title} {WHO[j.visibility].title}
            </Txt>
            <Txt variant="lead" style={{ color: darkTheme.colors.onPhoto, opacity: 0.84, marginBottom: 8 }}>{WHO[j.visibility].note}</Txt>
            <Button label="Add your first entry" size="lg" block icon={(c) => <Camera size={19} color={c} strokeWidth={2.4} />} onPress={() => router.replace(`/journey/${id}/add`)} />
            {j.shareUrl ? (
              <Button label="Share the link" size="lg" variant="glass" block icon={(c) => <Share2 size={18} color={c} />} onPress={() => j.shareUrl && void shareLink(`${j.title} on Journey`, j.shareUrl)} />
            ) : (
              <Button label="Maybe later" size="lg" variant="glass" block onPress={leave} />
            )}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}
