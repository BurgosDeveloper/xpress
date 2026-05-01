import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppMap, type AppMapMarker, type AppMapRef, type LatLng, type Region } from "../components/AppMap";

import type { RootStackParamList } from "../navigation/AppNavigator";
import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { GoldTitle } from "../components/GoldTitle";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import { apiAdminAssignRideDriver, apiAdminListDrivers } from "../admin/admin.api";
import { serviceTypeLabel } from "../utils/serviceType";
import { getDrivingRouteDistanceMeters } from "../utils/directions";

type Props = NativeStackScreenProps<RootStackParamList, "AdminRideAssignMap">;

type DriverRow = any;

type Coords = { lat: number; lng: number };

function regionFromCenter(center: Coords): Region {
  return { latitude: center.lat, longitude: center.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 };
}

function toLatLng(p: Coords): LatLng {
  return { latitude: p.lat, longitude: p.lng };
}

function toNum(v: any): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function haversineMeters(a: Coords, b: Coords) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function AdminRideAssignMapScreen({ route, navigation }: Props) {
  const auth = useAuth();
  const token = auth.token;

  const ride = route.params.ride;

  const pickup = useMemo(() => {
    const lat = toNum(ride?.pickupLat);
    const lng = toNum(ride?.pickupLng);
    return { lat, lng };
  }, [ride?.pickupLat, ride?.pickupLng]);

  const serviceTypeWanted = (ride?.serviceTypeWanted ?? "CARRO") as any;

  const initialCenter = useMemo(() => ({ lat: pickup.lat, lng: pickup.lng }), [pickup.lat, pickup.lng]);

  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedDriver, setSelectedDriver] = useState<DriverRow | null>(null);
  const [selectedRouteDistance, setSelectedRouteDistance] = useState<number | null>(null);
  const [routeDistanceLoading, setRouteDistanceLoading] = useState(false);

  const mapRef = useRef<AppMapRef | null>(null);

  const title = useMemo(() => {
    const shortId = ride?.id ? String(ride.id).slice(-6) : "—";
    return `Asignar #${shortId}`;
  }, [ride?.id]);

  async function loadDrivers() {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const res = await apiAdminListDrivers(token);
      const filtered = (res.drivers ?? [])
        .filter((d: any) => d?.user?.isActive !== false)
        .filter((d: any) => !!d?.location)
        .filter((d: any) => !serviceTypeWanted || d?.serviceType === serviceTypeWanted);

      setDrivers(filtered);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar choferes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDrivers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, serviceTypeWanted]);

  async function assign() {
    if (!token) return;
    if (!ride?.id) return;
    if (!selectedDriver?.id) return;

    setAssigning(true);
    setError(null);
    try {
      await apiAdminAssignRideDriver(token, { rideId: ride.id, driverId: selectedDriver.id });
      Alert.alert("Listo", "Chofer asignado.");
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo asignar el chofer");
    } finally {
      setAssigning(false);
    }
  }

  const selectedDistanceApprox = useMemo(() => {
    if (!selectedDriver?.location) return null;
    const dpos = { lat: toNum(selectedDriver.location.lat), lng: toNum(selectedDriver.location.lng) };
    return Math.round(haversineMeters(pickup, dpos));
  }, [pickup, selectedDriver?.location]);

  useEffect(() => {
    let cancelled = false;
    setSelectedRouteDistance(null);

    if (!selectedDriver?.location) return;
    const to = { lat: toNum(selectedDriver.location.lat), lng: toNum(selectedDriver.location.lng) };
    if (!Number.isFinite(to.lat) || !Number.isFinite(to.lng) || (to.lat === 0 && to.lng === 0)) return;

    setRouteDistanceLoading(true);
    void (async () => {
      const dist = await getDrivingRouteDistanceMeters({ from: pickup, to });
      if (cancelled) return;
      setSelectedRouteDistance(dist);
      setRouteDistanceLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [pickup.lat, pickup.lng, selectedDriver?.location]);

  const markers = useMemo(() => {
    const items: AppMapMarker[] = [{ id: "pickup", coordinate: toLatLng(pickup), pinColor: colors.gold }];

    for (const d of drivers) {
      const lat = toNum(d.location?.lat);
      const lng = toNum(d.location?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue;
      const isSel = selectedDriver?.id === d.id;

      items.push({
        id: `driver-${String(d.id)}`,
        coordinate: toLatLng({ lat, lng }),
        pinColor: isSel ? colors.gold : colors.danger,
        onPress: () => setSelectedDriver(d),
      });
    }

    return items;
  }, [pickup.lat, pickup.lng, drivers, selectedDriver?.id]);

  return (
    <Screen style={{ padding: 0 }}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Ionicons name="pin-outline" size={18} color={colors.gold} />
          <GoldTitle>{title}</GoldTitle>
        </View>

        <Pressable onPress={() => void loadDrivers()} style={({ pressed }) => [styles.refreshBtn, pressed && styles.pressed]}>
          <Ionicons name="refresh" size={18} color={colors.gold} />
        </Pressable>
      </View>

      <View style={styles.mapWrap}>
        <AppMap
          ref={(r) => {
            mapRef.current = r;
          }}
          style={StyleSheet.absoluteFill}
          initialRegion={regionFromCenter(initialCenter)}
          rotateEnabled
          pitchEnabled={false}
          scrollEnabled
          zoomEnabled
          markers={markers}
        />

        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={colors.gold} />
            <Text style={styles.loadingText}>Cargando choferes...</Text>
          </View>
        ) : null}

        {!!error ? (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.sheet}>
          <Card style={{ gap: 10 }}>
            <Text style={styles.sheetTitle}>Servicio: {serviceTypeLabel(serviceTypeWanted)}</Text>
            <Text style={styles.sheetLine}>Choferes en mapa: {drivers.length}</Text>

            {selectedDriver ? (
              <View style={{ gap: 6 }}>
                <Text style={styles.sheetLine}>Seleccionado: {selectedDriver.fullName}</Text>
                <Text style={styles.sheetLine}>Tel: {selectedDriver.phone || "—"}</Text>
                {selectedRouteDistance != null ? (
                  <Text style={styles.sheetLine}>Distancia por ruta: {selectedRouteDistance} m</Text>
                ) : routeDistanceLoading ? (
                  <Text style={styles.sheetLine}>Distancia por ruta: calculando...</Text>
                ) : null}
                {selectedDistanceApprox != null ? <Text style={styles.sheetLine}>Distancia aprox (recta): {selectedDistanceApprox} m</Text> : null}
              </View>
            ) : (
              <Text style={styles.sheetMuted}>Toca un chofer en el mapa para seleccionarlo.</Text>
            )}

            <PrimaryButton
              label={assigning ? "Asignando..." : "Asignar chofer"}
              onPress={() => void assign()}
              disabled={!selectedDriver || assigning}
            />

            <SecondaryButton label="Volver" onPress={() => navigation.goBack()} disabled={assigning} />
          </Card>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  refreshBtn: {
    width: 44,
    height: 44,
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
  mapWrap: {
    flex: 1,
  },
  loadingOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
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
    top: 66,
    left: 12,
    right: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.card,
  },
  errorText: {
    color: colors.danger,
    fontWeight: "900",
  },
  sheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
  },
  sheetTitle: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 15,
  },
  sheetLine: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 13,
  },
  sheetMuted: {
    color: colors.mutedText,
    fontWeight: "800",
    fontSize: 13,
  },
});
