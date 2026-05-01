import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppMap, type AppMapMarker, type AppMapRef, type LatLng, type Region } from "../components/AppMap";

import type { RootStackParamList } from "../navigation/AppNavigator";
import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { GoldTitle } from "../components/GoldTitle";
import { PrimaryButton } from "../components/PrimaryButton";
import { colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import { apiDriverUpsertLocation } from "../driver/driver.api";
import { preloadCoords, readCachedCoords, type Coords } from "../utils/location";

type Props = NativeStackScreenProps<RootStackParamList, "DriverMap">;

type MapPoint = { lat: number; lng: number };

function regionFromCenter(center: MapPoint, close?: boolean): Region {
  // ~100m: 0.001° lat ≈ 111m (aprox).
  const delta = close ? 0.001 : 0.03;
  return { latitude: center.lat, longitude: center.lng, latitudeDelta: delta, longitudeDelta: delta };
}

function toLatLng(p: MapPoint): LatLng {
  return { latitude: p.lat, longitude: p.lng };
}

export function DriverMapScreen({ navigation }: Props) {
  const auth = useAuth();
  const token = auth.token;

  const fallbackCenter = useMemo(() => ({ lat: 7.7669, lng: -72.2250 }), []);

  const [coords, setCoords] = useState<Coords | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mapRef = useRef<AppMapRef | null>(null);
  const userInteractedRef = useRef(false);
  const shouldRecenterRef = useRef(false);
  const hasAutoCenteredRef = useRef(false);

  const center = coords ?? null;

  async function syncDriverLocation(next: Coords) {
    if (!token) return;
    if (auth.user?.role !== "DRIVER") return;

    try {
      await apiDriverUpsertLocation(token, next);
    } catch {
      // silencioso: no bloquea UI
    }
  }

  async function refresh(opts?: { animate?: boolean }) {
    const animate = opts?.animate ?? true;
    shouldRecenterRef.current = animate;

    setError(null);
    setLoading(true);

    try {
      // Centro inmediato desde cache (no pide permisos)
      const cached = await readCachedCoords();
      if (cached) setCoords(cached);

      const seq = await preloadCoords();
      const next = seq?.current ?? seq?.fast;
      if (!next) throw new Error("Necesitás habilitar la ubicación para ver el mapa");

      setCoords(next);
      void syncDriverLocation(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo obtener tu ubicación");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh({ animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!coords) return;
    const canAutoCenter = !userInteractedRef.current || shouldRecenterRef.current || !hasAutoCenteredRef.current;
    if (!canAutoCenter) return;

    mapRef.current?.animateToRegion(regionFromCenter(coords, true), 450);
    hasAutoCenteredRef.current = true;
    shouldRecenterRef.current = false;
  }, [coords?.lat, coords?.lng]);

  if (auth.user?.role !== "DRIVER") {
    return (
      <Screen>
        <Card style={{ marginTop: 16 }}>
          <Text style={{ color: colors.text, fontWeight: "900" }}>Solo disponible para ejecutivos</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen style={{ padding: 0 }}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Ionicons name="map-outline" size={18} color={colors.gold} />
          <GoldTitle>Mi mapa</GoldTitle>
        </View>

        <Pressable style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={18} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.mapWrap}>
        <AppMap
          ref={(r) => {
            mapRef.current = r;
          }}
          style={StyleSheet.absoluteFill}
          initialRegion={regionFromCenter(fallbackCenter, true)}
          rotateEnabled
          pitchEnabled={false}
          scrollEnabled
          zoomEnabled
          onUserGesture={() => {
            userInteractedRef.current = true;
          }}
          markers={
            coords ? ([{ id: "me", coordinate: toLatLng(coords), pinColor: colors.gold }] satisfies AppMapMarker[]) : ([] as AppMapMarker[])
          }
        />

        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={colors.gold} />
            <Text style={styles.loadingText}>Cargando ubicación...</Text>
          </View>
        ) : null}

        {!!error ? (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.sheet}>
        <Card style={{ gap: 10 }}>
          <View style={styles.row}>
            <Ionicons name="locate-outline" size={18} color={colors.gold} />
            <Text style={styles.title}>Ubicación actual</Text>
          </View>

          <Text style={styles.small}>
            {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : "—"}
          </Text>

          <PrimaryButton
            label={loading ? "Actualizando..." : "Actualizar ubicación"}
            iconName="locate-outline"
            onPress={() => void refresh({ animate: true })}
            disabled={loading}
          />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
  },
  mapWrap: {
    flex: 1,
    position: "relative",
  },
  loadingOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    color: colors.mutedText,
    fontWeight: "800",
  },
  errorOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    color: colors.danger,
    fontWeight: "900",
  },
  sheet: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    color: colors.text,
    fontWeight: "900",
  },
  small: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
  },
});
