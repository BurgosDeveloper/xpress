import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import { apiAdminDeleteAllRides, apiAdminGetRidesStats, apiAdminListRides, type RideStatus } from "../admin/admin.api";
import { serviceTypeLabel } from "../utils/serviceType";
import { formatDateYMD } from "../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "AdminRides">;

type RideRow = any;

export function AdminRidesScreen({ navigation }: Props) {
  const auth = useAuth();
  const token = auth.token;

  const [rides, setRides] = useState<RideRow[]>([]);
  const [stats, setStats] = useState<{ total: number; byStatus: Record<RideStatus, number> } | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => `Viajes (${rides.length})`, [rides.length]);

  const metricItems = useMemo(() => {
    const labels: Record<string, string> = {
      total: "Total",
      OPEN: "Abiertas",
      ASSIGNED: "Asignadas",
      ACCEPTED: "Aceptadas",
      MATCHED: "Emparejadas",
      IN_PROGRESS: "En progreso",
      CANCELLED: "Canceladas",
      EXPIRED: "Expiradas",
      COMPLETED: "Completadas",
    };

    if (!stats) return [] as Array<{ key: string; label: string; value: number }>;

    const base: Array<{ key: string; label: string; value: number }> = [{ key: "total", label: labels.total, value: stats.total }];
    const statuses: RideStatus[] = [
      "OPEN",
      "ASSIGNED",
      "ACCEPTED",
      "MATCHED",
      "IN_PROGRESS",
      "CANCELLED",
      "EXPIRED",
      "COMPLETED",
    ];

    return [...base, ...statuses.map((s) => ({ key: s, label: labels[s], value: stats.byStatus?.[s] ?? 0 }))];
  }, [stats]);

  async function load() {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const [resRides, resStats] = await Promise.all([apiAdminListRides(token, { take: 50, skip: 0 }), apiAdminGetRidesStats(token)]);
      setRides(resRides.rides);
      setStats(resStats.stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar viajes");
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteAll() {
    if (!token) return;

    Alert.alert(
      "Eliminar todas las carreras",
      "Esto eliminará todas las carreras en cualquier estado. Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setDeleting(true);
              setError(null);
              try {
                await apiAdminDeleteAllRides(token);
                await load();
              } catch (e) {
                setError(e instanceof Error ? e.message : "No se pudo eliminar carreras");
              } finally {
                setDeleting(false);
              }
            })();
          },
        },
      ]
    );
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Ionicons name="map-outline" size={20} color={colors.gold} />
            <Text style={styles.title}>{title}</Text>
          </View>

          <Pressable onPress={() => void load()} style={({ pressed }) => [styles.refreshBtn, pressed && styles.pressed]}>
            <Ionicons name="refresh" size={18} color={colors.gold} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centerRow}>
            <ActivityIndicator />
            <Text style={styles.muted}>Cargando...</Text>
          </View>
        ) : null}

        {metricItems.length ? (
          <View style={styles.metricsWrap}>
            {metricItems.map((m) => (
              <Card key={m.key} style={styles.metricCard}>
                <Text style={styles.metricValue}>{String(m.value)}</Text>
                <Text style={styles.metricLabel}>{m.label}</Text>
              </Card>
            ))}
          </View>
        ) : null}

        <View style={styles.actionsRow}>
          <SecondaryButton label={deleting ? "Eliminando..." : "Eliminar todas las carreras"} onPress={onDeleteAll} disabled={loading || deleting} />
        </View>

        {!!error ? <Text style={styles.error}>{error}</Text> : null}

        {rides.map((r) => (
          <Card key={r.id} style={styles.card}>
            <Text style={styles.cardTitle}>#{String(r.id).slice(-6)}</Text>
            <Text style={styles.line}>Estado: {r.status || "—"}</Text>
            <Text style={styles.line}>Servicio: {r.serviceTypeWanted ? serviceTypeLabel(r.serviceTypeWanted) : "—"}</Text>
            <Text style={styles.line}>Asignado por admin: {r.assignedByAdmin ? "Sí" : "No"}</Text>

            <Text style={styles.line}>
              Pasajero: {r.passenger?.fullName || "—"} ({r.passenger?.user?.email || "—"})
            </Text>
            <Text style={styles.line}>
              Chofer: {r.matchedDriver?.fullName || "—"} ({r.matchedDriver?.user?.email || "—"})
            </Text>

            <Text style={styles.muted}>Creado: {formatDateYMD(r.createdAt) ?? "—"}</Text>

            {!["IN_PROGRESS", "COMPLETED", "CANCELLED", "EXPIRED"].includes(String(r.status || "")) ? (
              <View style={{ marginTop: 8 }}>
                <PrimaryButton label="Asignar en mapa" onPress={() => navigation.navigate("AdminRideAssignMap", { ride: r })} />
              </View>
            ) : null}
          </Card>
        ))}

        {!loading && rides.length === 0 ? <Text style={styles.muted}>No hay viajes.</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: 10,
    paddingBottom: 40,
    gap: 12,
  },
  metricsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricCard: {
    width: "23%",
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 2,
  },
  metricValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  metricLabel: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  actionsRow: {
    gap: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
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
  centerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  muted: {
    color: colors.mutedText,
    fontSize: 13,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  card: {
    gap: 6,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  line: {
    color: colors.text,
    fontSize: 13,
  },
});
