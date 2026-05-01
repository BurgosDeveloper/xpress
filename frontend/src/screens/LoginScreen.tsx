import React, { useMemo, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { z } from "zod";
import { Screen } from "../components/Screen";
import { TextField } from "../components/TextField";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { colors } from "../theme/colors";
import { useAuth } from "../auth/AuthContext";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { LogoMark } from "../components/LogoMark";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

const LoginFormSchema = z.object({
  user: z.string().min(1, "Ingresá tu email o username"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

export function LoginScreen({ navigation }: Props) {
  const auth = useAuth();

  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = useMemo(() => {
    const parsed = LoginFormSchema.safeParse({ user, password });
    if (parsed.success) return {} as Record<string, string>;
    const out: Record<string, string> = {};
    for (const i of parsed.error.issues) out[i.path[0] as string] = i.message;
    return out;
  }, [user, password]);

  async function onSubmit() {
    setError(null);
    const parsed = LoginFormSchema.safeParse({ user, password });
    if (!parsed.success) {
      setError("Revisá los campos");
      return;
    }

    setLoading(true);
    try {
      await auth.login({ user: parsed.data.user, password: parsed.data.password });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo iniciar sesión";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function goReset() {
    navigation.navigate("PasswordResetRequest", { presetUser: user.trim() || undefined });
  }

  return (
    <Screen keyboardAvoiding>
      <Modal visible={loading} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBackdrop} />
          <View style={styles.loadingCard}>
            <LogoMark size={190} />
            <ActivityIndicator color={colors.gold} />
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <View style={styles.brandRow}>
            <LogoMark size={96} />
            <Text style={styles.subtitle}>Accedé a tu cuenta</Text>
          </View>

          <View style={styles.mainHeader}>
            <Ionicons name="log-in-outline" size={22} color={colors.gold} />
            <Text style={styles.mainHeaderText}>Inicio de sesión</Text>
          </View>

          <View style={styles.form}>
          <TextField
            label="Usuario"
            labelIconName="person-outline"
            value={user}
            onChangeText={setUser}
            placeholder="email o username"
            keyboardType="email-address"
            error={errors.user}
          />
          <TextField
            label="Contraseña"
            labelIconName="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry={!passwordVisible}
            rightIconName={passwordVisible ? "eye-off-outline" : "eye-outline"}
            onPressRightIcon={() => setPasswordVisible((v) => !v)}
            rightIconAccessibilityLabel={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
            error={errors.password}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <PrimaryButton label={loading ? "Ingresando..." : "Ingresar"} onPress={onSubmit} disabled={loading} />
          <SecondaryButton label="Recuperar contraseña" onPress={goReset} disabled={loading} />

          <Pressable onPress={() => navigation.navigate("RegisterPassenger")}>
            <Text style={styles.link}>Crear cuenta (solo cliente)</Text>
          </Pressable>
          <Text style={styles.hint}>Ejecutivos y admin los crea el administrador.</Text>
          </View>

          <View style={styles.footerBrand}>
            <Image source={require("../../assets/playstore.png")} style={styles.footerBrandImg} resizeMode="contain" />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingTop: 24,
    paddingBottom: 48,
    flexGrow: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: "space-between",
    gap: 18,
  },
  brandRow: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    opacity: 0.92,
  },
  loadingCard: {
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 16,
    gap: 18,
    alignItems: "center",
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: 13,
  },
  footerBrand: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  footerBrandImg: {
    width: 320,
    height: 90,
  },
  mainHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  mainHeaderText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  form: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  link: {
    color: colors.gold,
    textAlign: "center",
    fontWeight: "800",
    marginTop: 4,
  },
  hint: {
    color: colors.mutedText,
    textAlign: "center",
    fontSize: 12,
    marginTop: 4,
  },
});
