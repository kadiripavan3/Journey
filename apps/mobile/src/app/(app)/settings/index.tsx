import { useRouter } from 'expo-router';
import { Bell, CircleHelp, FileText, Flag, Lock, LogOut, Palette, ShieldCheck, UserRound } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGetMe, useGetSettings } from '@/api/generated/journey';
import { useSession } from '@/auth/session';
import { openPage } from '@/api/config';
import { layout, useTheme } from '@/theme';
import { useAppearance } from '@/theme/appearance';
import { AppBar } from '@/ui/AppBar';
import { Avatar } from '@/ui/Avatar';
import { GroupLabel } from '@/ui/Heading';
import { Row, RowGroup } from '@/ui/Rows';
import { Txt } from '@/ui/Txt';
import { words } from '@/words';

/** 10.1 Settings: everything in plain words, in short groups. */
export default function Settings() {
  const router = useRouter();
  const { colors } = useTheme();
  const session = useSession();
  const me = useGetMe().data;
  const settings = useGetSettings().data;
  const appearance = useAppearance();
  const profile = me?.profile;
  // These are web pages, so they can also be read without the app; the stores ask for exactly that.
  const switches = settings
    ? [settings.notifyNewEntries, settings.notifyCompleted, settings.notifyComments, settings.notifyFollowers, settings.notifyLikes, settings.weeklyDigest, settings.digestEmail, settings.reminders]
    : null;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppBar title={words.settings.title} trailing={<View style={{ width: 40 }} />} />
      <ScrollView contentContainerStyle={{ paddingTop: 8, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {profile ? (
          <RowGroup>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
              <Avatar uri={profile.avatarUrl} name={profile.displayName} size={52} />
              <View style={{ flex: 1 }}>
                <Txt variant="headline" numberOfLines={1}>
                  {profile.displayName}
                </Txt>
                <Txt variant="footnote" numberOfLines={1} color="muted">
                  {words.common.join([`@${profile.username}`, me?.email])}
                </Txt>
              </View>
            </View>
          </RowGroup>
        ) : null}

        <GroupLabel style={{ marginHorizontal: layout.gutter }}>{words.settings.you}</GroupLabel>
        <RowGroup>
          <Row first icon={(c) => <UserRound size={18} color={c} />} label={words.settings.account} onPress={() => router.push('/settings/account')} />
          <Row
            icon={(c) => <Bell size={18} color={c} />}
            label={words.settings.notifications}
            value={switches ? words.settings.switchesOn(switches.filter(Boolean).length, switches.length) : undefined}
            onPress={() => router.push('/settings/notifications')}
          />
          <Row icon={(c) => <ShieldCheck size={18} color={c} />} label={words.settings.privacy} onPress={() => router.push('/settings/privacy')} />
          <Row icon={(c) => <Palette size={18} color={c} />} label={words.settings.appearance} value={words.settings.appearancePage.choices[appearance].label} onPress={() => router.push('/settings/appearance')} />
        </RowGroup>

        <GroupLabel style={{ marginHorizontal: layout.gutter }}>{words.settings.help}</GroupLabel>
        <RowGroup>
          <Row first icon={(c) => <CircleHelp size={18} color={c} />} label={words.settings.helpAndContact} onPress={() => openPage('/contact')} />
          <Row icon={(c) => <Flag size={18} color={c} />} label={words.settings.guidelines} onPress={() => openPage('/guidelines')} />
          <Row icon={(c) => <FileText size={18} color={c} />} label={words.settings.terms} onPress={() => openPage('/terms')} />
          <Row icon={(c) => <Lock size={18} color={c} />} label={words.settings.privacyPolicy} onPress={() => openPage('/privacy')} />
        </RowGroup>

        <GroupLabel style={{ marginHorizontal: layout.gutter }}> </GroupLabel>
        <RowGroup>
          <Row first icon={(c) => <LogOut size={18} color={c} />} label={words.settings.signOut} onPress={() => void session.signOut()} trailing={<View />} />
        </RowGroup>
      </ScrollView>
    </SafeAreaView>
  );
}
