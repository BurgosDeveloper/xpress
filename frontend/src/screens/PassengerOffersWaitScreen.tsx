import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { GoldTitle } from "../components/GoldTitle";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import {
  apiCancelRide,
  apiGetDriverTechSheet,
  apiGetRideById,
  apiGetRideOffers,
  apiRejectRideOffer,
  apiSelectRideDriver,
} from "../rides/rides.api";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { DriverTechSheetModal } from "../drivers/DriverTechSheetModal";
import { absoluteUrl } from "../utils/url";
import { MiniMeetMap } from "../components/MiniMeetMap";
import { MiniRouteMap } from "../components/MiniRouteMap";
import { clearActiveRideOffersRideId, setActiveRideOffersRideId } from "../lib/storage";
import { serviceTypeIconName, serviceTypeLabel } from "../utils/serviceType";
import { formatCop } from "../utils/currency";
import { subscribeRealtimeEvent } from "../realtime/socket";
import { handleRideChangedForegroundRealtime } from "../notifications/foregroundRealtime";

type Props = NativeStackScreenProps<RootStackParamList, "PassengerOffersWait">;

type RideOfferItem = {
  driverId: string;
  fullName: string;
  photoUrl?: string | null;
  distanceMeters: number;
  vehicle?: any;
  serviceType?: string;
  driverLocation?: { lat: number; lng: number; updatedAt?: string };
};

