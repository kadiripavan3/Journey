import { AtSign, Check, ChevronRight, Ellipsis, Link as LinkIcon, Mail, MessageCircle } from 'lucide-react-native';
import { type ReactNode, useEffect, useState } from 'react';
import { Linking, View } from 'react-native';

import { messageFor } from '@/api/fetcher';
import { type EntryResponse, useGetEntryShareLink, useGetMe, useGetMyShareLink } from '@/api/generated/journey';
import { entryHeadline } from '@/features/entries/labels';
import { copyText, mailLink, messageLink, shareLink, shortLink } from '@/lib/share';
import { layout, radius, useTheme } from '@/theme';
import { LinkBox } from '@/ui/LinkBox';
import { Loading } from '@/ui/Loading';
import { Tap } from '@/ui/Motion';
import { Photo } from '@/ui/Photo';
import { Sheet, SheetRow } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

/** Something that can be shared: the web page for it and how it is introduced. */
export type Shared = {
  url: string;
  /** The bold line of the preview. */
  title: string;
  /** The line under it. */
  line: string;
  /** What is written in front of the link in a message or an email. */
  text: string;
  photo?: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  heading: string;
  /** Undefined while the link is on its way. */
  link: Shared | undefined;
  /** Why there is no link, in the API's own words. */
  problem?: string | null;
  /** Rows under the ways to share, such as the way to the "Follow my journey" link. */
  children?: ReactNode;
};

/**
 * 6.6 Share: a sheet with the link as others will see it, a way to copy it, and the usual places to send it.
 * The link is a web page, so it also works for people who don't have the app.
 */
export function ShareSheet({ visible, onClose, heading, link, problem, children }: Props) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  const ways = link
    ? [
        { label: 'Messages', icon: (c: string) => <MessageCircle size={22} color={c} />, go: () => void Linking.openURL(messageLink(`${link.text}\n${link.url}`)).catch(() => undefined) },
        { label: 'Mail', icon: (c: string) => <Mail size={22} color={c} />, go: () => void Linking.openURL(mailLink(link.text, `${link.text}\n${link.url}`)).catch(() => undefined) },
        {
          label: copied ? 'Copied' : 'Copy link',
          icon: (c: string) => (copied ? <Check size={22} color={c} strokeWidth={2.6} /> : <LinkIcon size={22} color={c} />),
          go: () => void copyText(link.url).then(setCopied),
        },
        // The phone's own share sheet, with every app that can take a link.
        { label: 'More', icon: (c: string) => <Ellipsis size={22} color={c} />, go: () => void shareLink(link.text, link.url).then((result) => setCopied(result === 'copied')) },
      ]
    : [];

  return (
    <Sheet visible={visible} onClose={onClose} title={heading}>
      {problem ? (
        <Txt variant="callout" color="muted" style={{ paddingHorizontal: layout.gutter, paddingTop: 4, paddingBottom: 12 }}>
          {problem}
        </Txt>
      ) : !link ? (
        <View style={{ height: 150 }}>
          <Loading />
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', marginTop: 10, marginHorizontal: layout.barGutter, borderRadius: radius.photo, overflow: 'hidden', backgroundColor: colors.fill }}>
            {link.photo ? <Photo uri={link.photo} radius="none" style={{ width: 110, backgroundColor: colors.fill2 }} /> : null}
            <View style={{ flex: 1, gap: 3, paddingVertical: 12, paddingHorizontal: 14 }}>
              <Txt variant="tiny" weight={700} color="muted" numberOfLines={1}>
                {shortLink(link.url).split('/')[0]}
              </Txt>
              <Txt variant="item" weight={800} numberOfLines={2}>
                {link.title}
              </Txt>
              <Txt variant="footnote" color="muted" numberOfLines={2}>
                {link.line}
              </Txt>
            </View>
          </View>
          <LinkBox url={link.url} style={{ marginTop: 10, marginHorizontal: layout.barGutter }} />
          <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 18, marginHorizontal: 10, marginBottom: 10 }}>
            {ways.map((way) => (
              <Tap key={way.label} accessibilityRole="button" accessibilityLabel={way.label} onPress={way.go} scaleTo={0.94} style={{ alignItems: 'center', gap: 6, minWidth: 72 }}>
                <View style={{ width: 56, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.fill }}>{way.icon(colors.text)}</View>
                <Txt variant="small" weight={600}>
                  {way.label}
                </Txt>
              </Tap>
            ))}
          </View>
          {children}
        </>
      )}
    </Sheet>
  );
}

/** Sharing one entry. Its author also finds the way to their "Follow my journey" link here. */
export function EntryShareSheet({ entry, visible, onClose }: { entry: EntryResponse; visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const [profile, setProfile] = useState(false);
  const link = useGetEntryShareLink(entry.id, { query: { enabled: visible && !profile } });
  const mine = entry.viewer.canEdit;
  const close = () => {
    setProfile(false);
    onClose();
  };
  if (profile) return <ProfileShareSheet visible={visible} onClose={close} />;
  const photo = entry.media.find((m) => !m.held);
  return (
    <ShareSheet
      visible={visible}
      onClose={close}
      heading={mine ? 'Share your entry' : 'Share this entry'}
      problem={link.isError ? messageFor(link.error) : null}
      link={
        link.data
          ? { url: link.data.url, text: link.data.text, title: entryHeadline(entry), line: `${entry.label} of ${entry.journeyTitle}, by ${entry.author.displayName}`, photo: photo?.thumbUrl ?? photo?.url }
          : undefined
      }>
      {mine ? (
        <SheetRow
          first
          icon={(c) => <AtSign size={22} color={c} />}
          label="Your “Follow my journey” link"
          note="For your Instagram or TikTok bio"
          trailing={<ChevronRight size={18} color={colors.muted} />}
          onPress={() => setProfile(true)}
        />
      ) : null}
    </ShareSheet>
  );
}

/** Your "Follow my journey" link: one page with your public journeys, made for a social bio. */
export function ProfileShareSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const me = useGetMe().data?.profile;
  const link = useGetMyShareLink({ query: { enabled: visible } });
  return (
    <ShareSheet
      visible={visible}
      onClose={onClose}
      heading="Your “Follow my journey” link"
      problem={link.isError ? messageFor(link.error) : null}
      link={
        link.data && me
          ? {
              url: link.data.url,
              text: link.data.text,
              title: me.displayName,
              line: 'Your public journeys on one page. Put the link in your Instagram or TikTok bio.',
              photo: me.avatarUrl,
            }
          : undefined
      }
    />
  );
}
