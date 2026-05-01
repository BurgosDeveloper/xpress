import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppMap, type AppMapMarker, type AppMapRef, type LatLng, type Region } from "../components/AppMap";

import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { GoldTitle } from "../components/GoldTitle";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import { apiCreateOffer, apiEstimateOffer } from "../offers/offers.api";
import type { ServiceType } from "../rides/rides.types";
import { serviceTypeHasCargo, serviceTypeIconName, serviceTypeLabel } from "../utils/serviceType";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { getDrivingRoute } from "../utils/directions";
import { ensureForegroundPermission, getCurrentCoords, getFastCoords, readCachedCoords } from "../utils/location";
import { formatCop, formatSecondaryFromCop } from "../utils/currency";
import { ApiError } from "../lib/api";
import { apiGetPublicZones, type PublicZone } from "../config/config.api";
import { buildWhatsappLink } from "../utils/whatsapp";
import { getMatchingRadiusM } from "../config/matchingRadius";

type Props = NativeStackScreenProps<RootStackParamList, "PassengerMakeOffer">;

type MapPoint = { lat: number; lng: number };

function regionFromCenter(center: MapPoint): Region {
  return { latitude: center.lat, longitude: center.lng, latitudeDelta: 0.00082, longitudeDelta: 0.00082 };
}

function toLatLng(p: MapPoint): LatLng {
  return { latitude: p.lat, longitude: p.lng };
}

