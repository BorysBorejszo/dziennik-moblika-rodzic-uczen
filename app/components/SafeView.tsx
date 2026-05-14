import * as React from "react";
import { View, ViewProps, StyleProp, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Edge = "top" | "bottom" | "left" | "right";

interface SafeViewProps extends ViewProps {
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
}

export default function SafeView({
  edges = ["top", "bottom"],
  style,
  children,
  ...rest
}: SafeViewProps) {
  const insets = useSafeAreaInsets();

  const paddingTop = edges.includes("top") ? insets.top : 0;
  const paddingBottom = edges.includes("bottom") ? insets.bottom : 0;
  const paddingLeft = edges.includes("left") ? insets.left : 0;
  const paddingRight = edges.includes("right") ? insets.right : 0;

  return (
    <View
      style={[
        { paddingTop, paddingBottom, paddingLeft, paddingRight },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
