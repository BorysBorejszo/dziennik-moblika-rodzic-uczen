import { Link, Stack } from "expo-router";
import { Text, View } from "react-native";
import { useTheme } from "./theme/ThemeContext";

export default function NotFoundScreen() {
  const { theme } = useTheme();
  const bg = theme === "dark" ? "#000" : "#fff";
  const textColor = theme === "dark" ? "#fff" : "#000";
  const mutedColor = theme === "dark" ? "#888" : "#666";

  return (
    <>
      <Stack.Screen options={{ title: "Nie znaleziono" }} />
      <View style={{ flex: 1, backgroundColor: bg, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ fontSize: 48, fontWeight: "bold", color: textColor, marginBottom: 8 }}>
          404
        </Text>
        <Text style={{ fontSize: 18, fontWeight: "600", color: textColor, marginBottom: 8 }}>
          Strona nie istnieje
        </Text>
        <Text style={{ fontSize: 14, color: mutedColor, textAlign: "center", marginBottom: 32 }}>
          Ta trasa nie jest obsługiwana przez aplikację.
        </Text>
        <Link href="/" style={{ color: "#3b82f6", fontSize: 16 }}>
          Wróć do strony głównej
        </Link>
      </View>
    </>
  );
}