export function PassengerOffersWaitScreen({ route, navigation }: Props) {
  const auth = useAuth();
  const token = auth.token;
  const { rideId } = route.params;

  const [items, setItems] = useState<RideOfferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pickup, setPickup] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoff, setDropoff] = useState<{ lat: number; lng: number } | null>(null);
  const [routePath, setRoutePath] = useState<{ lat: number; lng: number }[] | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);

  const [actionDriverId, setActionDriverId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const [techOpen, setTechOpen] = useState(false);
  const [techDriver, setTechDriver] = useState<any | null>(null);
  const [techLoading, setTechLoading] = useState(false);

  const refreshSeq = useRef(0);
  const firstLoadRef = useRef(true);

  const canUse = auth.user?.role === "USER";

  async function refresh() {
    if (!token) return;

    const mySeq = ++refreshSeq.current;
    setError(null);
    const showSpinner = firstLoadRef.current;
    if (showSpinner) setLoading(true);

    try {
      const rideRes = await apiGetRideById(token, { rideId });
      if (mySeq !== refreshSeq.current) return;

      const ride = rideRes.ride;
      const pickupLat = Number(ride?.pickupLat);
      const pickupLng = Number(ride?.pickupLng);
      if (Number.isFinite(pickupLat) && Number.isFinite(pickupLng)) {
        setPickup({ lat: pickupLat, lng: pickupLng });
      }

      const dropoffLat = Number(ride?.dropoffLat);
      const dropoffLng = Number(ride?.dropoffLng);
      if (Number.isFinite(dropoffLat) && Number.isFinite(dropoffLng)) {
        setDropoff({ lat: dropoffLat, lng: dropoffLng });
      }

      const dist = Number(ride?.distanceMeters);
      setDistanceMeters(Number.isFinite(dist) ? dist : null);

      const price = Number(ride?.estimatedPrice);
      setEstimatedPrice(Number.isFinite(price) ? price : null);

      const rp = (ride?.routePath ?? null) as any;
      setRoutePath(Array.isArray(rp) && rp.length >= 2 ? (rp as any) : null);

      const status = ride?.status as string | undefined;
      const matchedName = ride?.matchedDriver?.fullName as string | undefined;

      if (status && status !== "OPEN" && matchedName) {
        navigation.replace("PassengerWaiting", { rideId, driverName: matchedName });
        return;
      }

      const res = await apiGetRideOffers(token, { rideId });
      if (mySeq !== refreshSeq.current) return;

      setItems((res.items ?? []) as RideOfferItem[]);
    } catch (e) {
      if (mySeq !== refreshSeq.current) return;
      setError(e instanceof Error ? e.message : "No se pudo cargar los ejecutivos");
    } finally {
      if (mySeq !== refreshSeq.current) return;
      if (showSpinner) setLoading(false);
      firstLoadRef.current = false;
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, rideId]);

  useEffect(() => {
    void setActiveRideOffersRideId(rideId);
  }, [rideId]);

  useEffect(() => {
    if (!token) return;
    const t = setInterval(() => {
      void refresh();
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, rideId]);

  const handleRealtimeRideChange = (payload: any) => {
    const payloadRideId = payload?.rideId != null ? String(payload.rideId) : "";
    if (payloadRideId && payloadRideId !== rideId) return;
    void handleRideChangedForegroundRealtime({ role: "USER", payload });
    void refresh();
  };

  useEffect(() => {
    if (!token) return;

    const cleanups = [
      subscribeRealtimeEvent("ride:offers:changed", handleRealtimeRideChange),
      subscribeRealtimeEvent("ride:matched", handleRealtimeRideChange),
      subscribeRealtimeEvent("ride:changed", handleRealtimeRideChange),
    ];

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [token, rideId]);

  useEffect(() => {
    if (!token) return;

    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") return;
      void refresh();
    });

    return () => {
      sub.remove();
    };
  }, [token, rideId]);

  async function openTechSheet(driverId: string) {
    if (!token) return;

    setTechLoading(true);
    try {
      const res = await apiGetDriverTechSheet(token, { driverId });
      setTechDriver(res.driver);
      setTechOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la ficha técnica");
    } finally {
      setTechLoading(false);
    }
  }

  async function selectDriver(driver: RideOfferItem) {
    if (!token) return;

    setActionDriverId(driver.driverId);
    setError(null);
    try {
      const matched = await apiSelectRideDriver(token, { rideId, driverId: driver.driverId });
      navigation.replace("PassengerWaiting", { rideId: matched.ride.id, driverName: driver.fullName });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo seleccionar el ejecutivo");
    } finally {
      setActionDriverId(null);
    }
  }

  async function rejectDriver(driver: RideOfferItem) {
    if (!token) return;

    setActionDriverId(driver.driverId);
    setError(null);
    try {
      await apiRejectRideOffer(token, { rideId, driverId: driver.driverId });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo quitar el ejecutivo");
    } finally {
      setActionDriverId(null);
    }
  }

  async function cancelRideNow() {
    if (!token) return;

    setCancelLoading(true);
    setError(null);
    try {
      await apiCancelRide(token, { rideId });
      await clearActiveRideOffersRideId();
      navigation.popToTop();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cancelar el servicio");
    } finally {
      setCancelLoading(false);
    }
  }

  function confirmCancelRide() {
    Alert.alert("Cancelar servicio", "Vas a cancelar tu solicitud. ¿Querés continuar?", [
      { text: "Volver", style: "cancel" },
      {
        text: "Cancelar",
        style: "destructive",
        onPress: () => {
          void cancelRideNow();
        },
      },
    ]);
  }

  if (!canUse) {
    return (
      <Screen>
        <Card style={{ marginTop: 16 }}>
          <Text style={{ color: colors.text, fontWeight: "900" }}>Solo disponible para clientes</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <DriverTechSheetModal
        visible={techOpen}
        driver={techDriver}
        onClose={() => {
          setTechOpen(false);
          setTechDriver(null);
        }}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            <Ionicons name="time-outline" size={18} color={colors.gold} />
            <GoldTitle>Ejecutivos disponibles</GoldTitle>
          </View>

          <Pressable style={styles.iconBtn} onPress={() => void refresh()}>
            <Ionicons name="refresh" size={18} color={colors.text} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.banner}>
            <ActivityIndicator color={colors.gold} />
            <Text style={styles.bannerText}>Buscando ofertas...</Text>
          </View>
        ) : null}

        {!!error ? (
          <View style={[styles.banner, { borderColor: colors.danger }]}>
            <Text style={[styles.bannerText, { color: colors.danger }]}>{error}</Text>
          </View>
        ) : null}

        <View style={{ marginTop: 10 }}>
          <SecondaryButton
            label={cancelLoading ? "Cancelando..." : "Cancelar servicio"}
            onPress={confirmCancelRide}
            disabled={cancelLoading}
          />
        </View>

        <Card style={{ marginTop: 16, gap: 6 }}>

                  {pickup && dropoff ? (
                    <Card style={{ marginTop: 16, gap: 10 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={styles.summaryIcon}>
                          <Ionicons name="navigate-outline" size={18} color={colors.gold} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.summaryTitle}>Ruta</Text>
                          <Text style={styles.summaryValue}>
                            {distanceMeters != null ? `${Math.round(distanceMeters)} m` : "-"}
                          </Text>
                        </View>
                      </View>

                      <MiniRouteMap pickup={pickup} dropoff={dropoff} routePath={routePath} height={140} />

                      <View style={styles.bigRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.bigLabel}>Distancia</Text>
                          <Text style={styles.bigValue}>{distanceMeters != null ? `${Math.round(distanceMeters)} m` : "-"}</Text>
                        </View>
                        <View style={{ flex: 1, alignItems: "flex-end" }}>
                          <Text style={styles.bigLabel}>Monto</Text>
                          <Text style={styles.bigValue}>
                            {estimatedPrice != null ? formatCop(Number(estimatedPrice)) : "-"}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.approxRow}>
                        <Ionicons name="information-circle-outline" size={16} color={colors.mutedText} />
                        <Text style={styles.approxText}>
                          Distancia <Ionicons name="navigate-outline" size={14} color={colors.mutedText} /> y monto{" "}
                          <Ionicons name="cash-outline" size={14} color={colors.mutedText} /> son aproximados. El taxímetro define el valor real.
                        </Text>
                      </View>
                    </Card>
                  ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={styles.summaryIcon}>
              <Ionicons name="people-outline" size={18} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle}>Ofertas recibidas</Text>
              <Text style={styles.summaryValue}>{items.length}</Text>
            </View>
          </View>
        </Card>

        <View style={{ gap: 12, marginTop: 16 }}>
          {items.map((d) => {
            const busy = actionDriverId === d.driverId;

            const driverLat = Number(d.driverLocation?.lat);
            const driverLng = Number(d.driverLocation?.lng);
            const canMap = Boolean(pickup && Number.isFinite(driverLat) && Number.isFinite(driverLng));

            return (
              <Card key={d.driverId} style={{ gap: 10 }}>
                <View style={styles.itemHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                    {d.photoUrl ? (
                      <Image
                        source={{ uri: absoluteUrl(d.photoUrl) ?? undefined }}
                        style={styles.avatar}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Ionicons name="person-outline" size={18} color={colors.gold} />
                      </View>
                    )}

                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{d.fullName}</Text>
                      <View style={styles.itemMetaRow}>
                        <Ionicons name="walk-outline" size={14} color={colors.mutedText} />
                        <Text style={styles.itemMetaText}>{Math.round(d.distanceMeters)} m</Text>
                      </View>
                      {d.serviceType ? (
                        <View style={styles.itemMetaRow}>
                          <Ionicons name={serviceTypeIconName(d.serviceType as any)} size={14} color={colors.mutedText} />
                          <Text style={styles.itemMetaText}>{serviceTypeLabel(d.serviceType as any)}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>

                {canMap ? (
                  <MiniMeetMap
                    height={120}
                    driver={{ lat: driverLat, lng: driverLng }}
                    passenger={{ lat: pickup!.lat, lng: pickup!.lng }}
                    driverIconName="car"
                    passengerIconName="person"
                  />
                ) : null}

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <SecondaryButton
                      label={techLoading ? "Cargando ficha..." : "Ficha técnica"}
                      onPress={() => void openTechSheet(d.driverId)}
                      disabled={techLoading || busy}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <SecondaryButton label={busy ? "Quitando..." : "Quitar"} onPress={() => void rejectDriver(d)} disabled={busy} />
                  </View>
                </View>

                <PrimaryButton
                  label={busy ? "Seleccionando..." : "Seleccionar ejecutivo"}
                  onPress={() => void selectDriver(d)}
                  disabled={busy}
                />
              </Card>
            );
          })}

          {!loading && items.length === 0 ? (
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ionicons name="time-outline" size={18} color={colors.gold} />
                <Text style={styles.small}>Aún no hay ejecutivos ofrecidos. Mantené esta pantalla abierta.</Text>
              </View>
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
  small: {
    color: colors.mutedText,
    fontWeight: "800",
    fontSize: 13,
    lineHeight: 18,
  },
  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  summaryTitle: {
    color: colors.mutedText,
    fontWeight: "900",
    fontSize: 13,
    lineHeight: 18,
  },
  summaryValue: {
    marginTop: 2,
    color: colors.text,
    fontWeight: "900",
    fontSize: 22,
    lineHeight: 26,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemTitle: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 16,
  },
  itemMetaRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bigRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 2,
  },
  bigLabel: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "800",
  },
  bigValue: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
  },
  approxRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  approxText: {
    flex: 1,
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  itemMetaText: {
    color: colors.mutedText,
    fontWeight: "800",
    fontSize: 13,
    lineHeight: 18,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  avatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
});
