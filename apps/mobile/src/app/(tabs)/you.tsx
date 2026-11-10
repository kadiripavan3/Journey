import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGetMe } from '@/api/generated/journey';
import { useSession } from '@/auth/session';
import { initials } from '@/lib/username';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Txt } from '@/ui/Txt';

/** Your profile. Journeys, followers and editing arrive with later milestones. */
export default function You() {
  const { colors, scheme } = useTheme();
  const session = useSession();
  const me = useGetMe();
  const profile = me.data?.profile;
  if (!profile) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 16 }}>
        <View
          style={{
            alignItems: 'center',
            gap: 4,
            padding: 22,
            borderRadius: 26,
            backgroundColor: colors.surface,
            borderWidth: scheme === 'dark' ? 1 : 0,
            borderColor: colors.line,
            boxShadow: scheme === 'dark' ? undefined : '0 12px 32px rgba(20, 20, 32, 0.13)',
          }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, marginBottom: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.fill2 }}>
            <Txt weight={800} style={{ fontSize: 32, lineHeight: 38, letterSpacing: -1 }}>
              {initials(profile.displayName)}
            </Txt>
          </View>
          <Txt accessibilityRole="header" variant="title" center>
            {profile.displayName}
          </Txt>
          <Txt variant="caption" color="muted">
            @{profile.username}
          </Txt>
        </View>
        {profile.bio ? <Txt style={{ fontSize: 14.5, lineHeight: 22, marginHorizontal: 4 }}>{profile.bio}</Txt> : null}
        <Txt variant="caption" color="muted" style={{ marginHorizontal: 4 }}>
          Signed in as {me.data?.email}
        </Txt>
        <Button label="Sign out" variant="line" block onPress={() => void session.signOut()} />
      </ScrollView>
    </SafeAreaView>
  );
}
