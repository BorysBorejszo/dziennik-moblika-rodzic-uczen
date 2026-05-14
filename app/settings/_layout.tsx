import React from "react";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useTheme } from "../theme/ThemeContext";

export default function SettingsLayout() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const bgColor = theme === 'dark' ? '#000' : '#fff';

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: bgColor }}>
      <View
        style={{
          flex: 1,
          backgroundColor: bgColor,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: bgColor },
          }}
        />
      </View>
    </GestureHandlerRootView>
  );
}
