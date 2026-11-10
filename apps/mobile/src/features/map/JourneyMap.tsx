import { Star } from 'lucide-react-native';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import type { MapPinResponse } from '@/api/generated/journey';
import { radius, useTheme } from '@/theme';
import { Txt } from '@/ui/Txt';

import { regionOf, type Stop, stopLabel } from './stops';

/** The phone draws a real map. (The web preview shows the same stops as a list.) */
export const hasMap = true;

type Props = {
  /** Every pin, in story order: the line joins them. */
  pins: MapPinResponse[];
  /** The pins grouped by spot: one pill each. */
  stops: Stop[];
  /** The stop that is picked, by its key. */
  selected: string | null;
  onSelect: (key: string | null) => void;
  /** How much of the map the bars over it cover, so the route is fitted into what is left. */
  inset: { top: number; bottom: number };
};

/**
 * 5.3 Map: the journey's stops as day pills, joined by a line in the order of the story. Milestones are
 * starred; the picked stop turns dark. Tapping a pill picks it; tapping the map lets go.
 */
export function JourneyMap({ pins, stops, selected, onSelect, inset }: Props) {
  const { colors, scheme, shadow } = useTheme();
  const map = useRef<MapView>(null);
  const route = pins.map((pin) => ({ latitude: pin.lat, longitude: pin.lng }));
  const fit = () => {
    if (route.length > 1) map.current?.fitToCoordinates(route, { edgePadding: { top: inset.top, right: 56, bottom: inset.bottom, left: 56 }, animated: false });
  };

  return (
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      initialRegion={regionOf(pins) ?? undefined}
      onMapReady={fit}
      onPress={(event) => {
        // Tapping a pill also counts as a tap on the map on some phones; only a tap on the map itself lets go.
        if (event.nativeEvent.action !== 'marker-press') onSelect(null);
      }}
      userInterfaceStyle={scheme}
      // Where the phone lets the app colour the map (Google Maps), it wears the app's own colours.
      customMapStyle={[
        { elementType: 'geometry', stylers: [{ color: colors.mapLand }] },
        { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: colors.mapLabel }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: colors.mapLand }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: colors.mapWater }] },
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: colors.mapPark }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: colors.mapRoad2 }] },
        { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: colors.mapRoad }] },
      ]}
      showsCompass={false}
      toolbarEnabled={false}
      pitchEnabled={false}
      rotateEnabled={false}>
      {route.length > 1 ? <Polyline coordinates={route} strokeColor={colors.text} strokeWidth={3} lineCap="round" lineJoin="round" /> : null}
      {stops.map((stop) => {
        const on = stop.key === selected;
        const milestone = stop.pins.some((pin) => pin.isMilestone);
        const bg = on ? colors.text : milestone ? colors.accent : colors.surface;
        const fg = on ? colors.bg : milestone ? colors.onAccent : colors.text;
        return (
          <Marker
            // A pill that changes its look is drawn again.
            key={`${stop.key}-${on ? 'on' : 'off'}`}
            coordinate={{ latitude: stop.lat, longitude: stop.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            zIndex={on ? 2 : 1}
            accessibilityLabel={`${stopLabel(stop)}${stop.pins[0]?.placeName ? `, ${stop.pins[0].placeName}` : ''}${milestone ? ', milestone' : ''}`}
            onPress={(event) => {
              event.stopPropagation();
              onSelect(stop.key);
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: on ? 9 : 7, paddingHorizontal: on ? 14 : 11, borderRadius: radius.field, backgroundColor: bg, boxShadow: shadow.float }}>
              {milestone ? <Star size={12} color={fg} fill={fg} /> : null}
              <Txt variant={on ? 'note' : 'caption'} weight={800} style={{ color: fg }}>
                {stopLabel(stop)}
              </Txt>
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}
