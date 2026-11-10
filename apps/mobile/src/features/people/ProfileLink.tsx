import { Link as LinkIcon } from 'lucide-react-native';
import { Linking, type StyleProp, type ViewStyle } from 'react-native';

import { shortLink } from '@/lib/share';
import { useTheme } from '@/theme';
import { Tap } from '@/ui/Motion';
import { Txt } from '@/ui/Txt';

/** The link on a profile: shown without "https://", and it opens in the phone's browser. */
export function ProfileLink({ url, style }: { url: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const short = shortLink(url);
  // A link saved without a scheme still opens.
  const address = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  return (
    <Tap
      accessibilityRole="link"
      accessibilityLabel={`Open ${short}`}
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      onPress={() => void Linking.openURL(address).catch(() => undefined)}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }, style]}>
      <LinkIcon size={16} color={colors.accentText} />
      <Txt variant="callout" numberOfLines={1} weight={700} style={{ color: colors.accentText, flexShrink: 1 }}>
        {short}
      </Txt>
    </Tap>
  );
}
