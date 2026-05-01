import React from "react";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "../theme/colors";

export function ImagePreviewModal(props: { visible: boolean; uri: string | null; onClose: () => void }) {
  return (
    <Modal visible={props.visible} animationType="fade" transparent onRequestClose={props.onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={props.onClose} accessibilityRole="button" accessibilityLabel="Cerrar imagen" />

        <View style={styles.content}>
          {props.uri ? <Image source={{ uri: props.uri }} style={styles.image} resizeMode="contain" /> : null}
        </View>

        <Pressable style={styles.closeBtn} onPress={props.onClose} accessibilityRole="button" accessibilityLabel="Cerrar">
          <Ionicons name="close" size={20} color={colors.text} />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    width: "92%",
    height: "72%",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  closeBtn: {
    position: "absolute",
    top: 18,
    right: 18,
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
});
