
import { useRouter } from "expo-router";
import { ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import GlassCard from "../components/GlassCard";
import SafeView from "../components/SafeView";
import { useTheme } from "../theme/ThemeContext";

export default function Ustawieniawygladu() {
	const router = useRouter();

	// single color theme for all switches to keep UI consistent
	const primaryTrackOn = "#4F46E5"; // indigo-600
	const primaryThumbOn = "#EDE9FE"; // indigo-100-ish

	const { theme, toggleTheme } = useTheme();

	return (
			<SafeView edges={['bottom']} className={`flex-1 ${theme === 'dark' ? 'bg-black' : 'bg-white'}`}>
				{/* fixed header */}
				<View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, paddingHorizontal: 16, paddingTop: 12 }}>
					<TouchableOpacity onPress={() => router.push('/(tabs)/settings')} style={{ marginRight: 12 }}>
						<Text style={{ color: '#60A5FA', marginLeft: 8, fontSize: 20 }}>◀  <Text style={{ color: theme === 'dark' ? '#fff' : '#000', fontWeight: '700', fontSize: 20 }}>Wygląd</Text></Text>
					</TouchableOpacity>
				</View>

				<Text style={{ color: theme === 'dark' ? '#9CA3AF' : '#374151', marginBottom: 8, marginLeft: 16, paddingHorizontal: 16, marginTop: 72 }}>Zarządzaj ustawieniami wyglądu: motyw, czcionka i inne.</Text>

				<ScrollView contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16, paddingTop: 88 }}>
				
				<GlassCard>
					<View className="flex-row justify-between items-center">
						<View>
							<Text className={`${theme === 'dark' ? 'text-white' : 'text-black'} text-lg font-semibold`}>Tryb aplikacji</Text>
							<Text className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'} text-sm`}>Wybierz między trybem ciemnym i jasnym</Text>
						</View>
						<Switch
							value={theme === 'dark'}
							onValueChange={toggleTheme}
							trackColor={{ false: '#9CA3AF', true: primaryTrackOn }}
							thumbColor={theme === 'dark' ? primaryThumbOn : '#fff'}
						/>
					</View>
				</GlassCard>

			</ScrollView>
		</SafeView>
	);
}
