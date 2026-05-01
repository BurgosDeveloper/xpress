import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";

import type { RootStackParamList } from "../navigation/AppNavigator";
import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { GoldTitle } from "../components/GoldTitle";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { TextField } from "../components/TextField";
import { colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import {
  apiAdminAdjustDriverCredits,
  apiAdminCreateDriver,
  apiAdminSetDriverActive,
  apiAdminUpdateDriver,
  type ServiceType,
} from "../admin/admin.api";
import { apiUploadSingle } from "../uploads/uploads.api";
import { absoluteUrl } from "../utils/url";
import { serviceTypeLabel } from "../utils/serviceType";

type Props = NativeStackScreenProps<RootStackParamList, "AdminDriverUpsert">;

type Driver = any;

function formatCop(n: number) {
  try {
    return new Intl.NumberFormat("es-CO").format(n);
  } catch {
    return String(n);
  }
}

function parseIntOrNull(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export function AdminDriverUpsertScreen({ route, navigation }: Props) {
  const auth = useAuth();
  const token = auth.token;

  const driver: Driver | null = (route.params as any)?.driver ?? null;
  const isEdit = !!driver?.id;

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType>("CARRO");

  const [mobilePayBank, setMobilePayBank] = useState("");
  const [mobilePayDocument, setMobilePayDocument] = useState("");
  const [mobilePayPhone, setMobilePayPhone] = useState("");

  const [photoUrl, setPhotoUrl] = useState("");

  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [year, setYear] = useState("");
  const [color, setColor] = useState("");
  const [doors, setDoors] = useState("");
  const [hasAC, setHasAC] = useState(false);
  const [hasTrunk, setHasTrunk] = useState(false);
  const [allowsPets, setAllowsPets] = useState(false);
  const [vehiclePhotoUrls, setVehiclePhotoUrls] = useState<string[]>([]);

  const [isActive, setIsActive] = useState(true);
  const [balanceCop, setBalanceCop] = useState<number>(0);
  const [deltaCop, setDeltaCop] = useState("");

  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const title = useMemo(() => (isEdit ? "Editar chofer" : "Agregar chofer"), [isEdit]);

  useEffect(() => {
    navigation.setOptions({ title: "" });
  }, [navigation]);

  useEffect(() => {
    if (!driver) return;

    setEmail(driver.user?.email ?? "");
    setFullName(driver.fullName ?? "");
    setPhone(driver.phone ?? "");
    setMobilePayBank(driver.mobilePayBank ?? "");
    setMobilePayDocument(driver.mobilePayDocument ?? "");
    setMobilePayPhone(driver.mobilePayPhone ?? "");
    setServiceType((driver.serviceType as ServiceType) ?? "CARRO");
    setPhotoUrl(driver.photoUrl ?? "");

    setBrand(driver.vehicle?.brand ?? "");
    setModel(driver.vehicle?.model ?? "");
    setPlate(driver.vehicle?.plate ?? "");
    setYear(driver.vehicle?.year != null ? String(driver.vehicle.year) : "");
    setColor(driver.vehicle?.color ?? "");
    setDoors(driver.vehicle?.doors != null ? String(driver.vehicle.doors) : "");
    setHasAC(!!driver.vehicle?.hasAC);
    setHasTrunk(!!driver.vehicle?.hasTrunk);
    setAllowsPets(!!driver.vehicle?.allowsPets);

    const docs: any[] = Array.isArray(driver.documents) ? driver.documents : [];
    const photos = docs.filter((d) => d.type === "VEHICLE_PHOTO" && d.url).map((d) => String(d.url));
    setVehiclePhotoUrls(photos);

    setIsActive(driver.user?.isActive ?? true);
    setBalanceCop(Number(driver.user?.creditAccount?.balanceCop ?? 0));
  }, [driver]);

  if (auth.user?.role !== "ADMIN") {
    return (
      <Screen>
        <Card style={{ marginTop: 16 }}>
          <Text style={{ color: colors.text, fontWeight: "900" }}>Solo disponible para admin</Text>
        </Card>
      </Screen>
    );
  }

  async function uploadFile(input: { uri: string; name: string; mimeType: string; category: string }) {
    if (!token) throw new Error("Sin token");

    setUploadingKey(input.category);
    try {
      const res = await apiUploadSingle(token, input);
      return res.file.path;
    } finally {
      setUploadingKey(null);
    }
  }

  async function pickAndUploadImage(category: string, opts?: { allowsEditing?: boolean }) {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: opts?.allowsEditing ?? false,
    });

    if (res.canceled) return null;
    const asset = res.assets?.[0];
    if (!asset?.uri) return null;

    const name = asset.fileName ?? `image-${Date.now()}.jpg`;
    const mimeType = asset.mimeType ?? "image/jpeg";

    return await uploadFile({ uri: asset.uri, name, mimeType, category });
  }

  async function onUploadPhoto() {
    try {
      const path = await pickAndUploadImage("driver_photo", { allowsEditing: true });
      if (path) setPhotoUrl(path);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "No se pudo subir la foto");
    }
  }

  async function onAddVehiclePhoto() {
    try {
      const path = await pickAndUploadImage("vehicle_photo");
      if (path) setVehiclePhotoUrls((prev) => [...prev, path]);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "No se pudo subir la foto del vehículo");
    }
  }

  function removeVehiclePhoto(url: string) {
    Alert.alert("Quitar foto", "¿Eliminar esta foto del vehículo?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () => setVehiclePhotoUrls((prev) => prev.filter((x) => x !== url)),
      },
    ]);
  }

  async function toggleActive() {
    if (!token) return;
    if (!driver?.id) return;

    const next = !isActive;

    Alert.alert(next ? "Activar" : "Desactivar", `¿Seguro que querés ${next ? "activar" : "desactivar"} este usuario?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: next ? "Activar" : "Desactivar",
        style: next ? "default" : "destructive",
        onPress: async () => {
          try {
            setSaving(true);
            setError(null);
            await apiAdminSetDriverActive(token, { driverId: driver.id, isActive: next });
            setIsActive(next);
          } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo actualizar el usuario");
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  }

  async function applyCreditsDelta() {
    if (!token) return;
    if (!driver?.id) return;

    const delta = parseIntOrNull(deltaCop);
    if (delta == null || delta === 0) {
      Alert.alert("Dato inválido", "Ingresá un delta en COP (ej: 5000 o -5000)");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const res = await apiAdminAdjustDriverCredits(token, { driverId: driver.id, deltaCop: delta });
      setBalanceCop(res.balanceCop);
      setDeltaCop("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo ajustar créditos");
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!token) return;

    setError(null);

    const y = parseIntOrNull(year);
    const d = parseIntOrNull(doors);

    if (!email.trim()) {
      Alert.alert("Faltan datos", "Email es obligatorio");
      return;
    }
    if (!fullName.trim()) {
      Alert.alert("Faltan datos", "Nombre completo es obligatorio");
      return;
    }
    if (!phone.trim()) {
      Alert.alert("Faltan datos", "Teléfono es obligatorio");
      return;
    }

    if (!mobilePayBank.trim() || !mobilePayDocument.trim() || !mobilePayPhone.trim()) {
      Alert.alert("Faltan datos", "Completá Pago móvil (banco, documento y teléfono)");
      return;
    }

    if (!photoUrl.trim()) {
      Alert.alert("Faltan datos", "Subí la foto del chofer");
      return;
    }

    if (!brand.trim() || !model.trim() || !color.trim() || y == null) {
      Alert.alert("Faltan datos", "Completá los datos del vehículo (marca, modelo, color, año) ");
      return;
    }

    if (vehiclePhotoUrls.length === 0) {
      Alert.alert("Faltan datos", "Subí al menos 1 foto del vehículo");
      return;
    }

    try {
      setSaving(true);

      if (!isEdit) {
        const res = await apiAdminCreateDriver(token, {
          email: email.trim(),
          password: password.trim() ? password.trim() : undefined,
          fullName: fullName.trim(),
          phone: phone.trim(),
          mobilePayBank: mobilePayBank.trim(),
          mobilePayDocument: mobilePayDocument.trim(),
          mobilePayPhone: mobilePayPhone.trim(),
          photoUrl: photoUrl.trim(),
          serviceType,
          vehicle: {
            brand: brand.trim(),
            model: model.trim(),
            year: y,
            color: color.trim(),
            doors: d ?? undefined,
            hasAC,
            hasTrunk,
            allowsPets,
          },
          documents: {
            vehiclePhotoUrls,
          },
        });

        Alert.alert(
          "Chofer creado",
          `Credenciales:\nUsuario: ${res.credentials.user}\nContraseña: ${res.credentials.password}`
        );

        navigation.goBack();
        return;
      }

      await apiAdminUpdateDriver(token, {
        driverId: driver.id,
        email: email.trim() || undefined,
        fullName: fullName.trim() || undefined,
        phone: phone.trim() || undefined,
        mobilePayBank: mobilePayBank.trim() ? mobilePayBank.trim() : null,
        mobilePayDocument: mobilePayDocument.trim() ? mobilePayDocument.trim() : null,
        mobilePayPhone: mobilePayPhone.trim() ? mobilePayPhone.trim() : null,
        photoUrl: photoUrl.trim() || undefined,
        serviceType,
        vehicle: {
          brand: brand.trim() || undefined,
          model: model.trim() || undefined,
          plate: plate.trim() ? plate.trim() : null,
          year: y ?? undefined,
          color: color.trim() || undefined,
          doors: d,
          hasAC,
          hasTrunk,
          allowsPets,
        },
        documents: {
          vehiclePhotoUrls: vehiclePhotoUrls.length ? vehiclePhotoUrls : undefined,
        },
      });

      Alert.alert("Listo", "Cambios guardados");
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  const isUploading = !!uploadingKey;
  const photoAbs = absoluteUrl(photoUrl);

  return (
    <Screen keyboardAvoiding>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Ionicons name={isEdit ? "create-outline" : "person-add-outline"} size={20} color={colors.gold} />
            <GoldTitle>{title}</GoldTitle>
          </View>

          <Pressable style={styles.closeBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={18} color={colors.text} />
          </Pressable>
        </View>

        {!!error ? (
          <Card style={{ marginTop: 10, borderWidth: 1, borderColor: colors.danger }}>
            <Text style={{ color: colors.danger, fontWeight: "900" }}>{error}</Text>
          </Card>
        ) : null}

        {isEdit ? (
          <Card style={{ marginTop: 12, gap: 10 }}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.gold} />
              <Text style={styles.sectionTitle}>Cuenta</Text>
            </View>

            <Text style={styles.readLine}>Activo: {isActive ? "Sí" : "No"}</Text>
            <Text style={styles.readLine}>Créditos (COP): {formatCop(balanceCop)}</Text>

            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              <Pressable onPress={() => void toggleActive()} style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]} disabled={saving}>
                <Ionicons name={isActive ? "pause-circle-outline" : "play-circle-outline"} size={18} color={isActive ? colors.danger : colors.gold} />
                <Text style={[styles.actionText, isActive ? { color: colors.danger } : null]}>{isActive ? "Desactivar" : "Activar"}</Text>
              </Pressable>
            </View>

            <View style={{ marginTop: 8, gap: 10 }}>
              <TextField
                label="Ajuste de créditos (delta COP)"
                labelIconName="wallet-outline"
                value={deltaCop}
                onChangeText={setDeltaCop}
                keyboardType="number-pad"
                placeholder="Ej: 5000 o -5000"
              />
              <SecondaryButton label={saving ? "Aplicando..." : "Aplicar ajuste"} onPress={() => void applyCreditsDelta()} disabled={saving} />
            </View>
          </Card>
        ) : null}

        <Card style={{ marginTop: 12, gap: 12 }}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="person-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Datos</Text>
          </View>

          <TextField label="Email" labelIconName="mail-outline" value={email} onChangeText={setEmail} keyboardType="email-address" />

          {!isEdit ? (
            <TextField
              label="Contraseña (opcional)"
              labelIconName="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              placeholder="Si lo dejás vacío, se genera"
              secureTextEntry
            />
          ) : null}

          <TextField
            label="Nombre completo"
            labelIconName="text-outline"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />
          <TextField label="Teléfono" labelIconName="call-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

          <View style={{ gap: 8 }}>
            <Text style={styles.label}>Tipo de servicio</Text>
            <View style={styles.pillsRow}>
              {(["CARRO", "MOTO", "MOTO_CARGA", "CARRO_CARGA"] as ServiceType[]).map((t) => {
                const active = t === serviceType;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setServiceType(t)}
                    style={({ pressed }) => [styles.pill, active ? styles.pillActive : null, pressed && styles.pressed]}
                  >
                    <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{serviceTypeLabel(t)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <Text style={styles.label}>Foto chofer</Text>
            <View style={styles.photoRow}>
              <View style={styles.avatar}>
                {photoAbs ? (
                  <Image source={{ uri: photoAbs }} style={styles.avatarImg} resizeMode="cover" />
                ) : (
                  <View style={styles.avatarEmpty}>
                    <Ionicons name="image-outline" size={18} color={colors.mutedText} />
                  </View>
                )}
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <SecondaryButton
                  label={uploadingKey === "driver_photo" ? "Subiendo..." : "Subir foto"}
                  onPress={() => void onUploadPhoto()}
                  disabled={isUploading}
                />
                {photoUrl ? <Text style={styles.muted}>{photoUrl}</Text> : <Text style={styles.muted}>Sin foto cargada</Text>}
              </View>
            </View>
          </View>
        </Card>

        <Card style={{ marginTop: 12, gap: 12 }}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="wallet-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Pago móvil</Text>
          </View>

          <TextField
            label="Banco"
            labelIconName="business-outline"
            value={mobilePayBank}
            onChangeText={setMobilePayBank}
            autoCapitalize="words"
            placeholder="Ej: Banesco"
          />
          <TextField
            label="Documento"
            labelIconName="document-text-outline"
            value={mobilePayDocument}
            onChangeText={setMobilePayDocument}
            autoCapitalize="characters"
            placeholder="Ej: V-12345678"
          />
          <TextField
            label="Teléfono"
            labelIconName="call-outline"
            value={mobilePayPhone}
            onChangeText={setMobilePayPhone}
            keyboardType="phone-pad"
            placeholder="Ej: 0412XXXXXXX"
          />
        </Card>

        <Card style={{ marginTop: 12, gap: 12 }}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="car-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Vehículo</Text>
          </View>

          <TextField label="Marca" labelIconName="pricetag-outline" value={brand} onChangeText={setBrand} autoCapitalize="words" />
          <TextField label="Modelo" labelIconName="pricetag-outline" value={model} onChangeText={setModel} autoCapitalize="words" />
          <TextField label="Placa" labelIconName="card-outline" value={plate} onChangeText={setPlate} autoCapitalize="characters" />
          <TextField label="Año" labelIconName="calendar-outline" value={year} onChangeText={setYear} keyboardType="number-pad" />
          <TextField label="Color" labelIconName="color-palette-outline" value={color} onChangeText={setColor} autoCapitalize="words" />
          <TextField label="Puertas (opcional)" labelIconName="grid-outline" value={doors} onChangeText={setDoors} keyboardType="number-pad" />

          <View style={{ gap: 8 }}>
            <Text style={styles.label}>Extras</Text>
            <View style={styles.pillsRow}>
              <Pressable onPress={() => setHasAC((v) => !v)} style={({ pressed }) => [styles.pill, hasAC ? styles.pillActive : null, pressed && styles.pressed]}>
                <Text style={[styles.pillText, hasAC ? styles.pillTextActive : null]}>A/C</Text>
              </Pressable>
              <Pressable
                onPress={() => setHasTrunk((v) => !v)}
                style={({ pressed }) => [styles.pill, hasTrunk ? styles.pillActive : null, pressed && styles.pressed]}
              >
                <Text style={[styles.pillText, hasTrunk ? styles.pillTextActive : null]}>Baúl</Text>
              </Pressable>
              <Pressable
                onPress={() => setAllowsPets((v) => !v)}
                style={({ pressed }) => [styles.pill, allowsPets ? styles.pillActive : null, pressed && styles.pressed]}
              >
                <Text style={[styles.pillText, allowsPets ? styles.pillTextActive : null]}>Mascotas</Text>
              </Pressable>
            </View>
          </View>
        </Card>

        <Card style={{ marginTop: 12, gap: 12 }}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="images-outline" size={18} color={colors.gold} />
            <Text style={styles.sectionTitle}>Fotos</Text>
          </View>

          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={styles.label}>Fotos vehículo</Text>
              <Pressable
                onPress={() => void onAddVehiclePhoto()}
                style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
                disabled={isUploading}
              >
                <Ionicons name="add" size={18} color={colors.gold} />
              </Pressable>
            </View>

            {vehiclePhotoUrls.length ? (
              <View style={styles.photosGrid}>
                {vehiclePhotoUrls.map((u) => (
                  (() => {
                    const uri = absoluteUrl(u);
                    if (!uri) return null;
                    return (
                      <Pressable key={u} onPress={() => removeVehiclePhoto(u)} style={styles.photoThumb}>
                        <Image source={{ uri }} style={styles.photoThumbImg} resizeMode="cover" />
                        <View style={styles.photoThumbX}>
                          <Ionicons name="close" size={14} color={colors.text} />
                        </View>
                      </Pressable>
                    );
                  })()
                ))}
              </View>
            ) : (
              <Text style={styles.muted}>Sin fotos de vehículo</Text>
            )}
          </View>
        </Card>

        <View style={{ marginTop: 14, gap: 10 }}>
          {saving ? (
            <View style={styles.centerRow}>
              <ActivityIndicator color={colors.gold} />
              <Text style={styles.muted}>Procesando...</Text>
            </View>
          ) : null}

          <PrimaryButton label={saving ? "Guardando..." : "Guardar"} onPress={() => void save()} disabled={saving || isUploading} />
        </View>
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
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  readLine: {
    color: colors.mutedText,
    fontSize: 13,
  },
  muted: {
    color: colors.mutedText,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.85,
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
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  pill: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
  },
  pillActive: {
    borderColor: colors.gold,
  },
  pillText: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 12,
  },
  pillTextActive: {
    color: colors.gold,
  },
  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
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
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  photosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  photoThumb: {
    width: 76,
    height: 76,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  photoThumbImg: {
    width: "100%",
    height: "100%",
  },
  photoThumbX: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  centerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
