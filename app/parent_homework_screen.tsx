import { router } from "expo-router";
import React from "react";
import ParentHomework from "./(tabs)/parent_homework";
import SafeView from "./components/SafeView";
import { getEditorialPalette } from "./theme/editorial";
import { useTheme } from "./theme/ThemeContext";

export default function ParentHomeworkScreen() {
  const { theme } = useTheme();
  const palette = getEditorialPalette(theme);
  return (
    <SafeView edges={["top"]} style={{ flex: 1, backgroundColor: palette.background }}>
      <ParentHomework onBack={() => router.back()} />
    </SafeView>
  );
}
