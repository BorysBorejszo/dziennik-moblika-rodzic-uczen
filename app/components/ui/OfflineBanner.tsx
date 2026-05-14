import { Text, View } from "react-native";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";

export default function OfflineBanner() {
  const status = useNetworkStatus();
  if (status !== "offline") return null;

  return (
    <View style={{ backgroundColor: "#ef4444", paddingVertical: 8, paddingHorizontal: 16 }}>
      <Text style={{ color: "#fff", textAlign: "center", fontSize: 13, fontWeight: "600" }}>
        Brak połączenia z internetem
      </Text>
    </View>
  );
}
