import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppMap, type AppMapMarker, type AppMapPolyline, type AppMapRef, type LatLng, type Region } from "./AppMap";

import { colors } from "../theme/colors";
import { getDrivingRoute } from "../utils/directions";
import { MapPreviewModal } from "./MapPreviewModal";
import type { MapPoint } from "./MapPreviewModal";

type Point = { lat: number; lng: number };

const LIVE_ROUTE_START_MIN_METERS = 25;
const LIVE_ROUTE_REFRESH_MIN_METERS = 20;

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

function haversineMeters(from: Point, to: Point) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadius * c);
}

function computeCenter(origin: Point, dropoff: Point, route?: MapPoint[] | null): MapPoint {
  const points = (route?.length ? route : null) ?? [origin, dropoff];
  const minLat = Math.min(...points.map((p) => p.lat));
  const maxLat = Math.max(...points.map((p) => p.lat));
  const minLng = Math.min(...points.map((p) => p.lng));
  const maxLng = Math.max(...points.map((p) => p.lng));
  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
}

export function MiniRouteMap(props: {
  pickup: Point;
  dropoff: Point;
  height?: number;
  routePath?: Point[] | null;
  currentPosition?: Point | null;
  currentPositionTitle?: string;
}) {
  const height = props.height ?? 130;

  const [route, setRoute] = useState<MapPoint[] | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  const mapRef = useRef<AppMapRef | null>(null);
  const userInteractedRef = useRef(false);
  const lastLiveOriginRef = useRef<MapPoint | null>(null);

  const liveOrigin = useMemo(() => {
    const point = props.currentPosition;
    if (!point) return null;
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null;
    return { lat: point.lat, lng: point.lng };
  }, [props.currentPosition?.lat, props.currentPosition?.lng]);

  const shouldUseLiveRoute = useMemo(() => {
    if (!liveOrigin) return false;
    return haversineMeters(liveOrigin, props.pickup) >= LIVE_ROUTE_START_MIN_METERS;
  }, [liveOrigin?.lat, liveOrigin?.lng, props.pickup.lat, props.pickup.lng]);

  const routeOrigin = shouldUseLiveRoute && liveOrigin ? liveOrigin : props.pickup;

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!shouldUseLiveRoute && Array.isArray(props.routePath) && props.routePath.length >= 2) {
        const coords = props.routePath
          .map((p) => {
            if (!p || typeof p.lat !== "number" || typeof p.lng !== "number") return null;
            return { lat: p.lat, lng: p.lng } as MapPoint;
          })
          .filter(Boolean) as MapPoint[];

        lastLiveOriginRef.current = null;
        if (!cancelled) setRoute(coords.length >= 2 ? downsample(coords, 200) : null);
        return;
      }

      if (shouldUseLiveRoute && liveOrigin) {
        const lastOrigin = lastLiveOriginRef.current;
        if (lastOrigin && haversineMeters(lastOrigin, liveOrigin) < LIVE_ROUTE_REFRESH_MIN_METERS) {
          return;
        }
        lastLiveOriginRef.current = liveOrigin;
      } else {
        lastLiveOriginRef.current = null;
      }

      const res = await getDrivingRoute({ from: routeOrigin, to: props.dropoff });
      if (cancelled) return;
      setRoute(res?.path?.length ? downsample(res.path.map((p) => ({ lat: p.latitude, lng: p.longitude })), 200) : null);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    props.pickup.lat,
    props.pickup.lng,
    props.dropoff.lat,
    props.dropoff.lng,
    props.routePath,
    props.currentPosition?.lat,
    props.currentPosition?.lng,
    routeOrigin.lat,
    routeOrigin.lng,
    liveOrigin?.lat,
    liveOrigin?.lng,
    shouldUseLiveRoute,
  ]);

  const center = useMemo(
    () => computeCenter(routeOrigin, props.dropoff, route),
    [routeOrigin.lat, routeOrigin.lng, props.dropoff.lat, props.dropoff.lng, route]
  );

  const fitCoords = useMemo(() => {
    const line = route?.length ? route : [routeOrigin, props.dropoff];
    const coords = line
      .filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map(toLatLng);
    return coords.length >= 2 ? coords : null;
  }, [route, routeOrigin.lat, routeOrigin.lng, props.dropoff.lat, props.dropoff.lng]);

  const markers = useMemo(() => {
    const out: AppMapMarker[] = [];

    if (shouldUseLiveRoute && liveOrigin) {
      out.push({
        id: "current",
        coordinate: toLatLng(liveOrigin),
        pinColor: colors.gold,
        children: (
          <View style={[styles.badge, styles.badgeCurrent]}>
            <Ionicons name="navigate" size={14} color={colors.text} />
          </View>
        ),
      });
    } else {
      out.push({
        id: "pickup",
        coordinate: toLatLng(props.pickup),
        pinColor: colors.gold,
        children: (
          <View style={[styles.badge, styles.badgeA]}>
            <Text style={styles.badgeText}>A</Text>
          </View>
        ),
      });
    }

    out.push({
      id: "dropoff",
      coordinate: toLatLng(props.dropoff),
      pinColor: colors.text,
      children: (
        <View style={[styles.badge, styles.badgeB]}>
          <Text style={styles.badgeText}>B</Text>
        </View>
      ),
    });

    return out;
  }, [shouldUseLiveRoute, liveOrigin?.lat, liveOrigin?.lng, props.pickup.lat, props.pickup.lng, props.dropoff.lat, props.dropoff.lng]);

  const previewMarkers = useMemo(() => {
    const out = [] as Array<{ id: string; coordinate: Point; title: string; pinColor: string }>;

    if (shouldUseLiveRoute && liveOrigin) {
      out.push({
        id: "current",
        coordinate: liveOrigin,
        title: props.currentPositionTitle ?? "En ruta",
        pinColor: colors.gold,
      });
    } else {
      out.push({
        id: "pickup",
        coordinate: props.pickup,
        title: "A",
        pinColor: colors.gold,
      });
    }

    out.push({
      id: "dropoff",
      coordinate: props.dropoff,
      title: "B",
      pinColor: colors.text,
    });

    return out;
  }, [
    shouldUseLiveRoute,
    liveOrigin?.lat,
    liveOrigin?.lng,
    props.pickup.lat,
    props.pickup.lng,
    props.dropoff.lat,
    props.dropoff.lng,
    props.currentPositionTitle,
  ]);

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
            coordinates: (route?.length ? route : [routeOrigin, props.dropoff]).map(toLatLng),
            strokeColor: colors.gold,
            strokeWidth: 4,
          }) satisfies AppMapPolyline
        }
        markers={markers}
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
        markers={previewMarkers}
        polyline={
          route?.length
            ? route
            : [routeOrigin, props.dropoff]
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
  badgeCurrent: {
    borderColor: colors.gold,
    backgroundColor: colors.card,
  },
  badgeText: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 16,
  },
});
