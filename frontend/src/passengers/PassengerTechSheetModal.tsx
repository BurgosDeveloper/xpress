import React, { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Card } from "../components/Card";
import { GoldTitle } from "../components/GoldTitle";
import { colors } from "../theme/colors";
import { absoluteUrl } from "../utils/url";
import { ImagePreviewModal } from "../components/ImagePreviewModal";

export type PassengerTechSheet = {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  photoUrl?: string | null;
};

export function PassengerTechSheetModal(props: { visible: boolean; passenger: PassengerTechSheet | null; onClose: () => void }) {
  const [previewOpen, setPreviewOpen] = useState(false);

  const photoUri = useMemo(() => {
    const url = props.passenger?.photoUrl;
    return url ? absoluteUrl(url) : null;
  }, [props.passenger?.photoUrl]);

  function closeAll() {
    setPreviewOpen(false);
    props.onClose();
  }

  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={closeAll}>
      <ImagePreviewModal visible={previewOpen} uri={photoUri} onClose={() => setPreviewOpen(false)} />

      <Pressable style={styles.backdrop} onPress={closeAll}>
        <Pressable style={styles.modalCard} onPress={() => null}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Ionicons name="person-outline" size={18} color={colors.gold} />
              <GoldTitle>Ficha del cliente</GoldTitle>
            </View>

            <Pressable onPress={closeAll} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          <Card style={{ gap: 12 }}>
            <View style={styles.row}>
              <View style={styles.avatarWrap}>
                {photoUri ? (
                  <Pressable onPress={() => setPreviewOpen(true)}>
                    <Image source={{ uri: photoUri }} style={styles.avatar} resizeMode="cover" />
                  </Pressable>
                ) : (
                  <View style={[styles.avatar, styles.avatarEmpty]}>
                    <Ionicons name="image-outline" size={20} color={colors.mutedText} />
                  </View>
                )}
              </View>

              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.name}>{props.passenger?.fullName || "—"}</Text>
                <Text style={styles.line}>Tel: {props.passenger?.phone || "—"}</Text>
                <Text style={styles.line}>Correo: {props.passenger?.email || "—"}</Text>
              </View>
            </View>

            {photoUri ? <Text style={styles.hint}>Toca la foto para ampliarla.</Text> : null}
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 16,
    justifyContent: "center",
  },
  modalCard: {
    borderRadius: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarWrap: {
    width: 74,
    height: 74,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  avatar: {
    width: 74,
    height: 74,
  },
  avatarEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 15,
  },
  line: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 13,
  },
  hint: {
    color: colors.mutedText,
    fontWeight: "800",
    fontSize: 12,
  },
});
