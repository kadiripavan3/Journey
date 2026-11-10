import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { onAnswer } from '@/api/fetcher';
import { track } from '@/features/analytics/analytics';
import { layout } from '@/theme';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';
import { words } from '@/words';

import { askedAboutPush, shouldAskAboutPush, turnOnPush } from './device';
import { pushSupport } from './support';

/**
 * The moments when the question makes sense: the person has just followed a journey or a person, or posted
 * an entry. Then there is something worth hearing about. Each is an API call that was just accepted.
 */
const GOOD_MOMENTS: [method: string, path: RegExp][] = [
  ['PUT', /^\/v1\/journeys\/[^/]+\/follow$/],
  ['PUT', /^\/v1\/profiles\/[^/]+\/follow$/],
  ['POST', /^\/v1\/journeys\/[^/]+\/entries$/],
];

/** How long after the moment the question comes up, so the screen first shows what was just done. */
const A_MOMENT_MS = 900;

/**
 * 2.4 Notifications, for someone who never saw the question during sign-up: they signed up on another phone,
 * reinstalled the app, or left sign-up half way. It is asked once per install, with the reason first and
 * the phone's own question only after a yes. Never when the app opens: it waits for a moment when
 * notifications would have something to say. Where they can't work (a browser, Expo Go) it does nothing.
 *
 * Sits in the layout of the signed-in app, above every screen.
 */
export function AskAboutNotifications() {
  const [visible, setVisible] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (pushSupport() !== 'ready') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let checking = false;
    const stop = onAnswer((method, path) => {
      if (checking || !GOOD_MOMENTS.some(([wanted, address]) => wanted === method && address.test(path))) return;
      checking = true;
      void shouldAskAboutPush().then((ask) => {
        checking = false;
        if (!ask) return;
        void askedAboutPush(); // seen once on this phone, whatever the answer
        timer = setTimeout(() => setVisible(true), A_MOMENT_MS);
      });
    });
    return () => {
      stop();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const turnOn = async () => {
    setAsking(true);
    const answer = await turnOnPush();
    track('notifications_answered', { answer, during: 'app' });
    setAsking(false);
    setVisible(false);
  };
  const notNow = () => {
    if (asking) return;
    track('notifications_answered', { answer: 'later', during: 'app' });
    setVisible(false);
  };

  return (
    <Sheet
      visible={visible}
      onClose={notNow}
      title={words.notifications.ask.title}
      subtitle={words.notifications.ask.bodyInApp}>
      <View style={{ gap: 10, paddingHorizontal: layout.rowGutter, paddingTop: 6 }}>
        <Button label={words.notifications.ask.turnOn} size="lg" block loading={asking} onPress={() => void turnOn()} />
        <Button label={words.common.notNow} variant="soft" size="lg" block disabled={asking} onPress={notNow} />
      </View>
    </Sheet>
  );
}
