import React, { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { colors } from "../theme/colors";

export function AnimatedBackdrop() {
  const a = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 4000, useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration: 4000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [a]);

  const t1 = useMemo(
    () =>
      a.interpolate({
        inputRange: [0, 1],
        outputRange: [-12, 12],
      }),
    [a]
  );

  const t2 = useMemo(
    () =>
      a.interpolate({
        inputRange: [0, 1],
        outputRange: [10, -10],
      }),
    [a]
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]} />
      <Animated.View
        style={[
          styles.circle,
          {
            transform: [{ translateX: t1 }, { translateY: t2 }],
            opacity: 0.18,
            top: -80,
            left: -60,
            backgroundColor: colors.gold,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.circle,
          {
            transform: [{ translateX: t2 }, { translateY: t1 }],
            opacity: 0.10,
            bottom: -100,
            right: -80,
            backgroundColor: colors.text,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 240,
  },
});
