import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { RootStackParamList } from "../navigation/AppNavigator";
import { Screen } from "../components/Screen";
import { Card } from "../components/Card";
import { GoldTitle } from "../components/GoldTitle";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { TextField } from "../components/TextField";
import { colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import { apiAdminDeletePassenger, apiAdminSetPassengerActive, apiAdminUpdatePassenger } from "../admin/admin.api";

type Props = NativeStackScreenProps<RootStackParamList, "AdminPassengerUpsert">;

type Passenger = any;

export function AdminPassengerUpsertScreen({ route, navigation }: Props) {
  const auth = useAuth();
  const token = auth.token;

  const passenger: Passenger | null = (route.params as any)?.passenger ?? null;
  const isEdit = !!passenger?.id;

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  const [isActive, setIsActive] = useState(true);

  const title = useMemo(() => (isEdit ? "Editar cliente" : "Cliente"), [isEdit]);

  useEffect(() => {
    navigation.setOptions({ title: "" });
  }, [navigation]);

  useEffect(() => {
    if (!passenger) return;

    setEmail(passenger.user?.email ?? "");
    setFullName(passenger.fullName ?? "");
    setFirstName(passenger.firstName ?? "");
    setLastName(passenger.lastName ?? "");
    setPhone(passenger.phone ?? "");
    setPhotoUrl(passenger.photoUrl ?? "");
    setIsActive(passenger.user?.isActive ?? true);
  }, [passenger]);

  if (auth.user?.role !== "ADMIN") {
    return (
      <Screen>
        <Card style={{ marginTop: 16 }}>
          <Text style={{ color: colors.text, fontWeight: "900" }}>Solo disponible para admin</Text>
        </Card>
      </Screen>
    );
  }

  async function toggleActive() {
    if (!token) return;
    if (!passenger?.id) return;

    const next = !isActive;

    Alert.alert(next ? "Activar" : "Desactivar", `¿Seguro que querés ${next ? "activar" : "desactivar"} este cliente?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: next ? "Activar" : "Desactivar",
        style: next ? "default" : "destructive",
        onPress: async () => {
          try {
            setSaving(true);
            setError(null);
            await apiAdminSetPassengerActive(token, { passengerId: passenger.id, isActive: next });
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

  async function onDelete() {
    if (!token) return;
    if (!passenger?.id) return;

    Alert.alert("Eliminar", "Esto elimina al cliente y toda su data relacionada. ¿Continuar?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            setSaving(true);
            setError(null);
            await apiAdminDeletePassenger(token, { passengerId: passenger.id });
            navigation.goBack();
          } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo eliminar");
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  }

  async function save() {
    if (!token) return;
    if (!passenger?.id) return;

    setError(null);

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

    try {
      setSaving(true);
      await apiAdminUpdatePassenger(token, {
        passengerId: passenger.id,
        email: email.trim(),
        fullName: fullName.trim(),
        firstName: firstName.trim() ? firstName.trim() : null,
        lastName: lastName.trim() ? lastName.trim() : null,
        phone: phone.trim(),
        photoUrl: photoUrl.trim() ? photoUrl.trim() : null,
      });

      Alert.alert("Listo", "Cliente actualizado");
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Ionicons name="person-outline" size={18} color={colors.gold} />
            <GoldTitle>{title}</GoldTitle>
          </View>

          {isEdit ? (
            <Pressable onPress={() => void toggleActive()} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
              <Ionicons name={isActive ? "pause" : "play"} size={18} color={isActive ? colors.danger : colors.gold} />
            </Pressable>
          ) : null}
        </View>

        {!!error ? <Text style={styles.error}>{error}</Text> : null}

        <Card style={styles.card}>
          <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <TextField label="Nombre completo" value={fullName} onChangeText={setFullName} />
          <TextField label="Nombre" value={firstName} onChangeText={setFirstName} />
          <TextField label="Apellido" value={lastName} onChangeText={setLastName} />
          <TextField label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <TextField label="Foto (URL)" value={photoUrl} onChangeText={setPhotoUrl} autoCapitalize="none" placeholder="(opcional)" />

          <Text style={styles.muted}>Activo: {isActive ? "Sí" : "No"}</Text>
        </Card>

        <PrimaryButton label={saving ? "Guardando..." : "Guardar"} iconName="save-outline" onPress={() => void save()} disabled={saving} />

        {isEdit ? (
          <SecondaryButton label={saving ? "..." : "Eliminar"} onPress={() => void onDelete()} disabled={saving} />
        ) : null}
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
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
  },
  card: {
    gap: 10,
  },
  muted: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: "800",
  },
});
