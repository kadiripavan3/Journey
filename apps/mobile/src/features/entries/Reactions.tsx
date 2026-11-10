import { Heart, MessageCircle } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { type EntryResponse, useLikeEntry, useUnlikeEntry } from '@/api/generated/journey';
import { useCache } from '@/api/cache';
import { compact } from '@/lib/plural';
import { useTheme } from '@/theme';
import { SPRING, Tap } from '@/ui/Motion';
import { Txt } from '@/ui/Txt';

/** The heart and the comment count under an entry. The heart fills straight away when tapped. */
export function Reactions({ entry, onComments }: { entry: EntryResponse; onComments: () => void }) {
  const { colors } = useTheme();
  const cache = useCache();
  const like = useLikeEntry({ mutation: { onSuccess: (liked) => cache.entryReacted(liked) } });
  const unlike = useUnlikeEntry({ mutation: { onSuccess: (unliked) => cache.entryReacted(unliked) } });
  const busy = like.isPending || unlike.isPending;
  // While a request is on its way, show where it is heading.
  const liked = like.isPending ? true : unlike.isPending ? false : entry.viewer.hasLiked;
  const count = entry.likeCount + (liked === entry.viewer.hasLiked ? 0 : liked ? 1 : -1);
  const beat = useSharedValue(1);
  const heart = useAnimatedStyle(() => ({ transform: [{ scale: beat.get() }] }));

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 16 }}>
      <Tap
        accessibilityRole="button"
        accessibilityLabel={liked ? `Unlike. ${count} likes` : `Like. ${count} likes`}
        accessibilityState={{ selected: liked }}
        hitSlop={10}
        onPress={() => {
          if (busy) return;
          if (liked) {
            unlike.mutate({ id: entry.id });
          } else {
            beat.set(withSequence(withSpring(1.35, SPRING), withSpring(1, SPRING)));
            like.mutate({ id: entry.id });
          }
        }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Animated.View style={heart}>
          <Heart size={22} color={liked ? colors.like : colors.text} fill={liked ? colors.like : 'transparent'} />
        </Animated.View>
        <Txt variant="callout" weight={700} style={{ color: liked ? colors.like : colors.text }}>
          {compact(Math.max(count, 0))}
        </Txt>
      </Tap>
      <Tap accessibilityRole="button" accessibilityLabel={`Comments. ${entry.commentCount}`} hitSlop={10} onPress={onComments} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <MessageCircle size={22} color={colors.text} />
        <Txt variant="callout" weight={700}>
          {compact(entry.commentCount)}
        </Txt>
      </Tap>
    </View>
  );
}

/** The same counts, small and not tappable: for cards in a list. Shows nothing when there is nothing to count. */
export function ReactionCounts({ entry }: { entry: EntryResponse }) {
  const { colors } = useTheme();
  if (entry.likeCount === 0 && entry.commentCount === 0) return null;
  return (
    <View accessible accessibilityLabel={`${entry.likeCount} likes, ${entry.commentCount} comments`} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Heart size={17} color={entry.viewer.hasLiked ? colors.like : colors.text} fill={entry.viewer.hasLiked ? colors.like : 'transparent'} />
        <Txt variant="caption" weight={700} style={{ color: entry.viewer.hasLiked ? colors.like : colors.text }}>
          {compact(entry.likeCount)}
        </Txt>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <MessageCircle size={17} color={colors.text} />
        <Txt variant="caption" weight={700}>
          {compact(entry.commentCount)}
        </Txt>
      </View>
    </View>
  );
}
