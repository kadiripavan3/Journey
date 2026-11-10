import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Bell, Compass, House, Plus, User } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useGetActivityUnseen } from '@/api/generated/journey';
import { AddSheet } from '@/features/journeys/AddSheet';
import { radius, useTheme } from '@/theme';
import { Tap } from '@/ui/Motion';
import { Txt } from '@/ui/Txt';

const ICONS: Record<string, (color: string) => ReactNode> = {
  index: (c) => <House size={24} color={c} />,
  discover: (c) => <Compass size={24} color={c} />,
  activity: (c) => <Bell size={24} color={c} />,
  you: (c) => <User size={24} color={c} />,
};

/** The floating glass tab bar: Home, Discover, the + button, Activity and You. Content scrolls underneath it. */
export function TabBar({ state, descriptors, navigateToTab, insets }: BottomTabBarProps) {
  const { colors, scheme, shadow } = useTheme();
  const [adding, setAdding] = useState(false);
  // Checked again every minute, so the dot appears without leaving the app.
  // One small question a minute while the app is in front: is there anything new? It never builds the inbox.
  const hasNews = useGetActivityUnseen({ query: { refetchInterval: 60_000 } }).data?.unseen ?? false;

  const tab = (routeIndex: number) => {
    const route = state.routes[routeIndex];
    if (!route) return null;
    const focused = state.index === routeIndex;
    const label = descriptors[route.key]?.options.title ?? route.name;
    const color = focused ? colors.accentText : colors.muted;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={route.name === 'activity' && hasNews ? `${label}, new` : label}
        onPress={() => {
          if (!focused) navigateToTab(route.key);
        }}
        style={{ width: 62, height: 56, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        {ICONS[route.name]?.(color)}
        {route.name === 'activity' && hasNews ? (
          <View style={{ position: 'absolute', top: 7, right: 17, width: 9, height: 9, borderRadius: radius.pill, backgroundColor: colors.like, borderWidth: 1.5, borderColor: colors.bg }} />
        ) : null}
        <Txt variant="micro" weight={700} style={{ color }}>{label}</Txt>
      </Pressable>
    );
  };

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 14, right: 14, bottom: Math.max(insets.bottom, 12) }}>
      <View
        style={{
          height: 70,
          borderRadius: radius.pill,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.glassLine,
          boxShadow: shadow.md,
        }}>
        <BlurView intensity={40} tint={scheme} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 6, backgroundColor: colors.glass }}>
          {tab(0)}
          {tab(1)}
          <Tap
            accessibilityRole="button"
            accessibilityLabel="Add an entry or start a journey"
            onPress={() => setAdding(true)}
            scaleTo={0.9}
            style={{ width: 54, height: 54, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}>
            <Plus size={26} color={colors.onAccent} strokeWidth={2.4} />
          </Tap>
          {tab(2)}
          {tab(3)}
        </View>
      </View>
      <AddSheet visible={adding} onClose={() => setAdding(false)} />
    </View>
  );
}
