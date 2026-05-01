import React, { useEffect, useMemo, useRef } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppMap, type AppMapMarker, type AppMapPolyline, type AppMapRef, type LatLng, type Region } from "./AppMap";

import { colors } from "../theme/colors";

export type MapPoint = { lat: number; lng: number };

type MarkerItem = {
  id: string;
  coordinate: MapPoint;
  title: string;
  pinColor?: string;
};

function computeCenter(points: MapPoint[]): MapPoint {
  if (!points.length) return { lat: 0, lng: 0 };

  const minLat = Math.min(...points.map((p) => p.lat));
  const maxLat = Math.max(...points.map((p) => p.lat));
  const minLng = Math.min(...points.map((p) => p.lng));
  const maxLng = Math.max(...points.map((p) => p.lng));

  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
}

function regionFromCenter(center: MapPoint): Region {
  return { latitude: center.lat, longitude: center.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 };
}

function toLatLng(p: MapPoint): LatLng {
  return { latitude: p.lat, longitude: p.lng };
}

export function MapPreviewModal(props: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  markers: MarkerItem[];
  polyline?: MapPoint[] | null;
}) {
  const mapRef = useRef<AppMapRef | null>(null);

  const fitPoints = useMemo(() => {
    const base = props.markers.map((m) => m.coordinate);
    const line = props.polyline?.length ? props.polyline : null;
    return line?.length ? [...base, ...line] : base;
  }, [props.markers, props.polyline]);

  const initialCenter = useMemo(() => computeCenter(fitPoints), [fitPoints]);

  const fitCoords = useMemo(() => {
    const coords = fitPoints
      .filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map(toLatLng);
    return coords.length >= 2 ? coords : null;
  }, [fitPoints]);

  useEffect(() => {
    if (!props.visible) return;
    if (!fitCoords) return;

    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(fitCoords, {
        edgePadding: { top: 70, right: 70, bottom: 70, left: 70 },
        animated: false,
      });
    }, 0);

    return () => clearTimeout(t);
  }, [props.visible, fitCoords]);

  return (
    <Modal visible={props.visible} animationType="fade" transparent onRequestClose={props.onClose}>
      <View style={styles.backdropWrap}>
        <View style={styles.backdrop} />

        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={props.onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar mapa"
        />

        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {props.title ?? "Mapa"}
            </Text>

            <Pressable
              onPress={props.onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.mapWrap}>
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
                mapRef.current?.fitToCoordinates(fitCoords, {
                  edgePadding: { top: 70, right: 70, bottom: 70, left: 70 },
                  animated: false,
                });
              }}
              polyline={
                props.polyline?.length
                  ? ({
                      id: "modal-route",
                      coordinates: props.polyline.map(toLatLng),
                      strokeColor: colors.gold,
                      strokeWidth: 4,
                    } satisfies AppMapPolyline)
                  : null
              }
              markers={
                props.markers.map(
                  (m) =>
                    ({
                      id: m.id,
                      coordinate: toLatLng(m.coordinate),
                      title: m.title,
                      pinColor: m.pinColor,
                    }) satisfies AppMapMarker
                )
              }
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    opacity: 0.94,
  },
  content: {
    width: "100%",
    maxWidth: 720,
    height: "78%",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  header: {
    height: 56,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginLeft: 12,
  },
  mapWrap: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  pressed: {
    opacity: 0.85,
  },
});
