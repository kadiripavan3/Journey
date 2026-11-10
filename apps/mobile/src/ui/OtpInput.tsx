import { type ComponentRef, useRef } from 'react';
import { Platform, Pressable, TextInput, type TextStyle, View } from 'react-native';

import { useTheme } from '@/theme';

import { Txt } from './Txt';

type Props = {
  value: string;
  onChange: (code: string) => void;
  /** Called once when the last digit is typed. */
  onComplete?: (code: string) => void;
  length?: number;
  disabled?: boolean;
};

/** Six boxes for a one-time code. One hidden text field takes the typing, so paste and autofill from the email work. */
export function OtpInput({ value, onChange, onComplete, length = 6, disabled }: Props) {
  const { colors } = useTheme();
  const input = useRef<ComponentRef<typeof TextInput>>(null);

  const change = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, length);
    onChange(digits);
    if (digits.length === length && digits !== value) onComplete?.(digits);
  };

  return (
    <Pressable onPress={() => input.current?.focus()} accessible={false}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {Array.from({ length }, (_, i) => {
          const active = i === Math.min(value.length, length - 1) && !disabled;
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: 60,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? colors.bg : colors.fill,
                borderWidth: active ? 2 : 0,
                borderColor: colors.text,
              }}>
              <Txt weight={800} style={{ fontSize: 26, lineHeight: 32 }}>
                {value[i] ?? ''}
              </Txt>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={change}
        editable={!disabled}
        autoFocus
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        caretHidden
        accessibilityLabel={`${length}-digit code`}
        style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.01, color: 'transparent' }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null]}
      />
    </Pressable>
  );
}
