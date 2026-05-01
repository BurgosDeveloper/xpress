import React from "react";
import { StyleSheet, Text, type TextProps } from "react-native";
import { colors } from "../theme/colors";

export function GoldTitle(props: TextProps & { children: React.ReactNode }) {
  return (
    <Text {...props} style={[styles.title, props.style]}>
      {props.children}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.gold,
    fontSize: 20,
    fontWeight: "900",
  },
});
