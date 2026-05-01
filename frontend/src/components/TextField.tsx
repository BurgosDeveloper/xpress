import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

export function TextField(props: {
  label: string;
  labelIconName?: React.ComponentProps<typeof Ionicons>["name"];
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad" | "number-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  editable?: boolean;
  error?: string | null;
  rightIconName?: React.ComponentProps<typeof Ionicons>["name"];
  onPressRightIcon?: () => void;
  rightIconAccessibilityLabel?: string;
  rightIconDisabled?: boolean;
}) {
  const hasRightIcon = !!props.rightIconName;
  const rightDisabled = props.rightIconDisabled || !props.onPressRightIcon;

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        {props.labelIconName ? <Ionicons name={props.labelIconName} size={13} color={colors.text} /> : null}
        <Text style={styles.label}>{props.label}</Text>
      </View>
      <View style={styles.inputWrap}>
        <TextInput
          value={props.value}
          onChangeText={props.onChangeText}
          placeholder={props.placeholder}
          placeholderTextColor={colors.mutedText}
          secureTextEntry={props.secureTextEntry}
          keyboardType={props.keyboardType}
          autoCapitalize={props.autoCapitalize ?? "none"}
          editable={props.editable ?? true}
          style={[
            styles.input,
            hasRightIcon ? styles.inputWithRight : null,
            (props.editable ?? true) ? null : styles.inputDisabled,
            props.error ? styles.inputError : null,
          ]}
        />

        {props.rightIconName ? (
          <Pressable
            onPress={rightDisabled ? undefined : props.onPressRightIcon}
            accessibilityRole="button"
            accessibilityLabel={props.rightIconAccessibilityLabel ?? "Acción"}
            hitSlop={10}
            style={({ pressed }) => [styles.rightIconBtn, pressed && !rightDisabled ? styles.rightIconBtnPressed : null]}
          >
            <Ionicons name={props.rightIconName} size={18} color={rightDisabled ? colors.mutedText : colors.gold} />
          </Pressable>
        ) : null}
      </View>
      {!!props.error && <Text style={styles.error}>{props.error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  inputWrap: {
    position: "relative",
  },
  inputWithRight: {
    paddingRight: 44,
  },
  rightIconBtn: {
    position: "absolute",
    right: 8,
    top: 0,
    bottom: 0,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    elevation: 2,
  },
  rightIconBtnPressed: {
    opacity: 0.85,
  },
  inputError: {
    borderColor: colors.danger,
  },
  inputDisabled: {
    opacity: 0.7,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
  },
});
