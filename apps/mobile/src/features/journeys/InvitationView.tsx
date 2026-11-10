import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import type { JourneyResponse, PersonResponse } from '@/api/generated/journey';
import { darkTheme, layout, withAlpha } from '@/theme';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { LightStatusBar } from '@/ui/LightStatusBar';
import { Loading } from '@/ui/Loading';
import { Problem } from '@/ui/Problem';
import { RoundButton } from '@/ui/RoundButton';
import { Txt } from '@/ui/Txt';
import { words } from '@/words';

const STAGE = darkTheme.colors.stage;
const ON = darkTheme.colors.onPhoto;

type Props = {
  /** What the person is invited to and by whom. Null when the invitation isn't there (any more). */
  invitation: { journey: JourneyResponse; invitedBy: PersonResponse } | null;
  loading: boolean;
  /** Set when the invitation couldn't be fetched, with a way to try again. */
  loadError?: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  /** What to say when there is no invitation. */
  gone: string;
  /** Why joining or declining didn't work. */
  failed?: unknown;
  onJoin: () => void;
  joining: boolean;
  onDecline: () => void;
  declining?: boolean;
  onClose: () => void;
};

/**
 * 8.2 Invitation: what a friend sees, whether they were asked in the app or opened an invite link.
 * It says plainly what joining means and who can see the journey. Nobody is added without saying yes.
 */
export function InvitationView({ invitation, loading, loadError, onRetry, retrying, gone, failed, onJoin, joining, onDecline, declining, onClose }: Props) {
  const j = invitation?.journey;
  const points = j
    ? [
        words.shared.invitation.points.post,
        words.shared.invitation.points.onProfile,
        j.visibility === 'public' && j.followerCount > 0 ? words.shared.invitation.points.publicFollowed(j.followerCount) : words.shared.invitation.points.who[j.visibility],
        words.shared.invitation.points.leave,
      ]
    : [];

  return (
    <View style={{ flex: 1, backgroundColor: STAGE }}>
      <LightStatusBar />
      {j?.coverUrl ? <Image source={{ uri: j.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} /> : null}
      <LinearGradient colors={[withAlpha(STAGE, 0.45), withAlpha(STAGE, 0.05), withAlpha(STAGE, 0.8), withAlpha(STAGE, 0.96)]} locations={[0, 0.25, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1, justifyContent: 'space-between', paddingHorizontal: layout.rowGutter }}>
        <View style={{ paddingTop: 8, marginLeft: -4 }}>
          <RoundButton tone="photo" label={words.common.close} onPress={onClose} icon={(c) => <X size={20} color={c} />} />
        </View>
        {loading ? (
          <Loading tone="onPhoto" />
        ) : loadError ? (
          <Problem tone="onPhoto" message={messageFor(loadError)} onRetry={onRetry} retrying={retrying} />
        ) : !invitation || !j ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Txt variant="body" center style={{ color: ON }}>
              {gone}
            </Txt>
          </View>
        ) : (
          <View style={{ gap: 12, paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar uri={invitation.invitedBy.avatarUrl} name={invitation.invitedBy.displayName} size={36} />
              <Txt variant="item" style={{ color: ON }}>
                {words.shared.invitation.invitedYou(invitation.invitedBy.displayName)}
              </Txt>
            </View>
            <Txt variant="display" accessibilityRole="header" style={{ color: ON }}>
              {words.shared.invitation.title(j.title)}
            </Txt>
            <View style={{ gap: 9, marginVertical: 6 }}>
              {points.map((point) => (
                <View key={point} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Check size={18} color={darkTheme.colors.accent} strokeWidth={2.6} />
                  <Txt variant="body" style={{ flex: 1, color: ON, opacity: 0.9 }}>
                    {point}
                  </Txt>
                </View>
              ))}
            </View>
            {failed ? (
              <Txt variant="caption" accessibilityLiveRegion="polite" style={{ color: darkTheme.colors.danger }}>
                {messageFor(failed)}
              </Txt>
            ) : null}
            <Button label={words.shared.invitation.join} size="lg" block loading={joining} onPress={onJoin} />
            <Button label={words.shared.invitation.notNow} size="lg" variant="glass" block loading={declining} onPress={onDecline} />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}
