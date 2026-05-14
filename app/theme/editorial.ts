import { TextStyle, ViewStyle } from "react-native";

export type ThemeMode = "light" | "dark";

// Border radius tokens — matches web's Tailwind config
export const R = {
    xs: 4,
    sm: 6,    // grade chips
    md: 8,    // icons, small cards
    lg: 12,   // cards, inputs — primary card radius
    xl: 16,   // modals, sheets
    full: 9999,
} as const;

// Spacing scale — 4px base
export const S = {
    1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48,
} as const;

export type EditorialPalette = {
    background: string;
    surface: string;
    surfaceLow: string;
    surfaceMid: string;
    surfaceHigh: string;
    surfaceHighest: string;
    text: string;
    textMuted: string;
    textSoft: string;
    primary: string;
    primaryContainer: string;
    primaryFixed: string;
    onPrimary: string;
    success: string;
    successBg: string;
    successText: string;
    warning: string;
    warningBg: string;
    warningText: string;
    danger: string;
    dangerBg: string;
    dangerText: string;
    info: string;
    infoBg: string;
    infoText: string;
    outline: string;
    outlineVariant: string;
    scrim: string;
    tabBar: string;
    // Backward-compat aliases
    pageSection: string;
    surfaceGlass: string;
    surfaceMuted: string;
    inputSurface: string;
    successSoft: string;
    warningSoft: string;
    infoSoft: string;
    dangerSoft: string;
};

const light: EditorialPalette = {
    background:      "#f8f9fa",
    surface:         "#ffffff",
    surfaceLow:      "#f3f4f5",
    surfaceMid:      "#edeeef",
    surfaceHigh:     "#e7e8e9",
    surfaceHighest:  "#e1e3e4",
    text:        "#191c1d",
    textMuted:   "#424654",
    textSoft:    "#737785",
    primary:          "#0040a1",
    primaryContainer: "#0056d2",
    primaryFixed:     "#dae2ff",
    onPrimary:        "#ffffff",
    success:     "#16a34a",
    successBg:   "#f0fdf4",
    successText: "#15803d",
    warning:     "#d97706",
    warningBg:   "#fffbeb",
    warningText: "#b45309",
    danger:      "#dc2626",
    dangerBg:    "#fef2f2",
    dangerText:  "#b91c1c",
    info:        "#0040a1",
    infoBg:      "#dae2ff",
    infoText:    "#001847",
    outline:        "#737785",
    outlineVariant: "#c3c6d6",
    scrim:  "rgba(0,0,0,0.6)",
    tabBar: "rgba(255,255,255,0.96)",
    pageSection:  "#f3f4f5",
    surfaceGlass: "#edeeef",
    surfaceMuted: "#edeeef",
    inputSurface: "#f3f4f5",
    successSoft:  "#f0fdf4",
    warningSoft:  "#fffbeb",
    infoSoft:     "#dae2ff",
    dangerSoft:   "#fef2f2",
};

const dark: EditorialPalette = {
    background:      "#0c1324",
    surface:         "#141e2e",
    surfaceLow:      "#1d263f",
    surfaceMid:      "#232f46",
    surfaceHigh:     "#313954",
    surfaceHighest:  "#464e6d",
    text:        "#dce1fb",
    textMuted:   "#c2c6d6",
    textSoft:    "#737785",
    primary:          "#3c50ff",
    primaryContainer: "#4d8eff",
    primaryFixed:     "#232f46",
    onPrimary:        "#ffffff",
    success:     "#4ade80",
    successBg:   "rgba(74,222,128,0.1)",
    successText: "#86efac",
    warning:     "#fbbf24",
    warningBg:   "rgba(251,191,36,0.1)",
    warningText: "#fde68a",
    danger:      "#f87171",
    dangerBg:    "rgba(248,113,113,0.1)",
    dangerText:  "#fca5a5",
    info:        "#3c50ff",
    infoBg:      "rgba(60,80,255,0.15)",
    infoText:    "#b2c5ff",
    outline:        "#737785",
    outlineVariant: "#424754",
    scrim:  "rgba(0,0,0,0.7)",
    tabBar: "rgba(20,30,46,0.96)",
    pageSection:  "#1d263f",
    surfaceGlass: "#232f46",
    surfaceMuted: "#232f46",
    inputSurface: "#1d263f",
    successSoft:  "rgba(74,222,128,0.1)",
    warningSoft:  "rgba(251,191,36,0.1)",
    infoSoft:     "rgba(60,80,255,0.15)",
    dangerSoft:   "rgba(248,113,113,0.1)",
};

export function getEditorialPalette(theme: ThemeMode): EditorialPalette {
    return theme === "dark" ? dark : light;
}

// Web card shadow: 0 8px 32px -4px rgba(25,28,29,0.06)
export function cardShadow(theme: ThemeMode): ViewStyle {
    return {
        shadowColor: theme === "dark" ? "#000" : "#191c1d",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: theme === "dark" ? 0.25 : 0.06,
        shadowRadius: 12,
        elevation: theme === "dark" ? 6 : 2,
    };
}

export function floatingShadow(theme: ThemeMode): ViewStyle {
    return {
        shadowColor: theme === "dark" ? "#000" : "#191c1d",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: theme === "dark" ? 0.4 : 0.08,
        shadowRadius: 16,
        elevation: theme === "dark" ? 12 : 4,
    };
}

export function getEditorialShadow(theme: ThemeMode, variant?: "card" | "floating"): ViewStyle {
    return variant === "floating" ? floatingShadow(theme) : cardShadow(theme);
}

// Typography tokens
export const T = {
    display: {
        fontSize: 36, lineHeight: 42, fontWeight: "900", letterSpacing: -1,
    } satisfies TextStyle,
    headline: {
        fontSize: 24, lineHeight: 30, fontWeight: "800", letterSpacing: -0.5,
    } satisfies TextStyle,
    title: {
        fontSize: 18, lineHeight: 24, fontWeight: "700", letterSpacing: -0.2,
    } satisfies TextStyle,
    body: {
        fontSize: 15, lineHeight: 22, fontWeight: "400",
    } satisfies TextStyle,
    bodyMedium: {
        fontSize: 15, lineHeight: 22, fontWeight: "500",
    } satisfies TextStyle,
    label: {
        fontSize: 13, lineHeight: 18, fontWeight: "500", letterSpacing: 0.1,
    } satisfies TextStyle,
    labelBold: {
        fontSize: 13, lineHeight: 18, fontWeight: "700", letterSpacing: 0.1,
    } satisfies TextStyle,
    eyebrow: {
        fontSize: 10, lineHeight: 14, fontWeight: "700", letterSpacing: 1.2,
        textTransform: "uppercase",
    } satisfies TextStyle,
    meta: {
        fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 0.1,
    } satisfies TextStyle,
    statValue: {
        fontSize: 28, lineHeight: 34, fontWeight: "900", letterSpacing: -0.8,
    } satisfies TextStyle,
} as const;

// Legacy aliases
export const editorialType = {
    eyebrow:      T.eyebrow,
    sectionLabel: T.labelBold,
    title:        T.title,
    headline:     T.headline,
    display:      T.display,
    body:         T.bodyMedium,
    meta:         T.label,
};

export default function EditorialThemeRoute() { return null; }
