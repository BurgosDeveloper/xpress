import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import * as Location from "expo-location";
import { Screen } from "../components/Screen";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import { Card } from "../components/Card";
import { GoldTitle } from "../components/GoldTitle";
import { ReadOnlyField } from "../components/ReadOnlyField";
import { MiniRouteMap } from "../components/MiniRouteMap";
import { MiniMeetMap } from "../components/MiniMeetMap";
import { Ionicons } from "@expo/vector-icons";
import { buildWhatsappLink } from "../utils/whatsapp";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { apiCancelRide, apiDriverNearbyRideRequests, apiDriverOfferRide, apiGetActiveRide, apiGetRideById, apiGetRideOffers } from "../rides/rides.api";
import {
  apiDriverAcceptRide,
  apiDriverCompleteRide,
  apiDriverNotifyArrived,
  apiDriverStartRide,
  apiDriverUpdateMeter,
  apiDriverUpsertLocation,
} from "../driver/driver.api";
import { apiCreateRating } from "../ratings/ratings.api";
import { apiCancelOffer, apiMyOffers, apiNearbyOffers } from "../offers/offers.api";
import type { NearbyOfferItem } from "../offers/offers.types";
import { serviceTypeLabel } from "../utils/serviceType";
import { rideStatusLabel, roleLabel, userDisplayName } from "../utils/labels";
import { ensureForegroundPermission, getCurrentCoords, getLastKnownCoords } from "../utils/location";
import {
  clearActiveRideDriverArrivedNotifiedAt,
  clearActiveRideOfferCommittedRideId,
  clearActiveRideOffersRideId,
  getActiveRideDriverArrivedNotifiedAt,
  getActiveRideOfferCommittedRideId,
  getActiveRideOffersRideId,
  setActiveRideDriverArrivedNotifiedAt,
  setActiveRideOfferCommittedRideId,
  setActiveRideOffersRideId,
} from "../lib/storage";
import { formatCop, formatSecondaryFromCop } from "../utils/currency";
import { notifyCatchup } from "../notifications/catchup";
import { notifyAndPlayInAppOnce, playInAppSoundOnce } from "../notifications/incoming";
import { handleDriverNearbyForegroundRealtime, handleRideChangedForegroundRealtime } from "../notifications/foregroundRealtime";
import { buildTelUrl, openDialer } from "../utils/phone";
import { getMatchingRadiusM } from "../config/matchingRadius";
import { subscribeRealtimeEvent } from "../realtime/socket";
import { getMatchedDrivingTraceDistanceMeters, getTraceStraightDistanceMeters, type TimedCoords } from "../utils/directions";

