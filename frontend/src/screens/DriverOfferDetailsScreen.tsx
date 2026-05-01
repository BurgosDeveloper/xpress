import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { AppMap, type AppMapMarker, type AppMapRef, type LatLng, type Region } from "../components/AppMap";

import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { GoldTitle } from "../components/GoldTitle";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import { apiCommitOffer, apiGetOfferForDriver } from "../offers/offers.api";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { serviceTypeLabel } from "../utils/serviceType";
import { absoluteUrl } from "../utils/url";
import { PassengerTechSheetModal } from "../passengers/PassengerTechSheetModal";
import { getDrivingRoute } from "../utils/directions";
import { offerStatusLabel } from "../utils/labels";
import { formatCop } from "../utils/currency";

type Props = NativeStackScreenProps<RootStackParamList, "DriverOfferDetails">;

type MapPoint = { lat: number; lng: number };

function regionFromCenter(center: MapPoint): Region {
  return { latitude: center.lat, longitude: center.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 };
}

function toLatLng(p: MapPoint): LatLng {
  return { latitude: p.lat, longitude: p.lng };
}

export function DriverOfferDetailsScreen({ route, navigation }: Props) {
  const auth = useAuth();
  const token = auth.token;

  const offerId = route.params.offerId;

  const [offer, setOffer] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [routePath, setRoutePath] = useState<MapPoint[] | null>(null);

  const mapRef = useRef<AppMapRef | null>(null);

  const [passengerTechOpen, setPassengerTechOpen] = useState(false);

  const passengerTech = useMemo(() => {
    const p = offer?.passenger;
    if (!p) return null;
    const fullName = p.fullName ?? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
    return {
      fullName,
      phone: p.phone ?? null,
      email: p.user?.email ?? null,
      photoUrl: p.photoUrl ?? null,
    };
  }, [offer?.passenger]);

  const pickup = useMemo(() => {
    if (!offer) return null;
    return { lat: Number(offer.pickupLat), lng: Number(offer.pickupLng) };
  }, [offer]);

  const dropoff = useMemo(() => {
    if (!offer) return null;
    return { lat: Number(offer.dropoffLat), lng: Number(offer.dropoffLng) };
  }, [offer]);

  const initialCenter = useMemo(() => pickup ?? { lat: -34.4477, lng: -58.5584 }, [pickup]);

  const fitCoords = useMemo(() => {
    if (!pickup || !dropoff) return null;
    const line = routePath?.length ? routePath : [pickup, dropoff];
    const coords = line
      .filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map(toLatLng);
    return coords.length >= 2 ? coords : null;
  }, [pickup, dropoff, routePath]);

  const polyline = useMemo(() => {
    if (!pickup || !dropoff) return null;
    const line = (routePath?.length ? routePath : [pickup, dropoff]).map(toLatLng);
    return line.length >= 2
      ? {
          id: "offer-route",
          coordinates: line,
          strokeColor: colors.gold,
          strokeWidth: 4,
        }
      : null;
  }, [pickup, dropoff, routePath]);

  const markers = useMemo(() => {
    const items: AppMapMarker[] = [];
    if (pickup) items.push({ id: "pickup", coordinate: toLatLng(pickup), pinColor: colors.gold });
    if (dropoff) items.push({ id: "dropoff", coordinate: toLatLng(dropoff), pinColor: colors.text });
    return items;
  }, [pickup, dropoff]);

  useEffect(() => {
    if (!fitCoords) return;
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(fitCoords, { edgePadding: { top: 70, right: 70, bottom: 70, left: 70 }, animated: false });
    }, 0);
    return () => clearTimeout(t);
  }, [fitCoords]);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetOfferForDriver(token, offerId);
      setOffer(res.offer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la oferta");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, offerId]);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!pickup || !dropoff) {
        setRoutePath(null);
        return;
      }

      const route = await getDrivingRoute({ from: pickup, to: dropoff });
      if (!alive) return;
      setRoutePath(route?.path?.map((p) => ({ lat: p.latitude, lng: p.longitude })) ?? null);
    })();

    return () => {
      alive = false;
    };
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);

  async function commit() {
    if (!token) return;

    setCommitting(true);
    setError(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error("Necesitás habilitar la ubicación para comprometerte");

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };

      const res = await apiCommitOffer(token, offerId, coords);
      Alert.alert("Listo", "Te comprometiste con esta contraoferta.");
      navigation.popToTop();
      navigation.navigate("Home");
      // Opcional: podríamos navegar a una pantalla de ride activo cuando exista.
      void res;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo comprometer la oferta");
    } finally {
      setCommitting(false);
    }
  }

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
      <PassengerTechSheetModal
        visible={passengerTechOpen}
        passenger={passengerTech}
        onClose={() => setPassengerTechOpen(false)}
      />

      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Ionicons name="pricetag-outline" size={18} color={colors.gold} />
          <GoldTitle>Detalle oferta</GoldTitle>
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
          initialRegion={regionFromCenter(initialCenter)}
          rotateEnabled
          pitchEnabled={false}
          scrollEnabled
          zoomEnabled
          onMapReady={() => {
            if (!fitCoords) return;
            mapRef.current?.fitToCoordinates(fitCoords, { edgePadding: { top: 70, right: 70, bottom: 70, left: 70 }, animated: false });
          }}
          polyline={polyline}
          markers={markers}
        />

        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={colors.gold} />
            <Text style={styles.loadingText}>Cargando oferta...</Text>
          </View>
        ) : null}

        {!!error ? (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          <Card style={{ gap: 10 }}>
            {offer ? (
              <>
              <View style={styles.titleRow}>
                <Ionicons name="car-outline" size={18} color={colors.gold} />
                <Text style={styles.title}>Oferta {serviceTypeLabel(offer.serviceTypeWanted)}</Text>
              </View>

              {offer.passenger ? (
                <View style={{ gap: 4, marginTop: 6 }}>
                  <Text style={[styles.line, { color: colors.text, fontWeight: "900" }]}>Cliente</Text>

                  {(() => {
                    const passengerPhotoUri = absoluteUrl(offer.passenger.photoUrl);

                    if (passengerPhotoUri) {
                      return (
                        <View style={styles.passengerRow}>
                          <View style={styles.avatar}>
                            <Image source={{ uri: passengerPhotoUri }} style={styles.avatarImg} resizeMode="cover" />
                          </View>

                          <View style={{ flex: 1, gap: 2 }}>
                            <Text style={styles.line}>
                              Nombre: {offer.passenger.firstName ?? ""} {offer.passenger.lastName ?? ""}
                            </Text>
                            {offer.passenger.phone ? <Text style={styles.line}>Tel: {offer.passenger.phone}</Text> : null}
                          </View>
                        </View>
                      );
                    }

                    return (
                      <>
                        <Text style={styles.line}>
                          Nombre: {offer.passenger.firstName ?? ""} {offer.passenger.lastName ?? ""}
                        </Text>
                        {offer.passenger.phone ? <Text style={styles.line}>Tel: {offer.passenger.phone}</Text> : null}
                      </>
                    );
                  })()}

                  {offer.passenger.user?.email ? <Text style={styles.line}>Correo: {offer.passenger.user.email}</Text> : null}

                  <View style={{ marginTop: 8 }}>
                    <SecondaryButton label="Ficha del cliente" onPress={() => setPassengerTechOpen(true)} />
                  </View>
                </View>
              ) : null}

              <View style={styles.kvRow}>
                <Ionicons name="flag-outline" size={16} color={colors.mutedText} />
                <Text style={styles.line}>Estado: {offerStatusLabel({ status: offer.status, role: auth.user?.role })}</Text>
              </View>

              <View style={styles.kvRow}>
                <Ionicons name="map-outline" size={16} color={colors.mutedText} />
                <Text style={styles.line}>Distancia: {Math.round(Number(offer.distanceMeters ?? 0))} m</Text>
              </View>

              <View style={styles.kvRow}>
                <Ionicons name="cash-outline" size={16} color={colors.mutedText} />
                <Text style={styles.line}>Estimado: {formatCop(Number(offer.estimatedPrice))} • Ofrecido: {formatCop(Number(offer.offeredPrice))}</Text>
              </View>

              <View style={styles.kvRow}>
                <Ionicons name="navigate-outline" size={16} color={colors.mutedText} />
                <Text style={styles.line}>Salida: {offer.pickupAddress ?? `${Number(offer.pickupLat).toFixed(4)}, ${Number(offer.pickupLng).toFixed(4)}`}</Text>
              </View>

              <View style={styles.kvRow}>
                <Ionicons name="location-outline" size={16} color={colors.mutedText} />
                <Text style={styles.line}>Destino: {offer.dropoffAddress ?? `${Number(offer.dropoffLat).toFixed(4)}, ${Number(offer.dropoffLng).toFixed(4)}`}</Text>
              </View>

              <PrimaryButton label={committing ? "Comprometiéndose..." : "Comprometerse"} onPress={() => void commit()} disabled={committing} />
              </>
            ) : (
              <Text style={styles.line}>Sin datos.</Text>
            )}
          </Card>
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
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
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  loadingOverlay: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    color: colors.mutedText,
    fontWeight: "700",
  },
  kvRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorOverlay: {
    position: "absolute",
    top: 12,
    left: 16,
    right: 16,
    backgroundColor: colors.card,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    color: colors.danger,
    fontWeight: "800",
  },
  sheet: {
    maxHeight: "55%",
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  sheetContent: {
    padding: 16,
    paddingBottom: 28,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  passengerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  line: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
  },
});
