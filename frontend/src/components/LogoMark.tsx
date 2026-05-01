import React from "react";
import { Image, StyleSheet, View } from "react-native";

export function LogoMark(props: { size?: number }) {
  const size = props.size ?? 34;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Image
        source={require("../../assets/logo_xpress.png")}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
});
