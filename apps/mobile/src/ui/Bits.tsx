import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { messageFor } from '@/api/fetcher';
import { useTheme } from '@/theme';

import { Button } from './Button';
import { Frost } from './Frost';
import { SPRING } from './Motion';
import { Txt } from './Txt';

/** A small label on a photo, such as "3 new" or "Milestone". */
export function Pill({ label, icon, tone = 'glass', style }: { label: string; icon?: (color: string) => ReactNode; tone?: 'glass' | 'accent' | 'photo'; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const bg = tone === 'accent' ? colors.accent : tone === 'photo' ? colors.photoGlass : colors.glassStrong;
  const fg = tone === 'accent' ? colors.onAccent : tone === 'photo' ? colors.onPhoto : colors.text;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 14, overflow: 'hidden', backgroundColor: bg, alignSelf: 'flex-start' }, style]}>
      {tone === 'accent' ? null : <Frost tone={tone === 'photo' ? 'dark' : 'theme'} intensity={20} />}
      {icon?.(fg)}
      <Txt weight={700} style={{ fontSize: 12, lineHeight: 15, color: fg }}>
        {label}
      </Txt>
    </View>
  );
}

/** The small capital line above an entry's title: "DAY 14 · HOI AN". */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <Txt variant="label" color="accentText" numberOfLines={1}>
      {children}
    </Txt>
  );
}

/** A photo that fills its box, with the page's fill colour while it loads. */
export function Photo({ uri, style, radius = 20, children, label }: { uri?: string | null; style?: StyleProp<ViewStyle>; radius?: number; children?: ReactNode; label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden', backgroundColor: colors.fill }, style]}>
      {uri ? (
        <Image source={{ uri }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" transition={150} accessible={!!label} accessibilityLabel={label} />
      ) : null}
      {children}
    </View>
  );
}

/** A raised surface for a group of rows or a card. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors, shadow } = useTheme();
  return <View style={[{ borderRadius: 22, backgroundColor: colors.surface, boxShadow: shadow.sm }, style]}>{children}</View>;
}

/** A section's heading with an optional way to see everything in it. */
export function SectionHeader({ title, onPress }: { title: string; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'header'}
      accessibilityLabel={onPress ? `${title}. See all` : title}
      disabled={!onPress}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 12, paddingHorizontal: 20 }}>
      <Txt weight={800} style={{ fontSize: 20, lineHeight: 25, letterSpacing: -0.5 }}>
        {title}
      </Txt>
      {onPress ? <ChevronRight size={20} color={colors.text} /> : null}
    </Pressable>
  );
}

/** A row of cards that scrolls sideways. */
export function Rail({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
      {children}
    </ScrollView>
  );
}

/** A journey as a compact row: small cover, title, a line of detail, and an optional action at the end. */
export function JourneyRow({ coverUrl, title, detail, trailing, onPress, faded }: { coverUrl?: string | null; title: string; detail: string; trailing?: ReactNode; onPress?: () => void; faded?: boolean }) {
  const main = (
    <>
      <Photo uri={coverUrl} radius={16} style={{ width: 64, height: 64 }} />
      <View style={{ flex: 1 }}>
        <Txt numberOfLines={2} weight={700} style={{ fontSize: 15, lineHeight: 20, letterSpacing: -0.15 }}>
          {title}
        </Txt>
        <Txt numberOfLines={2} color="muted" style={{ fontSize: 12.5, lineHeight: 17, marginTop: 2 }}>
          {detail}
        </Txt>
      </View>
    </>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 20, opacity: faded ? 0.55 : 1 }}>
      {onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${detail}`} onPress={onPress} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.8 : 1 })}>
          {main}
        </Pressable>
      ) : (
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>{main}</View>
      )}
      {trailing}
    </View>
  );
}

/** Shown while a screen's first data is on its way. */
export function Loading() {
  const { colors } = useTheme();
  return (
    <View accessibilityLabel="Loading" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <ActivityIndicator color={colors.muted} />
    </View>
  );
}

/** Shown when a screen's data couldn't be fetched: what happened, in the API's own words, and a way to try again. */
export function Problem({ error, onRetry, retrying }: { error: unknown; onRetry?: () => void; retrying?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 }}>
      <Txt accessibilityRole="header" weight={800} center style={{ fontSize: 21, lineHeight: 26, letterSpacing: -0.5 }}>
        That didn&apos;t load
      </Txt>
      <Txt color="muted" center style={{ fontSize: 14.5, lineHeight: 22 }}>
        {messageFor(error)}
      </Txt>
      {onRetry ? <Button label="Try again" variant="line" loading={retrying} onPress={onRetry} style={{ alignSelf: 'center', marginTop: 6 }} /> : null}
    </View>
  );
}

/** An on/off switch drawn with the app's colours. */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (next: boolean) => void; label: string }) {
  const { colors } = useTheme();
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: withSpring(value ? 20 : 0, SPRING) }] }), [value]);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={8}
      onPress={() => onChange(!value)}
      style={{ width: 50, height: 30, borderRadius: 15, padding: 3, backgroundColor: value ? colors.accent : colors.fill2 }}>
      <Animated.View style={[{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)' }, knob]} />
    </Pressable>
  );
}
