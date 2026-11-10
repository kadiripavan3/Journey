import { type ReactNode, useState } from 'react';
import { Platform, TextInput, type TextInputProps, type TextStyle, View } from 'react-native';

import { fontFor, useTheme } from '@/theme';

import { Txt } from './Txt';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Shown under the field in the danger colour. */
  error?: string | null;
  /** Shown under the field when there is no error. */
  note?: string | null;
  noteTone?: 'muted' | 'ok';
  /** Text shown before what the person types, such as "@". */
  prefix?: string;
  /** Shown at the right edge, such as a tick. */
  accessory?: ReactNode;
};

// Browsers draw their own focus ring inside the box; the box's border already shows focus.
const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

/** A text field with its label inside the box, as in the designs. */
export function Field({ label, error, note, noteTone = 'muted', prefix, accessory, multiline, onFocus, onBlur, ...input }: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.text : colors.lineStrong;

  return (
    <View style={{ gap: 6 }}>
      <View
        style={{
          borderRadius: 16,
          borderWidth: focused || error ? 2 : 1.5,
          borderColor,
          backgroundColor: colors.bg,
          paddingHorizontal: focused || error ? 15.5 : 16,
          paddingTop: focused || error ? 8.5 : 9,
          paddingBottom: focused || error ? 9.5 : 10,
        }}>
        <Txt variant="caption" color="muted" style={{ fontSize: 12, lineHeight: 16 }}>
          {label}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', gap: 2 }}>
          {prefix ? (
            <Txt weight={600} style={{ fontSize: 16, lineHeight: 24 }}>
              {prefix}
            </Txt>
          ) : null}
          <TextInput
            {...input}
            accessibilityLabel={label}
            multiline={multiline}
            placeholderTextColor={colors.muted}
            selectionColor={colors.accent}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            style={[
              webNoOutline,
              {
              flex: 1,
              minHeight: multiline ? 66 : 24,
              padding: 0,
              fontFamily: fontFor[multiline ? 500 : 600],
              fontSize: 16,
              lineHeight: multiline ? 23 : undefined,
              color: colors.text,
              textAlignVertical: multiline ? 'top' : 'center',
              },
            ]}
          />
          {accessory}
        </View>
      </View>
      {error ? (
        <Txt variant="caption" color="danger" accessibilityLiveRegion="polite" style={{ marginHorizontal: 4 }}>
          {error}
        </Txt>
      ) : note ? (
        <Txt variant="caption" color={noteTone} style={{ marginHorizontal: 4 }}>
          {note}
        </Txt>
      ) : null}
    </View>
  );
}
