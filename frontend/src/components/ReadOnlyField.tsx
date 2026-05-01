import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

export function ReadOnlyField(props: {
  label: string;
  labelIconName?: React.ComponentProps<typeof Ionicons>["name"];
  value: string;
  emptyText?: string;
}) {
  const v = (props.value ?? "").trim();
  const shown = v.length ? v : props.emptyText ?? "-";

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        {props.labelIconName ? <Ionicons name={props.labelIconName} size={16} color={colors.gold} /> : null}
        <Text style={styles.label}>{props.label}</Text>
      </View>
      <Text style={[styles.value, v.length ? null : styles.valueEmpty]}>{shown}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  label: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "800",
  },
  value: {
    marginTop: 6,
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  valueEmpty: {
    color: colors.mutedText,
    fontWeight: "700",
  },
});
