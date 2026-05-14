
import { useRouter } from "expo-router";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import SafeView from "../components/SafeView";
import { useTheme } from "../theme/ThemeContext";

export default function UstawieniaPrywatnosci() {
	const router = useRouter();

	const { theme } = useTheme();

	return (
		<SafeView edges={['bottom']} style={{ flex: 1, backgroundColor: theme === 'dark' ? '#000' : '#fff' }}>
			{/* fixed header */}
			<View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, paddingHorizontal: 16, paddingTop: 12 }}>
				<TouchableOpacity onPress={() => router.push('/(tabs)/settings')} style={{ marginRight: 12 }}>
					<Text style={{ color: '#60A5FA', marginLeft: 8, fontSize: 20 }}>◀  <Text style={{ color: theme === 'dark' ? '#fff' : '#000', fontWeight: '700', fontSize: 20 }}>Prywatność</Text></Text>
				</TouchableOpacity>
			</View>

			<Text style={{ color: theme === 'dark' ? '#9CA3AF' : '#374151', marginBottom: 8, marginLeft: 16, marginTop: 72 }}>Zarządzaj ustawieniami prywatności: zgody, blokady i inne.</Text>

			<ScrollView contentContainerStyle={{ paddingBottom: 40, paddingTop: 88 }}>
				
			</ScrollView>
		</SafeView>
	);
}
