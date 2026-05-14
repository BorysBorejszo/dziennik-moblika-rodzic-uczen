import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarFooter,
  useSidebar,
} from "./ui/sidebar";
import { useTheme } from "../theme/ThemeContext";
import { useUser } from "../context/UserContext";
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from "expo-router";

export function AppSidebar() {
  const { close } = useSidebar();
  const { theme } = useTheme();
  const { user } = useUser();
  const isParent = user?.role?.toLowerCase() === "rodzic";
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <Sidebar>
      <SidebarHeader>
        <Text style={{ color: theme === 'dark' ? '#fff' : '#0f172a', fontWeight: '700', fontSize: 18 }}>Menu</Text>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup title="Nawigacja">
          <TouchableOpacity onPress={() => { close(); router.push('/'); }} style={{ paddingVertical: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="home-outline" size={18} color={theme === 'dark' ? '#fff' : '#0f172a'} />
              <Text style={{ color: theme === 'dark' ? '#fff' : '#0f172a', marginLeft: 10 }}>Strona główna</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { close(); router.push('/schedule'); }} style={{ paddingVertical: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="calendar-outline" size={18} color={theme === 'dark' ? '#fff' : '#0f172a'} />
              <Text style={{ color: theme === 'dark' ? '#fff' : '#0f172a', marginLeft: 10 }}>Plan lekcji</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { close(); router.push('/grades'); }} style={{ paddingVertical: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="ribbon-outline" size={18} color={theme === 'dark' ? '#fff' : '#0f172a'} />
              <Text style={{ color: theme === 'dark' ? '#fff' : '#0f172a', marginLeft: 10 }}>Oceny</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { close(); router.push('/attendance'); }} style={{ paddingVertical: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="stats-chart-outline" size={18} color={theme === 'dark' ? '#fff' : '#0f172a'} />
              <Text style={{ color: theme === 'dark' ? '#fff' : '#0f172a', marginLeft: 10 }}>Frekwencja</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { close(); router.push('/messages'); }} style={{ paddingVertical: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="chatbubbles-outline" size={18} color={theme === 'dark' ? '#fff' : '#0f172a'} />
              <Text style={{ color: theme === 'dark' ? '#fff' : '#0f172a', marginLeft: 10 }}>Wiadomości</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { close(); router.push(isParent ? '/parent_homework_screen' : '/homework'); }} style={{ paddingVertical: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="book-outline" size={18} color={theme === 'dark' ? '#fff' : '#0f172a'} />
              <Text style={{ color: theme === 'dark' ? '#fff' : '#0f172a', marginLeft: 10 }}>Prace domowe</Text>
            </View>
          </TouchableOpacity>
          {/* Group header toggles expansion */}
          <TouchableOpacity onPress={() => setSettingsOpen(s => !s)} style={{ paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="settings-outline" size={18} color={theme === 'dark' ? '#fff' : '#0f172a'} />
              <Text style={{ color: theme === 'dark' ? '#fff' : '#0f172a', fontWeight: '600', marginLeft: 10 }}>Ustawienia</Text>
            </View>
            <Ionicons name={settingsOpen ? 'chevron-up' : 'chevron-down'} size={18} color={theme === 'dark' ? '#fff' : '#0f172a'} />
          </TouchableOpacity>

          {settingsOpen ? (
            <View style={{ paddingLeft: 6 }}>
              
              <TouchableOpacity onPress={() => { close(); router.push('/settings/ustawienia_wyglad'); }} style={{ paddingVertical: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ transform: [{ rotate: '45deg' }], width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons
                      name="color-palette-outline"
                      size={18}
                      color={theme === 'dark' ? '#fff' : '#0f172a'}
                    />
                  </View>
                  <Text style={{ color: theme === 'dark' ? '#fff' : '#0f172a', marginLeft: 10 }}>Wygląd</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { close(); router.push('/settings/ustawienia_powiadomienia'); }} style={{ paddingVertical: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="notifications-outline" size={18} color={theme === 'dark' ? '#fff' : '#0f172a'} />
                  <Text style={{ color: theme === 'dark' ? '#fff' : '#0f172a', marginLeft: 10 }}>Powiadomienia</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { close(); router.push('/settings/ustawienia_prywatnosc'); }} style={{ paddingVertical: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="lock-closed-outline" size={18} color={theme === 'dark' ? '#fff' : '#0f172a'} />
                  <Text style={{ color: theme === 'dark' ? '#fff' : '#0f172a', marginLeft: 10 }}>Prywatność</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { close(); router.push('/settings/ustawienia_jezyk'); }} style={{ paddingVertical: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="language-outline" size={18} color={theme === 'dark' ? '#fff' : '#0f172a'} />
                  <Text style={{ color: theme === 'dark' ? '#fff' : '#0f172a', marginLeft: 10 }}>Język</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setSettingsOpen(true); }} style={{ paddingVertical: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="person-outline" size={18} color={theme === 'dark' ? '#fff' : '#0f172a'} />
                <Text style={{ color: theme === 'dark' ? '#fff' : '#0f172a', marginLeft: 10 }}>Profil</Text>
              </View>
            </TouchableOpacity>
            </View>
          ) : (
            null
          )}
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <TouchableOpacity onPress={close} style={{ paddingVertical: 6 }}>
          <Text style={{ color: theme === 'dark' ? '#9CA3AF' : '#6b7280' }}>Zamknij</Text>
        </TouchableOpacity>
      </SidebarFooter>
    </Sidebar>
  );
}

export default AppSidebar;
