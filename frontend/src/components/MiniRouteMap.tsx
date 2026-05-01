import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppMap, type AppMapMarker, type AppMapPolyline, type AppMapRef, type LatLng, type Region } from "./AppMap";

import { colors } from "../theme/colors";
import { getDrivingRoute } from "../utils/directions";
import { MapPreviewModal } from "./MapPreviewModal";
import type { MapPoint } from "./MapPreviewModal";

type Point = { lat: number; lng: number };

function regionFromCenter(center: MapPoint): Region {
  return { latitude: center.lat, longitude: center.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 };
}

function toLatLng(p: MapPoint): LatLng {
  return { latitude: p.lat, longitude: p.lng };
}

function downsample(path: MapPoint[], maxPoints: number) {
  const max = Math.max(2, Math.floor(maxPoints));
  if (path.length <= max) return path;

  const stride = Math.ceil(path.length / max);
  const out: MapPoint[] = [];
  for (let i = 0; i < path.length; i += stride) out.push(path[i]);

  const last = path[path.length - 1];
  const lastOut = out[out.length - 1];
  if (!lastOut || lastOut.lat !== last.lat || lastOut.lng !== last.lng) out.push(last);
  return out.length > max ? out.slice(0, max) : out;
}

function computeCenter(pickup: Point, dropoff: Point, route?: MapPoint[] | null): MapPoint {
  const points = (route?.length ? route : null) ?? [pickup, dropoff];
  const minLat = Math.min(...points.map((p) => p.lat));
  const maxLat = Math.max(...points.map((p) => p.lat));
  const minLng = Math.min(...points.map((p) => p.lng));
  const maxLng = Math.max(...points.map((p) => p.lng));
  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
}

export function MiniRouteMap(props: { pickup: Point; dropoff: Point; height?: number; routePath?: Point[] | null }) {
  const height = props.height ?? 130;

  const [route, setRoute] = useState<MapPoint[] | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  const mapRef = useRef<AppMapRef | null>(null);
  const userInteractedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (Array.isArray(props.routePath) && props.routePath.length >= 2) {
        const coords = props.routePath
          .map((p) => {
            if (!p || typeof p.lat !== "number" || typeof p.lng !== "number") return null;
            return { lat: p.lat, lng: p.lng } as MapPoint;
          })
          .filter(Boolean) as MapPoint[];

        if (!cancelled) setRoute(coords.length >= 2 ? downsample(coords, 200) : null);
        return;
      }

      const res = await getDrivingRoute({ from: props.pickup, to: props.dropoff });
      if (cancelled) return;
      setRoute(res?.path?.length ? downsample(res.path.map((p) => ({ lat: p.latitude, lng: p.longitude })), 200) : null);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [props.pickup.lat, props.pickup.lng, props.dropoff.lat, props.dropoff.lng, props.routePath]);

  const center = useMemo(
    () => computeCenter(props.pickup, props.dropoff, route),
    [props.pickup.lat, props.pickup.lng, props.dropoff.lat, props.dropoff.lng, route]
  );

  const fitCoords = useMemo(() => {
    const line = route?.length ? route : [props.pickup, props.dropoff];
    const coords = line
      .filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map(toLatLng);
    return coords.length >= 2 ? coords : null;
  }, [route, props.pickup, props.dropoff]);

  useEffect(() => {
    if (userInteractedRef.current) return;
    if (!fitCoords) return;
    const t = setTimeout(() => {
      if (userInteractedRef.current) return;
      mapRef.current?.fitToCoordinates(fitCoords, { edgePadding: { top: 20, right: 20, bottom: 20, left: 20 }, animated: false });
    }, 0);
    return () => clearTimeout(t);
  }, [fitCoords]);

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
          if (!fitCoords) return;
          mapRef.current?.fitToCoordinates(fitCoords, { edgePadding: { top: 20, right: 20, bottom: 20, left: 20 }, animated: false });
        }}
        polyline={
          ({
            id: "mini-route",
            coordinates: (route?.length ? route : [props.pickup, props.dropoff]).map(toLatLng),
            strokeColor: colors.gold,
            strokeWidth: 4,
          }) satisfies AppMapPolyline
        }
        markers={[
          {
            id: "pickup",
            coordinate: toLatLng(props.pickup),
            pinColor: colors.gold,
            children: (
              <View style={[styles.badge, styles.badgeA]}>
                <Text style={styles.badgeText}>A</Text>
              </View>
            ),
          } satisfies AppMapMarker,
          {
            id: "dropoff",
            coordinate: toLatLng(props.dropoff),
            pinColor: colors.text,
            children: (
              <View style={[styles.badge, styles.badgeB]}>
                <Text style={styles.badgeText}>B</Text>
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
        title="Ruta"
        markers={[
          {
            id: "pickup",
            coordinate: props.pickup,
            title: "A",
            pinColor: colors.gold,
          },
          {
            id: "dropoff",
            coordinate: props.dropoff,
            title: "B",
            pinColor: colors.text,
          },
        ]}
        polyline={
          route?.length
            ? route
            : [props.pickup, props.dropoff]
        }
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
  pressed: {
    opacity: 0.85,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  badgeA: {
    borderColor: colors.gold,
  },
  badgeB: {
    borderColor: colors.border,
  },
  badgeText: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 16,
  },
});
