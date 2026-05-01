import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import { apiAdminHardDeleteDriver, apiAdminListDrivers, apiAdminSetDriverActive } from "../admin/admin.api";
import { serviceTypeLabel } from "../utils/serviceType";
import { absoluteUrl } from "../utils/url";
import { DriverTechSheetModal } from "../drivers/DriverTechSheetModal";

type Props = NativeStackScreenProps<RootStackParamList, "AdminDrivers">;

type DriverRow = any;

function formatCop(n: number) {
  try {
    return new Intl.NumberFormat("es-CO").format(n);
  } catch {
    return String(n);
  }
}

export function AdminDriversScreen({ navigation }: Props) {
  const auth = useAuth();
  const token = auth.token;

  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [techOpen, setTechOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<DriverRow | null>(null);

  const title = useMemo(() => `Choferes (${drivers.length})`, [drivers.length]);

  async function load() {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const res = await apiAdminListDrivers(token);
      setDrivers(res.drivers);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar choferes");
    } finally {
      setLoading(false);
    }
  }

  function openTech(d: DriverRow) {
    setSelectedDriver(d);
    setTechOpen(true);
  }

  async function setActive(driverId: string, nextActive: boolean) {
    if (!token) return;

    Alert.alert(nextActive ? "Activar" : "Desactivar", `¿Seguro que querés ${nextActive ? "activar" : "desactivar"} este usuario?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: nextActive ? "Activar" : "Desactivar",
        style: nextActive ? "default" : "destructive",
        onPress: async () => {
          setBusyId(driverId);
          try {
            await apiAdminSetDriverActive(token, { driverId, isActive: nextActive });
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

  async function deleteDriver(driverId: string) {
    if (!token) return;

    Alert.alert("Eliminar chofer", "Esto elimina al chofer y toda su data relacionada. ¿Continuar?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          setBusyId(driverId);
          try {
            await apiAdminHardDeleteDriver(token, { driverId });
            await load();
          } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo eliminar el chofer");
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
      <DriverTechSheetModal
        visible={techOpen}
        driver={selectedDriver}
        onClose={() => {
          setTechOpen(false);
          setSelectedDriver(null);
        }}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Ionicons name="people-outline" size={20} color={colors.gold} />
            <Text style={styles.title}>{title}</Text>
          </View>

          <View style={styles.headerRight}>
            <Pressable
              onPress={() => navigation.navigate("AdminDriverUpsert")}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Agregar chofer"
            >
              <Ionicons name="add" size={20} color={colors.gold} />
            </Pressable>

            <Pressable onPress={() => void load()} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
              <Ionicons name="refresh" size={18} color={colors.gold} />
            </Pressable>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerRow}>
            <ActivityIndicator />
            <Text style={styles.muted}>Cargando...</Text>
          </View>
        ) : null}

        {!!error ? <Text style={styles.error}>{error}</Text> : null}

        {drivers.map((d) => {
          const isBusy = busyId === d.id;
          const avatarUri = absoluteUrl(d.photoUrl);
          return (
            <Card key={d.id} style={styles.card}>
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
                  <Text style={styles.cardTitle}>{d.fullName || "(sin nombre)"}</Text>
                  <Text style={styles.line}>Email: {d.user?.email || "—"}</Text>
                </View>

                <Pressable
                  onPress={() => navigation.navigate("AdminDriverUpsert", { driver: d })}
                  style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Editar chofer"
                >
                  <Ionicons name="create-outline" size={18} color={colors.gold} />
                </Pressable>
              </View>

              <Text style={styles.line}>Teléfono: {d.phone || "—"}</Text>
              <Text style={styles.line}>Servicio: {d.serviceType ? serviceTypeLabel(d.serviceType) : "—"}</Text>
              <Text style={styles.line}>Estado: {d.status || "—"}</Text>
              <Text style={styles.line}>Disponible: {d.isAvailable ? "Sí" : "No"}</Text>
              <Text style={styles.line}>Activo: {d.user?.isActive ? "Sí" : "No"}</Text>
              <Text style={styles.line}>Créditos (COP): {formatCop(Number(d.user?.creditAccount?.balanceCop ?? 0))}</Text>
              <Text style={styles.line}>
                Vehículo: {d.vehicle ? `${d.vehicle.brand} ${d.vehicle.model} ${d.vehicle.plate ? `(${d.vehicle.plate})` : ""}` : "—"}
              </Text>

              <View style={styles.actionsRow}>
                <Pressable
                  disabled={isBusy}
                  onPress={() => void setActive(d.id, !d.user?.isActive)}
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                >
                  <Ionicons
                    name={d.user?.isActive ? "pause-circle-outline" : "play-circle-outline"}
                    size={18}
                    color={d.user?.isActive ? colors.danger : colors.gold}
                  />
                  <Text style={[styles.actionText, d.user?.isActive ? { color: colors.danger } : null]}>
                    {d.user?.isActive ? "Desactivar" : "Activar"}
                  </Text>
                </Pressable>

                <Pressable
                  disabled={isBusy}
                  onPress={() => openTech(d)}
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Abrir ficha técnica"
                >
                  <Ionicons name="document-text-outline" size={18} color={colors.gold} />
                  <Text style={styles.actionText}>Ficha técnica</Text>
                </Pressable>

                <Pressable
                  disabled={isBusy}
                  onPress={() => void deleteDriver(d.id)}
                  style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Eliminar chofer"
                >
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  <Text style={[styles.actionText, { color: colors.danger }]}>Eliminar</Text>
                </Pressable>
              </View>

              {isBusy ? <Text style={styles.muted}>Actualizando...</Text> : null}
            </Card>
          );
        })}

        {!loading && drivers.length === 0 ? <Text style={styles.muted}>No hay choferes.</Text> : null}
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
    borderWidth:  1,
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
