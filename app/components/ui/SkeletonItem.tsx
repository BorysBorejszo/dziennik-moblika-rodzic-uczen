import React, { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import { useTheme } from "../../theme/ThemeContext";

type Props = {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
};

export default function SkeletonItem({ width = "100%", height = 16, borderRadius = 8, style }: Props) {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme === "dark" ? "#333" : "#e0e0e0",
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  return (
    <View style={{ marginBottom: 12, padding: 16, borderRadius: 12, overflow: "hidden" }}>
      <SkeletonItem height={14} width="60%" style={{ marginBottom: 8 }} />
      <SkeletonItem height={12} width="90%" style={{ marginBottom: 6 }} />
      <SkeletonItem height={12} width="75%" />
    </View>
  );
}
