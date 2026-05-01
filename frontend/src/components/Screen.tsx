import React from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { AnimatedBackdrop } from "./AnimatedBackdrop";

export function Screen(props: {
  children: React.ReactNode;
  style?: ViewStyle;
  keyboardAvoiding?: boolean;
  keyboardVerticalOffset?: number;
}) {
  const keyboardAvoiding = props.keyboardAvoiding ?? false;
  const keyboardVerticalOffset = props.keyboardVerticalOffset ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <AnimatedBackdrop />
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={[styles.content, props.style]}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={keyboardVerticalOffset}
        >
          {props.children}
        </KeyboardAvoidingView>
      ) : (
        <View style={[styles.content, props.style]}>{props.children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    padding: 16,
  },
});
