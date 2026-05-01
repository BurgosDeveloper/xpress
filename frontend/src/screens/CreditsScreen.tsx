import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import { apiGetMyCredits } from "../credits/credits.api";
import { formatCop } from "../utils/currency";

type Props = NativeStackScreenProps<RootStackParamList, "Credits">;

export function CreditsScreen(_props: Props) {
  const auth = useAuth();
  const token = auth.token;
  const role = auth.user?.role;

  const [balanceCop, setBalanceCop] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatted = useMemo(() => formatCop(balanceCop), [balanceCop]);

  async function load() {
    if (!token) return;
    if (role !== "DRIVER") return;
    setError(null);
    setLoading(true);
    try {
      const res = await apiGetMyCredits(token);
      setBalanceCop(Number(res.balanceCop) || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el saldo");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, role]);

  if (role && role !== "DRIVER") {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Ionicons name="cash-outline" size={20} color={colors.gold} />
              <Text style={styles.title}>Créditos</Text>
            </View>
          </View>

          <Card style={styles.card}>
            <Text style={styles.cardLabel}>No disponible</Text>
            <Text style={styles.hint}>Los créditos aplican únicamente para ejecutivos.</Text>
          </Card>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Ionicons name="cash-outline" size={20} color={colors.gold} />
            <Text style={styles.title}>Créditos</Text>
          </View>

          <Pressable onPress={() => void load()} style={({ pressed }) => [styles.refreshBtn, pressed && styles.pressed]}>
            <Ionicons name="refresh" size={18} color={colors.gold} />
          </Pressable>
        </View>

        <Card style={styles.card}>
          <Text style={styles.cardLabel}>Saldo disponible</Text>
          <Text style={styles.amount}>{formatted}</Text>
          <Text style={styles.hint}>Moneda: pesos colombianos (COP)</Text>

          {loading ? (
            <View style={styles.centerRow}>
              <ActivityIndicator />
              <Text style={styles.muted}>Actualizando...</Text>
            </View>
          ) : null}

          {!!error ? <Text style={styles.error}>{error}</Text> : null}
        </Card>
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
  card: {
    gap: 10,
  },
  cardLabel: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  amount: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
  },
  hint: {
    color: colors.mutedText,
    fontSize: 12,
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
});
