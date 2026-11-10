import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, Share2, X } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGetJourney } from '@/api/generated/journey';
import { visibility } from '@/features/journeys/visibility';
import { JourneyShareSheet } from '@/features/sharing/ShareSheet';
import { PageProblem } from '@/features/states/PageProblem';
import { darkTheme, layout, withAlpha } from '@/theme';
import { Button } from '@/ui/Button';
import { LightStatusBar } from '@/ui/LightStatusBar';
import { Loading } from '@/ui/Loading';
import { Pill } from '@/ui/Pill';
import { RoundButton } from '@/ui/RoundButton';
import { Txt } from '@/ui/Txt';
import { words } from '@/words';

const STAGE = darkTheme.colors.stage;

/** 7.7 Journey is live: the journey exists and has a link. Two next steps: add the first entry, or share the link. */
export default function JourneyLive() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const journey = useGetJourney(id);
  const j = journey.data;
  const leave = () => router.replace(`/journey/${id}`);
  const [sharing, setSharing] = useState(false);

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
          <RoundButton tone="photo" label={words.common.close} onPress={leave} icon={(c) => <X size={20} color={c} />} />
        </View>
        {!j ? (
          journey.isError ? <PageProblem inset={false} tone="onPhoto" error={journey.error} onRetry={() => void journey.refetch()} retrying={journey.isFetching} /> : <Loading tone="onPhoto" offline={journey.isPaused} />
        ) : (
          <View style={{ gap: 12, paddingBottom: 12 }}>
            <Pill tone="photo" frost="blur" label={words.common.join([words.journey.live.firstLabel(j.labelStyle === 'day'), visibility(j.visibility).label])} />
            <Txt variant="displayLarge" accessibilityRole="header" style={{ color: darkTheme.colors.onPhoto }}>
              {words.journey.live.title[j.visibility](j.title)}
            </Txt>
            <Txt variant="lead" style={{ color: darkTheme.colors.onPhoto, opacity: 0.84, marginBottom: 8 }}>{words.journey.live.note[j.visibility]}</Txt>
            <Button label={words.journey.live.addFirst} size="lg" block icon={(c) => <Camera size={19} color={c} strokeWidth={2.4} />} onPress={() => router.replace(`/journey/${id}/add`)} />
            {j.shareUrl ? (
              <Button label={words.journey.live.shareLink} size="lg" variant="glass" block icon={(c) => <Share2 size={18} color={c} />} onPress={() => setSharing(true)} />
            ) : (
              <Button label={words.journey.live.later} size="lg" variant="glass" block onPress={leave} />
            )}
          </View>
        )}
      </SafeAreaView>
      {j ? <JourneyShareSheet journey={j} visible={sharing} onClose={() => setSharing(false)} /> : null}
    </View>
  );
}
