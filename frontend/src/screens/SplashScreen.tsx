import React from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import { Screen } from "../components/Screen";
import { colors } from "../theme/colors";
import { LogoMark } from "../components/LogoMark";

export function SplashScreen() {
  return (
    <Screen style={styles.wrap}>
      <LogoMark size={196} />
      <ActivityIndicator color={colors.gold} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
});
