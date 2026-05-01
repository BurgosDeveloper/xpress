import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "../theme/colors";

export function SecondaryButton(props: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      style={({ pressed }) => [styles.btn, pressed && !props.disabled ? styles.pressed : null, props.disabled ? styles.disabled : null]}
    >
      <Text style={styles.text}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderColor: colors.gold,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  text: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
});
