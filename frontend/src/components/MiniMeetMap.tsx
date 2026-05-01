import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppMap, type AppMapMarker, type AppMapRef, type LatLng, type Region } from "./AppMap";

import { colors } from "../theme/colors";
import { MapPreviewModal } from "./MapPreviewModal";
import type { MapPoint } from "./MapPreviewModal";

type Point = { lat: number; lng: number };

function computeCenter(a: Point, b: Point): MapPoint {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

function regionFromCenter(center: MapPoint): Region {
  return { latitude: center.lat, longitude: center.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 };
}

function toLatLng(p: MapPoint): LatLng {
  return { latitude: p.lat, longitude: p.lng };
}

export function MiniMeetMap(props: {
  driver: Point;
  passenger: Point;
  height?: number;
  driverIconName?: keyof typeof Ionicons.glyphMap;
  passengerIconName?: keyof typeof Ionicons.glyphMap;
}) {
  const height = props.height ?? 130;
  const [previewVisible, setPreviewVisible] = useState(false);

  const mapRef = useRef<AppMapRef | null>(null);
  const userInteractedRef = useRef(false);

  const center = useMemo(
    () => computeCenter(props.driver, props.passenger),
    [props.driver.lat, props.driver.lng, props.passenger.lat, props.passenger.lng]
  );

  useEffect(() => {
    if (userInteractedRef.current) return;
    const coords = [props.driver, props.passenger]
      .filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map(toLatLng);
    if (coords.length < 2) return;

    const t = setTimeout(() => {
      if (userInteractedRef.current) return;
      mapRef.current?.fitToCoordinates(coords, { edgePadding: { top: 20, right: 20, bottom: 20, left: 20 }, animated: false });
    }, 0);
    return () => clearTimeout(t);
  }, [props.driver.lat, props.driver.lng, props.passenger.lat, props.passenger.lng]);

  return (
    <View style={[styles.wrap, { height }]}>
      <AppMap
        ref={(r) => {
          mapRef.current = r;
        }}
        style={StyleSheet.absoluteFill}
        initialRegion={regionFromCenter(center)}
        rotateEnabled={false}
        pitchEnabled={false}
        scrollEnabled
        zoomEnabled
        onUserGesture={() => {
          userInteractedRef.current = true;
        }}
        onMapReady={() => {
          if (userInteractedRef.current) return;
          const coords = [props.driver, props.passenger]
            .filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng))
            .map(toLatLng);
          if (coords.length < 2) return;
          mapRef.current?.fitToCoordinates(coords, { edgePadding: { top: 20, right: 20, bottom: 20, left: 20 }, animated: false });
        }}
        markers={[
          {
            id: "passenger",
            coordinate: toLatLng(props.passenger),
            pinColor: colors.gold,
            children: (
              <View style={[styles.pin, styles.pinPassenger]}>
                <Ionicons name={props.passengerIconName ?? "person"} size={14} color={colors.text} />
                <Text style={styles.pinText}>Cliente</Text>
              </View>
            ),
          } satisfies AppMapMarker,
          {
            id: "driver",
            coordinate: toLatLng(props.driver),
            pinColor: colors.text,
            children: (
              <View style={[styles.pin, styles.pinDriver]}>
                <Ionicons name={props.driverIconName ?? "car"} size={14} color={colors.text} />
                <Text style={styles.pinText}>Tú</Text>
              </View>
            ),
          } satisfies AppMapMarker,
        ]}
      />

      <Pressable
        onPress={() => setPreviewVisible(true)}
        style={({ pressed }) => [styles.expandBtn, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Ampliar mapa"
      >
        <Ionicons name="expand-outline" size={18} color={colors.gold} />
      </Pressable>

      <MapPreviewModal
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        title="Ubicaciones"
        markers={[
          {
            id: "passenger",
            coordinate: props.passenger,
            title: "Cliente",
            pinColor: colors.gold,
          },
          {
            id: "driver",
            coordinate: props.driver,
            title: "Tú",
            pinColor: colors.text,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  expandBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pin: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pinDriver: {
    backgroundColor: colors.card,
  },
  pinPassenger: {
    backgroundColor: colors.card,
  },
  pinText: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 12,
  },
  pressed: {
    opacity: 0.85,
  },
});
