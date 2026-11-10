import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { track } from '@/features/analytics/analytics';
import { askedAboutPush, turnOnPush } from '@/features/notifications/device';
import { pushSupport } from '@/features/notifications/support';
import { radius, useTheme, withAlpha } from '@/theme';
import { BrandMark } from '@/ui/Brand';
import { Button } from '@/ui/Button';
import { Frost } from '@/ui/Frost';
import { Heading, Lead } from '@/ui/Heading';
import { Rise } from '@/ui/Motion';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Txt';
import { words } from '@/words';

/**
 * 2.4 Notifications: asked once, with a reason, before the phone's own question. Where notifications can't
 * work (a browser, Expo Go) the screen says so in a sentence and sign-up simply goes on.
 */
export default function NotifyAsk() {
  const router = useRouter();
  const { colors } = useTheme();
  const support = pushSupport();
  const [asking, setAsking] = useState(false);
  // Seen here, the question isn't put again later inside the app.
  useEffect(() => void askedAboutPush(), []);

  const next = () => router.push('/ready');
  const turnOn = async () => {
    setAsking(true);
    const answer = await turnOnPush();
    track('notifications_answered', { answer, during: 'sign_up' });
    setAsking(false);
    next();
  };
  const notNow = () => {
    track('notifications_answered', { answer: 'later', during: 'sign_up' });
    next();
  };

  return (
    <Screen
      footer={
        support === 'ready' ? (
          <>
            <Button label={words.notifications.ask.turnOn} size="lg" block loading={asking} onPress={() => void turnOn()} />
            <Button label={words.common.notNow} size="lg" variant="quiet" block disabled={asking} onPress={notNow} />
          </>
        ) : (
          <Button label={words.common.continue} size="lg" block onPress={next} />
        )
      }>
      <View style={{ height: 410, marginTop: 10, marginBottom: 6, marginHorizontal: -4 }}>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 34, borderRadius: radius.sheet, overflow: 'hidden', backgroundColor: colors.fill }}>
          <Image source={require('@/assets/photos/terraces.jpg')} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
          <LinearGradient colors={[withAlpha(colors.stage, 0), withAlpha(colors.stage, 0.35)]} locations={[0.3, 1]} style={StyleSheet.absoluteFill} />
        </View>
        <Example index={0} example={words.notifications.ask.examples.trip} style={{ bottom: 104, left: 14, right: 14 }} />
        <Example index={1} example={words.notifications.ask.examples.challenge} style={{ bottom: 14, left: 26, right: 26, opacity: 0.96 }} />
      </View>
      <Heading center>{words.notifications.ask.title}</Heading>
      <Lead center>{words.notifications.ask.body}</Lead>
      {support === 'ready' ? null : (
        <View style={{ marginTop: 14, paddingVertical: 12, paddingHorizontal: 16, borderRadius: radius.field, backgroundColor: colors.fill }}>
          <Txt variant="note" color="muted" center>
            {words.notifications.whyNot[support]}
          </Txt>
        </View>
      )}
    </Screen>
  );
}

/** What a notification from Journey looks like, drawn on the photo as a pane of glass. */
function Example({ index, example, style }: { index: number; example: { title: string; line: string; when: string }; style: { bottom: number; left: number; right: number; opacity?: number } }) {
  const { colors, shadow } = useTheme();
  return (
    <Rise index={index + 1} style={[{ position: 'absolute' }, style]}>
      <View
        accessible
        accessibilityLabel={words.notifications.ask.exampleSpoken(example.title, example.line)}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 10,
          paddingVertical: 12,
          paddingLeft: 12,
          paddingRight: 14,
          borderRadius: radius.cardLarge,
          borderWidth: 1,
          borderColor: colors.glassLine,
          backgroundColor: colors.glassStrong,
          boxShadow: shadow.md,
          overflow: 'hidden',
        }}>
        <Frost />
        <BrandMark size={38} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt variant="callout" weight={800} numberOfLines={1}>
            {example.title}
          </Txt>
          <Txt variant="caption" weight={500} color="muted" style={{ marginTop: 2 }}>
            {example.line}
          </Txt>
        </View>
        <Txt variant="small" weight={500} color="muted">
          {example.when}
        </Txt>
      </View>
    </Rise>
  );
}
