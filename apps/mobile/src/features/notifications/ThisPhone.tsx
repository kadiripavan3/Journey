import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';

import { layout } from '@/theme';
import { Button } from '@/ui/Button';
import { Txt } from '@/ui/Txt';

import { pushAllowed, turnOnPush } from './device';
import { pushSupport, WHY_NOT } from './support';

/**
 * Under the notification switches: whether this phone gets notifications at all, and a way to turn them on.
 * The switches above say what a person wants to hear about; this says whether the phone lets Journey tell them.
 */
export function ThisPhone() {
  const support = pushSupport();
  const [state, setState] = useState<'checking' | 'on' | 'off' | 'blocked'>('checking');
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (support !== 'ready') return;
    let mounted = true;
    void pushAllowed().then((allowed) => {
      if (mounted) setState(allowed ? 'on' : 'off');
    });
    return () => {
      mounted = false;
    };
  }, [support]);

  const turnOn = async () => {
    setAsking(true);
    const answer = await turnOnPush();
    setAsking(false);
    // The phone asks only once. After a no, the way back is the phone's own settings.
    setState(answer === 'on' ? 'on' : 'blocked');
  };

  const words =
    support !== 'ready'
      ? WHY_NOT[support]
      : state === 'on'
        ? 'This phone gets the notifications you switched on. Everything also shows in Activity.'
        : state === 'blocked'
          ? "Notifications for Journey are off in your phone's settings. Until you turn them on there, everything shows in Activity."
          : state === 'off'
            ? "Notifications are off on this phone. Your choices above are saved for when you turn them on; until then everything shows in Activity."
            : '';

  return (
    <View style={{ marginTop: 14, marginHorizontal: layout.gutter, gap: 12 }}>
      <Txt variant="footnote" color="muted" accessibilityLiveRegion="polite">
        {words}
      </Txt>
      {support === 'ready' && state === 'off' ? <Button label="Turn on notifications" variant="soft" loading={asking} onPress={() => void turnOn()} /> : null}
      {support === 'ready' && state === 'blocked' ? <Button label="Open the phone's settings" variant="soft" onPress={() => void Linking.openSettings()} /> : null}
    </View>
  );
}
