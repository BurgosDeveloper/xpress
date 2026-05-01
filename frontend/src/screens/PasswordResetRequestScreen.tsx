import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { Screen } from "../components/Screen";
import { TextField } from "../components/TextField";
import { PrimaryButton } from "../components/PrimaryButton";
import { colors } from "../theme/colors";
import { apiPasswordResetRequest } from "../auth/auth.api";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "PasswordResetRequest">;

const Schema = z.object({
  user: z.string().min(1, "Ingresá tu email o username"),
});

export function PasswordResetRequestScreen({ route, navigation }: Props) {
  const [user, setUser] = useState(route.params?.presetUser ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = useMemo(() => {
    const parsed = Schema.safeParse({ user });
    if (parsed.success) return {} as Record<string, string>;
    const out: Record<string, string> = {};
    for (const i of parsed.error.issues) out[i.path[0] as string] = i.message;
    return out;
  }, [user]);

  async function onSubmit() {
    setError(null);
    const parsed = Schema.safeParse({ user });
    if (!parsed.success) {
      setError("Revisá el campo");
      return;
    }
    setLoading(true);
    try {
      const res = await apiPasswordResetRequest({ user: parsed.data.user });
      navigation.replace("PasswordResetVerify", { resetRequestId: res.resetRequestId, phoneLast3: res.phoneLast3 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo solicitar el código";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen keyboardAvoiding>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Recuperar contraseña</Text>
          <Text style={styles.subtitle}>
            Ingresá tu usuario. Un admin verá el código y te lo enviará por WhatsApp.
          </Text>

          <TextField label="Usuario" value={user} onChangeText={setUser} placeholder="email o username" error={errors.user} />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <PrimaryButton label={loading ? "Solicitando..." : "Solicitar código"} onPress={onSubmit} disabled={loading} />
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
});
