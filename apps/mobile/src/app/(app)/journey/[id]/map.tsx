import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, List as ListIcon, Star } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { type MapPinResponse, useGetJourney, useGetJourneyMap } from '@/api/generated/journey';
import { hasMap, JourneyMap } from '@/features/map/JourneyMap';
import { entryEyebrow } from '@/features/entries/labels';
import { stopsOf } from '@/features/map/stops';
import { PageProblem } from '@/features/states/PageProblem';
import { loadState } from '@/lib/loading';
import { useLeave } from '@/features/navigation/useLeave';
import { plural } from '@/words/en/plural';
import { layout, radius, useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { Eyebrow } from '@/ui/Eyebrow';
import { GlassBar } from '@/ui/GlassBar';
import { List } from '@/ui/List';
import { Loading } from '@/ui/Loading';
import { Rise, Tap } from '@/ui/Motion';
import { Photo } from '@/ui/Photo';
import { RoundButton } from '@/ui/RoundButton';
import { Sheet } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

/**
 * 5.3 Map: where the journey has been. Day pills on the route, joined in the order of the story; tapping one
 * shows its entry on a card, and the card opens the entry. Readers see the area of each place unless its
 * author chose the exact spot. In a browser (the web preview) the same stops are a list, in order.
 */
export default function JourneyMapScreen() {
  const { id, entry: opened } = useLocalSearchParams<{ id: string; entry?: string }>();
  const router = useRouter();
  const leave = useLeave();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, shadow } = useTheme();
  const journey = useGetJourney(id);
  const map = useGetJourneyMap(id);
  // Opened from an entry's place: that stop is chosen once the pins are in. Null after the person closes it.
  const [chosen, setSelected] = useState<string | null | undefined>(undefined);
  const [listing, setListing] = useState(false);

  const j = journey.data;
  const pins = map.data?.pins ?? [];
  const stops = stopsOf(pins);
  const selected = chosen === undefined ? (stops.find((stop) => stop.pins.some((pin) => pin.entryId === opened))?.key ?? null) : chosen;
  const counts = map.data ? `${plural(map.data.pinCount, 'entry', 'entries')} · ${plural(map.data.placeCount, 'place')}` : undefined;
  const load = loadState(journey, map);
  const failed = load.error;
  const openEntry = (pin: MapPinResponse) => router.push(`/entry/${pin.entryId}`);
  const capped = map.data?.capped ? `Showing the first ${pins.length} places.` : null;

  // No map to draw (still loading, nothing to show, or a browser): an ordinary page.
  if (failed || !j || !map.data || pins.length === 0 || !hasMap) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <AppBar title={j?.title ?? ''} subtitle={pins.length > 0 ? counts : undefined} trailing={<View style={{ width: 40 }} />} />
        </View>
        {failed ? (
          <PageProblem error={failed} onRetry={load.retry} retrying={load.retrying} />
        ) : !j || !map.data ? (
          <Loading offline={load.offline} />
        ) : pins.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 80 }}>
            <EmptyState emoji="🗺️" title="No places yet" body={j.viewer.canAddEntry ? 'Add a place to an entry and it shows up here, joined to the others in the order of the story.' : 'Entries with a place show up here, joined in the order of the story.'} />
          </View>
        ) : (
          <List
            data={pins}
            keyOf={(pin) => pin.entryId}
            top={8}
            bottom={40 + insets.bottom}
            header={
              <Txt variant="footnote" color="muted" style={{ marginHorizontal: layout.gutter, marginBottom: 6 }}>
                The stops of this journey, in the order of the story.{capped ? ` ${capped}` : ''}
              </Txt>
            }
            row={(pin, index) => (index < 8 ? <Rise index={index}>{<PinRow pin={pin} number={index + 1} last={index === pins.length - 1} onPress={() => openEntry(pin)} />}</Rise> : <PinRow pin={pin} number={index + 1} last={index === pins.length - 1} onPress={() => openEntry(pin)} />)}
          />
        )}
      </SafeAreaView>
    );
  }

  const stop = stops.find((other) => other.key === selected);
  const cardWidth = Math.min(width - 32, 460);
  return (
    <View style={{ flex: 1, backgroundColor: colors.mapLand }}>
      <JourneyMap pins={pins} stops={stops} selected={selected} onSelect={setSelected} inset={{ top: insets.top + 96, bottom: 220 + insets.bottom }} />

      <GlassBar radius="sheet" style={{ position: 'absolute', top: insets.top + 8, left: layout.barGutter, right: layout.barGutter }} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 6 }}>
        <RoundButton label="Back" onPress={leave} icon={(c) => <ArrowLeft size={20} color={c} />} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Txt variant="control" weight={800} numberOfLines={1} accessibilityRole="header">
            {j.title}
          </Txt>
          <Txt variant="small" color="muted" numberOfLines={1}>
            {counts}
          </Txt>
        </View>
        <View style={{ width: 40 }} />
      </GlassBar>

      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom, 12) + 8, gap: 12 }}>
        <Button label="List" variant="ink" icon={(c) => <ListIcon size={18} color={c} />} onPress={() => setListing(true)} style={{ alignSelf: 'center', boxShadow: shadow.md }} />
        {stop ? (
          <ScrollView horizontal pagingEnabled={stop.pins.length > 1} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: layout.barGutter, gap: 10 }}>
            {stop.pins.map((pin) => (
              <Tap key={pin.entryId} accessibilityRole="button" accessibilityLabel={`${entryEyebrow(pin)}. ${pin.title || 'Open the entry'}`} onPress={() => openEntry(pin)} scaleTo={0.985} style={{ width: stop.pins.length > 1 ? cardWidth - 28 : cardWidth, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 10, paddingRight: 14, borderRadius: radius.panel, backgroundColor: colors.surface, boxShadow: shadow.md }}>
                {pin.thumbUrl ? <Photo uri={pin.thumbUrl} radius="photo" style={{ width: 104, height: 104 }} /> : null}
                <View style={{ flex: 1, paddingLeft: pin.thumbUrl ? 0 : 8, paddingVertical: pin.thumbUrl ? 0 : 10 }}>
                  <Eyebrow>{entryEyebrow(pin)}</Eyebrow>
                  <Txt variant="headline" weight={800} numberOfLines={2} style={{ marginTop: 3 }}>
                    {pin.title || pin.placeName}
                  </Txt>
                  {stop.pins.length > 1 ? (
                    <Txt variant="footnote" color="muted" style={{ marginTop: 4 }}>
                      {stop.pins.indexOf(pin) + 1} of {stop.pins.length} here
                    </Txt>
                  ) : null}
                </View>
              </Tap>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <Sheet visible={listing} onClose={() => setListing(false)} title="Stops" subtitle={capped ?? undefined} tall>
        {pins.map((pin, index) => (
          <PinRow
            key={pin.entryId}
            pin={pin}
            number={index + 1}
            last={index === pins.length - 1}
            onPress={() => {
              setListing(false);
              openEntry(pin);
            }}
          />
        ))}
      </Sheet>
    </View>
  );
}

/** One stop in the list: its number on the line, its day and place, its title and a small photo. */
function PinRow({ pin, number, last, onPress }: { pin: MapPinResponse; number: number; last: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Tap accessibilityRole="button" accessibilityLabel={`Stop ${number}. ${entryEyebrow(pin)}${pin.isMilestone ? ', milestone' : ''}. ${pin.title || 'Open the entry'}`} onPress={onPress} scaleTo={0.985} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 9, paddingHorizontal: layout.rowGutter }}>
      {/* The line that joins the stops, like the route on the map. */}
      {number === 1 && last ? null : <View style={{ position: 'absolute', left: layout.rowGutter + 15, top: number === 1 ? '50%' : 0, bottom: last ? '50%' : 0, width: 2, backgroundColor: colors.fill2 }} />}
      <View style={{ width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: pin.isMilestone ? colors.accent : colors.text }}>
        <Txt variant="caption" weight={800} style={{ color: pin.isMilestone ? colors.onAccent : colors.bg }}>
          {number}
        </Txt>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {pin.isMilestone ? <Star size={12} color={colors.accentText} fill={colors.accentText} /> : null}
          <View style={{ flex: 1 }}>
            <Eyebrow>{entryEyebrow(pin)}</Eyebrow>
          </View>
        </View>
        <Txt variant="headline" numberOfLines={2} style={{ marginTop: 2 }}>
          {pin.title || pin.placeName}
        </Txt>
      </View>
      {pin.thumbUrl ? <Photo uri={pin.thumbUrl} radius="thumb" style={{ width: 56, height: 56 }} /> : null}
    </Tap>
  );
}
