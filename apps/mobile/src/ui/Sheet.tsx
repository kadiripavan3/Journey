import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { Txt } from './Txt';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** Pinned under the scrolling content and above the keyboard, such as a box to type in. */
  footer?: ReactNode;
  /** Shown at the right of the title, such as a close button. */
  action?: ReactNode;
  /** Always take most of the screen, however little is inside. */
  tall?: boolean;
};

/** A sheet that slides up from the bottom over a dimmed page. Tapping outside closes it. */
export function Sheet({ visible, onClose, title, subtitle, children, footer, action, tall }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.44)' }}
        />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: '88%',
            height: tall ? '82%' : undefined,
            paddingTop: 10,
            paddingBottom: footer ? 0 : Math.max(insets.bottom, 16) + 8,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            backgroundColor: colors.surface,
            boxShadow: '0 -12px 40px rgba(0, 0, 0, 0.2)',
          }}>
          <View style={{ alignSelf: 'center', width: 38, height: 5, borderRadius: 3, marginBottom: 8, backgroundColor: colors.fill2 }} />
          {title ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingLeft: 22, paddingRight: 16, paddingTop: 8, paddingBottom: 4 }}>
              <Txt accessibilityRole="header" weight={800} style={{ flex: 1, fontSize: 20, lineHeight: 26, letterSpacing: -0.5 }}>
                {title}
              </Txt>
              {action}
            </View>
          ) : null}
          {subtitle ? (
            <Txt color="muted" style={{ fontSize: 14, lineHeight: 20, paddingHorizontal: 22, paddingBottom: 10 }}>
              {subtitle}
            </Txt>
          ) : null}
          <ScrollView style={tall ? { flex: 1 } : undefined} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingBottom: Math.max(insets.bottom, 12), borderTopWidth: 1, borderTopColor: colors.line }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type RowProps = {
  icon?: (color: string) => ReactNode;
  label: string;
  note?: string;
  onPress?: () => void;
  danger?: boolean;
  trailing?: ReactNode;
  first?: boolean;
};

/** One choice in a sheet or a menu. */
export function SheetRow({ icon, label, note, onPress, danger, trailing, first }: RowProps) {
  const { colors } = useTheme();
  const color = danger ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={note ? `${label}. ${note}` : label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 13,
        paddingHorizontal: 22,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.line,
        backgroundColor: pressed ? colors.fill : 'transparent',
      })}>
      {icon?.(color)}
      <View style={{ flex: 1, gap: 1 }}>
        <Txt weight={600} style={{ fontSize: 16, lineHeight: 22, color }}>
          {label}
        </Txt>
        {note ? (
          <Txt color="muted" style={{ fontSize: 12.5, lineHeight: 17 }}>
            {note}
          </Txt>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}
