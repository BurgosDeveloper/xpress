import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/AppNavigator";
import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import {
  apiAdminListZoneFixedPrices,
  apiAdminListZones,
  apiAdminUpsertZoneFixedPrice,
  type AdminZone,
  type AdminZoneFixedPriceItem,
  type ServiceType,
} from "../admin/admin.api";

type Props = NativeStackScreenProps<RootStackParamList, "AdminZones">;

const SERVICE_TYPES: ServiceType[] = ["CARRO", "MOTO", "MOTO_CARGA", "CARRO_CARGA"];

function serviceTypeShortLabel(t: ServiceType) {
  if (t === "CARRO") return "Carro";
  if (t === "MOTO") return "Moto";
  if (t === "MOTO_CARGA") return "Moto C";
  return "Carro C";
}

function parseCop(input: string) {
  const s = String(input ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (!s) return NaN;
  return Number(s);
}

export function AdminZonesScreen({ navigation }: Props) {
  const auth = useAuth();
  const token = auth.token;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [zones, setZones] = useState<AdminZone[]>([]);
  const [fixedPrices, setFixedPrices] = useState<AdminZoneFixedPriceItem[]>([]);

  // Edición: key = `${targetZoneId}:${serviceType}` -> string
  const [draft, setDraft] = useState<Record<string, string>>({});
  const dirtyKeysRef = useRef<Set<string>>(new Set());

  const hubZone = useMemo(() => zones.find((z) => z.isHub) ?? null, [zones]);
  const targetZones = useMemo(() => zones.filter((z) => !z.isHub && z.isActive), [zones]);

  const priceIndex = useMemo(() => {
    const map: Record<string, AdminZoneFixedPriceItem> = {};
    const hubId = hubZone?.id;
    for (const it of fixedPrices) {
      if (!hubId) continue;
      if (it.hubZoneId !== hubId) continue;
      const key = `${it.targetZoneId}:${it.serviceType}`;
      map[key] = it;
    }
    return map;
  }, [fixedPrices, hubZone?.id]);

  function getShownValue(targetZoneId: string, serviceType: ServiceType) {
    const key = `${targetZoneId}:${serviceType}`;
    if (draft[key] != null) return draft[key];
    const current = priceIndex[key];
    if (!current || !current.isActive) return "";
    return String(current.amountCop ?? "");
  }

  async function load() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [zonesRes, fixedRes] = await Promise.all([
        apiAdminListZones(token),
        apiAdminListZoneFixedPrices(token),
      ]);
      setZones(Array.isArray(zonesRes.zones) ? zonesRes.zones : []);
      setFixedPrices(Array.isArray(fixedRes.items) ? fixedRes.items : []);
      setDraft({});
      dirtyKeysRef.current = new Set();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar zonas");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!token) return;
    if (!hubZone) return Alert.alert("Zonas", "No hay zona HUB (SC) configurada.");

    const keys = Array.from(dirtyKeysRef.current);
    if (keys.length === 0) return Alert.alert("Zonas", "No hay cambios para guardar.");

    setSaving(true);
    setError(null);

    try {
      for (const key of keys) {
        const [targetZoneId, serviceType] = key.split(":") as [string, ServiceType];
        const raw = draft[key] ?? "";
        const n = parseCop(raw);

        // Vacío => desactivar/borrar (guardamos isActive=false si existe, o no hacemos nada si no hay item).
        if (!raw.trim()) {
          const existing = priceIndex[key];
          if (existing) {
            await apiAdminUpsertZoneFixedPrice(token, {
              hubZoneId: hubZone.id,
              targetZoneId,
              serviceType,
              amountCop: Number(existing.amountCop ?? 0),
              isActive: false,
            });
          }
          continue;
        }

        if (!Number.isFinite(n) || n <= 0) {
          throw new Error(`Monto inválido para ${serviceTypeShortLabel(serviceType)}.`);
        }

        await apiAdminUpsertZoneFixedPrice(token, {
          hubZoneId: hubZone.id,
          targetZoneId,
          serviceType,
          amountCop: n,
          isActive: true,
        });
      }

      await load();
      Alert.alert("Listo", "Precios guardados");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void load();
    const unsub = navigation.addListener("focus", () => void load());
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, navigation]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Ionicons name="map-outline" size={20} color={colors.gold} />
            <Text style={styles.title}>Zonas</Text>
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

        <Card style={styles.card}>
          <Text style={styles.muted}>
            Hub (SC): {hubZone ? hubZone.name : "(no configurado)"}
          </Text>
          <Text style={styles.muted}>
            Regla: SC ↔ Zona = precio fijo. Zona ↔ Zona = negociar por WhatsApp.
          </Text>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Precios fijos (SC → Zona)</Text>

          {!hubZone ? (
            <Text style={styles.error}>No hay zona HUB configurada. Marcá SC como HUB en el import o en backend.</Text>
          ) : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={styles.tableHeaderRow}>
                <View style={[styles.cellZone, styles.cellHeader]}>
                  <Text style={styles.cellHeaderText}>Zona</Text>
                </View>
                {SERVICE_TYPES.map((st) => (
                  <View key={st} style={[styles.cellPrice, styles.cellHeader]}>
                    <Text style={styles.cellHeaderText}>{serviceTypeShortLabel(st)}</Text>
                  </View>
                ))}
              </View>

              {targetZones.map((z) => (
                <View key={z.id} style={styles.tableRow}>
                  <View style={styles.cellZone}>
                    <Text style={styles.zoneName}>{z.name}</Text>
                  </View>

                  {SERVICE_TYPES.map((st) => {
                    const key = `${z.id}:${st}`;
                    const shown = getShownValue(z.id, st);

                    return (
                      <View key={st} style={styles.cellPrice}>
                        <TextInput
                          value={shown}
                          onChangeText={(t) => {
                            setDraft((d) => ({ ...d, [key]: t }));
                            dirtyKeysRef.current.add(key);
                          }}
                          placeholder="-"
                          placeholderTextColor={colors.mutedText}
                          keyboardType="number-pad"
                          style={styles.priceInput}
                        />
                      </View>
                    );
                  })}
                </View>
              ))}

              {targetZones.length === 0 ? <Text style={styles.muted}>No hay zonas activas (no-hub).</Text> : null}
            </View>
          </ScrollView>

          <Text style={styles.muted}>Dejá vacío para desactivar ese precio fijo.</Text>
        </Card>

        <PrimaryButton
          label={saving ? "Guardando..." : "Guardar precios"}
          iconName="save-outline"
          onPress={() => void save()}
          disabled={saving || loading || !hubZone}
        />
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
    fontWeight: "700",
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800",
  },
  card: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },

  tableHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  cellHeader: {
    borderColor: colors.gold,
  },
  cellZone: {
    width: 220,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.card,
  },
  cellPrice: {
    width: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  cellHeaderText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900",
  },
  zoneName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  priceInput: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    paddingVertical: 4,
  },
});
