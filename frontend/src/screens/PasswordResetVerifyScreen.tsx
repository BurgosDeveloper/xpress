import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { Screen } from "../components/Screen";
import { TextField } from "../components/TextField";
import { PrimaryButton } from "../components/PrimaryButton";
import { colors } from "../theme/colors";
import { apiPasswordResetVerify } from "../auth/auth.api";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "PasswordResetVerify">;

const Schema = z.object({
  code: z.string().regex(/^\d{6}$/, "Código de 6 dígitos"),
});

export function PasswordResetVerifyScreen({ route, navigation }: Props) {
  const { resetRequestId, phoneLast3 } = route.params;
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = useMemo(() => {
    const parsed = Schema.safeParse({ code });
    if (parsed.success) return {} as Record<string, string>;
    const out: Record<string, string> = {};
    for (const i of parsed.error.issues) out[i.path[0] as string] = i.message;
    return out;
  }, [code]);

  async function onSubmit() {
    setError(null);
    const parsed = Schema.safeParse({ code });
    if (!parsed.success) {
      setError("Revisá el código");
      return;
    }

    setLoading(true);
    try {
      const res = await apiPasswordResetVerify({ resetRequestId, code: parsed.data.code });
      navigation.replace("PasswordResetConfirm", { resetToken: res.resetToken });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo verificar";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen keyboardAvoiding>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Ingresar código</Text>
          <Text style={styles.subtitle}>Código enviado al WhatsApp asociado terminado en ***{phoneLast3}.</Text>

          <TextField
            label="Código"
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            keyboardType="number-pad"
            error={errors.code}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}
          <PrimaryButton label={loading ? "Verificando..." : "Verificar"} onPress={onSubmit} disabled={loading} />
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