const zoeImg = require("../../assets/zoe.png");
const playstoreImg = require("../../assets/playstore.png");

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export function HomeScreen({ navigation }: Props) {
  const auth = useAuth();
  const role = auth.user?.role;
  const userId = auth.user?.id;

  const token = auth.token;
  const matchingRadiusM = useMemo(() => getMatchingRadiusM(auth.appConfig), [auth.appConfig]);
  const [attentionRide, setAttentionRide] = useState<any | null>(null);
  const [rideLoading, setRideLoading] = useState(false);
  const [rideError, setRideError] = useState<string | null>(null);
  const [rideActionLoading, setRideActionLoading] = useState(false);
  const [notifyLoading, setNotifyLoading] = useState(false);

  const [myOffers, setMyOffers] = useState<any[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);

  const [nearbyRequests, setNearbyRequests] = useState<any[]>([]);
  const [nearbyRequestsLoading, setNearbyRequestsLoading] = useState(false);
  const [nearbyRequestsError, setNearbyRequestsError] = useState<string | null>(null);
  const [offerRideLoadingId, setOfferRideLoadingId] = useState<string | null>(null);

  const [nearbyOffers, setNearbyOffers] = useState<NearbyOfferItem[]>([]);
  const [nearbyOffersLoading, setNearbyOffersLoading] = useState(false);
  const [nearbyOffersError, setNearbyOffersError] = useState<string | null>(null);

  const [driverCoords, setDriverCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [offersRideId, setOffersRideId] = useState<string | null>(null);
  const [offersRideCount, setOffersRideCount] = useState<number>(0);
  const [offersRideLoading, setOffersRideLoading] = useState(false);

  const offersRideFirstLoadRef = useRef(true);
  const offersRideRefreshSeqRef = useRef(0);

  const driverPendingRideNotifiedRef = useRef<string | null>(null);

  const driverNearbyInitializedRef = useRef(false);
  const driverSeenNearbyRideIdsRef = useRef<Set<string>>(new Set());

  const driverNearbyOffersInitializedRef = useRef(false);
  const driverSeenNearbyOfferIdsRef = useRef<Set<string>>(new Set());

  const passengerRideOffersInitializedRef = useRef(false);
  const passengerSeenRideOfferDriverIdsRef = useRef<Set<string>>(new Set());

  const lastNearbyRequestsKeyRef = useRef<string>("");
  const lastNearbyOffersKeyRef = useRef<string>("");

  const isFocused = useIsFocused();

  async function refreshMyOffers() {
    if (!token) return;
    if (role !== "USER") return;

    try {
      const res = await apiMyOffers(token);
      setMyOffers(res.offers);
    } catch {
      // silencioso
    }
  }

  async function refreshOffersMeta(opts?: { showLoading?: boolean }) {
    if (!token) return;
    if (role !== "USER") return;
    if (!offersRideId) return;

    const mySeq = ++offersRideRefreshSeqRef.current;
    const showSpinner = opts?.showLoading ?? offersRideFirstLoadRef.current;
    if (showSpinner) setOffersRideLoading(true);

    try {
      const rideRes = await apiGetRideById(token, { rideId: offersRideId });
      if (mySeq !== offersRideRefreshSeqRef.current) return;

      const status = rideRes.ride?.status as string | undefined;
      const matched = Boolean(rideRes.ride?.matchedDriverId);

      if (!status || status !== "OPEN" || matched) {
        await clearActiveRideOffersRideId();
        if (mySeq !== offersRideRefreshSeqRef.current) return;
        setOffersRideId(null);
        setOffersRideCount(0);
        return;
      }

      const offersRes = await apiGetRideOffers(token, { rideId: offersRideId });
      if (mySeq !== offersRideRefreshSeqRef.current) return;
      setOffersRideCount(Array.isArray(offersRes.items) ? offersRes.items.length : 0);

      const items = Array.isArray(offersRes.items) ? offersRes.items : [];
      for (const it of items) {
        const driverIdRaw = (it as any)?.driverId;
        const driverId = driverIdRaw != null ? String(driverIdRaw) : "";
        if (!driverId) continue;

        const fullNameRaw = (it as any)?.fullName;
        const fullName = fullNameRaw != null ? String(fullNameRaw) : "";

        if (passengerSeenRideOfferDriverIdsRef.current.has(driverId)) continue;
        passengerSeenRideOfferDriverIdsRef.current.add(driverId);

        const eventId = `RIDE_OFFERED:${offersRideId}:${driverId}`;
        void notifyAndPlayInAppOnce({
          eventId,
          soundName: "aceptar_servicio",
          title: "Nueva oferta",
          body: fullName ? `${fullName} se ofreció.` : "Un ejecutivo se ofreció.",
          data: { rideId: offersRideId, driverId, type: "RIDE_OFFERED" },
        });
      }

      passengerRideOffersInitializedRef.current = true;
    } catch {
      await clearActiveRideOffersRideId();
      if (mySeq !== offersRideRefreshSeqRef.current) return;
      setOffersRideId(null);
      setOffersRideCount(0);
    } finally {
      if (mySeq !== offersRideRefreshSeqRef.current) return;
      if (showSpinner) setOffersRideLoading(false);
      offersRideFirstLoadRef.current = false;
    }
  }

  useEffect(() => {
    // Resetea "catch-up" al cambiar de usuario/rol.
    driverPendingRideNotifiedRef.current = null;

    driverNearbyInitializedRef.current = false;
    driverSeenNearbyRideIdsRef.current = new Set();

    driverNearbyOffersInitializedRef.current = false;
    driverSeenNearbyOfferIdsRef.current = new Set();

    passengerRideOffersInitializedRef.current = false;
    passengerSeenRideOfferDriverIdsRef.current = new Set();
  }, [userId, role, token]);

  const meterIncludedKm = useMemo(() => {
    const raw = process.env.EXPO_PUBLIC_METER_INCLUDED_KM;
    const n = raw != null ? Number(raw) : NaN;
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 3;
  }, []);

  const meterWatchRef = useRef<Location.LocationSubscription | null>(null);
  const meterLastCoordsRef = useRef<{ lat: number; lng: number; ts: number; accuracy?: number | null } | null>(null);
  const meterDistanceRef = useRef<number>(0);
  const meterSyncedDistanceRef = useRef<number>(0);
  const meterPendingApproxDistanceRef = useRef<number>(0);
  const meterTracePointsRef = useRef<TimedCoords[]>([]);
  const meterRideIdRef = useRef<string | null>(null);
  const meterLastSentAtRef = useRef<number>(0);
  const meterLastSentDistanceRef = useRef<number>(0);
  const meterSendInFlightRef = useRef<boolean>(false);

  const [meterDistanceMeters, setMeterDistanceMeters] = useState<number>(0);
  const [meterError, setMeterError] = useState<string | null>(null);
  const [meterPaused, setMeterPaused] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<"BANCOLOMBIA" | "ZELLE">("BANCOLOMBIA");

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

  const passengerWhatsappLink = useMemo(() => {
    if (role !== "DRIVER") return null;
    const phone = attentionRide?.passenger?.phone;
    if (!phone || !attentionRide?.id) return null;
    return buildWhatsappLink({
      phone,
      text: `Hola, soy tu ejecutivo. Te escribo por el servicio (${String(attentionRide.id).slice(-6)}).`,
    });
  }, [role, attentionRide?.id, attentionRide?.passenger?.phone]);

  const driverWhatsappLink = useMemo(() => {
    if (role !== "USER") return null;
    const phone = attentionRide?.matchedDriver?.phone;
    if (!phone || !attentionRide?.id) return null;
    return buildWhatsappLink({
      phone,
      text: `Hola, soy tu cliente. Te escribo por el servicio (${String(attentionRide.id).slice(-6)}).`,
    });
  }, [role, attentionRide?.id, attentionRide?.matchedDriver?.phone]);

  async function openPassengerWhatsapp() {
    if (!passengerWhatsappLink) return;
    await Linking.openURL(passengerWhatsappLink);
  }

  async function openDriverWhatsapp() {
    if (!driverWhatsappLink) return;
    await Linking.openURL(driverWhatsappLink);
  }

  const driverTelLink = useMemo(() => {
    if (role !== "USER") return null;
    const raw = attentionRide?.matchedDriver?.phone;
    if (!raw) return null;
    return buildTelUrl(String(raw));
  }, [role, attentionRide?.matchedDriver?.phone]);

  async function callDriverDirect() {
    if (role !== "USER") return;
    const raw = attentionRide?.matchedDriver?.phone;
    if (!raw) return;
    await openDialer(String(raw));
  }

  async function refreshRide(opts?: { showLoading?: boolean }) {
    if (!token) return;

    const showLoading = opts?.showLoading ?? true;

    setRideError(null);
    if (showLoading) setRideLoading(true);
    try {
      const res = await apiGetActiveRide(token);
      setAttentionRide(res.ride);

      // Caso 2 (cliente): si hay una ride OPEN sin chofer asignado, queremos escuchar ofertas
      // desde la pantalla de inicio aunque el flag no se haya guardado por algún flujo.
      if (role === "USER") {
        const rideIdRaw = (res.ride as any)?.id;
        const rideId = rideIdRaw != null ? String(rideIdRaw) : "";
        const status = String((res.ride as any)?.status ?? "");
        const matched = Boolean((res.ride as any)?.matchedDriverId);

        // Catch-up best-effort: si falla (SecureStore/Notifs), no bloquea refreshRide.
        try {
          // Caso 4 (cliente): si el chofer presionó "notificar llegada" y el push no llegó
          // (por ejemplo, prueba en un solo teléfono alternando sesión), hacemos catch-up.
          const arrivedAtRaw = (res.ride as any)?.driverArrivedNotifiedAt;
          const arrivedAt = arrivedAtRaw != null ? String(arrivedAtRaw) : "";

          if (rideId && status === "ACCEPTED" && matched && arrivedAt) {
            const lastArrivedAt = await getActiveRideDriverArrivedNotifiedAt();
            if (lastArrivedAt !== arrivedAt) {
              const ms = Date.parse(arrivedAt);
              const suffix = Number.isFinite(ms) ? String(ms) : arrivedAt;
              await notifyAndPlayInAppOnce({
                eventId: `DRIVER_ARRIVED:${rideId}:${suffix}`,
                soundName: "uber_llego",
                title: "Tu ejecutivo está en el lugar",
                body: "Tu ejecutivo ya llegó al punto de recogida.",
                data: { rideId, type: "CATCHUP_DRIVER_ARRIVED" },
              });
              await setActiveRideDriverArrivedNotifiedAt(arrivedAt);
            }
          }

          if (!rideId || !arrivedAt || status !== "ACCEPTED" || !matched) {
            void clearActiveRideDriverArrivedNotifiedAt();
          }

          // Contraofertas (cliente): si un chofer se comprometió y el push no llegó,
          // hacemos catch-up con el mismo sonido del caso 2.
          const offerIdRaw = (res.ride as any)?.offer?.id;
          const offerId = offerIdRaw != null ? String(offerIdRaw) : "";
          const committedDriverIdRaw = (res.ride as any)?.matchedDriverId ?? (res.ride as any)?.matchedDriver?.id;
          const committedDriverId = committedDriverIdRaw != null ? String(committedDriverIdRaw) : "";
          if (rideId && offerId && status === "ACCEPTED" && matched) {
            const lastCommittedRideId = await getActiveRideOfferCommittedRideId();
            if (lastCommittedRideId !== rideId) {
              await notifyAndPlayInAppOnce({
                eventId: `OFFER_COMMITTED:${offerId}:${committedDriverId || rideId}`,
                soundName: "aceptar_servicio",
                title: "Contraoferta aceptada",
                body: "Un chofer se comprometió con tu oferta.",
                data: { rideId, offerId, type: "CATCHUP_OFFER_COMMITTED" },
              });
              await setActiveRideOfferCommittedRideId(rideId);
            }
          }

          if (!rideId || !offerId || status !== "ACCEPTED" || !matched) {
            void clearActiveRideOfferCommittedRideId();
          }
        } catch {
          // ignore
        }

        if (rideId && status === "OPEN" && !matched) {
          // best-effort: persistimos y seteamos estado local
          void setActiveRideOffersRideId(rideId);
          setOffersRideId(rideId);
        }

        if (!rideId || status !== "OPEN" || matched) {
          // Si ya no aplica, limpiamos el puntero.
          void clearActiveRideOffersRideId();
          setOffersRideId(null);
        }

        if (!rideId) {
          void clearActiveRideDriverArrivedNotifiedAt();
          void clearActiveRideOfferCommittedRideId();
        }
      }
    } catch (e) {
      setRideError(e instanceof Error ? e.message : "No se pudo cargar el estado del viaje");
    } finally {
      if (showLoading) setRideLoading(false);
    }
  }

  useEffect(() => {
    if (!isFocused) return;
    if (!token) return;
    if (!attentionRide?.id) return;

    const rideId = String(attentionRide.id);
    const status = String(attentionRide.status ?? "");
    const isOfferRide = Boolean((attentionRide as any)?.offer);

    if (role === "DRIVER") {
      // Catch-up: el chofer entra y ya tiene un servicio por aceptar.
      if (
        !isOfferRide &&
        (status === "ASSIGNED" || status === "MATCHED" || status === "ACCEPTED") &&
        driverPendingRideNotifiedRef.current !== rideId
      ) {
        driverPendingRideNotifiedRef.current = rideId;
        void notifyCatchup({
          title: "Nuevo servicio",
          body: "Tienes un servicio por aceptar.",
          soundName: "tienes_servicio",
          data: { rideId, type: "CATCHUP_DRIVER_PENDING" },
        });
      }
    }

    if (role === "USER") {
      // (Limpieza) Evitamos sonidos extra fuera de los 4 casos especificados.
    }
  }, [attentionRide?.id, attentionRide?.status, isFocused, role, token]);

  async function ensureDriverCoords() {
    const ok = await ensureForegroundPermission();
    if (!ok) throw new Error("Necesitás habilitar la ubicación para ver servicios solicitados");

    const last = await getLastKnownCoords();
    if (last) return last;
    return getCurrentCoords();
  }

  async function refreshNearbyRequests(opts?: { showLoading?: boolean }) {
    if (!token) return;
    if (role !== "DRIVER") return;

    const showLoading = opts?.showLoading ?? true;
    if (showLoading) {
      setNearbyRequestsError(null);
      setNearbyOffersError(null);
      setNearbyRequestsLoading(true);
      setNearbyOffersLoading(true);
    }

    try {
      const coords = await ensureDriverCoords();
      setDriverCoords(coords);

      // Best-effort: si falla ubicación en backend, igual intentamos listar.
      try {
        await apiDriverUpsertLocation(token, coords);
      } catch {
        // ignore
      }

      const [reqRes, offersRes] = await Promise.allSettled([
        apiDriverNearbyRideRequests(token, { radiusM: matchingRadiusM, take: 10 }),
        apiNearbyOffers(token, { lat: coords.lat, lng: coords.lng, radiusM: matchingRadiusM }),
      ]);

      if (reqRes.status === "fulfilled") {
        const items = Array.isArray(reqRes.value.items) ? reqRes.value.items : [];
        const key = items
          .map((it: any) => {
            const idRaw = it?.id ?? it?.rideId ?? it?.ride?.id;
            const id = idRaw != null ? String(idRaw) : "";
            const myOfferStatus = it?.myOffer?.status != null ? String(it.myOffer.status) : "";
            const myOfferUpdatedAt = it?.myOffer?.updatedAt != null ? String(it.myOffer.updatedAt) : "";
            const distanceMeters = Number.isFinite(Number(it?.distanceMeters)) ? String(Math.round(Number(it.distanceMeters))) : "";
            return `${id}@${myOfferStatus}@${myOfferUpdatedAt}@${distanceMeters}`;
          })
          .join("|");
        if (key !== lastNearbyRequestsKeyRef.current) {
          lastNearbyRequestsKeyRef.current = key;
          setNearbyRequests(items);
        }
        setNearbyRequestsError(null);
      } else if (showLoading) {
        const e = reqRes.reason;
        setNearbyRequestsError(e instanceof Error ? e.message : "No se pudo cargar servicios solicitados");
      }

      if (offersRes.status === "fulfilled") {
        const items = Array.isArray(offersRes.value.items) ? (offersRes.value.items as NearbyOfferItem[]) : ([] as NearbyOfferItem[]);
        const key = items
          .map((it: any) => {
            const idRaw = it?.offerId ?? it?.id;
            const id = idRaw != null ? String(idRaw) : "";
            const updatedAt = it?.createdAt != null ? String(it.createdAt) : "";
            const distanceMeters = Number.isFinite(Number(it?.distanceMeters)) ? String(Math.round(Number(it.distanceMeters))) : "";
            return `${id}@${updatedAt}@${distanceMeters}`;
          })
          .join("|");
        if (key !== lastNearbyOffersKeyRef.current) {
          lastNearbyOffersKeyRef.current = key;
          setNearbyOffers(items);
        }
        setNearbyOffersError(null);
      } else if (showLoading) {
        const e = offersRes.reason;
        setNearbyOffersError(e instanceof Error ? e.message : "No se pudo cargar contraofertas cercanas");
      }
    } catch (e) {
      // Solo mostrar el error duro en carga inicial. En polling silencioso no asustamos al chofer.
      if (showLoading) {
        const msg = e instanceof Error ? e.message : "No se pudo actualizar servicios";
        setNearbyRequestsError(msg);
        setNearbyOffersError(msg);
      }
    } finally {
      if (showLoading) {
        setNearbyRequestsLoading(false);
        setNearbyOffersLoading(false);
      }
    }
  }

  async function offerServiceToRide(rideId: string) {
    if (!token) return;
    if (role !== "DRIVER") return;

    setOfferRideLoadingId(rideId);
    setNearbyRequestsError(null);
    try {
      await apiDriverOfferRide(token, { rideId });
      await refreshNearbyRequests({ showLoading: false });
    } catch (e) {
      setNearbyRequestsError(e instanceof Error ? e.message : "No se pudo ofrecer el servicio");
    } finally {
      setOfferRideLoadingId(null);
    }
  }

  useEffect(() => {
    if (!token) return;
    if (!isFocused) return;

    void refreshRide({ showLoading: true });
    if (role === "USER") {
      void (async () => {
        setOffersLoading(true);
        await refreshMyOffers();
        setOffersLoading(false);
      })();
    }
    const t = setInterval(() => {
      void refreshRide({ showLoading: false });
      if (role === "USER") {
        void refreshMyOffers();
      }
    }, 4000);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isFocused, role]);

  useEffect(() => {
    if (!token) return;
    if (!isFocused) return;
    if (role !== "USER") return;

    let alive = true;

    async function loadStored() {
      const stored = await getActiveRideOffersRideId();
      if (!alive) return;
      setOffersRideId(stored ?? null);
    }

    void loadStored();
    return () => {
      alive = false;
    };
  }, [token, isFocused, role]);

  useEffect(() => {
    if (!token) return;
    if (!isFocused) return;
    if (role !== "USER") return;
    if (!offersRideId) return;

    void refreshOffersMeta({ showLoading: true });
    const t = setInterval(() => {
      void refreshOffersMeta({ showLoading: false });
    }, 3000);

    return () => {
      clearInterval(t);
    };
  }, [token, isFocused, role, offersRideId]);

  useEffect(() => {
    if (!offersRideId) return;
    offersRideFirstLoadRef.current = true;
    passengerRideOffersInitializedRef.current = false;
    passengerSeenRideOfferDriverIdsRef.current = new Set();
  }, [offersRideId]);

  useEffect(() => {
    if (!token) return;
    if (!isFocused) return;
    if (role !== "DRIVER") return;

    void refreshNearbyRequests({ showLoading: true });

    const t = setInterval(() => {
      void refreshNearbyRequests({ showLoading: false });
    }, 2000);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isFocused, role, matchingRadiusM]);

  useEffect(() => {
    if (!isFocused) return;
    if (!token) return;
    if (role !== "DRIVER") return;

    const items = Array.isArray(nearbyRequests) ? nearbyRequests : [];

    // Primera carga: marcamos sin sonar (ya hay catch-up separado).
    if (!driverNearbyInitializedRef.current) {
      for (const it of items) {
        const idRaw = (it as any)?.id ?? (it as any)?.rideId ?? (it as any)?.ride?.id;
        const id = idRaw != null ? String(idRaw) : "";
        if (id) driverSeenNearbyRideIdsRef.current.add(id);
      }
      driverNearbyInitializedRef.current = true;
      return;
    }

    // Cada nuevo cliente que aparece (por polling) debe sonar `disponibles`.
    const newIds: string[] = [];
    for (const it of items) {
      const idRaw = (it as any)?.id ?? (it as any)?.rideId ?? (it as any)?.ride?.id;
      const id = idRaw != null ? String(idRaw) : "";
      if (!id) continue;
      if (driverSeenNearbyRideIdsRef.current.has(id)) continue;
      driverSeenNearbyRideIdsRef.current.add(id);
      newIds.push(id);
    }

    if (newIds.length === 0) return;

    // Sonar una vez por cada solicitud nueva.
    // (El player ya serializa para evitar solapamientos.)
    for (const id of newIds) {
      void playInAppSoundOnce({ eventId: `RIDE_AVAILABLE:${id}`, soundName: "disponibles" });
    }
  }, [nearbyRequests, isFocused, role, token]);

  useEffect(() => {
    if (!isFocused) return;
    if (!token) return;
    if (role !== "DRIVER") return;

    const items = Array.isArray(nearbyOffers) ? nearbyOffers : [];

    // Primera carga: marcamos sin sonar.
    if (!driverNearbyOffersInitializedRef.current) {
      for (const it of items) {
        const idRaw = (it as any)?.offerId ?? (it as any)?.id;
        const id = idRaw != null ? String(idRaw) : "";
        if (id) driverSeenNearbyOfferIdsRef.current.add(id);
      }
      driverNearbyOffersInitializedRef.current = true;
      return;
    }

    const newIds: string[] = [];
    for (const it of items) {
      const idRaw = (it as any)?.offerId ?? (it as any)?.id;
      const id = idRaw != null ? String(idRaw) : "";
      if (!id) continue;
      if (driverSeenNearbyOfferIdsRef.current.has(id)) continue;
      driverSeenNearbyOfferIdsRef.current.add(id);
      newIds.push(id);
    }

    if (newIds.length === 0) return;

    for (const id of newIds) {
      void playInAppSoundOnce({ eventId: `OFFER_AVAILABLE:${id}`, soundName: "disponibles" });
    }
  }, [nearbyOffers, isFocused, role, token]);

  const handleRealtimeNearbyChange = (payload: any) => {
    if (!isFocused) return;
    if (role !== "DRIVER") return;
    void handleDriverNearbyForegroundRealtime(payload);
    void refreshNearbyRequests({ showLoading: false });
  };

  const handleRealtimeRideChange = (payload: any) => {
    if (!isFocused) return;

    const payloadType = payload?.type != null ? String(payload.type) : "";
    const payloadRideId = payload?.rideId != null ? String(payload.rideId) : "";

    if (role === "DRIVER" || role === "USER") {
      void handleRideChangedForegroundRealtime({ role, payload });
    }

    if (role === "DRIVER" && payloadRideId && (payloadType === "RIDE_ASSIGNED" || payloadType === "RIDE_MATCHED")) {
      driverPendingRideNotifiedRef.current = payloadRideId;
    }

    void refreshRide({ showLoading: false });

    if (role === "USER" && offersRideId && (!payloadRideId || payloadRideId === offersRideId)) {
      void refreshOffersMeta({ showLoading: false });
    }

    if (role === "USER") {
      void refreshMyOffers();
    }
  };

  useEffect(() => {
    if (!token) return;

    const cleanups = [
      subscribeRealtimeEvent("ride:changed", handleRealtimeRideChange),
      subscribeRealtimeEvent("ride:matched", handleRealtimeRideChange),
      subscribeRealtimeEvent("ride:offers:changed", handleRealtimeRideChange),
      subscribeRealtimeEvent("driver:nearby:changed", handleRealtimeNearbyChange),
    ];

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [token, isFocused, role, offersRideId, matchingRadiusM]);

  useEffect(() => {
    if (!token) return;
    if (!isFocused) return;

    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") return;
      void refreshRide({ showLoading: false });

      if (role === "DRIVER") {
        void refreshNearbyRequests({ showLoading: false });
      }

      if (role === "USER") {
        void refreshMyOffers();
        if (offersRideId) void refreshOffersMeta({ showLoading: false });
      }
    });

    return () => {
      sub.remove();
    };
  }, [token, isFocused, role, offersRideId, matchingRadiusM]);


  useEffect(() => {
    const rideId = attentionRide?.id as string | undefined;
    const rideStatus = attentionRide?.status as string | undefined;

    const isOfferRide = Boolean(attentionRide?.offer);
    const isFixedPriceRide = Boolean(attentionRide?.isFixedPrice);

    // El taxímetro debe seguir contando aunque el chofer navegue a otra pantalla
    // (mientras esta pantalla siga montada y la ride esté en progreso).
    const shouldRun = Boolean(
      token &&
        role === "DRIVER" &&
        rideId &&
        rideStatus === "IN_PROGRESS" &&
        !isOfferRide &&
        !isFixedPriceRide &&
        !meterPaused
    );

    const stop = () => {
      if (meterWatchRef.current) {
        meterWatchRef.current.remove();
        meterWatchRef.current = null;
      }
      meterLastCoordsRef.current = null;
      meterTracePointsRef.current = [];
      meterSyncedDistanceRef.current = 0;
      meterPendingApproxDistanceRef.current = 0;
      meterDistanceRef.current = 0;
      meterSendInFlightRef.current = false;
      meterLastSentAtRef.current = 0;
      meterLastSentDistanceRef.current = 0;
    };

    const haversineMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
      const R = 6371000;
      const dLat = ((b.lat - a.lat) * Math.PI) / 180;
      const dLng = ((b.lng - a.lng) * Math.PI) / 180;
      const lat1 = (a.lat * Math.PI) / 180;
      const lat2 = (b.lat * Math.PI) / 180;
      const s1 = Math.sin(dLat / 2);
      const s2 = Math.sin(dLng / 2);
      const h = s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2;
      return 2 * R * Math.asin(Math.sqrt(h));
    };

    const appendTracePoint = (point: TimedCoords) => {
      const trace = meterTracePointsRef.current;
      const last = trace[trace.length - 1];
      if (last && last.lat === point.lat && last.lng === point.lng && last.ts === point.ts) return;
      trace.push(point);
      if (trace.length > 100) trace.splice(0, trace.length - 100);
    };

    const maybeSendMeter = async (opts?: { force?: boolean }) => {
      if (!token || !rideId) return;
      if (meterSendInFlightRef.current) return;

      const force = opts?.force ?? false;
      const approxDistance = Math.max(meterSyncedDistanceRef.current, Math.round(meterSyncedDistanceRef.current + meterPendingApproxDistanceRef.current));

      const now = Date.now();
      const minMsBetweenSends = 10_000;
      const minMetersBetweenSends = 25;

      const since = now - meterLastSentAtRef.current;
      const delta = approxDistance - meterLastSentDistanceRef.current;

      if (!force && meterLastSentAtRef.current && (since < minMsBetweenSends || delta < minMetersBetweenSends)) return;

      const traceSnapshot = meterTracePointsRef.current.slice();
      const incrementalDistance = traceSnapshot.length >= 2 ? await getMatchedDrivingTraceDistanceMeters(traceSnapshot) : 0;
      const candidateDistance = Math.max(
        meterSyncedDistanceRef.current,
        Math.round(meterSyncedDistanceRef.current + Math.max(0, incrementalDistance ?? meterPendingApproxDistanceRef.current))
      );

      meterSendInFlightRef.current = true;
      try {
        const res = await apiDriverUpdateMeter(token, rideId, { meterDistanceMeters: candidateDistance });
        const backendDistance = Math.round(Number(res.ride?.meterDistanceMeters ?? candidateDistance));
        meterSyncedDistanceRef.current = Math.max(candidateDistance, Number.isFinite(backendDistance) ? backendDistance : 0);

        const currentTrace = meterTracePointsRef.current;
        const snapshotLastTs = traceSnapshot[traceSnapshot.length - 1]?.ts ?? 0;
        const traceTail = currentTrace.filter((point) => (point.ts ?? 0) > snapshotLastTs);
        const anchor = traceSnapshot[traceSnapshot.length - 1] ?? currentTrace[currentTrace.length - 1] ?? null;
        meterTracePointsRef.current = anchor ? [anchor, ...traceTail] : traceTail;
        meterPendingApproxDistanceRef.current = getTraceStraightDistanceMeters(meterTracePointsRef.current);
        meterDistanceRef.current = meterSyncedDistanceRef.current + meterPendingApproxDistanceRef.current;
        setMeterDistanceMeters(Math.round(meterDistanceRef.current));

        setAttentionRide((prev: any | null) => {
          if (!prev || prev.id !== rideId) return prev;
          return {
            ...prev,
            meterDistanceMeters: res.ride?.meterDistanceMeters,
            meterPrice: res.ride?.meterPrice,
          };
        });
        meterLastSentAtRef.current = now;
        meterLastSentDistanceRef.current = meterSyncedDistanceRef.current;
        setMeterError(null);
      } catch (e) {
        setMeterError(e instanceof Error ? e.message : "No se pudo actualizar el taxímetro");
      } finally {
        meterSendInFlightRef.current = false;
      }
    };

    if (!shouldRun) {
      stop();
      return;
    }

    const backendMeters = Number(attentionRide?.meterDistanceMeters ?? 0);
    if (meterRideIdRef.current !== rideId) {
      // Nuevo servicio: inicializamos desde backend.
      meterRideIdRef.current = rideId || null;
      meterSyncedDistanceRef.current = Number.isFinite(backendMeters) && backendMeters > 0 ? backendMeters : 0;
      meterPendingApproxDistanceRef.current = 0;
      meterTracePointsRef.current = [];
      meterDistanceRef.current = meterSyncedDistanceRef.current;
    } else {
      // Reanudar (o re-render): nunca bajar el contador por falta de sincronización.
      const current = Number(meterDistanceRef.current ?? 0);
      const safeBackend = Number.isFinite(backendMeters) ? backendMeters : 0;
      meterSyncedDistanceRef.current = Math.max(meterSyncedDistanceRef.current, safeBackend);
      meterDistanceRef.current = Math.max(current, meterSyncedDistanceRef.current + meterPendingApproxDistanceRef.current);
    }

    setMeterDistanceMeters(Math.round(meterDistanceRef.current));
    setMeterError(null);

    let cancelled = false;

    void (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (cancelled) return;
        if (!perm.granted) {
          const req = await Location.requestForegroundPermissionsAsync();
          if (cancelled) return;
          if (!req.granted) {
            setMeterError("Necesitás habilitar GPS para el taxímetro");
            return;
          }
        }

        // Primer envío para que el precio base quede calculado desde el inicio
        await maybeSendMeter({ force: true });

        const sub = await Location.watchPositionAsync(
          {
            // Más frecuente para reducir subestimación (línea recta) y mantener estabilidad.
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 2000,
            distanceInterval: 1,
          },
          (pos) => {
            if (cancelled) return;
            const coords = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              ts: typeof pos.timestamp === "number" ? pos.timestamp : Date.now(),
              accuracy: typeof pos.coords.accuracy === "number" ? pos.coords.accuracy : null,
            };

            // Filtrar lecturas muy imprecisas (suele generar saltos grandes).
            if (coords.accuracy != null && coords.accuracy > 50) {
              return;
            }

            const prev = meterLastCoordsRef.current;
            if (!prev) {
              meterLastCoordsRef.current = coords;
              appendTracePoint(coords);
              return;
            }

            const dtSec = Math.max(0, (coords.ts - prev.ts) / 1000);
            if (dtSec <= 0.2) return;

            const delta = haversineMeters(prev, coords);

            // Filtrado básico de saltos raros
            if (!Number.isFinite(delta) || delta <= 0.5) {
              // Delta insignificante: actualizamos ancla para no acumular deriva.
              meterLastCoordsRef.current = coords;
              return;
            }

            // Salto gigante: no cambiamos el punto previo (evita perder distancia por rebotes)
            if (delta > 1000) return;

            // Filtrado por velocidad (m/s). Evita sumar metros por rebotes de GPS.
            const deviceSpeed =
              typeof pos.coords.speed === "number" && Number.isFinite(pos.coords.speed) && pos.coords.speed >= 0 ? pos.coords.speed : null;
            const speed = deviceSpeed ?? delta / dtSec;
            if (!Number.isFinite(speed) || speed > 55) return;

            // Umbral mínimo según precisión: ignora movimiento dentro del margen de error.
            const prevAcc = typeof prev.accuracy === "number" && Number.isFinite(prev.accuracy) ? prev.accuracy : 15;
            const curAcc = typeof coords.accuracy === "number" && Number.isFinite(coords.accuracy) ? coords.accuracy : 15;
            const movementThreshold = Math.max(2, Math.min(15, (prevAcc + curAcc) / 2));

            if (delta < movementThreshold) {
              // Ruido/deriva típica: movemos el ancla pero no sumamos metros.
              meterLastCoordsRef.current = coords;
              return;
            }

            // Aceptado: actualizar ancla y sumar.
            meterLastCoordsRef.current = coords;

            appendTracePoint(coords);
            meterPendingApproxDistanceRef.current += delta;
            meterDistanceRef.current = meterSyncedDistanceRef.current + meterPendingApproxDistanceRef.current;
            const rounded = Math.round(meterDistanceRef.current);
            setMeterDistanceMeters(rounded);
            void maybeSendMeter();
          }
        );

        meterWatchRef.current = sub;
      } catch (e) {
        if (cancelled) return;
        setMeterError(e instanceof Error ? e.message : "No se pudo iniciar el taxímetro");
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isFocused, role, attentionRide?.id, attentionRide?.status, attentionRide?.offer?.id, meterPaused]);

  useEffect(() => {
    // Si cambia la carrera, reseteamos el pause.
    setMeterPaused(false);
  }, [attentionRide?.id]);

  function toggleMeterPaused() {
    setMeterPaused((p) => !p);
  }

  async function resetMeterNow() {
    if (!token) return;
    if (role !== "DRIVER") return;
    if (!attentionRide) return;
    if (attentionRide.status !== "IN_PROGRESS") return;
    if (attentionRide.offer) return;
    if (attentionRide.isFixedPrice) return;

    meterDistanceRef.current = 0;
    meterSyncedDistanceRef.current = 0;
    meterPendingApproxDistanceRef.current = 0;
    meterLastCoordsRef.current = null;
    meterTracePointsRef.current = [];
    meterLastSentAtRef.current = 0;
    meterLastSentDistanceRef.current = 0;
    setMeterDistanceMeters(0);
    setMeterError(null);

    try {
      const res = await apiDriverUpdateMeter(token, attentionRide.id, { meterDistanceMeters: 0 });
      setAttentionRide((prev: any | null) => {
        if (!prev || prev.id !== attentionRide.id) return prev;
        return {
          ...prev,
          meterDistanceMeters: res.ride?.meterDistanceMeters,
          meterPrice: res.ride?.meterPrice,
        };
      });
    } catch (e) {
      setMeterError(e instanceof Error ? e.message : "No se pudo reiniciar el taxímetro");
    }
  }

  function confirmResetMeter() {
    Alert.alert(
      "Reiniciar taxímetro",
      "Si confirmás, se perderá el recorrido acumulado de esta carrera.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Reiniciar",
          style: "destructive",
          onPress: () => {
            void resetMeterNow();
          },
        },
      ]
    );
  }

  useEffect(() => {
    if (!token || !isFocused) return;
    if (role !== "DRIVER") return;
    if (!attentionRide || attentionRide.status !== "IN_PROGRESS") return;

    const backendMeters = Math.round(Number(attentionRide.meterDistanceMeters ?? 0));
    if (backendMeters > Math.round(meterDistanceRef.current) + 5) {
      meterSyncedDistanceRef.current = backendMeters;
      meterPendingApproxDistanceRef.current = 0;
      meterTracePointsRef.current = meterLastCoordsRef.current ? [meterLastCoordsRef.current] : [];
      meterDistanceRef.current = backendMeters;
      setMeterDistanceMeters(backendMeters);
      // Evita un envío inmediato redundante si el backend ya está más adelante
      meterLastSentDistanceRef.current = backendMeters;
    }
  }, [token, isFocused, role, attentionRide?.status, attentionRide?.meterDistanceMeters]);

  const openOffer = useMemo(() => {
    return Array.isArray(myOffers) && myOffers.length ? myOffers[0] : null;
  }, [myOffers]);

  const userHasActiveRide = useMemo(() => {
    if (role !== "USER") return false;
    const status = attentionRide?.status as string | undefined;
    return status === "OPEN" || status === "ASSIGNED" || status === "ACCEPTED" || status === "MATCHED" || status === "IN_PROGRESS";
  }, [role, attentionRide?.status]);

  const userHasOpenOffer = useMemo(() => {
    if (role !== "USER") return false;
    return Boolean(openOffer);
  }, [role, openOffer]);

  async function cancelMyOffer() {
    if (!token || !openOffer) return;
    setRideActionLoading(true);
    setRideError(null);
    try {
      await apiCancelOffer(token, openOffer.id);
      const res = await apiMyOffers(token);
      setMyOffers(res.offers);
    } catch (e) {
      setRideError(e instanceof Error ? e.message : "No se pudo cancelar la contraoferta");
    } finally {
      setRideActionLoading(false);
    }
  }

  async function cancelMyRideNow() {
    if (!token || !attentionRide) return;

    setRideActionLoading(true);
    setRideError(null);
    try {
      await apiCancelRide(token, { rideId: attentionRide.id });
      await clearActiveRideOffersRideId();
      setOffersRideId(null);
      setOffersRideCount(0);
      await refreshRide({ showLoading: false });
    } catch (e) {
      setRideError(e instanceof Error ? e.message : "No se pudo cancelar el servicio");
    } finally {
      setRideActionLoading(false);
    }
  }

  function confirmCancelMyRide() {
    Alert.alert("Cancelar servicio", "Vas a cancelar tu solicitud actual. ¿Querés continuar?", [
      { text: "Volver", style: "cancel" },
      {
        text: "Cancelar servicio",
        style: "destructive",
        onPress: () => {
          void cancelMyRideNow();
        },
      },
    ]);
  }

  const ratingDirection = role === "USER" ? "PASSENGER_TO_DRIVER" : role === "DRIVER" ? "DRIVER_TO_PASSENGER" : null;
  const canRate = useMemo(() => {
    if (!attentionRide || !ratingDirection) return false;
    if (attentionRide.status !== "COMPLETED") return false;
    const ratings: any[] = Array.isArray(attentionRide.ratings) ? attentionRide.ratings : [];
    return !ratings.some((r) => r?.direction === ratingDirection);
  }, [attentionRide, ratingDirection]);

  const displayName = useMemo(() => userDisplayName(auth.user), [auth.user]);
  const displayRole = useMemo(() => roleLabel(role), [role]);

  const meterPriceToShow = useMemo(() => {
    if (!attentionRide || role !== "DRIVER" || attentionRide.status !== "IN_PROGRESS") return null;
    if (attentionRide.offer) return null;

    const baseFare = Number(attentionRide.pricingBaseFare ?? 0);
    const perKm = Number(attentionRide.pricingPerKm ?? 0);
    const ac = Number(attentionRide.pricingAcSurcharge ?? 0);
    const trunk = Number(attentionRide.pricingTrunkSurcharge ?? 0);
    const pets = Number(attentionRide.pricingPetsSurcharge ?? 0);
    const surcharge = (attentionRide.wantsAC ? ac : 0) + (attentionRide.wantsTrunk ? trunk : 0) + (attentionRide.wantsPets ? pets : 0);

    const includedMeters = Math.max(0, Math.floor(Number(attentionRide.pricingIncludedMeters ?? 0)));
    const stepMeters = Math.max(0, Math.floor(Number(attentionRide.pricingStepMeters ?? 0)));
    const stepPrice = Number(attentionRide.pricingStepPrice ?? 0);

    const useSteps = stepMeters > 0 && Number.isFinite(stepPrice) && stepPrice > 0;
    let distanceCharge = 0;
    if (useSteps) {
      const extraMeters = Math.max(0, Math.floor(Math.max(0, meterDistanceMeters) - includedMeters));
      const steps = extraMeters > 0 ? Math.ceil(extraMeters / stepMeters) : 0;
      distanceCharge = steps * stepPrice;
    } else {
      const kmWhole = Math.floor(Math.max(0, meterDistanceMeters) / 1000);
      const extraKm = Math.max(0, kmWhole - meterIncludedKm);
      distanceCharge = perKm * extraKm;
    }

    const computed = baseFare + distanceCharge + surcharge;
    const computedRounded = Math.max(0, Math.round(computed * 100) / 100);

    const backend = Number(attentionRide.meterPrice ?? 0);
    return backend > 0 ? backend : computedRounded;
  }, [attentionRide, meterDistanceMeters, meterIncludedKm, role]);

  const meterSecondary = useMemo(() => {
    if (meterPriceToShow == null) return null;
    return formatSecondaryFromCop(Number(meterPriceToShow), auth.appConfig ?? {});
  }, [meterPriceToShow, auth.appConfig]);

  async function driverAction(action: "accept" | "start" | "complete") {
    if (!token || !attentionRide) return;
    setRideActionLoading(true);
    setRideError(null);
    try {
      if (action === "accept") await apiDriverAcceptRide(token, attentionRide.id);
      if (action === "start") await apiDriverStartRide(token, attentionRide.id);
      if (action === "complete") await apiDriverCompleteRide(token, attentionRide.id);
      await refreshRide();
    } catch (e) {
      setRideError(e instanceof Error ? e.message : "No se pudo actualizar tu servicio");
    } finally {
      setRideActionLoading(false);
    }
  }

  async function notifyPassengerArrived() {
    if (!token || !attentionRide) return;
    if (role !== "DRIVER") return;

    setNotifyLoading(true);
    setRideError(null);
    try {
      await apiDriverNotifyArrived(token, attentionRide.id);
    } catch (e) {
      setRideError(e instanceof Error ? e.message : "No se pudo notificar al cliente");
    } finally {
      setNotifyLoading(false);
    }
  }

  async function submitRating(stars: number) {
    if (!token || !attentionRide) return;
    setRideActionLoading(true);
    setRideError(null);
    try {
      await apiCreateRating(token, { rideId: attentionRide.id, stars });
      await refreshRide();
    } catch (e) {
      setRideError(e instanceof Error ? e.message : "No se pudo enviar la calificación");
    } finally {
      setRideActionLoading(false);
    }
  }

  const scrollPadBottom = 120;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: scrollPadBottom }} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Ionicons name="sparkles" size={20} color={colors.gold} />
            <GoldTitle>Inicio</GoldTitle>
          </View>

          <Pressable style={styles.operatorBtn} onPress={() => void openOperator()}>
            <Image source={zoeImg} style={styles.operatorImg} resizeMode="contain" />
            <Text style={styles.operatorText}>ZOE</Text>
          </Pressable>
        </View>

        <Card style={styles.card}>
          <View style={styles.welcomeRow}>
            <Ionicons name="sparkles" size={18} color={colors.gold} />
            <Text style={styles.title}>Bienvenido {displayName}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name={role === "ADMIN" ? "shield-checkmark-outline" : role === "DRIVER" ? "car-outline" : "person-outline"} size={16} color={colors.mutedText} />
            <Text style={styles.line}>Rol: {displayRole}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={16} color={colors.mutedText} />
            <Text style={styles.line}>Usuario: {auth.user?.email ?? auth.user?.username ?? "-"}</Text>
          </View>
        </Card>

        {role === "USER" ? (
          <Card style={styles.card}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="person-outline" size={18} color={colors.gold} />
              <Text style={styles.sectionTitle}>Servicios Cliente</Text>
            </View>
            <Text style={styles.sectionText}>Acá vas a solicitar traslados, hacer ofertas y ver tu historial.</Text>

            <View style={{ marginTop: 10, gap: 10 }}>
              <PrimaryButton
                label="Solicitar traslado"
                onPress={() => navigation.navigate("PassengerDriversMap")}
                disabled={userHasActiveRide || userHasOpenOffer}
              />
              <SecondaryButton
                label={
                  offersRideId
                    ? offersRideLoading
                      ? `Ejecutivos ofrecidos (${offersRideCount})...`
                      : `Ejecutivos ofrecidos (${offersRideCount})`
                    : "Ejecutivos ofrecidos"
                }
                onPress={() => {
                  if (!offersRideId) return;
                  navigation.navigate("PassengerOffersWait", { rideId: offersRideId });
                }}
                disabled={!offersRideId || offersRideLoading}
              />
              <SecondaryButton
                label="Hacer oferta"
                onPress={() => navigation.navigate("PassengerMakeOffer")}
                disabled={userHasActiveRide || userHasOpenOffer}
              />
              <View style={{ height: 6 }} />
              <SecondaryButton label="Historial" onPress={() => navigation.navigate("RidesHistory")} />
            </View>
          </Card>
        ) : null}

      {token ? (
        <Card style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="time-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Tu servicio</Text>
          </View>

          {rideLoading ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
              <ActivityIndicator color={colors.gold} />
              <Text style={styles.sectionText}>Actualizando...</Text>
            </View>
          ) : null}

          {!!rideError ? <Text style={[styles.sectionText, { color: colors.danger }]}>{rideError}</Text> : null}

          {attentionRide ? (
            <>
              <Text style={styles.sectionText}>
                Estado: {rideStatusLabel({ status: attentionRide.status, role, canRate })}
              </Text>

              {role === "DRIVER" && attentionRide.status === "ASSIGNED" ? (
                <View style={styles.noticeBox}>
                  <Ionicons name="notifications-outline" size={18} color={colors.gold} />
                  <Text style={styles.noticeText}>Tenés un servicio por aceptar</Text>
                </View>
              ) : null}

              {role === "USER" && (attentionRide.status === "ASSIGNED" || attentionRide.status === "ACCEPTED") ? (
                <View style={styles.noticeBox}>
                  <Ionicons name="notifications-outline" size={18} color={colors.gold} />
                  <Text style={styles.noticeText}>
                    {attentionRide.status === "ACCEPTED" ? "Tu ejecutivo aceptó tu servicio" : "Un ejecutivo fue asignado a tu servicio"}
                  </Text>
                </View>
              ) : null}

              <View style={{ marginTop: 8 }}>
                <SecondaryButton
                  label="Ver detalle"
                  onPress={() => navigation.navigate("RideDetails", { rideId: attentionRide.id })}
                />
              </View>

              {attentionRide.agreedPrice != null ? (
                <Text style={styles.sectionText}>Precio acordado: {formatCop(Number(attentionRide.agreedPrice))}</Text>
              ) : null}

              {role === "USER" && attentionRide.matchedDriver ? (
                <>
                  <Text style={styles.sectionText}>Ejecutivo: {attentionRide.matchedDriver.fullName}</Text>
                  {driverWhatsappLink && (attentionRide.status === "ASSIGNED" || attentionRide.status === "ACCEPTED" || attentionRide.status === "IN_PROGRESS") ? (
                    <Pressable onPress={() => void openDriverWhatsapp()} style={({ pressed }) => [styles.whatsBtn, pressed && styles.pressed]}>
                      <Ionicons name="logo-whatsapp" size={18} color={colors.gold} />
                      <Text style={styles.whatsText}>Hablar con Ejecutivo</Text>
                    </Pressable>
                  ) : null}

                  {driverTelLink && (attentionRide.status === "ASSIGNED" || attentionRide.status === "ACCEPTED" || attentionRide.status === "IN_PROGRESS") ? (
                    <View style={{ marginTop: 8 }}>
                      <SecondaryButton label="Llamar directamente al ejecutivo" onPress={() => void callDriverDirect()} />
                    </View>
                  ) : null}

                  {attentionRide.matchedDriver.phone ? (
                    <Text style={styles.sectionText}>Tel: {attentionRide.matchedDriver.phone}</Text>
                  ) : null}
                  {attentionRide.matchedDriver.serviceType ? (
                    <Text style={styles.sectionText}>Tipo: {serviceTypeLabel(attentionRide.matchedDriver.serviceType)}</Text>
                  ) : null}
                  {attentionRide.matchedDriver.vehicle ? (
                    <Text style={styles.sectionText}>
                      Vehículo: {attentionRide.matchedDriver.vehicle.brand} {attentionRide.matchedDriver.vehicle.model}
                      {attentionRide.matchedDriver.vehicle.plate ? ` • ${attentionRide.matchedDriver.vehicle.plate}` : ""}
                    </Text>
                  ) : null}
                </>
              ) : null}

              {role === "USER" && (attentionRide.status === "OPEN" || attentionRide.status === "ASSIGNED" || attentionRide.status === "ACCEPTED" || attentionRide.status === "MATCHED") ? (
                <View style={{ marginTop: 10 }}>
                  <SecondaryButton
                    label={rideActionLoading ? "Cancelando..." : "Cancelar servicio"}
                    onPress={confirmCancelMyRide}
                    disabled={rideActionLoading}
                  />
                </View>
              ) : null}
              {role === "DRIVER" && attentionRide.passenger ? (
                <>
                  <Text style={styles.sectionText}>Pasajero: {attentionRide.passenger.fullName}</Text>
                  {attentionRide.passenger.phone ? <Text style={styles.sectionText}>Tel: {attentionRide.passenger.phone}</Text> : null}
                </>
              ) : null}

              {role === "DRIVER" ? (
                <View style={{ marginTop: 10, gap: 10 }}>
                  {passengerWhatsappLink && (attentionRide.status === "ACCEPTED" || attentionRide.status === "IN_PROGRESS") ? (
                    <Pressable
                      onPress={() => void openPassengerWhatsapp()}
                      style={({ pressed }) => [styles.whatsBtn, pressed && styles.pressed]}
                    >
                      <Ionicons name="logo-whatsapp" size={18} color={colors.gold} />
                      <Text style={styles.whatsText}>Hablar con Cliente</Text>
                    </Pressable>
                  ) : null}

                  {attentionRide.status === "ASSIGNED" ? (
                    <PrimaryButton
                      label={rideActionLoading ? "Procesando..." : "Aceptar carrera"}
                      onPress={() => void driverAction("accept")}
                      disabled={rideActionLoading}
                    />
                  ) : null}

                  {attentionRide.status === "ACCEPTED" ? (
                    <>
                      {attentionRide.isFixedPrice && !attentionRide.offer ? (
                        <View style={styles.meterBox}>
                          <View style={styles.meterTitleRow}>
                            <Ionicons name="cash-outline" size={16} color={colors.gold} />
                            <Text style={styles.meterTitle}>Precio fijo</Text>
                          </View>

                          <Text style={styles.meterBigLine}>
                            {formatCop(Number(attentionRide.fixedPriceCop ?? attentionRide.estimatedPrice ?? 0))}
                          </Text>
                          <Text style={styles.meterSmallLine}>Cobro fijo por zona (no aplica taxímetro).</Text>
                        </View>
                      ) : null}

                      {attentionRide.offer ? (
                        <View style={styles.meterBox}>
                          <View style={styles.meterTitleRow}>
                            <Ionicons name="map-outline" size={16} color={colors.gold} />
                            <Text style={styles.meterTitle}>Ruta</Text>
                          </View>

                          <MiniRouteMap
                            pickup={{ lat: Number(attentionRide.pickupLat), lng: Number(attentionRide.pickupLng) }}
                            dropoff={{ lat: Number(attentionRide.dropoffLat), lng: Number(attentionRide.dropoffLng) }}
                            routePath={(attentionRide.routePath ?? attentionRide.offer?.routePath ?? null) as any}
                            height={140}
                          />

                          {attentionRide.agreedPrice != null ? (
                            <Text style={styles.meterBigLine}>Monto acordado: {formatCop(Number(attentionRide.agreedPrice))}</Text>
                          ) : null}
                        </View>
                      ) : null}

                      <PrimaryButton
                        label={rideActionLoading ? "Procesando..." : "Iniciar carrera"}
                        onPress={() => void driverAction("start")}
                        disabled={rideActionLoading}
                      />

                      <SecondaryButton
                        label={notifyLoading ? "Notificando..." : "Notificar al cliente"}
                        onPress={() => void notifyPassengerArrived()}
                        disabled={notifyLoading}
                      />
                    </>
                  ) : null}

                  {attentionRide.status === "IN_PROGRESS" ? (
                    <>
                      {attentionRide.offer ? (
                        <View style={styles.meterBox}>
                          <View style={styles.meterTitleRow}>
                            <Ionicons name="map-outline" size={16} color={colors.gold} />
                            <Text style={styles.meterTitle}>Ruta</Text>
                          </View>

                          <MiniRouteMap
                            pickup={{ lat: Number(attentionRide.pickupLat), lng: Number(attentionRide.pickupLng) }}
                            dropoff={{ lat: Number(attentionRide.dropoffLat), lng: Number(attentionRide.dropoffLng) }}
                            routePath={(attentionRide.routePath ?? attentionRide.offer?.routePath ?? null) as any}
                            height={140}
                          />

                          {attentionRide.agreedPrice != null ? (
                            <Text style={styles.meterBigLine}>Monto acordado: {formatCop(Number(attentionRide.agreedPrice))}</Text>
                          ) : null}
                        </View>
                      ) : attentionRide.isFixedPrice ? (
                        <View style={styles.meterBox}>
                          <View style={styles.meterTitleRow}>
                            <Ionicons name="cash-outline" size={16} color={colors.gold} />
                            <Text style={styles.meterTitle}>Precio fijo</Text>
                          </View>

                          <Text style={styles.meterBigLine}>
                            {formatCop(Number(attentionRide.fixedPriceCop ?? attentionRide.estimatedPrice ?? 0))}
                          </Text>
                          <Text style={styles.meterSmallLine}>Cobro fijo por zona (no aplica taxímetro).</Text>
                        </View>
                      ) : (
                        <View style={styles.meterBox}>
                          <View style={styles.meterTopRow}>
                            <View style={{ flex: 1, gap: 8 }}>
                              <View style={styles.meterTitleRow}>
                                <Ionicons name="speedometer-outline" size={16} color={colors.gold} />
                                <Text style={styles.meterTitle}>Taxímetro</Text>
                              </View>

                              <Text style={styles.meterBigLine}>{Math.round(meterDistanceMeters)} m</Text>
                              {meterPriceToShow != null ? (
                                <>
                                  <Text style={styles.meterBigLine}>{formatCop(Number(meterPriceToShow))}</Text>
                                  {meterSecondary ? <Text style={styles.meterSmallLine}>{meterSecondary}</Text> : null}
                                </>
                              ) : null}
                            </View>

                            <View style={styles.meterActionsCol}>
                              <Pressable
                                onPress={toggleMeterPaused}
                                style={({ pressed }) => [styles.meterActionBtn, pressed && styles.pressed]}
                              >
                                <Ionicons
                                  name={meterPaused ? "play-outline" : "pause-outline"}
                                  size={18}
                                  color={colors.gold}
                                />
                                <Text style={styles.meterActionText}>{meterPaused ? "Reanudar" : "Pausar"}</Text>
                              </Pressable>

                              <Pressable
                                onPress={confirmResetMeter}
                                style={({ pressed }) => [styles.meterActionBtn, pressed && styles.pressed]}
                              >
                                <Ionicons name="refresh-outline" size={18} color={colors.gold} />
                                <Text style={styles.meterActionText}>Reiniciar</Text>
                              </Pressable>
                            </View>
                          </View>

                          {!!meterError ? <Text style={[styles.sectionText, { color: colors.danger }]}>{meterError}</Text> : null}
                        </View>
                      )}

                      <PrimaryButton
                        label={rideActionLoading ? "Procesando..." : "Finalizar carrera"}
                        onPress={() => void driverAction("complete")}
                        disabled={rideActionLoading}
                      />
                    </>
                  ) : null}
                </View>
              ) : null}

              {canRate ? (
                <View style={{ marginTop: 10, gap: 8 }}>
                  <Text style={[styles.sectionText, { color: colors.text, fontWeight: "900" }]}>Calificar</Text>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Pressable
                        key={n}
                        style={styles.starBtn}
                        onPress={() => void submitRating(n)}
                        disabled={rideActionLoading}
                      >
                        <Ionicons name="star" size={18} color={colors.gold} />
                        <Text style={styles.starText}>{n}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          ) : (
            <Text style={styles.sectionText}>No tenés un servicio activo.</Text>
          )}
        </Card>
      ) : null}

      {role === "USER" && attentionRide ? (
        <Card style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="card-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Métodos de pago</Text>
          </View>

          <Text style={styles.sectionText}>Elegí tu método para ver los datos.</Text>

          <View style={styles.payToggleRow}>
            <Pressable
              onPress={() => setPaymentMethod("BANCOLOMBIA")}
              style={({ pressed }) => [
                styles.payToggleBtn,
                paymentMethod === "BANCOLOMBIA" ? styles.payToggleBtnActive : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={[styles.payToggleText, paymentMethod === "BANCOLOMBIA" ? styles.payToggleTextActive : null]}>
                Bancolombia
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setPaymentMethod("ZELLE")}
              style={({ pressed }) => [
                styles.payToggleBtn,
                paymentMethod === "ZELLE" ? styles.payToggleBtnActive : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={[styles.payToggleText, paymentMethod === "ZELLE" ? styles.payToggleTextActive : null]}>
                Zelle
              </Text>
            </Pressable>
          </View>

          {paymentMethod === "BANCOLOMBIA" ? (
            <View style={{ gap: 10 }}>
              <ReadOnlyField label="Titular" value={auth.appConfig?.paymentBancolombiaHolder ?? ""} />
              <ReadOnlyField label="Documento" value={auth.appConfig?.paymentBancolombiaDocument ?? ""} />
              <ReadOnlyField label="Tipo de cuenta" value={auth.appConfig?.paymentBancolombiaAccountType ?? ""} />
              <ReadOnlyField label="Número de cuenta" value={auth.appConfig?.paymentBancolombiaAccountNumber ?? ""} />
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <ReadOnlyField label="Titular" value={auth.appConfig?.paymentZelleHolder ?? ""} />
              <ReadOnlyField label="Email" value={auth.appConfig?.paymentZelleEmail ?? ""} />
              <ReadOnlyField label="Teléfono" value={auth.appConfig?.paymentZellePhone ?? ""} emptyText="(opcional)" />
            </View>
          )}
        </Card>
      ) : null}

      {role === "DRIVER" ? (
        <Card style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionTitleMain}>
              <Ionicons name="list-outline" size={18} color={colors.gold} />
              <Text style={styles.sectionTitle}>Servicios solicitados</Text>
            </View>

            <Pressable style={styles.sectionActionBtn} onPress={() => void refreshNearbyRequests({ showLoading: true })}>
              <Ionicons name="refresh" size={16} color={colors.text} />
            </Pressable>
          </View>

          <Text style={styles.sectionText}>Acá vas a ver solicitudes cercanas y ofrecer tu servicio dentro de {Math.round(matchingRadiusM)} m.</Text>

          {nearbyRequestsLoading ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
              <ActivityIndicator color={colors.gold} />
              <Text style={styles.sectionText}>Actualizando...</Text>
            </View>
          ) : null}

          {!!nearbyRequestsError ? <Text style={[styles.sectionText, { color: colors.danger }]}>{nearbyRequestsError}</Text> : null}

          <View style={{ marginTop: 10, gap: 10 }}>
            {nearbyRequests.slice(0, 10).map((r: any) => {
              const status = r?.myOffer?.status as string | undefined;
              const busy = offerRideLoadingId === r.rideId;

              const label =
                status === "OFFERED"
                  ? "Ofrecido"
                  : status === "REJECTED"
                    ? "Rechazado"
                    : status === "SELECTED"
                      ? "Seleccionado"
                      : busy
                        ? "Ofreciendo..."
                        : "Ofrecer servicio";

              const disabled = busy || status === "OFFERED" || status === "REJECTED" || status === "SELECTED";

                const firstName = (r?.passenger?.firstName as string | undefined) ?? "";
                const lastName = (r?.passenger?.lastName as string | undefined) ?? "";
                const fullName = (r?.passenger?.fullName as string | undefined) ?? "";
                const passengerName = `${firstName} ${lastName}`.trim() || fullName || "-";
              const distMeters = Math.round(Number(r?.distanceMeters ?? 0));
              const pickupLat = Number(r?.pickup?.lat);
              const pickupLng = Number(r?.pickup?.lng);
              const dropoffLat = Number(r?.dropoff?.lat);
              const dropoffLng = Number(r?.dropoff?.lng);

              const pickupText = (r?.pickup?.address as string | undefined) ?? null;
              const dropoffText = (r?.dropoff?.address as string | undefined) ?? null;

              function splitAddress(addr: string | null) {
                if (!addr) return { main: null as string | null, zone: null as string | null };
                const parts = addr
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
                if (parts.length <= 1) return { main: addr, zone: null };
                return {
                  main: parts.slice(0, -1).join(", ") || addr,
                  zone: parts[parts.length - 1] || null,
                };
              }

              const pickupSplit = splitAddress(pickupText);
              const dropoffSplit = splitAddress(dropoffText);

              const canRouteMap =
                Number.isFinite(pickupLat) &&
                Number.isFinite(pickupLng) &&
                Number.isFinite(dropoffLat) &&
                Number.isFinite(dropoffLng) &&
                (Math.abs(pickupLat - dropoffLat) > 0.00001 || Math.abs(pickupLng - dropoffLng) > 0.00001);
              const canMap = Boolean(
                driverCoords &&
                  Number.isFinite(driverCoords.lat) &&
                  Number.isFinite(driverCoords.lng) &&
                  Number.isFinite(pickupLat) &&
                  Number.isFinite(pickupLng)
              );

              // Mostrar monto al chofer para que sepa qué va a cobrar.

              return (
                <Card key={r.rideId} style={{ gap: 10 }}>
                  {canRouteMap ? (
                    <MiniRouteMap
                      height={130}
                      pickup={{ lat: pickupLat, lng: pickupLng }}
                      dropoff={{ lat: dropoffLat, lng: dropoffLng }}
                    />
                  ) : canMap ? (
                    <MiniMeetMap
                      height={120}
                      driver={{ lat: driverCoords!.lat, lng: driverCoords!.lng }}
                      passenger={{ lat: pickupLat, lng: pickupLng }}
                      driverIconName="car"
                      passengerIconName="person"
                    />
                  ) : null}

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={styles.requestAvatar}>
                      <Ionicons name="person" size={16} color={colors.gold} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.requestTitle}>{passengerName}</Text>
                      <View style={styles.requestMetaRow}>
                        <Ionicons name="walk-outline" size={14} color={colors.mutedText} />
                        <Text style={styles.requestMetaText}>{distMeters} m</Text>
                      </View>
                    </View>
                    <View style={styles.requestPill}>
                      <Ionicons
                        name={status === "OFFERED" ? "checkmark-circle-outline" : "flash-outline"}
                        size={14}
                        color={colors.gold}
                      />
                      <Text style={styles.requestPillText}>{status === "OFFERED" ? "Ofrecido" : "Cerca"}</Text>
                    </View>
                  </View>

                  {pickupText ? (
                    <>
                      <View style={styles.requestMetaRow}>
                        <Ionicons name="location-outline" size={14} color={colors.mutedText} />
                        <Text style={styles.requestMetaText}>Salida: {pickupSplit.main ?? pickupText}</Text>
                      </View>
                      {pickupSplit.zone ? (
                        <View style={styles.requestMetaRow}>
                          <Ionicons name="map-outline" size={14} color={colors.mutedText} />
                          <Text style={styles.requestMetaText}>Zona salida: {pickupSplit.zone}</Text>
                        </View>
                      ) : null}
                    </>
                  ) : null}

                  {dropoffText ? (
                    <>
                      <View style={styles.requestMetaRow}>
                        <Ionicons name="flag-outline" size={14} color={colors.mutedText} />
                        <Text style={styles.requestMetaText}>Destino: {dropoffSplit.main ?? dropoffText}</Text>
                      </View>
                      {dropoffSplit.zone ? (
                        <View style={styles.requestMetaRow}>
                          <Ionicons name="map-outline" size={14} color={colors.mutedText} />
                          <Text style={styles.requestMetaText}>Zona destino: {dropoffSplit.zone}</Text>
                        </View>
                      ) : null}
                    </>
                  ) : null}

                  <View style={styles.requestMetaRow}>
                    <Ionicons name="cash-outline" size={14} color={colors.mutedText} />
                    <Text style={styles.requestMetaText}>
                      {r?.isFixedPrice ? "Precio fijo: " : "Estimado: "}
                      {formatCop(Number(r?.isFixedPrice ? r?.fixedPriceCop ?? r?.estimatedPrice : r?.estimatedPrice))}
                    </Text>
                  </View>

                  <PrimaryButton label={label} onPress={() => void offerServiceToRide(r.rideId)} disabled={disabled} />
                </Card>
              );
            })}

            {!nearbyRequestsLoading && nearbyRequests.length === 0 ? (
              <Card>
                <Text style={styles.sectionText}>No hay solicitudes cercanas por ahora.</Text>
              </Card>
            ) : null}
          </View>
        </Card>
      ) : null}

      {role === "DRIVER" ? (
        <Card style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionTitleMain}>
              <Ionicons name="pricetag-outline" size={18} color={colors.gold} />
              <Text style={styles.sectionTitle}>Contraofertas cercanas</Text>
            </View>

            <Pressable style={styles.sectionActionBtn} onPress={() => void refreshNearbyRequests({ showLoading: true })}>
              <Ionicons name="refresh" size={16} color={colors.text} />
            </Pressable>
          </View>

          <Text style={styles.sectionText}>Se muestran dentro del radio global de {Math.round(matchingRadiusM)} m.</Text>

          {nearbyOffersLoading ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
              <ActivityIndicator color={colors.gold} />
              <Text style={styles.sectionText}>Actualizando...</Text>
            </View>
          ) : null}

          {!!nearbyOffersError ? <Text style={[styles.sectionText, { color: colors.danger }]}>{nearbyOffersError}</Text> : null}

          <View style={{ marginTop: 10, gap: 10 }}>
            {nearbyOffers.slice(0, 6).map((o) => (
              <Pressable key={o.offerId} onPress={() => navigation.navigate("DriverOfferDetails", { offerId: o.offerId })}>
                <Card style={{ gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                      <Ionicons name="location-outline" size={16} color={colors.gold} />
                      <Text style={[styles.sectionText, { color: colors.text, fontWeight: "900" }]}>
                        Oferta {serviceTypeLabel(o.serviceTypeWanted)}
                      </Text>
                    </View>
                    <View style={styles.requestPill}>
                      <Ionicons name="walk-outline" size={14} color={colors.gold} />
                      <Text style={styles.requestPillText}>{Math.round(o.distanceMeters)} m</Text>
                    </View>
                  </View>

                  <Text style={styles.sectionText}>
                    Ofrecido: {formatCop(Number(o.offeredPrice))} • Estimado: {formatCop(Number(o.estimatedPrice))}
                  </Text>
                </Card>
              </Pressable>
            ))}

            {!nearbyOffersLoading && nearbyOffers.length === 0 ? (
              <Card>
                <Text style={styles.sectionText}>No hay contraofertas cercanas por ahora.</Text>
              </Card>
            ) : null}
          </View>

          <View style={{ marginTop: 10 }}>
            <SecondaryButton label="Ver todas" onPress={() => navigation.navigate("DriverOffersList")} />
          </View>
        </Card>
      ) : null}

      {role === "USER" && openOffer ? (
        <Card style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="pricetag-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Tu contraoferta</Text>
          </View>

          {offersLoading ? <Text style={styles.sectionText}>Actualizando...</Text> : null}

          <>
            <Text style={styles.sectionText}>Servicio: {serviceTypeLabel(openOffer.serviceTypeWanted)}</Text>
            <Text style={styles.sectionText}>Ofrecido: {formatCop(Number(openOffer.offeredPrice))}</Text>
            <Text style={styles.sectionText}>Radio: {openOffer.searchRadiusM} m</Text>

            <View style={{ marginTop: 10 }}>
              <MiniRouteMap
                pickup={{ lat: Number(openOffer.pickupLat), lng: Number(openOffer.pickupLng) }}
                dropoff={{ lat: Number(openOffer.dropoffLat), lng: Number(openOffer.dropoffLng) }}
                routePath={(openOffer.routePath ?? null) as any}
              />
            </View>

            <View style={{ marginTop: 10 }}>
              <SecondaryButton
                label={rideActionLoading ? "Cancelando..." : "Cancelar contraoferta"}
                onPress={() => void cancelMyOffer()}
                disabled={rideActionLoading}
              />
            </View>
          </>
        </Card>
      ) : null}

      {role === "ADMIN" ? (
        <Card style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Administración</Text>
          </View>
          <Text style={styles.sectionText}>Desde acá vas a gestionar choferes, viajes y recuperaciones.</Text>

          <View style={{ marginTop: 10, gap: 10 }}>
            <PrimaryButton label="Configuración" onPress={() => navigation.navigate("AdminSettings")} />
            <PrimaryButton label="Zonas" onPress={() => navigation.navigate("AdminZones")} />
            <PrimaryButton label="Choferes" onPress={() => navigation.navigate("AdminDrivers")} />
            <PrimaryButton label="Clientes" onPress={() => navigation.navigate("AdminPassengers")} />
            <SecondaryButton label="Viajes" onPress={() => navigation.navigate("AdminRides")} />
            <SecondaryButton label="Recuperaciones" onPress={() => navigation.navigate("AdminPasswordResets")} />
          </View>
        </Card>
      ) : null}

      {role === "DRIVER" ? (
        <Card style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="car-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Ejecutivo</Text>
          </View>
          <Text style={styles.sectionText}>Acá vas a ver viajes asignados y aceptarlos para comenzar.</Text>

          <View style={{ marginTop: 10 }}>
            <PrimaryButton label="Contraofertas cercanas" onPress={() => navigation.navigate("DriverOffersList")} />
            <View style={{ height: 10 }} />
            <SecondaryButton label="Mapa / Ubicación" onPress={() => navigation.navigate("DriverMap")} />
            <View style={{ height: 10 }} />
            <SecondaryButton label="Historial" onPress={() => navigation.navigate("RidesHistory")} />
            <View style={{ height: 10 }} />
            <SecondaryButton label="Créditos (COP)" onPress={() => navigation.navigate("Credits")} />
          </View>
        </Card>
      ) : null}

        <View style={{ height: 14 }} />
        <PrimaryButton label="Cerrar sesión" onPress={() => void auth.logout()} />

        <View style={styles.footerBrand}>
          <Image source={playstoreImg} style={styles.footerBrandImg} resizeMode="contain" />
        </View>
      </ScrollView>

    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  operatorBtn: {
    alignItems: "center",
    justifyContent: "center",
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.card,
    shadowColor: colors.text,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2,
  },
  footerBrand: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  footerBrandImg: {
    width: 320,
    height: 90,
  },
  operatorImg: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  operatorText: {
    marginTop: 2,
    color: colors.text,
    fontSize: 10,
    fontWeight: "900",
  },
  whatsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.card,
  },
  whatsText: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: "900",
  },
  payToggleRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
    marginBottom: 6,
  },
  payToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
  },
  payToggleBtnActive: {
    borderColor: colors.gold,
  },
  payToggleText: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: "900",
  },
  payToggleTextActive: {
    color: colors.gold,
  },
  card: { marginTop: 16, gap: 8 },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  welcomeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  line: {
    color: colors.mutedText,
    fontSize: 14,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionTitleMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  sectionActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  sectionText: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
  },

  requestAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  requestTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
  },
  requestMetaRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  requestMetaText: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  requestPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  requestPillText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.85,
  },
  starBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  starText: {
    color: colors.text,
    fontWeight: "900",
  },

  meterBox: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  meterTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  meterTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  meterActionsCol: {
    gap: 10,
    alignItems: "flex-end",
  },
  meterActionBtn: {
    minWidth: 92,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    gap: 6,
  },
  meterActionText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: "700",
  },
  meterTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  meterLine: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
  },
  meterBigLine: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
  },
  meterSmallLine: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },

  noticeBox: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.card,
    borderRadius: 14,
  },
  noticeText: {
    flex: 1,
    color: colors.text,
    fontWeight: "900",
  },
});
