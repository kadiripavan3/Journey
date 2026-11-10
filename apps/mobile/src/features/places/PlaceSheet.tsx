import { Image as ImageIcon, LocateFixed, MapPin, Search, Trash2, Type } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';

import type { Point } from '@/features/media/exif';
import { layout, radius, textStyle, useTheme } from '@/theme';
import { Sheet, SheetRow } from '@/ui/Sheet';
import { MAX_TEXT_SCALE, Txt } from '@/ui/Txt';
import { webNoOutline } from '@/ui/web';

import { canLocate, LocationDenied, placeAt, placeHere, searchPlaces } from './lookup';
import { type FoundPlace, type PickedPlace, typedName } from './place';

type Props = {
  visible: boolean;
  onClose: () => void;
  value: PickedPlace | null;
  onChange: (place: PickedPlace | null) => void;
  /** Where the entry's first photo was taken, when the photo says so. */
  photoPoint?: Point;
};

const DENIED = "Journey isn't allowed to use the phone's location, so it can't look places up. You can still use the name as you typed it.";

/**
 * 7.2 Place: search for where an entry happened, or take it from where the phone is or where the first photo
 * was taken. A name alone works too. Nothing here asks for the phone's location until the person taps for it.
 */
export function PlaceSheet({ visible, onClose, value, onChange, photoPoint }: Props) {
  const { colors } = useTheme();
  const [words, setWords] = useState('');
  const [found, setFound] = useState<FoundPlace[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Answers can come back out of order; only the latest question counts.
  const asked = useRef(0);

  const close = () => {
    if (timer.current) clearTimeout(timer.current);
    asked.current += 1;
    setWords('');
    setFound(null);
    setBusy(false);
    setNote(null);
    onClose();
  };
  const pick = (place: PickedPlace | null) => {
    onChange(place);
    close();
  };
  const pickFound = (place: FoundPlace) => pick({ name: place.name, lat: place.lat, lng: place.lng, exact: false });

  const type = (text: string) => {
    setWords(text);
    setNote(null);
    if (timer.current) clearTimeout(timer.current);
    const query = text.trim();
    const mine = (asked.current += 1);
    if (query.length < 2) {
      setFound(null);
      setBusy(false);
      return;
    }
    setBusy(true);
    // Wait until the typing pauses, so every letter isn't a search.
    timer.current = setTimeout(() => {
      searchPlaces(query)
        .then((list) => {
          if (asked.current === mine) setFound(list);
        })
        .catch((error: unknown) => {
          if (asked.current !== mine) return;
          setFound([]);
          if (error instanceof LocationDenied) setNote(DENIED);
        })
        .finally(() => {
          if (asked.current === mine) setBusy(false);
        });
    }, 350);
  };

  /** One of the "take it from…" rows: look the spot up, then use it. */
  const take = (look: () => Promise<FoundPlace | null>, missing: string) => {
    setBusy(true);
    setNote(null);
    const mine = (asked.current += 1);
    look()
      .then((place) => {
        if (asked.current !== mine) return;
        if (place) pickFound(place);
        else setNote(missing);
      })
      .catch((error: unknown) => {
        if (asked.current === mine) setNote(error instanceof LocationDenied ? "Journey isn't allowed to use the phone's location. You can switch it on in the phone's Settings, or search for the place instead." : missing);
      })
      .finally(() => {
        if (asked.current === mine) setBusy(false);
      });
  };

  const typed = words.trim();
  return (
    <Sheet visible={visible} onClose={close} title="Where was this?" tall>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, marginHorizontal: layout.rowGutter, marginTop: 6, marginBottom: 8, paddingHorizontal: 14, borderRadius: radius.field, backgroundColor: colors.fill }}>
        <Search size={18} color={colors.muted} />
        <TextInput
          maxFontSizeMultiplier={MAX_TEXT_SCALE}
          accessibilityLabel="Search for a place"
          value={words}
          onChangeText={type}
          placeholder="Search for a place"
          placeholderTextColor={colors.muted}
          selectionColor={colors.accent}
          autoCorrect={false}
          returnKeyType="search"
          maxLength={80}
          style={[webNoOutline, textStyle('item', 600, { oneLine: true }), { flex: 1, padding: 0, color: colors.text }]}
        />
        {busy ? <ActivityIndicator color={colors.muted} /> : null}
      </View>

      {note ? (
        <Txt variant="caption" color="muted" accessibilityLiveRegion="polite" style={{ marginHorizontal: layout.gutter, marginBottom: 8 }}>
          {note}
        </Txt>
      ) : null}

      {typed.length === 0 ? (
        <>
          {canLocate ? (
            <SheetRow first icon={(c) => <LocateFixed size={22} color={c} />} label="Where you are now" note="Uses the phone's location, only when you tap here" onPress={() => take(placeHere, "The phone couldn't tell where it is. Search for the place instead.")} />
          ) : null}
          {photoPoint ? (
            <SheetRow
              first={!canLocate}
              icon={(c) => <ImageIcon size={22} color={c} />}
              label="Where the first photo was taken"
              onPress={() => take(() => placeAt(photoPoint.lat, photoPoint.lng), "We couldn't tell where that photo was taken. Search for the place instead.")}
            />
          ) : null}
          {value ? <SheetRow first={!canLocate && !photoPoint} danger icon={(c) => <Trash2 size={22} color={c} />} label="Remove the place" onPress={() => pick(null)} /> : null}
        </>
      ) : (
        <>
          {(found ?? []).map((place, index) => (
            <SheetRow key={`${place.name}-${place.lat}-${place.lng}`} first={index === 0} icon={(c) => <MapPin size={22} color={c} />} label={place.name} note={place.note} onPress={() => pickFound(place)} />
          ))}
          {typed.length >= 2 ? (
            <SheetRow
              first={(found ?? []).length === 0}
              icon={(c) => <Type size={22} color={c} />}
              label={`Use "${typedName(typed)}"`}
              note="Just the name, without a spot on the map"
              onPress={() => pick({ name: typedName(typed), exact: false })}
            />
          ) : null}
        </>
      )}

      <Txt variant="footnote" color="muted" style={{ marginHorizontal: layout.gutter, marginTop: 16 }}>
        Other people see the area around a place, not the exact point, unless you choose to show the exact spot.
      </Txt>
    </Sheet>
  );
}
