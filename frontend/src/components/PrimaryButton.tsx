import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

export function PrimaryButton(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  iconName?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      style={({ pressed }) => [styles.btn, pressed && !props.disabled ? styles.pressed : null, props.disabled ? styles.disabled : null]}
    >
      <View style={styles.inner}>
        {props.iconName ? <Ionicons name={props.iconName} size={18} color={colors.bg} /> : null}
        <Text style={styles.text}>{props.label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: colors.gold,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  text: {
    color: colors.bg,
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
