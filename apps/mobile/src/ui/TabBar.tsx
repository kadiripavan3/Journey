import type { BottomTabBarProps } from 'expo-router/tabs';
import { BlurView } from 'expo-blur';
import { Bell, Compass, House, Plus, User } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, View } from 'react-native';

import { fontFor, useTheme } from '@/theme';

import { AddSheet } from './AddSheet';
import { Txt } from './Txt';

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
        accessibilityLabel={label}
        onPress={() => {
          if (!focused) navigateToTab(route.key);
        }}
        style={{ width: 62, height: 56, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        {ICONS[route.name]?.(color)}
        <Txt style={{ fontFamily: fontFor[700], fontSize: 10.5, lineHeight: 13, color }}>{label}</Txt>
      </Pressable>
    );
  };

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 14, right: 14, bottom: Math.max(insets.bottom, 12) }}>
      <View
        style={{
          height: 70,
          borderRadius: 35,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.glassLine,
          boxShadow: shadow.md,
        }}>
        <BlurView intensity={40} tint={scheme} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 6, backgroundColor: colors.glass }}>
          {tab(0)}
          {tab(1)}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add an entry or start a journey"
            onPress={() => setAdding(true)}
            style={({ pressed }) => ({
              width: 54,
              height: 54,
              borderRadius: 27,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.accent,
              opacity: pressed ? 0.85 : 1,
            })}>
            <Plus size={26} color={colors.onAccent} strokeWidth={2.4} />
          </Pressable>
          {tab(2)}
          {tab(3)}
        </View>
      </View>
      <AddSheet visible={adding} onClose={() => setAdding(false)} />
    </View>
  );
}
