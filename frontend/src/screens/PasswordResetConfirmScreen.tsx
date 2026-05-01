import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { Screen } from "../components/Screen";
import { TextField } from "../components/TextField";
import { PrimaryButton } from "../components/PrimaryButton";
import { colors } from "../theme/colors";
import { apiPasswordResetConfirm } from "../auth/auth.api";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "PasswordResetConfirm">;

const Schema = z
  .object({
    newPassword: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string().min(8, "Mínimo 8 caracteres"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export function PasswordResetConfirmScreen({ route, navigation }: Props) {
  const { resetToken } = route.params;
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const errors = useMemo(() => {
    const parsed = Schema.safeParse({ newPassword, confirmPassword });
    if (parsed.success) return {} as Record<string, string>;
    const out: Record<string, string> = {};
    for (const i of parsed.error.issues) out[i.path[0] as string] = i.message;
    return out;
  }, [newPassword, confirmPassword]);

  async function onSubmit() {
    setError(null);
    const parsed = Schema.safeParse({ newPassword, confirmPassword });
    if (!parsed.success) {
      setError("Revisá los campos");
      return;
    }
    setLoading(true);
    try {
      await apiPasswordResetConfirm({ resetToken, newPassword: parsed.data.newPassword });
      setOk(true);
      setTimeout(() => {
        navigation.popToTop();
      }, 700);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo cambiar";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen keyboardAvoiding>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Nueva contraseña</Text>
          <Text style={styles.subtitle}>Elegí una contraseña nueva.</Text>

          <TextField
            label="Nueva contraseña"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="••••••••"
            secureTextEntry
            error={errors.newPassword}
          />
          <TextField
            label="Repetir contraseña"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            secureTextEntry
            error={errors.confirmPassword}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}
          {ok ? <Text style={styles.ok}>Listo. Ya podés iniciar sesión.</Text> : null}
          <PrimaryButton label={loading ? "Guardando..." : "Cambiar contraseña"} onPress={onSubmit} disabled={loading || ok} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: 24,
    paddingBottom: 48,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: 13,
    marginBottom: 6,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  ok: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: "800",
  },
});
