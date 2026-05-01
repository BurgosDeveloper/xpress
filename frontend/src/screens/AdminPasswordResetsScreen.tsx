import React, { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import { apiAdminListPasswordResets, apiAdminSendPasswordResetWhatsapp } from "../admin/admin.api";
import { formatDateYMD } from "../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "AdminPasswordResets">;

type ResetRow = any;

export function AdminPasswordResetsScreen(_props: Props) {
  const auth = useAuth();
  const token = auth.token;

  const [items, setItems] = useState<ResetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const res = await apiAdminListPasswordResets(token, { take: 50 });
      setItems(res.requests);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar recuperaciones");
    } finally {
      setLoading(false);
    }
  }

  async function sendWhatsapp(resetRequestId: string) {
    if (!token) return;
    setBusyId(resetRequestId);
    setError(null);
    try {
      const res = await apiAdminSendPasswordResetWhatsapp(token, { resetRequestId });
      await Linking.openURL(res.whatsappLink);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el link de WhatsApp");
    } finally {
      setBusyId(null);
    }
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
            <Ionicons name="key-outline" size={20} color={colors.gold} />
            <Text style={styles.title}>Recuperaciones</Text>
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

        {!!error ? <Text style={styles.error}>{error}</Text> : null}

        {items.map((r) => {
          const isBusy = busyId === r.id;
          return (
            <Card key={r.id} style={styles.card}>
              <Text style={styles.cardTitle}>{r.email || "—"}</Text>
              <Text style={styles.line}>Rol: {r.role || "—"}</Text>
              <Text style={styles.line}>Tel (últ 3): {r.phoneLast3 || "—"}</Text>
              <Text style={styles.line}>Código: {r.code || "—"}</Text>
              <Text style={styles.line}>Creado: {formatDateYMD(r.createdAt) ?? "—"}</Text>
              <Text style={styles.line}>Expira: {formatDateYMD(r.expiresAt) ?? "—"}</Text>
              <Text style={styles.line}>Enviado: {formatDateYMD(r.sentAt) ?? "—"}</Text>
              <Text style={styles.line}>Verificado: {formatDateYMD(r.verifiedAt) ?? "—"}</Text>
              <Text style={styles.line}>Consumido: {formatDateYMD(r.consumedAt) ?? "—"}</Text>

              <Pressable
                disabled={isBusy}
                onPress={() => void sendWhatsapp(r.id)}
                style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
              >
                <Ionicons name="logo-whatsapp" size={18} color={colors.gold} />
                <Text style={styles.actionText}>{isBusy ? "Generando..." : "Enviar por WhatsApp"}</Text>
              </Pressable>
            </Card>
          );
        })}

        {!loading && items.length === 0 ? <Text style={styles.muted}>No hay solicitudes.</Text> : null}
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
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    marginTop: 10,
  },
  actionText: {
    color: colors.text,
    fontWeight: "900",
  },
});
