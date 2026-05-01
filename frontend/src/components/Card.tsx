import React from "react";
import { StyleSheet, View, type ViewProps } from "react-native";
import { colors } from "../theme/colors";

export function Card(props: ViewProps) {
  return <View {...props} style={[styles.card, props.style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
});