function downsampleRoutePath(path: MapPoint[], maxPoints: number) {
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

function routeRequestKey(from?: MapPoint | null, to?: MapPoint | null) {
  if (!from || !to) return "";
  const r = (n: number) => Math.round(n * 1e5) / 1e5;
  return `${r(from.lat)},${r(from.lng)}->${r(to.lat)},${r(to.lng)}`;
}

const ROUTE_PAYLOAD_MAX_POINTS = 450;

export function PassengerMakeOfferScreen({ navigation }: Props) {
  const auth = useAuth();
  const token = auth.token;
  const matchingRadiusM = getMatchingRadiusM(auth.appConfig);

  const [zones, setZones] = useState<PublicZone[]>([]);

  const operatorPhone = useMemo(() => {
    const fromConfig = auth.appConfig?.zoeWhatsappPhone;
    const fromEnv = process.env.EXPO_PUBLIC_OPERATOR_PHONE;
    return (fromConfig && fromConfig.trim()) || (fromEnv && fromEnv.trim()) || "04245687814";
  }, [auth.appConfig?.zoeWhatsappPhone]);

  const operatorLink = useMemo(() => {
    return buildWhatsappLink({
      phone: operatorPhone,
      text: "Hola, necesito ayuda de ZOE.",
    });
  }, [operatorPhone]);

  async function openOperator() {
    await Linking.openURL(operatorLink);
  }

  const [pickup, setPickup] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoff, setDropoff] = useState<{ lat: number; lng: number } | null>(null);
  const [serviceTypeWanted, setServiceTypeWanted] = useState<ServiceType>("CARRO");

  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [routePath, setRoutePath] = useState<MapPoint[] | null>(null);
  const [routeDataKey, setRouteDataKey] = useState<string | null>(null);
  const [isFixedPrice, setIsFixedPrice] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);

  const mapRef = useRef<AppMapRef | null>(null);
  const userInteractedRef = useRef(false);
  const shouldRecenterRef = useRef(false);
  const hasAutoCenteredRef = useRef(false);
  const pickupSeqRef = useRef(0);
  const estimateSeqRef = useRef(0);
  const autofilledOfferRef = useRef<string>("");
  const manualEstimateRef = useRef(false);
  const estimateInFlightRef = useRef(false);

  const [offeredPriceText, setOfferedPriceText] = useState<string>("");
  const offeredPriceNumber = useMemo(() => {
    const v = Number(offeredPriceText.replace(",", "."));
    if (!Number.isFinite(v)) return null;
    return v;
  }, [offeredPriceText]);

  const estimatedSecondary = useMemo(() => {
    if (estimatedPrice == null) return null;
    return formatSecondaryFromCop(estimatedPrice, auth.appConfig ?? {});
  }, [estimatedPrice, auth.appConfig]);

  const offeredSecondary = useMemo(() => {
    if (offeredPriceNumber == null) return null;
    return formatSecondaryFromCop(offeredPriceNumber, auth.appConfig ?? {});
  }, [offeredPriceNumber, auth.appConfig]);

  const [loading, setLoading] = useState(true);
  const [estimating, setEstimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialCenter = useMemo(() => pickup ?? { lat: 0, lng: 0 }, [pickup]);
  const currentRouteKey = useMemo(() => routeRequestKey(pickup, dropoff), [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);

  useEffect(() => {
    // Centro instantáneo desde cache (no pide permisos).
    void (async () => {
      const cached = await readCachedCoords();
      if (cached && !pickup) setPickup(cached);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pickup) return;
    const canAutoCenter = !userInteractedRef.current || shouldRecenterRef.current || !hasAutoCenteredRef.current;
    if (!canAutoCenter) return;

    mapRef.current?.animateToRegion(regionFromCenter(pickup), 450);
    hasAutoCenteredRef.current = true;
    shouldRecenterRef.current = false;
  }, [pickup?.lat, pickup?.lng]);

  async function refreshPickup(opts?: { showError?: boolean; animate?: boolean }) {
    const showError = opts?.showError ?? true;
    const animate = opts?.animate ?? true;
    shouldRecenterRef.current = animate;

    const mySeq = ++pickupSeqRef.current;
    const showSpinner = !pickup;
    if (showSpinner) setLoading(true);
    setError(null);

    try {
      const ok = await ensureForegroundPermission();
      if (!ok) throw new Error("Necesitás habilitar la ubicación para crear una oferta");

      const fast = await getFastCoords();
      if (mySeq !== pickupSeqRef.current) return;
      if (fast) setPickup(fast);

      try {
        const current = await getCurrentCoords();
        if (mySeq !== pickupSeqRef.current) return;
        setPickup(current);
      } catch {
        // silencioso: con fast coords ya se puede usar.
      }
    } catch (e) {
      if (showError) {
        setError(e instanceof Error ? e.message : "No se pudo obtener tu ubicación");
      }
    } finally {
      if (showSpinner && mySeq === pickupSeqRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    if (pickup) return;
    void refreshPickup({ showError: true, animate: true });
  }, [token, pickup]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await apiGetPublicZones();
        if (!alive) return;
        setZones(Array.isArray(res.zones) ? res.zones : []);
      } catch {
        if (!alive) return;
        setZones([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  function requestRecenter() {
    userInteractedRef.current = false;
    shouldRecenterRef.current = true;
    hasAutoCenteredRef.current = false;
    void refreshPickup({ showError: true, animate: true });
  }

  useEffect(() => {
    // Si cambia el destino, pedimos regenerar estimado y distancia.
    setEstimatedPrice(null);
    setDistanceMeters(null);
    setDurationSeconds(null);
    setRoutePath(null);
    setRouteDataKey(null);
    setIsFixedPrice(false);
    setOfferedPriceText("");
    autofilledOfferRef.current = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropoff?.lat, dropoff?.lng]);

  useEffect(() => {
    // Si cambia el servicio, pedimos regenerar estimado (la distancia no depende del tipo).
    setEstimatedPrice(null);
    setIsFixedPrice(false);
    setOfferedPriceText("");
    autofilledOfferRef.current = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceTypeWanted]);

  const fitCoords = useMemo(() => {
    const line = pickup && dropoff ? (routePath?.length ? routePath : [pickup, dropoff]) : null;
    if (!line || line.length < 2) return null;
    const coords = line
      .filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map(toLatLng);
    return coords.length >= 2 ? coords : null;
  }, [pickup, dropoff, routePath]);

  const polyline = useMemo(() => {
    if (!routePath?.length) return null;
    const line = routePath.map(toLatLng);
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

  async function ensureRouteData(opts?: { showError?: boolean }) {
    if (!pickup || !dropoff) return null;
    if (routeDataKey === currentRouteKey && routePath?.length && distanceMeters != null && distanceMeters > 0) {
      return { routePath, distanceMeters, durationSeconds };
    }
    const showError = opts?.showError ?? true;

    setRouteLoading(true);
    try {
      const route = await getDrivingRoute({ from: pickup, to: dropoff });
      const rawPath = route?.path?.map((p) => ({ lat: p.latitude, lng: p.longitude })) ?? null;
      const nextPath = rawPath?.length ? downsampleRoutePath(rawPath, ROUTE_PAYLOAD_MAX_POINTS) : null;
      const nextDistance = route?.distanceMeters ?? null;
      const nextDuration = route?.durationSeconds ?? null;

      setRoutePath(nextPath);
      setRouteDataKey(nextPath && nextDistance != null ? currentRouteKey : null);
      setDistanceMeters(nextDistance);
      setDurationSeconds(nextDuration);

      if ((!nextPath || nextDistance == null || nextDistance <= 0) && showError) {
        setError("No se pudo trazar la ruta en este momento. Reintentá.");
      }

      return nextPath && nextDistance != null
        ? { routePath: nextPath, distanceMeters: nextDistance, durationSeconds: nextDuration }
        : null;
    } finally {
      setRouteLoading(false);
    }
  }

  async function estimateNow(opts?: { showLoading?: boolean; openWhatsappOnNegotiate?: boolean; autofillPrice?: boolean }) {
    if (!token || !pickup || !dropoff) return;
    if (estimateInFlightRef.current) return;

    const showLoading = opts?.showLoading ?? true;
    estimateInFlightRef.current = true;
    if (showLoading) {
      manualEstimateRef.current = true;
      setEstimating(true);
    }
    setError(null);

    try {
      const mySeq = ++estimateSeqRef.current;
      const ensuredRoute = await ensureRouteData({ showError: false });
      const currentDistance = ensuredRoute?.distanceMeters ?? (routeDataKey === currentRouteKey ? distanceMeters : null);
      const currentDuration = ensuredRoute?.durationSeconds ?? (routeDataKey === currentRouteKey ? durationSeconds : null);
      const currentPath = ensuredRoute?.routePath ?? (routeDataKey === currentRouteKey ? routePath : null);

      const res = await apiEstimateOffer(token, {
        serviceTypeWanted,
        pickup,
        dropoff,
        distanceMeters: currentDistance ?? undefined,
        durationSeconds: currentDuration ?? undefined,
        routePath: currentPath ?? undefined,
        wantsAC: false,
        wantsTrunk: false,
        wantsPets: false,
      });

      if (mySeq !== estimateSeqRef.current) return;

      setEstimatedPrice(res.estimatedPrice);
      setDistanceMeters(res.distanceMeters);
      setDurationSeconds(res.durationSeconds ?? durationSeconds);
      setIsFixedPrice(Boolean(res.isFixedPrice));
      if (Array.isArray(res.routePath) && res.routePath.length >= 2) {
        setRoutePath(downsampleRoutePath(res.routePath, ROUTE_PAYLOAD_MAX_POINTS));
        setRouteDataKey(currentRouteKey || null);
      }

      if (opts?.autofillPrice && (!offeredPriceText.trim() || offeredPriceText.trim() === autofilledOfferRef.current)) {
        const nextText = String(res.estimatedPrice);
        autofilledOfferRef.current = nextText;
        setOfferedPriceText(nextText);
      }
    } catch (e) {
      if (e instanceof ApiError && e.data?.code === "NEGOTIATE_WHATSAPP") {
        setEstimatedPrice(null);
        setIsFixedPrice(false);
        try {
          if (opts?.openWhatsappOnNegotiate) {
            await openOperator();
            return;
          }
        } catch {
          // si falla abrir WhatsApp, seguimos a mensaje
        }
        setError("Ese recorrido se negocia por WhatsApp.");
        return;
      }
      if (showLoading || estimatedPrice == null) {
        setError(e instanceof Error ? e.message : "No se pudo estimar el precio");
      }
    } finally {
      estimateInFlightRef.current = false;
      if (showLoading) {
        setEstimating(false);
        manualEstimateRef.current = false;
      }
    }
  }

  async function submit() {
    if (!token || !pickup || !dropoff) return;

    const ensuredRoute = routeDataKey === currentRouteKey && routePath?.length && distanceMeters != null ? { routePath, distanceMeters, durationSeconds } : await ensureRouteData({ showError: false });

    // Validación previa: evita publicar ofertas fuera de SC / sin fijo (debe ir a WhatsApp).
    try {
      await apiEstimateOffer(token, {
        serviceTypeWanted,
        pickup,
        dropoff,
        distanceMeters: ensuredRoute?.distanceMeters ?? distanceMeters ?? undefined,
        durationSeconds: ensuredRoute?.durationSeconds ?? durationSeconds ?? undefined,
        routePath: ensuredRoute?.routePath ?? routePath ?? undefined,
        wantsAC: false,
        wantsTrunk: false,
        wantsPets: false,
      });
    } catch (e) {
      if (e instanceof ApiError && e.data?.code === "NEGOTIATE_WHATSAPP") {
        try {
          await openOperator();
          return;
        } catch {
          // fallback al mensaje
        }
      }
      setError(e instanceof Error ? e.message : "No se pudo validar la zona/tarifa");
      return;
    }

    if (estimatedPrice == null) {
      Alert.alert("Falta estimado", "Primero generá el estimado para poder publicar la contraoferta.");
      return;
    }
    if (offeredPriceNumber == null || offeredPriceNumber <= 0) {
      Alert.alert("Precio inválido", "Ingresá un monto válido para tu contraoferta.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await apiCreateOffer(token, {
        serviceTypeWanted,
        pickup,
        dropoff,
        distanceMeters: ensuredRoute?.distanceMeters ?? distanceMeters ?? undefined,
        durationSeconds: ensuredRoute?.durationSeconds ?? durationSeconds ?? undefined,
        routePath: ensuredRoute?.routePath ?? routePath ?? undefined,
        offeredPrice: offeredPriceNumber,
        searchRadiusM: matchingRadiusM,
      });

      Alert.alert("Listo", "Tu contraoferta fue publicada.");
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo publicar la contraoferta");
    } finally {
      setSubmitting(false);
    }
  }

  if (auth.user?.role !== "USER") {
    return (
      <Screen>
        <Card style={{ marginTop: 16 }}>
          <Text style={{ color: colors.text, fontWeight: "900" }}>Solo disponible para clientes</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen style={{ padding: 0 }}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Ionicons name="cash-outline" size={18} color={colors.gold} />
          <GoldTitle>Hacer oferta</GoldTitle>
        </View>

        <View style={styles.topBarRight}>
          <Pressable
            style={({ pressed }) => [styles.locateBtn, pressed && styles.pressed]}
            onPress={requestRecenter}
            accessibilityRole="button"
            accessibilityLabel="Centrar en mi ubicación"
          >
            <Ionicons name="locate-outline" size={18} color={colors.gold} />
          </Pressable>

          <Pressable style={styles.closeBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.mapWrap}>
        <AppMap
          ref={(r) => {
            mapRef.current = r;
          }}
          style={StyleSheet.absoluteFill}
          initialRegion={regionFromCenter(initialCenter)}
          rotateEnabled={true}
          pitchEnabled={false}
          scrollEnabled
          zoomEnabled
          polygons={zones
            .filter((z) => z && z.id && (z as any).geojson)
            .map((z) => ({
              id: z.id,
              geojson: (z as any).geojson,
              fillOpacity: z.isHub ? 0.16 : 0.1,
              lineOpacity: z.isHub ? 0.7 : 0.45,
              lineWidth: z.isHub ? 2.5 : 2,
            }))}
          onUserGesture={() => {
            userInteractedRef.current = true;
          }}
          onPress={(c) => {
            setDropoff({ lat: c.latitude, lng: c.longitude });
            setError(null);
          }}
          onMapReady={() => {
            if (fitCoords) {
              mapRef.current?.fitToCoordinates(fitCoords, { edgePadding: { top: 70, right: 70, bottom: 70, left: 70 }, animated: false });
              return;
            }

            if (!pickup) return;
            const canAutoCenter = !userInteractedRef.current || shouldRecenterRef.current || !hasAutoCenteredRef.current;
            if (!canAutoCenter) return;

            mapRef.current?.animateToRegion(regionFromCenter(pickup), 0);
            hasAutoCenteredRef.current = true;
            shouldRecenterRef.current = false;
          }}
          polyline={polyline}
          markers={markers}
        />

        {loading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={colors.gold} />
            <Text style={styles.loadingText}>Obteniendo tu ubicación...</Text>
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
            <Text style={styles.hint}>Tocá el mapa para elegir el destino.</Text>

            <View style={styles.pillRow}>
              {(["CARRO", "MOTO", "MOTO_CARGA", "CARRO_CARGA"] as const).map((t) => {
                const active = serviceTypeWanted === t;
                const iconColor = active ? colors.gold : colors.mutedText;

                return (
                  <Pressable key={t} style={[styles.pill, active ? styles.pillActive : null]} onPress={() => setServiceTypeWanted(t)}>
                    <View style={styles.pillInner}>
                      <View style={styles.pillIconWrap}>
                        <Ionicons name={serviceTypeIconName(t)} size={16} color={iconColor} />
                        {serviceTypeHasCargo(t) ? (
                          <View style={styles.pillCargoBadge}>
                            <Ionicons name="cube-outline" size={10} color={iconColor} />
                          </View>
                        ) : null}
                      </View>

                      <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{serviceTypeLabel(t)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.line}>Radio de búsqueda: {Math.round(matchingRadiusM)} m</Text>

            {distanceMeters != null ? <Text style={styles.line}>Distancia estimada: {Math.round(distanceMeters)} m</Text> : null}

            {estimatedPrice != null ? (
              <View style={styles.moneyBlock}>
                <Text style={styles.moneyLabel}>Precio estimado</Text>
                <Text style={styles.moneyMain}>{formatCop(estimatedPrice)}</Text>
                {estimatedSecondary ? <Text style={styles.moneySecondary}>{estimatedSecondary}</Text> : null}
                {isFixedPrice ? <Text style={styles.moneySecondary}>Tarifa fija por zona</Text> : null}
              </View>
            ) : null}

            <SecondaryButton
              label={estimating ? "Generando..." : "Generar estimado"}
              onPress={() => void estimateNow({ showLoading: true, openWhatsappOnNegotiate: true, autofillPrice: true })}
              disabled={estimating || submitting || !pickup || !dropoff || estimateInFlightRef.current}
            />

            <View style={{ gap: 8, marginTop: 6 }}>
              <Text style={styles.label}>Tu contraoferta</Text>
              <TextInput
                value={offeredPriceText}
                onChangeText={setOfferedPriceText}
                placeholder="Ej: 3000"
                placeholderTextColor={colors.mutedText}
                keyboardType="numeric"
                style={styles.input}
              />

              {offeredSecondary ? <Text style={styles.moneySecondary}>{offeredSecondary}</Text> : null}

              <View style={styles.row}>
                <SecondaryButton
                  label="-100"
                  onPress={() => {
                    const v = offeredPriceNumber ?? 0;
                    const next = Math.max(0, v - 100);
                    setOfferedPriceText(String(next));
                  }}
                  disabled={submitting}
                />
                <SecondaryButton
                  label="+100"
                  onPress={() => {
                    const v = offeredPriceNumber ?? 0;
                    const next = v + 100;
                    setOfferedPriceText(String(next));
                  }}
                  disabled={submitting}
                />
              </View>
            </View>

            <PrimaryButton
              label={submitting ? "Publicando..." : "Publicar contraoferta"}
              onPress={() => void submit()}
              disabled={
                submitting ||
                estimating ||
                estimatedPrice == null ||
                !pickup ||
                !dropoff ||
                offeredPriceNumber == null ||
                offeredPriceNumber <= 0
              }
            />
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
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  locateBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
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
  pressed: {
    opacity: 0.85,
  },
  mapWrap: {
    flex: 1,
    minHeight: 220,
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
  moneyBlock: {
    gap: 2,
    paddingVertical: 6,
  },
  moneyLabel: {
    color: colors.mutedText,
    fontWeight: "800",
  },
  moneyMain: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  moneySecondary: {
    color: colors.mutedText,
    fontWeight: "800",
  },
  hint: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  pill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
  },
  pillInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pillIconWrap: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pillCargoBadge: {
    position: "absolute",
    right: -6,
    top: -6,
  },
  pillActive: {
    borderColor: colors.gold,
  },
  pillText: {
    color: colors.mutedText,
    fontWeight: "900",
  },
  pillTextActive: {
    color: colors.gold,
  },
  line: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    color: colors.text,
    fontWeight: "800",
  },
});
