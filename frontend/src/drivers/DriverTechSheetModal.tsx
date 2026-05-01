import React, { useMemo, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Card } from "../components/Card";
import { GoldTitle } from "../components/GoldTitle";
import { ReadOnlyField } from "../components/ReadOnlyField";
import { ImagePreviewModal } from "../components/ImagePreviewModal";
import { colors } from "../theme/colors";
import { absoluteUrl } from "../utils/url";
import { serviceTypeLabel } from "../utils/serviceType";

type DriverLike = any;

function getVehiclePhotoUrls(driver: DriverLike): string[] {
  const arr: any[] = Array.isArray(driver?.documents) ? driver.documents : [];
  return arr.filter((d) => d.type === "VEHICLE_PHOTO" && d.url).map((d) => String(d.url));
}

export function DriverTechSheetModal(props: { visible: boolean; onClose: () => void; driver: DriverLike | null }) {
  const driver = props.driver;

  const [previewUri, setPreviewUri] = useState<string | null>(null);

  function closeAll() {
    setPreviewUri(null);
    props.onClose();
  }

  const photoUri = useMemo(() => absoluteUrl(driver?.photoUrl), [driver?.photoUrl]);
  const vehiclePhotoUris = useMemo(() => {
    const urls = getVehiclePhotoUrls(driver);
    return urls.map((u) => ({ key: u, uri: absoluteUrl(u) })).filter((x) => !!x.uri) as { key: string; uri: string }[];
  }, [driver]);

  return (
    <>
      <ImagePreviewModal visible={!!previewUri} uri={previewUri} onClose={() => setPreviewUri(null)} />

      <Modal visible={props.visible} animationType="slide" transparent onRequestClose={closeAll}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <Ionicons name="document-text-outline" size={18} color={colors.gold} />
                <GoldTitle>Ficha técnica</GoldTitle>
              </View>

              <Pressable style={styles.closeBtn} onPress={closeAll} accessibilityRole="button" accessibilityLabel="Cerrar">
                <Ionicons name="close" size={18} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {!driver ? (
                <Card>
                  <Text style={{ color: colors.text, fontWeight: "900" }}>Sin datos</Text>
                </Card>
              ) : (
                <>
                  <Card style={{ gap: 12 }}>
                    <View style={styles.topRow}>
                      <Pressable
                        style={styles.avatar}
                        onPress={() => {
                          if (photoUri) setPreviewUri(photoUri);
                        }}
                        disabled={!photoUri}
                        accessibilityRole="button"
                        accessibilityLabel={photoUri ? "Ver foto del conductor" : "Sin foto"}
                      >
                        {photoUri ? (
                          <Image source={{ uri: photoUri }} style={styles.avatarImg} resizeMode="cover" />
                        ) : (
                          <View style={styles.avatarEmpty}>
                            <Ionicons name="image-outline" size={18} color={colors.mutedText} />
                          </View>
                        )}
                      </Pressable>

                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.name}>{driver.fullName || "(sin nombre)"}</Text>
                        <Text style={styles.sub}>{driver.phone || "—"}</Text>
                      </View>
                    </View>

                    <View style={styles.sectionTitleRow}>
                      <Ionicons name="pricetag-outline" size={18} color={colors.gold} />
                      <Text style={styles.sectionTitle}>Servicio</Text>
                    </View>

                    <ReadOnlyField label="Tipo" labelIconName="car-outline" value={driver.serviceType ? serviceTypeLabel(driver.serviceType) : "—"} />
                  </Card>

                  <Card style={{ marginTop: 12, gap: 12 }}>
                    <View style={styles.sectionTitleRow}>
                      <Ionicons name="wallet-outline" size={18} color={colors.gold} />
                      <Text style={styles.sectionTitle}>Pago móvil</Text>
                    </View>

                    <ReadOnlyField label="Banco" labelIconName="business-outline" value={driver.mobilePayBank ?? ""} emptyText="Sin cargar" />
                    <ReadOnlyField label="Documento" labelIconName="document-text-outline" value={driver.mobilePayDocument ?? ""} emptyText="Sin cargar" />
                    <ReadOnlyField label="Teléfono" labelIconName="call-outline" value={driver.mobilePayPhone ?? ""} emptyText="Sin cargar" />
                  </Card>

                  <Card style={{ marginTop: 12, gap: 12 }}>
                    <View style={styles.sectionTitleRow}>
                      <Ionicons name="car-sport-outline" size={18} color={colors.gold} />
                      <Text style={styles.sectionTitle}>Vehículo</Text>
                    </View>

                    <ReadOnlyField label="Marca" labelIconName="pricetag-outline" value={driver.vehicle?.brand ?? ""} emptyText="Sin cargar" />
                    <ReadOnlyField label="Modelo" labelIconName="pricetag-outline" value={driver.vehicle?.model ?? ""} emptyText="Sin cargar" />
                    <ReadOnlyField label="Placa" labelIconName="card-outline" value={driver.vehicle?.plate ?? ""} emptyText="Sin cargar" />
                    <ReadOnlyField label="Año" labelIconName="calendar-outline" value={driver.vehicle?.year != null ? String(driver.vehicle.year) : ""} emptyText="Sin cargar" />
                    <ReadOnlyField label="Color" labelIconName="color-palette-outline" value={driver.vehicle?.color ?? ""} emptyText="Sin cargar" />

                    <ReadOnlyField label="A/C" labelIconName="snow-outline" value={driver.vehicle?.hasAC ? "Sí" : "No"} />
                    <ReadOnlyField label="Baúl" labelIconName="briefcase-outline" value={driver.vehicle?.hasTrunk ? "Sí" : "No"} />
                    <ReadOnlyField label="Mascotas" labelIconName="paw-outline" value={driver.vehicle?.allowsPets ? "Sí" : "No"} />
                  </Card>

                  <Card style={{ marginTop: 12, gap: 12 }}>
                    <View style={styles.sectionTitleRow}>
                      <Ionicons name="images-outline" size={18} color={colors.gold} />
                      <Text style={styles.sectionTitle}>Fotos</Text>
                    </View>

                    <View style={{ gap: 8 }}>
                      <Text style={styles.sectionMini}>Vehículo</Text>
                      {vehiclePhotoUris.length ? (
                        <View style={styles.photosGrid}>
                          {vehiclePhotoUris.map((x) => (
                            <Pressable
                              key={x.key}
                              style={styles.photoThumb}
                              onPress={() => setPreviewUri(x.uri)}
                              accessibilityRole="button"
                              accessibilityLabel="Ver foto del vehículo"
                            >
                              <Image source={{ uri: x.uri }} style={styles.photoThumbImg} resizeMode="cover" />
                            </Pressable>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.sub}>Sin fotos</Text>
                      )}
                    </View>
                  </Card>

                  <View style={{ height: 18 }} />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    height: "92%",
    maxHeight: "92%",
    backgroundColor: colors.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    flexGrow: 1,
  },
  scrollView: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  avatarEmpty: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  sub: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: "700",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  sectionMini: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 13,
  },
  photosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  photoThumb: {
    width: 76,
    height: 76,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  photoThumbImg: {
    width: "100%",
    height: "100%",
  },
});
