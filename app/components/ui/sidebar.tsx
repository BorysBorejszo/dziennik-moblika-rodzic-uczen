import React, { createContext, useContext, useMemo, useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  StyleSheet,
  TouchableWithoutFeedback,
} from "react-native";
import {
  editorialType,
  getEditorialPalette,
  getEditorialShadow,
} from "../../theme/editorial";
import { useTheme } from "../../theme/ThemeContext";

const { width: WINDOW_WIDTH } = Dimensions.get("window");
const SIDEBAR_WIDTH = Math.min(320, Math.floor(WINDOW_WIDTH * 0.78));

type SidebarContextType = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current; // 0 closed, 1 open

  useEffect(() => {
    Animated.timing(anim, {
      toValue: isOpen ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOpen, anim]);

  const value = useMemo(() => ({
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((s) => !s),
  }), [isOpen]);

  return (
    <SidebarContext.Provider value={value}>
      {/* Animated wrapper to be consumed by Sidebar component via context */}
      <View style={{ flex: 1 }}>
        {children}
        {/* render a portal-like holder - actual sidebar will be positioned absolute */}
      </View>
    </SidebarContext.Provider>
  );
};

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}

export const SidebarTrigger: React.FC<{ style?: any; children?: React.ReactNode }> = ({ style, children }) => {
  const { toggle } = useSidebar();
  return (
    <TouchableOpacity onPress={toggle} style={style} accessibilityLabel="Open sidebar">
      {children ?? <Text style={{ color: "#0040a1", fontSize: 20 }}>☰</Text>}
    </TouchableOpacity>
  );
};

// Low-level Sidebar components
export const Sidebar: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { isOpen, close } = useSidebar();
  const { theme } = useTheme();
  const palette = getEditorialPalette(theme);
  const translateX = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: isOpen ? 0 : -SIDEBAR_WIDTH,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: isOpen ? 0.5 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isOpen, translateX, backdropOpacity]);

  return (
    <>
      {/* Backdrop */}
      <Animated.View
        pointerEvents={isOpen ? "auto" : "none"}
        style={[
          styles.backdrop,
          { opacity: backdropOpacity, backgroundColor: palette.scrim },
        ]}
      >
        <TouchableWithoutFeedback onPress={close}>
          <View style={{ flex: 1 }} />
        </TouchableWithoutFeedback>
      </Animated.View>

      <Animated.View
        style={[
          styles.sidebar,
          {
            width: SIDEBAR_WIDTH,
            transform: [{ translateX }],
            backgroundColor: palette.surface,
          },
          getEditorialShadow(theme, "floating"),
        ]}
      >
        {children}
      </Animated.View>
    </>
  );
};

export const SidebarHeader: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { theme } = useTheme();
  const palette = getEditorialPalette(theme);
  return (
    <View style={[styles.header, { backgroundColor: palette.pageSection }]}>
      {children ?? <Text style={[styles.headerText, { color: palette.text }]}>Menu</Text>}
    </View>
  );
};

export const SidebarContent: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { theme } = useTheme();
  return <View style={[styles.content, { backgroundColor: theme === 'dark' ? 'transparent' : 'transparent' }]}>{children}</View>;
};

export const SidebarGroup: React.FC<{ title?: string; children?: React.ReactNode }> = ({ title, children }) => {
  const { theme } = useTheme();
  const palette = getEditorialPalette(theme);
  return (
    <View style={styles.group}>
      {title ? <Text style={[styles.groupTitle, { color: palette.textSoft }]}>{title}</Text> : null}
      {children}
    </View>
  );
};

export const SidebarFooter: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { theme } = useTheme();
  const palette = getEditorialPalette(theme);
  return <View style={[styles.footer, { backgroundColor: palette.pageSection }]}>{children}</View>;
};

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
    zIndex: 998,
  },
  sidebar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 999,
    paddingTop: 40,
    paddingHorizontal: 16,
  },
  header: {
    paddingTop: 24,
    paddingBottom: 14,
    paddingHorizontal: 14,
    borderRadius: 22,
  },
  headerText: {
    ...editorialType.title,
    color: "#10203a",
  },
  content: { flex: 1, paddingTop: 12 },
  group: { marginBottom: 8 },
  groupTitle: {
    ...editorialType.eyebrow,
    color: "#7f8ba0",
    marginBottom: 10,
    marginTop: 10,
  },
  footer: {
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 14,
    borderRadius: 22,
    marginBottom: 10,
  },
});

export default function SidebarRoute() {
  return null;
}
