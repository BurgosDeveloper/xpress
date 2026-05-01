import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/AppNavigator";
import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import { apiAdminDeletePassenger, apiAdminListPassengers, apiAdminSetPassengerActive } from "../admin/admin.api";
import { absoluteUrl } from "../utils/url";
import { PassengerTechSheetModal } from "../passengers/PassengerTechSheetModal";

type Props = NativeStackScreenProps<RootStackParamList, "AdminPassengers">;

type PassengerRow = any;

export function AdminPassengersScreen({ navigation }: Props) {
  const auth = useAuth();
  const token = auth.token;

  const [passengers, setPassengers] = useState<PassengerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [techOpen, setTechOpen] = useState(false);
  const [selectedPassenger, setSelectedPassenger] = useState<PassengerRow | null>(null);

  const title = useMemo(() => `Clientes (${passengers.length})`, [passengers.length]);

  async function load() {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const res = await apiAdminListPassengers(token, { take: 80, skip: 0 });
      setPassengers(res.passengers);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar clientes");
    } finally {
      setLoading(false);
    }
  }

  function openTech(p: PassengerRow) {
    setSelectedPassenger(p);
    setTechOpen(true);
  }

  async function setActive(passengerId: string, nextActive: boolean) {
    if (!token) return;

    Alert.alert(nextActive ? "Activar" : "Desactivar", `¿Seguro que querés ${nextActive ? "activar" : "desactivar"} este cliente?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: nextActive ? "Activar" : "Desactivar",
        style: nextActive ? "default" : "destructive",
        onPress: async () => {
          setBusyId(passengerId);
          try {
            await apiAdminSetPassengerActive(token, { passengerId, isActive: nextActive });
            await load();
          } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo actualizar el usuario");
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  async function deletePassenger(passengerId: string) {
    if (!token) return;

    Alert.alert("Eliminar", "Esto elimina al cliente y toda su data relacionada. ¿Continuar?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          setBusyId(passengerId);
          try {
            await apiAdminDeletePassenger(token, { passengerId });
            await load();
          } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo eliminar");
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  }

  useEffect(() => {
    void load();
    const unsub = navigation.addListener("focus", () => {
      void load();
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, navigation]);

  return (
    <Screen>
      <PassengerTechSheetModal
        visible={techOpen}
        passenger={
          selectedPassenger
            ? {
                fullName: selectedPassenger.fullName,
                phone: selectedPassenger.phone,
                email: selectedPassenger.user?.email,
                photoUrl: selectedPassenger.photoUrl,
              }
            : null
        }
        onClose={() => {
          setTechOpen(false);
          setSelectedPassenger(null);
        }}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Ionicons name="person-outline" size={20} color={colors.gold} />
            <Text style={styles.title}>{title}</Text>
          </View>

          <Pressable onPress={() => void load()} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
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

        {passengers.map((p) => {
          const isBusy = busyId === p.id;
          const avatarUri = absoluteUrl(p.photoUrl);
          const isActive = p.user?.isActive ?? true;

          return (
            <Card key={p.id} style={styles.card}>
              <View style={styles.cardTopRow}>
                <View style={styles.avatar}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatarImg} resizeMode="cover" />
                  ) : (
                    <View style={styles.avatarEmpty}>
                      <Ionicons name="image-outline" size={16} color={colors.mutedText} />
                    </View>
                  )}
                </View>

                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.cardTitle}>{p.fullName || "(sin nombre)"}</Text>
                  <Text style={styles.line}>Email: {p.user?.email || "—"}</Text>
                </View>

                <Pressable
                  onPress={() => navigation.navigate("AdminPassengerUpsert", { passenger: p })}
                  style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Editar cliente"
                >
                  <Ionicons name="create-outline" size={18} color={colors.gold} />
                </Pressable>
              </View>

              <Text style={styles.line}>Teléfono: {p.phone || "—"}</Text>
              <Text style={styles.line}>Activo: {isActive ? "Sí" : "No"}</Text>

              <View style={styles.actionsRow}>
                <Pressable
                  disabled={isBusy}
                  onPress={() => void setActive(p.id, !isActive)}
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                >
                  <Ionicons
                    name={isActive ? "pause-circle-outline" : "play-circle-outline"}
                    size={18}
                    color={isActive ? colors.danger : colors.gold}
                  />
                  <Text style={[styles.actionText, isActive ? { color: colors.danger } : null]}>
                    {isActive ? "Desactivar" : "Activar"}
                  </Text>
                </Pressable>

                <Pressable
                  disabled={isBusy}
                  onPress={() => openTech(p)}
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Abrir ficha técnica"
                >
                  <Ionicons name="document-text-outline" size={18} color={colors.gold} />
                  <Text style={styles.actionText}>Ficha técnica</Text>
                </Pressable>

                <Pressable
                  disabled={isBusy}
                  onPress={() => void deletePassenger(p.id)}
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Eliminar cliente"
                >
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  <Text style={[styles.actionText, { color: colors.danger }]}>Eliminar</Text>
                </Pressable>
              </View>

              {isBusy ? <Text style={styles.muted}>Actualizando...</Text> : null}
            </Card>
          );
        })}

        {!loading && passengers.length === 0 ? <Text style={styles.muted}>No hay clientes.</Text> : null}
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
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  avatarEmpty: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  editBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
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
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
    flexWrap: "wrap",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  actionText: {
    color: colors.text,
    fontWeight: "800",
  },
});
