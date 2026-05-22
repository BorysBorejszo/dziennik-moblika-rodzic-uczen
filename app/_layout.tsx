import { Slot } from 'expo-router';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppErrorBoundary from './components/AppErrorBoundary';
import OfflineBanner from './components/ui/OfflineBanner';
import { SidebarProvider } from './components/ui/sidebar';
import UserGate from './components/UserGate';
import { ParentProvider } from './context/ParentContext';
import { UserProvider } from './context/UserContext';
import { ThemeProvider } from './theme/ThemeContext';

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <UserProvider>
              <ParentProvider>
                <SidebarProvider>
                  <UserGate>
                    <View style={{ flex: 1 }}>
                      <OfflineBanner />
                      <Slot />
                    </View>
                  </UserGate>
                </SidebarProvider>
              </ParentProvider>
            </UserProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}
