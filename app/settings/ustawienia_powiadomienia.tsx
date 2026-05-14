
import { useRouter } from "expo-router";
import * as React from "react";
import { ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import GlassCard from "../components/GlassCard";
import SafeView from "../components/SafeView";
import { useTheme } from "../theme/ThemeContext";

export default function UstawieniaPowiadomienia() {
	const router = useRouter();

	const [sounds, setSounds] = React.useState(true);
	const [banners, setBanners] = React.useState(true);
	const [schedule, setSchedule] = React.useState(false);

	// single color theme for all switches to keep UI consistent
	const primaryTrackOn = "#4F46E5"; // indigo-600
	const primaryThumbOn = "#EDE9FE"; // indigo-100-ish

	const { theme } = useTheme();
	const smallTextClass = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';
	const separatorClass = theme === 'dark' ? 'border-white/6' : 'border-gray-200';
	const switchTrackOff = theme === 'dark' ? 'rgba(255,255,255,0.12)' : '#E5E7EB';
	const textClass = theme === 'dark' ? 'text-white' : 'text-black';

	return (
		<SafeView edges={['bottom']} style={{ flex: 1, backgroundColor: theme === 'dark' ? '#000' : '#fff' }}>
			{/* fixed header */}
			<View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, paddingHorizontal: 16, paddingTop: 12 }}>
				<TouchableOpacity onPress={() => router.push('/(tabs)/settings')} style={{ marginRight: 12 }}>
					<Text style={{ color: '#60A5FA', marginLeft: 8, fontSize: 20 }}>◀  <Text style={{ color: theme === 'dark' ? '#fff' : '#000', fontWeight: '700', fontSize: 20 }}>Powiadomienia</Text></Text>
				</TouchableOpacity>
			</View>

			<Text style={{ color: theme === 'dark' ? '#9CA3AF' : '#374151', marginBottom: 8, marginLeft: 16, marginTop: 72 }}>Zarządzaj ustawieniami powiadomień: dźwięki, banery i harmonogramy.</Text>

			<ScrollView contentContainerStyle={{ paddingBottom: 40, paddingTop: 88 }}>
				<GlassCard className="mb-4 ml-4 mr-4">
					<View className="flex-row items-center justify-between">
						<Text className={`${textClass} text-lg`}>Dźwięki</Text>
						<Switch
							value={sounds}
							onValueChange={setSounds}
							trackColor={{ false: switchTrackOff, true: primaryTrackOn }}
							thumbColor={sounds ? "#EDE9FE" : "#F3F4F6"}
						/>
					</View>

						<View className={`border-t ${separatorClass} mt-3 pt-3`}>
							<Text className={`${smallTextClass}`}>Włącz lub wyłącz dźwięki powiadomień aplikacji.</Text>
						</View>
				</GlassCard>

				<GlassCard className="mb-4 ml-4 mr-4">
					<View className="flex-row items-center justify-between">
						<Text className={`${textClass} text-lg`}>Banery</Text>
						<Switch
							value={banners}
							onValueChange={setBanners}
							trackColor={{ false: switchTrackOff, true: primaryTrackOn }}
							thumbColor={banners ? primaryThumbOn : "#F3F4F6"}
						/>
					</View>

					<View className={`border-t ${separatorClass} mt-3 pt-3`}>
						<Text className={`${smallTextClass}`}>Pokaż banery powiadomień na ekranie.</Text>
					</View>
				</GlassCard>

				<GlassCard className="mb-4 ml-4 mr-4">
					<View className="flex-row items-center justify-between">
						<Text className={`${textClass} text-lg`}>Harmonogram</Text>
						<Switch
							value={schedule}
							onValueChange={setSchedule}
							trackColor={{ false: switchTrackOff, true: primaryTrackOn }}
							thumbColor={schedule ? primaryThumbOn : "#F3F4F6"}
						/>
					</View>

					<View className={`border-t ${separatorClass} mt-3 pt-3`}>
						<Text className={`${smallTextClass}`}>Ustaw harmonogram niet przeszkadzać dla powiadomień.</Text>
					</View>
				</GlassCard>
			</ScrollView>
		</SafeView>
	);
}
