import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { Screen } from "../components/Screen";
import { TextField } from "../components/TextField";
import { PrimaryButton } from "../components/PrimaryButton";
import { colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";

const RegisterSchema = z
  .object({
    fullName: z.string().min(2, "Ingresá tu nombre"),
    phone: z.string().min(6, "Ingresá tu teléfono"),
    email: z.string().email("Email inválido"),
    password: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string().min(8, "Mínimo 8 caracteres"),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export function RegisterPassengerScreen() {
  const auth = useAuth();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = useMemo(() => {
    const parsed = RegisterSchema.safeParse({ fullName, phone, email, password, confirmPassword });
    if (parsed.success) return {} as Record<string, string>;
    const out: Record<string, string> = {};
    for (const i of parsed.error.issues) out[i.path[0] as string] = i.message;
    return out;
  }, [fullName, phone, email, password, confirmPassword]);

  async function onSubmit() {
    setError(null);
    const parsed = RegisterSchema.safeParse({ fullName, phone, email, password, confirmPassword });
    if (!parsed.success) {
      setError("Revisá los campos");
      return;
    }

    setLoading(true);
    try {
      await auth.registerPassenger({
        email: parsed.data.email,
        password: parsed.data.password,
        fullName: parsed.data.fullName,
        phone: parsed.data.phone,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo crear la cuenta";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen keyboardAvoiding>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Registro (Cliente)</Text>
          <Text style={styles.subtitle}>Completá tus datos para empezar.</Text>

          <TextField label="Nombre y apellido" value={fullName} onChangeText={setFullName} placeholder="Tu nombre" error={errors.fullName} />
          <TextField label="Teléfono" value={phone} onChangeText={setPhone} placeholder="WhatsApp" keyboardType="phone-pad" error={errors.phone} />
          <TextField label="Email" value={email} onChangeText={setEmail} placeholder="tu@email.com" keyboardType="email-address" error={errors.email} />
          <TextField label="Contraseña" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry error={errors.password} />
          <TextField
            label="Repetir contraseña"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            secureTextEntry
            error={errors.confirmPassword}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}
          <PrimaryButton label={loading ? "Creando..." : "Crear cuenta"} onPress={onSubmit} disabled={loading} />
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
