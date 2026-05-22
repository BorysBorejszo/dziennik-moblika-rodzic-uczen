import Ionicons from "@expo/vector-icons/build/Ionicons";
import Entypo from "@expo/vector-icons/Entypo";
import { useSegments } from "expo-router";
import * as React from "react";
import {
    Animated,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import {
    GestureHandlerRootView,
    PanGestureHandler,
    State,
} from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppSidebar } from "../components/app-sidebar";
import SafeView from "../components/SafeView";
import { SidebarProvider } from "../components/ui/sidebar";
import { useUser } from "../context/UserContext";
import "../globals.css";
import {
    getEditorialPalette,
} from "../theme/editorial";
import { useTheme } from "../theme/ThemeContext";
import AttendancePage from "./attendance";
import GradesPage from "./grades";
import IndexPage from "./index";
import MessagesPage from "./messages";
import ParentAttendancePage from "./parent_attendance";
import ParentGradesPage from "./parent_grades";
import ParentHomePage from "./parent_home";
import ParentSchedulePage from "./parent_schedule";
import SchedulePage from "./schedule";
import SettingsPage from "./settings";

const isParent = (role?: string) =>
  role ? role.toLowerCase() === "rodzic" : false;

export default function Layout() {
  const segments = useSegments();
  const { user } = useUser();
  const parent = isParent(user?.role);

  const routes = React.useMemo(() => {
    if (parent) return ["parent_home", "parent_schedule", "parent_grades", "parent_attendance", "messages", "settings"];
    return ["index", "schedule", "grades", "attendance", "messages", "settings"];
  }, [parent]);

  // determine current active segment (last segment)
  const currentSegment = segments[segments.length - 1] || "index";
  const currentIndex = Math.max(
    0,
    routes.indexOf(currentSegment) === -1 ? 0 : routes.indexOf(currentSegment)
  );

  const isAnimatingRef = React.useRef(false);

  const navigateToIndex = (i: number) => {
    const idx = (i + routes.length) % routes.length;
    // animate base offset to the tapped page for a smooth transition
    if (isAnimatingRef.current) return;
    const target = -idx * screenWidth;
    isAnimatingRef.current = true;
    // Update active index immediately so the tab bar highlight changes
    // in sync with the page transition (not after the animation finishes).
    setActiveIndex(idx);
    Animated.timing(offset, {
      toValue: target,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      // finalize state
      translateX.setValue(0);
      offset.setValue(target);
      isAnimatingRef.current = false;
      // Note: we intentionally do NOT call router.replace here to avoid layout thrash.
    });
  };
  // animated swipe handling: render pages side-by-side and translate container
  const screenWidth = Dimensions.get("window").width;
  const translateX = React.useRef(new Animated.Value(0)).current; // gesture translation during drag
  const offset = React.useRef(
    new Animated.Value(-currentIndex * screenWidth)
  ).current; // base offset for active page

  // stable combined translation — must be in a ref so pageTranslates can reference it once
  const combinedTranslate = React.useRef(Animated.add(offset, translateX)).current;

  // per-page X position: page idx sits at combinedTranslate + idx * screenWidth.
  // All pages share the same combinedTranslate so they slide together during a swipe.
  // 6 slots covers student (6) and parent (6) tab counts.
  const pageTranslates = React.useRef(
    Array.from({ length: 6 }, (_, i) => Animated.add(combinedTranslate, i * screenWidth))
  ).current;

  // Fully native gesture event — no JS bridge in the hot path.
  // failOffsetY on the PanGestureHandler rejects vertical gestures natively BEFORE
  // the handler activates, so each page's ScrollView can claim vertical drags on
  // every tab, not just the first one.
  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  );

  // Per-tab animated highlight levels driven by pageTranslates (native driver).
  // This ensures the tab bar highlight moves in perfect sync with the page slide —
  // no React re-render lag — because it runs on the UI thread alongside the animation.
  const tabLevels = React.useMemo(() =>
    routes.map((_, i) => {
      const active = pageTranslates[i].interpolate({
        inputRange: [-screenWidth, 0, screenWidth],
        outputRange: [0, 1, 0],
        extrapolate: 'clamp',
      });
      const inactive = active.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
      return { active, inactive };
    }),
    // pageTranslates and screenWidth are both stable refs — no re-creation needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // local active index state so we can update offset when route changes
  const [activeIndex, setActiveIndex] = React.useState(currentIndex);

  // keep offset in sync when segments change (e.g., programmatic navigation)
  React.useEffect(() => {
    const idx = Math.max(
      0,
      routes.indexOf(currentSegment) === -1 ? 0 : routes.indexOf(currentSegment)
    );
    setActiveIndex(idx);
    offset.setValue(-idx * screenWidth);
    translateX.setValue(0);
  }, [currentSegment, routes, screenWidth, offset, translateX]);

  const snapBack = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(() => {
      translateX.setValue(0);
    });
  };

  const handleStateChange = (event: any) => {
    const ne = event.nativeEvent;
    // FAILED = failOffsetY triggered (vertical scroll started); CANCELLED = another handler won.
    // Both cases: reset translateX so pages snap back cleanly.
    if (ne.state === State.FAILED || ne.state === State.CANCELLED) {
      snapBack();
      return;
    }
    if (ne.state !== State.END) return;

    const dx = ne.translationX ?? 0;
    const dy = ne.translationY ?? 0;

    if (Math.abs(dy) > Math.abs(dx)) {
      snapBack();
      return;
    }

    const threshold = Math.min(120, screenWidth * 0.25);
    if (dx < -threshold) {
      const next = (activeIndex + 1 + routes.length) % routes.length;
      const target = -next * screenWidth;
      setActiveIndex(next);
      Animated.parallel([
        Animated.timing(offset, { toValue: target, duration: 220, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => {
        translateX.setValue(0);
        offset.setValue(target);
      });
    } else if (dx > threshold) {
      const prev = (activeIndex - 1 + routes.length) % routes.length;
      const target = -prev * screenWidth;
      setActiveIndex(prev);
      Animated.parallel([
        Animated.timing(offset, { toValue: target, duration: 220, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => {
        translateX.setValue(0);
        offset.setValue(target);
      });
    } else {
      snapBack();
    }
  };

  const { theme } = useTheme();

  // Re-enabled swipe on Android with direction filtering (vertical drags fail early).
  // Previously disabled due to nested ScrollView conflicts; failOffsetY + logic above
  // now ensures vertical scroll keeps priority while horizontal swipe changes pages.
  const swipeEnabled = true;

  const palette = getEditorialPalette(theme);
  const bg = palette.background;
  // In dark mode use the same deep navy as the attendance hero card
  // (#1e3a8a) so the selected-tab highlight matches the "Frekwencja"
  // panel. Light mode keeps the palette's primary blue.
  const activePillBg = theme === "dark" ? "#1e3a8a" : palette.primary;
  const activeTint = theme === "dark" ? "#ffffff" : palette.onPrimary;
  const inactiveTint = palette.textSoft;

  const insets = useSafeAreaInsets();

  return (
    <SidebarProvider>
      {/* ThemeProvider exists at app/_layout.tsx (root) — don't re-create here in normal use */}
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: bg }}>
        {/* top-level safe area: ensure header/toolbar area is stable across pages */}
        <SafeView edges={['top']} style={{ flex: 1, backgroundColor: bg }}>
          {/* App Sidebar (sliding drawer) */}
          <AppSidebar onNavigate={navigateToIndex} />

          {/* Trigger removed from top — triggers are placed inline in page headers */}

          <View style={{ flex: 1 }}>
            <PanGestureHandler
              onGestureEvent={onGestureEvent}
              onHandlerStateChange={handleStateChange}
              activeOffsetX={[-15, 15]}
              failOffsetY={[-10, 10]}
              enabled={swipeEnabled}
            >
              {/*
                Each page is absolutely positioned at [0,0,right,bottom] so its
                LAYOUT bounds are identical to the screen rect regardless of the
                visual transform applied by pageTranslates[idx].
                On Android, touch-event dispatch uses layout coordinates (not
                post-transform visual coords), so with the old row approach all
                touches always hit page 0. Absolute layout + pointerEvents="none"
                on inactive pages fixes this: the active page's layout is always
                [0..W, 0..H] and its ScrollView receives touches correctly.
              */}
              <Animated.View style={{ flex: 1 }}>
                {(parent
                  ? [
                      (props: any) => <ParentHomePage {...props} onNavigate={navigateToIndex} />,
                      ParentSchedulePage,
                      ParentGradesPage,
                      ParentAttendancePage,
                      MessagesPage,
                      SettingsPage,
                    ]
                  : [
                      IndexPage,
                      SchedulePage,
                      GradesPage,
                      AttendancePage,
                      MessagesPage,
                      SettingsPage,
                    ]
                ).map((Page, idx) => (
                  <Animated.View
                    key={routes[idx]}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      transform: [{ translateX: pageTranslates[idx] }],
                    }}
                    pointerEvents={idx === activeIndex ? 'auto' : 'none'}
                  >
                    <Page />
                  </Animated.View>
                ))}
              </Animated.View>
            </PanGestureHandler>
          </View>

          {/* Custom static tab bar (not animated) */}
          <View
            style={{
              paddingBottom: insets.bottom,
              backgroundColor: palette.tabBar,
            }}
          >
            <View
              style={[
                styles.tabBarShell,
                { backgroundColor: palette.tabBar },
              ]}
            >
              {routes.map((route, i) => {
                const { active: activeLevel, inactive: inactiveLevel } = tabLevels[i];
                const label =
                  route === "index" || route === "parent_home" ? "Główna"
                  : route === "schedule" || route === "parent_schedule" ? "Plan"
                  : route === "settings" ? "Ustawienia"
                  : route === "grades" || route === "parent_grades" ? "Oceny"
                  : route === "attendance" || route === "parent_attendance" ? "Frekwencja"
                  : "Wiadomości";

                return (
                  <TouchableOpacity
                    key={route}
                    onPress={() => navigateToIndex(i)}
                    style={styles.tabTouch}
                    activeOpacity={0.8}
                  >
                    <View style={styles.tabPill}>
                      {/* Active pill fill — opacity driven by native Animated, synced with page slide */}
                      <Animated.View
                        style={[
                          StyleSheet.absoluteFillObject,
                          { borderRadius: 22, backgroundColor: activePillBg, opacity: activeLevel },
                        ]}
                      />

                      {/* Icons — two overlaid layers, complementary opacities */}
                      <View style={styles.tabIconWrap}>
                        <Animated.View style={{ opacity: inactiveLevel }}>
                          {(route === "index" || route === "parent_home") && <Entypo name="home" size={22} color={inactiveTint} />}
                          {(route === "schedule" || route === "parent_schedule") && <Entypo name="calendar" size={22} color={inactiveTint} />}
                          {route === "settings" && <Entypo name="cog" size={22} color={inactiveTint} />}
                          {(route === "grades" || route === "parent_grades") && <Ionicons name="ribbon-outline" size={23} color={inactiveTint} />}
                          {(route === "attendance" || route === "parent_attendance") && <Ionicons name="stats-chart-outline" size={23} color={inactiveTint} />}
                          {route === "messages" && <Entypo name="chat" size={22} color={inactiveTint} />}
                        </Animated.View>
                        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: activeLevel, alignItems: 'center', justifyContent: 'center' }]}>
                          {(route === "index" || route === "parent_home") && <Entypo name="home" size={22} color={activeTint} />}
                          {(route === "schedule" || route === "parent_schedule") && <Entypo name="calendar" size={22} color={activeTint} />}
                          {route === "settings" && <Entypo name="cog" size={22} color={activeTint} />}
                          {(route === "grades" || route === "parent_grades") && <Ionicons name="ribbon-outline" size={23} color={activeTint} />}
                          {(route === "attendance" || route === "parent_attendance") && <Ionicons name="stats-chart-outline" size={23} color={activeTint} />}
                          {route === "messages" && <Entypo name="chat" size={22} color={activeTint} />}
                        </Animated.View>
                      </View>

                      {/* Labels — same two-layer approach */}
                      <View style={styles.tabLabelWrap}>
                        <Animated.Text numberOfLines={1} ellipsizeMode="tail" style={[styles.tabLabel, { color: palette.textMuted, opacity: inactiveLevel }]}>
                          {label}
                        </Animated.Text>
                        <Animated.Text numberOfLines={1} ellipsizeMode="tail" style={[styles.tabLabel, styles.tabLabelOverlay, { color: activeTint, opacity: activeLevel }]}>
                          {label}
                        </Animated.Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
  </SafeView>
      </GestureHandlerRootView>
    </SidebarProvider>
  );
}

const styles = StyleSheet.create({
  tabBarShell: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  tabTouch: {
    flex: 1,
  },
  tabPill: {
    minHeight: 56,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  tabIconWrap: {
    minHeight: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  tabLabelWrap: {
    marginTop: 5,
    alignSelf: 'stretch',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  tabLabelOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
