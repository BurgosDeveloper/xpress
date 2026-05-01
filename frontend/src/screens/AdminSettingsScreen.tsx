import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { TextField } from "../components/TextField";
import { PrimaryButton } from "../components/PrimaryButton";
import { colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import {
  apiAdminGetAppConfig,
  apiAdminGetPricing,
  apiAdminUpsertPricing,
  apiAdminUpdateAppConfig,
} from "../admin/admin.api";
import type { ServiceType } from "../admin/admin.api";
import { serviceTypeIconName, serviceTypeLabel } from "../utils/serviceType";

type Props = NativeStackScreenProps<RootStackParamList, "AdminSettings">;

function parseNumber(input: string) {
  const s = String(input ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".");
  if (!s) return NaN;
  return Number(s);
}

function parseIntSafe(input: string) {
  const s = String(input ?? "").trim();
  if (!s) return NaN;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : NaN;
}

export function AdminSettingsScreen({ navigation }: Props) {
  const auth = useAuth();
  const token = auth.token;

  const [loading, setLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pricingType, setPricingType] = useState<ServiceType>("CARRO");
  const [pricingByType, setPricingByType] = useState<Record<string, any>>({});

  const [pricingBaseFare, setPricingBaseFare] = useState("0");
  const [pricingNightBaseFare, setPricingNightBaseFare] = useState("0");
  const [pricingNightStartHour, setPricingNightStartHour] = useState("20");
  const [pricingNightEndHour, setPricingNightEndHour] = useState("23");
  const [pricingIncludedMeters, setPricingIncludedMeters] = useState("0");
  const [pricingStepMeters, setPricingStepMeters] = useState("0");
  const [pricingStepPrice, setPricingStepPrice] = useState("0");
  const [driverCreditChargePercent, setDriverCreditChargePercent] = useState("0");
  const [fxCopPerUsd, setFxCopPerUsd] = useState("0");
  const [fxCopPerVes, setFxCopPerVes] = useState("0");
  const [matchingRadiusM, setMatchingRadiusM] = useState("2000");

  const [zoeWhatsappPhone, setZoeWhatsappPhone] = useState("");

  const [paymentBancolombiaHolder, setPaymentBancolombiaHolder] = useState("");
  const [paymentBancolombiaDocument, setPaymentBancolombiaDocument] = useState("");
  const [paymentBancolombiaAccountType, setPaymentBancolombiaAccountType] = useState("");
  const [paymentBancolombiaAccountNumber, setPaymentBancolombiaAccountNumber] = useState("");

  const [paymentZelleHolder, setPaymentZelleHolder] = useState("");
  const [paymentZelleEmail, setPaymentZelleEmail] = useState("");
  const [paymentZellePhone, setPaymentZellePhone] = useState("");

  const title = useMemo(() => "Configuración global", []);

  async function load() {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const [cfgRes, pricingRes] = await Promise.all([apiAdminGetAppConfig(token), apiAdminGetPricing(token)]);
      setDriverCreditChargePercent(String(cfgRes.appConfig.driverCreditChargePercent ?? 0));
      setFxCopPerUsd(String(cfgRes.appConfig.fxCopPerUsd ?? 0));
      setFxCopPerVes(String(cfgRes.appConfig.fxCopPerVes ?? 0));
      setMatchingRadiusM(String(cfgRes.appConfig.matchingRadiusM ?? 2000));

      setZoeWhatsappPhone(String(cfgRes.appConfig.zoeWhatsappPhone ?? ""));

      setPaymentBancolombiaHolder(String(cfgRes.appConfig.paymentBancolombiaHolder ?? ""));
      setPaymentBancolombiaDocument(String(cfgRes.appConfig.paymentBancolombiaDocument ?? ""));
      setPaymentBancolombiaAccountType(String(cfgRes.appConfig.paymentBancolombiaAccountType ?? ""));
      setPaymentBancolombiaAccountNumber(String(cfgRes.appConfig.paymentBancolombiaAccountNumber ?? ""));

      setPaymentZelleHolder(String(cfgRes.appConfig.paymentZelleHolder ?? ""));
      setPaymentZelleEmail(String(cfgRes.appConfig.paymentZelleEmail ?? ""));
      setPaymentZellePhone(String(cfgRes.appConfig.paymentZellePhone ?? ""));

      const byType: Record<string, any> = {};
      for (const row of pricingRes.pricing ?? []) {
        if (row?.serviceType) byType[String(row.serviceType)] = row;
      }
      setPricingByType(byType);

      const current = byType[pricingType] ?? null;
      setPricingBaseFare(String(current?.baseFare ?? 0));
      setPricingNightBaseFare(String(current?.nightBaseFare ?? 0));
      setPricingNightStartHour(String(current?.nightStartHour ?? 20));
      setPricingNightEndHour(String(current?.nightEndHour ?? 23));
      setPricingIncludedMeters(String(current?.includedMeters ?? 0));
      setPricingStepMeters(String(current?.stepMeters ?? 0));
      setPricingStepPrice(String(current?.stepPrice ?? 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la configuración");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const current = pricingByType[pricingType] ?? null;
    setPricingBaseFare(String(current?.baseFare ?? 0));
    setPricingNightBaseFare(String(current?.nightBaseFare ?? 0));
    setPricingNightStartHour(String(current?.nightStartHour ?? 20));
    setPricingNightEndHour(String(current?.nightEndHour ?? 23));
    setPricingIncludedMeters(String(current?.includedMeters ?? 0));
    setPricingStepMeters(String(current?.stepMeters ?? 0));
    setPricingStepPrice(String(current?.stepPrice ?? 0));
  }, [pricingType, pricingByType]);

  async function saveConfig() {
    if (!token) return;

    const baseFare = parseNumber(pricingBaseFare);
    const nightBaseFareByType = parseNumber(pricingNightBaseFare);
    const nightStartByType = parseIntSafe(pricingNightStartHour);
    const nightEndByType = parseIntSafe(pricingNightEndHour);
    const includedMeters = parseIntSafe(pricingIncludedMeters);
    const stepMeters = parseIntSafe(pricingStepMeters);
    const stepPrice = parseNumber(pricingStepPrice);
    const pct = parseNumber(driverCreditChargePercent);
    const fxUsd = parseNumber(fxCopPerUsd);
    const fxVes = parseNumber(fxCopPerVes);
    const nextMatchingRadiusM = parseIntSafe(matchingRadiusM);

    if (!Number.isFinite(baseFare) || baseFare < 0) return Alert.alert("Validación", "Tarifa base inválida");
    if (!Number.isFinite(nightBaseFareByType) || nightBaseFareByType < 0)
      return Alert.alert("Validación", "Tarifa base nocturna (por tipo) inválida");
    if (!Number.isFinite(nightStartByType) || nightStartByType < 0 || nightStartByType > 23)
      return Alert.alert("Validación", "Hora inicio nocturna (por tipo) inválida (0-23)");
    if (!Number.isFinite(nightEndByType) || nightEndByType < 0 || nightEndByType > 23)
      return Alert.alert("Validación", "Hora fin nocturna (por tipo) inválida (0-23)");
    if (!Number.isFinite(includedMeters) || includedMeters < 0) return Alert.alert("Validación", "Distancia incluida inválida");
    if (!Number.isFinite(stepMeters) || stepMeters < 0) return Alert.alert("Validación", "Metros por tramo inválidos");
    if (!Number.isFinite(stepPrice) || stepPrice < 0) return Alert.alert("Validación", "Precio por tramo inválido");
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return Alert.alert("Validación", "Porcentaje inválido (0-100)");
    if (!Number.isFinite(fxUsd) || fxUsd < 0) return Alert.alert("Validación", "Tasa COP por USD inválida");
    if (!Number.isFinite(fxVes) || fxVes < 0) return Alert.alert("Validación", "Tasa COP por Bs inválida");
    if (!Number.isFinite(nextMatchingRadiusM) || nextMatchingRadiusM <= 0)
      return Alert.alert("Validación", "Radio global inválido");

    if (includedMeters > 0 && stepMeters <= 0) {
      return Alert.alert("Validación", "Si hay distancia incluida, definí también los metros por tramo");
    }

    setSavingConfig(true);
    setError(null);
    try {
      await apiAdminUpsertPricing(token, {
        serviceType: pricingType,
        baseFare,
        nightBaseFare: nightBaseFareByType,
        nightStartHour: nightStartByType,
        nightEndHour: nightEndByType,
        includedMeters,
        stepMeters,
        stepPrice,
        perKm: 0,
        acSurcharge: 0,
        trunkSurcharge: 0,
        petsSurcharge: 0,
      });

      await apiAdminUpdateAppConfig(token, {
        driverCreditChargePercent: pct,
        driverCreditChargeMode: "SERVICE_VALUE",
        fxCopPerUsd: fxUsd,
        fxCopPerVes: fxVes,
        matchingRadiusM: nextMatchingRadiusM,

        zoeWhatsappPhone,

        paymentBancolombiaHolder,
        paymentBancolombiaDocument,
        paymentBancolombiaAccountType,
        paymentBancolombiaAccountNumber,

        paymentZelleHolder,
        paymentZelleEmail,
        paymentZellePhone,
      });
      await load();
      Alert.alert("Listo", "Configuración guardada");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSavingConfig(false);
    }
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
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Ionicons name="settings-outline" size={20} color={colors.gold} />
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

        <Card style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="pricetag-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Tarifas</Text>
          </View>

          <View style={styles.typeRow}>
            {(["CARRO", "MOTO", "MOTO_CARGA", "CARRO_CARGA"] as const).map((t) => {
              const active = pricingType === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setPricingType(t)}
                  style={({ pressed }) => [
                    styles.typeBtn,
                    active ? styles.typeBtnActive : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Ionicons name={serviceTypeIconName(t as any)} size={16} color={active ? colors.gold : colors.mutedText} />
                  <Text style={[styles.typeBtnText, { color: active ? colors.gold : colors.mutedText }]}>{serviceTypeLabel(t as any)}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextField
            label="Tarifa base"
            value={pricingBaseFare}
            onChangeText={setPricingBaseFare}
            keyboardType="number-pad"
            placeholder="Ej: 5000"
          />

          <TextField
            label="Tarifa base nocturna (este tipo)"
            value={pricingNightBaseFare}
            onChangeText={setPricingNightBaseFare}
            keyboardType="number-pad"
            placeholder="0 para desactivar"
          />

          <TextField
            label="Hora inicio nocturna (este tipo) (0-23)"
            value={pricingNightStartHour}
            onChangeText={setPricingNightStartHour}
            keyboardType="number-pad"
            placeholder="Ej: 20"
          />

          <TextField
            label="Hora fin nocturna (este tipo) (0-23)"
            value={pricingNightEndHour}
            onChangeText={setPricingNightEndHour}
            keyboardType="number-pad"
            placeholder="Ej: 6"
          />

          <TextField
            label="Distancia incluida (m)"
            value={pricingIncludedMeters}
            onChangeText={setPricingIncludedMeters}
            keyboardType="number-pad"
            placeholder="Ej: 3000"
          />

          <TextField
            label="Metros por tramo (m)"
            value={pricingStepMeters}
            onChangeText={setPricingStepMeters}
            keyboardType="number-pad"
            placeholder="Ej: 350"
          />

          <TextField
            label="Precio por tramo (COP)"
            value={pricingStepPrice}
            onChangeText={setPricingStepPrice}
            keyboardType="number-pad"
            placeholder="Ej: 500"
          />

          <Text style={styles.muted}>
            Se cobra: base + tramos después de la distancia incluida.
          </Text>
        </Card>

        <Card style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="cash-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Monedas</Text>
          </View>

          <TextField
            label="Tasa COP por 1 USD"
            value={fxCopPerUsd}
            onChangeText={setFxCopPerUsd}
            keyboardType="number-pad"
            placeholder="Ej: 4000"
          />

          <TextField
            label="Tasa COP por 1 Bs."
            value={fxCopPerVes}
            onChangeText={setFxCopPerVes}
            keyboardType="number-pad"
            placeholder="Ej: 120"
          />

          <Text style={styles.muted}>0 = ocultar montos secundarios en USD/Bs.</Text>
        </Card>

        <Card style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="radio-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Radio global</Text>
          </View>

          <TextField
            label="Radio de emparejamiento (m)"
            value={matchingRadiusM}
            onChangeText={setMatchingRadiusM}
            keyboardType="number-pad"
            placeholder="Ej: 2000"
          />

          <Text style={styles.muted}>
            Define a qué distancia se detectan clientes, ejecutivos y contraofertas. Valor inicial recomendado: 2000 m.
          </Text>
        </Card>

        <Card style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="wallet-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Comisión al chofer</Text>
          </View>

          <TextField
            label="Porcentaje global (%)"
            value={driverCreditChargePercent}
            onChangeText={setDriverCreditChargePercent}
            keyboardType="number-pad"
            placeholder="Ej: 10"
          />

          <Text style={styles.muted}>0 = no descontar. Se aplica al completar el servicio.</Text>
        </Card>

        <Card style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="logo-whatsapp" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Operador (ZOE)</Text>
          </View>

          <TextField
            label="WhatsApp ZOE"
            value={zoeWhatsappPhone}
            onChangeText={setZoeWhatsappPhone}
            placeholder="Ej: +573001112233"
          />
          <Text style={styles.helper}>Tip: incluí código de país si aplica.</Text>
        </Card>

        <Card style={styles.card}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="card-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Métodos de pago</Text>
          </View>

          <Text style={styles.helper}>Estos datos los verá el cliente cuando tenga un servicio activo.</Text>

          <Text style={styles.subTitle}>Bancolombia</Text>
          <TextField label="Titular" value={paymentBancolombiaHolder} onChangeText={setPaymentBancolombiaHolder} placeholder="Nombre" />
          <TextField label="Documento" value={paymentBancolombiaDocument} onChangeText={setPaymentBancolombiaDocument} placeholder="Cédula/NIT" />
          <TextField
            label="Tipo de cuenta"
            value={paymentBancolombiaAccountType}
            onChangeText={setPaymentBancolombiaAccountType}
            placeholder="Ahorros / Corriente"
          />
          <TextField
            label="Número de cuenta"
            value={paymentBancolombiaAccountNumber}
            onChangeText={setPaymentBancolombiaAccountNumber}
            placeholder="1234567890"
          />

          <View style={{ height: 8 }} />

          <Text style={styles.subTitle}>Zelle</Text>
          <TextField label="Titular" value={paymentZelleHolder} onChangeText={setPaymentZelleHolder} placeholder="Nombre" />
          <TextField label="Email" value={paymentZelleEmail} onChangeText={setPaymentZelleEmail} placeholder="correo@ejemplo.com" />
          <TextField label="Teléfono (opcional)" value={paymentZellePhone} onChangeText={setPaymentZellePhone} placeholder="+1..." />
        </Card>

        <PrimaryButton
          label={savingConfig ? "Guardando..." : "Guardar configuración"}
          iconName="save-outline"
          onPress={() => void saveConfig()}
          disabled={savingConfig || loading}
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
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  typeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  typeBtnActive: {
    borderColor: colors.gold,
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: "900",
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
    fontWeight: "700",
  },
  card: {
    gap: 10,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },

  helper: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
  },
  subTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 2,
  },
});
