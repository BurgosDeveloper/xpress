import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/AppNavigator";
import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import { apiDriverRideHistory, apiPassengerRideHistory } from "../rides/rides.api";
import { serviceTypeLabel } from "../utils/serviceType";
import { formatDateYMD } from "../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "RidesHistory">;

type RideRow = any;

export function RidesHistoryScreen({ navigation }: Props) {
  const auth = useAuth();
  const token = auth.token;
  const role = auth.user?.role;

  const [items, setItems] = useState<RideRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => {
    const who = role === "DRIVER" ? "Ejecutivo" : "Cliente";
    return `Historial (${who})`;
  }, [role]);

  async function load() {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const res = role === "DRIVER" ? await apiDriverRideHistory(token, { take: 20 }) : await apiPassengerRideHistory(token, { take: 20 });
      setItems(res.rides ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el historial");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, role]);

  if (!token || (role !== "USER" && role !== "DRIVER")) {
    return (
      <Screen>
        <Card style={{ marginTop: 16 }}>
          <Text style={{ color: colors.text, fontWeight: "900" }}>Solo disponible para clientes y ejecutivos.</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Ionicons name="time-outline" size={20} color={colors.gold} />
            <Text style={styles.title}>{title}</Text>
          </View>

          <Pressable onPress={() => void load()} style={({ pressed }) => [styles.refreshBtn, pressed && styles.pressed]}>
            <Ionicons name="refresh" size={18} color={colors.gold} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centerRow}>
            <ActivityIndicator color={colors.gold} />
            <Text style={styles.muted}>Cargando...</Text>
          </View>
        ) : null}

        {!!error ? (
          <Card style={{ borderColor: colors.danger, borderWidth: 1 }}>
            <Text style={styles.error}>{error}</Text>
          </Card>
        ) : null}

        {items.map((r) => {
          const status = r.status ?? "—";
          const service = r.serviceTypeWanted ? serviceTypeLabel(r.serviceTypeWanted) : "—";
          const otherName = role === "DRIVER" ? r.passenger?.fullName : r.matchedDriver?.fullName;
          const shortId = r.id ? String(r.id).slice(-6) : "—";

          return (
            <Card key={r.id} style={styles.card}>
              <Text style={styles.cardTitle}>#{shortId}</Text>
              <Text style={styles.line}>Estado: {status}</Text>
              <Text style={styles.line}>Servicio: {service}</Text>
              <Text style={styles.line}>{role === "DRIVER" ? "Cliente" : "Ejecutivo"}: {otherName || "—"}</Text>
              <Text style={styles.muted}>Creado: {formatDateYMD(r.createdAt) ?? "—"}</Text>

              <PrimaryButton label="Ver detalle" onPress={() => navigation.navigate("RideDetails", { rideId: r.id })} />
            </Card>
          );
        })}

        {!loading && items.length === 0 ? <Text style={styles.muted}>No hay carreras.</Text> : null}
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
    fontWeight: "700",
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "900",
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
