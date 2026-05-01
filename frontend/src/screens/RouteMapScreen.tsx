import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppMap, type AppMapMarker, type AppMapRef, type LatLng, type Region } from "../components/AppMap";

import type { RootStackParamList } from "../navigation/AppNavigator";
import { Screen } from "../components/Screen";
import { colors } from "../theme/colors";
import { getDrivingRoute } from "../utils/directions";

type Props = NativeStackScreenProps<RootStackParamList, "RouteMap">;

type Point = { lat: number; lng: number };
type MapPoint = { lat: number; lng: number };

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

function computeInitialCenter(pickup: Point, dropoff: Point, route?: MapPoint[] | null): MapPoint {
  const points = (route?.length ? route : null) ?? [pickup, dropoff];

  const minLat = Math.min(...points.map((p) => p.lat));
  const maxLat = Math.max(...points.map((p) => p.lat));
  const minLng = Math.min(...points.map((p) => p.lng));
  const maxLng = Math.max(...points.map((p) => p.lng));

  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
}

export function RouteMapScreen({ route: navRoute }: Props) {
  const pickup = navRoute.params.pickup;
  const dropoff = navRoute.params.dropoff;
  const paramPath = navRoute.params.routePath;
  const [routePoints, setRoutePoints] = useState<MapPoint[] | null>(null);

  const mapRef = useRef<AppMapRef | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (Array.isArray(paramPath) && paramPath.length >= 2) {
        const coords = paramPath
          .map((p) => {
            if (!p || typeof p.lat !== "number" || typeof p.lng !== "number") return null;
            return { lat: p.lat, lng: p.lng } as MapPoint;
          })
          .filter(Boolean) as MapPoint[];

        if (!cancelled) setRoutePoints(coords.length >= 2 ? downsample(coords, 800) : null);
        return;
      }

      const res = await getDrivingRoute({ from: pickup, to: dropoff });
      if (cancelled) return;
      setRoutePoints(res?.path?.length ? downsample(res.path.map((p) => ({ lat: p.latitude, lng: p.longitude })), 800) : null);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [pickup.lat, pickup.lng, dropoff.lat, dropoff.lng, paramPath]);

  const initialCenter = useMemo(() => computeInitialCenter(pickup, dropoff, routePoints), [pickup, dropoff, routePoints]);

  const fallbackLine = useMemo(() => [pickup, dropoff], [pickup, dropoff]);
  const fitTo = routePoints?.length ? routePoints : fallbackLine;
  const polyline = routePoints?.length ? routePoints : fallbackLine;

  const polylineShape = useMemo(() => {
    const coords = polyline.map(toLatLng);
    return coords.length >= 2
      ? {
          id: "route",
          coordinates: coords,
          strokeColor: colors.gold,
          strokeWidth: 4,
        }
      : null;
  }, [polyline]);

  const markers = useMemo(() => {
    return [
      { id: "pickup", coordinate: toLatLng(pickup), pinColor: colors.gold },
      { id: "dropoff", coordinate: toLatLng(dropoff), pinColor: colors.text },
    ] satisfies AppMapMarker[];
  }, [pickup.lat, pickup.lng, dropoff.lat, dropoff.lng]);

  const fitCoords = useMemo(() => {
    const coords = fitTo
      .filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map(toLatLng);
    return coords.length >= 2 ? coords : null;
  }, [fitTo]);

  useEffect(() => {
    if (!fitCoords) return;
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(fitCoords, { edgePadding: { top: 70, right: 70, bottom: 70, left: 70 }, animated: false });
    }, 0);
    return () => clearTimeout(t);
  }, [fitCoords]);

  return (
    <Screen style={{ padding: 0 }}>
      <View style={styles.wrap}>
        <AppMap
          ref={(r) => {
            mapRef.current = r;
          }}
          style={StyleSheet.absoluteFill}
          initialRegion={regionFromCenter(initialCenter)}
          rotateEnabled={false}
          pitchEnabled={false}
          onMapReady={() => {
            if (!fitCoords) return;
            mapRef.current?.fitToCoordinates(fitCoords, { edgePadding: { top: 70, right: 70, bottom: 70, left: 70 }, animated: false });
          }}
          polyline={polylineShape}
          markers={markers}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
