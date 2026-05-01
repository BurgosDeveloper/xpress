import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { GoldTitle } from "../components/GoldTitle";
import { colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import { apiNearbyOffers } from "../offers/offers.api";
import type { NearbyOfferItem } from "../offers/offers.types";
import { MiniRouteMap } from "../components/MiniRouteMap";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { serviceTypeLabel } from "../utils/serviceType";
import { ensureForegroundPermission, getLastKnownCoords, getCurrentCoords } from "../utils/location";
import { formatCop } from "../utils/currency";
import { getMatchingRadiusM } from "../config/matchingRadius";
import { subscribeRealtimeEvent } from "../realtime/socket";
import { handleDriverNearbyForegroundRealtime } from "../notifications/foregroundRealtime";

type Props = NativeStackScreenProps<RootStackParamList, "DriverOffersList">;

export function DriverOffersListScreen({ navigation }: Props) {
  const auth = useAuth();
  const token = auth.token;
  const matchingRadiusM = getMatchingRadiusM(auth.appConfig);

  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [items, setItems] = useState<NearbyOfferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSeq = useRef(0);

  const canUse = auth.user?.role === "DRIVER";

  async function ensureLocation() {
    const ok = await ensureForegroundPermission();
    if (!ok) throw new Error("Necesitás habilitar la ubicación para ver contraofertas cercanas");

    const last = await getLastKnownCoords();
    if (last) return last;

    return getCurrentCoords();
  }

  async function refresh() {
    if (!token) return;

    const mySeq = ++refreshSeq.current;
    setError(null);
    setLoading(true);

    try {
      const coords = await ensureLocation();
      if (mySeq !== refreshSeq.current) return;
      setCenter(coords);

      const res = await apiNearbyOffers(token, { lat: coords.lat, lng: coords.lng, radiusM: matchingRadiusM });
      if (mySeq !== refreshSeq.current) return;
      setItems(res.items);
    } catch (e) {
      if (mySeq !== refreshSeq.current) return;
      setError(e instanceof Error ? e.message : "No se pudo cargar las contraofertas");
    } finally {
      if (mySeq !== refreshSeq.current) return;
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, matchingRadiusM]);

  const handleRealtimeNearbyChange = (payload: any) => {
    void handleDriverNearbyForegroundRealtime(payload);
    void refresh();
  };

  useEffect(() => {
    if (!token) return;

    const cleanup = subscribeRealtimeEvent("driver:nearby:changed", handleRealtimeNearbyChange);
    return () => cleanup();
  }, [token, matchingRadiusM]);

  useEffect(() => {
    if (!token) return;

    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") return;
      void refresh();
    });

    return () => {
      sub.remove();
    };
  }, [token, matchingRadiusM]);


  if (!canUse) {
    return (
      <Screen>
        <Card style={{ marginTop: 16 }}>
          <Text style={{ color: colors.text, fontWeight: "900" }}>Solo disponible para ejecutivos</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            <Ionicons name="pricetag-outline" size={18} color={colors.gold} />
            <GoldTitle>Contraofertas</GoldTitle>
          </View>
          <Pressable style={styles.iconBtn} onPress={() => void refresh()}>
            <Ionicons name="refresh" size={18} color={colors.text} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.banner}>
            <ActivityIndicator color={colors.gold} />
            <Text style={styles.bannerText}>Cargando...</Text>
          </View>
        ) : null}

        {!!error ? (
          <View style={[styles.banner, { borderColor: colors.danger }]}>
            <Text style={[styles.bannerText, { color: colors.danger }]}>{error}</Text>
          </View>
        ) : null}

        <Card style={{ marginTop: 16, gap: 6 }}>
          <Text style={styles.small}>Radio: {Math.round(matchingRadiusM)} m</Text>
          {center ? <Text style={styles.small}>Tu ubicación: {center.lat.toFixed(5)}, {center.lng.toFixed(5)}</Text> : null}
          <Text style={styles.small}>Resultados: {items.length}</Text>
        </Card>

        <View style={{ gap: 12, marginTop: 16 }}>
          {items.map((o) => (
            <Pressable key={o.offerId} onPress={() => navigation.navigate("DriverOfferDetails", { offerId: o.offerId })}>
              <Card style={{ gap: 8 }}>
                <View style={styles.itemTitleRow}>
                  <Ionicons name="location-outline" size={16} color={colors.gold} />
                  <Text style={styles.itemTitle}>Oferta {serviceTypeLabel(o.serviceTypeWanted)}</Text>
                </View>
                {o.passenger?.fullName ? <Text style={styles.small}>Cliente: {o.passenger.fullName}</Text> : null}
                {o.passenger?.phone ? <Text style={styles.small}>Teléfono: {o.passenger.phone}</Text> : null}
                <Text style={styles.small}>Distancia: {Math.round(o.distanceMeters)} m</Text>
                <Text style={styles.small}>Estimado: {formatCop(o.estimatedPrice)} • Ofrecido: {formatCop(o.offeredPrice)}</Text>

                <MiniRouteMap
                  pickup={{ lat: o.pickup.lat, lng: o.pickup.lng }}
                  dropoff={{ lat: o.dropoff.lat, lng: o.dropoff.lng }}
                  routePath={o.routePath ?? null}
                  height={120}
                />

                <Text style={styles.small}>Salida: {o.pickup.address ?? `${o.pickup.lat.toFixed(4)}, ${o.pickup.lng.toFixed(4)}`}</Text>
                <Text style={styles.small}>Destino: {o.dropoff.address ?? `${o.dropoff.lat.toFixed(4)}, ${o.dropoff.lng.toFixed(4)}`}</Text>
              </Card>
            </Pressable>
          ))}

          {!loading && items.length === 0 ? (
            <Card>
              <Text style={styles.small}>No hay contraofertas cercanas por ahora.</Text>
            </Card>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  banner: {
    marginTop: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bannerText: {
    color: colors.mutedText,
    fontWeight: "800",
  },
  itemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemTitle: {
    color: colors.text,
    fontWeight: "900",
  },
  small: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
});
