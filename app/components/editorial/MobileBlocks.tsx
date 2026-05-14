import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import {
    StyleProp,
    StyleSheet,
    Text,
    TextInput,
    TextStyle,
    TouchableOpacity,
    View,
    ViewStyle,
} from "react-native";
import { R, S, T, cardShadow, getEditorialPalette } from "../../theme/editorial";
import { useTheme } from "../../theme/ThemeContext";

// ---------------------------------------------------------------------------
// Card — surface-container-lowest with web-matching shadow
// ---------------------------------------------------------------------------
type CardProps = {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    onPress?: () => void;
};

export function Card({ children, style, onPress }: CardProps) {
    const { theme } = useTheme();
    const palette = getEditorialPalette(theme);
    const shadow = cardShadow(theme);
    const base: ViewStyle = {
        backgroundColor: palette.surface,
        borderRadius: R.lg,
        ...shadow,
    };
    if (onPress) {
        return (
            <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={[base, style]}>
                {children}
            </TouchableOpacity>
        );
    }
    return <View style={[base, style]}>{children}</View>;
}

// ---------------------------------------------------------------------------
// SectionHeader — eyebrow / title / optional meta badge / chevron
// ---------------------------------------------------------------------------
type SectionHeaderProps = {
    eyebrow?: string;
    title: string;
    meta?: string;
    onPress?: () => void;
};

export function SectionHeader({ eyebrow, title, meta, onPress }: SectionHeaderProps) {
    const { theme } = useTheme();
    const palette = getEditorialPalette(theme);

    const content = (
        <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1 }}>
                {eyebrow ? (
                    <Text style={[T.eyebrow, { color: palette.textSoft, marginBottom: 4 }]}>
                        {eyebrow}
                    </Text>
                ) : null}
                <Text style={[T.title, { color: palette.text }]}>{title}</Text>
            </View>
            <View style={styles.sectionHeaderRight}>
                {meta ? (
                    <View style={[styles.metaBadge, { backgroundColor: palette.surfaceMid }]}>
                        <Text style={[T.meta, { color: palette.textMuted }]}>{meta}</Text>
                    </View>
                ) : null}
                {onPress ? (
                    <Ionicons name="chevron-forward" size={16} color={palette.textSoft} />
                ) : null}
            </View>
        </View>
    );

    if (onPress) {
        return (
            <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.sectionHeader}>
                {content}
            </TouchableOpacity>
        );
    }
    return <View style={styles.sectionHeader}>{content}</View>;
}

// ---------------------------------------------------------------------------
// StatCard — icon + eyebrow + large value + caption
// ---------------------------------------------------------------------------
type Tone = "primary" | "success" | "warning" | "danger" | "neutral";

type StatCardProps = {
    eyebrow: string;
    value: string;
    caption?: string;
    icon?: keyof typeof Ionicons.glyphMap;
    tone?: Tone;
    onPress?: () => void;
};

function toneColors(tone: Tone, palette: ReturnType<typeof getEditorialPalette>) {
    switch (tone) {
        case "success":  return { bg: palette.successBg,  icon: palette.success,  text: palette.successText };
        case "warning":  return { bg: palette.warningBg,  icon: palette.warning,  text: palette.warningText };
        case "danger":   return { bg: palette.dangerBg,   icon: palette.danger,   text: palette.dangerText };
        case "neutral":  return { bg: palette.surfaceMid, icon: palette.textMuted, text: palette.textMuted };
        default:         return { bg: palette.primaryFixed, icon: palette.primary, text: palette.primary };
    }
}

export function StatCard({ eyebrow, value, caption, icon, tone = "primary", onPress }: StatCardProps) {
    const { theme } = useTheme();
    const palette = getEditorialPalette(theme);
    const colors = toneColors(tone, palette);
    const shadow = cardShadow(theme);

    const inner = (
        <View style={[styles.statCard, { backgroundColor: palette.surface }, shadow]}>
            {icon ? (
                <View style={[styles.statIcon, { backgroundColor: colors.bg }]}>
                    <Ionicons name={icon} size={20} color={colors.icon} />
                </View>
            ) : null}
            <Text style={[T.eyebrow, { color: palette.textSoft, marginTop: icon ? S[3] : 0 }]}>
                {eyebrow}
            </Text>
            <Text style={[T.statValue, { color: colors.text, marginTop: 4 }]}>
                {value}
            </Text>
            {caption ? (
                <Text style={[T.label, { color: palette.textMuted, marginTop: 6 }]} numberOfLines={2}>
                    {caption}
                </Text>
            ) : null}
        </View>
    );

    if (onPress) {
        return (
            <TouchableOpacity activeOpacity={0.88} onPress={onPress}>
                {inner}
            </TouchableOpacity>
        );
    }
    return inner;
}

// ---------------------------------------------------------------------------
// RowCard — list item with icon / title / subtitle / badge / meta
// ---------------------------------------------------------------------------
type RowCardProps = {
    title: string;
    subtitle?: string;
    meta?: string;
    badge?: string;
    icon?: keyof typeof Ionicons.glyphMap;
    tone?: Tone;
    onPress?: () => void;
};

export function RowCard({ title, subtitle, meta, badge, icon, tone = "primary", onPress }: RowCardProps) {
    const { theme } = useTheme();
    const palette = getEditorialPalette(theme);
    const colors = toneColors(tone, palette);
    const shadow = cardShadow(theme);

    const inner = (
        <View style={[styles.rowCard, { backgroundColor: palette.surface }, shadow]}>
            {icon ? (
                <View style={[styles.rowIcon, { backgroundColor: colors.bg }]}>
                    <Ionicons name={icon} size={20} color={colors.icon} />
                </View>
            ) : null}
            <View style={styles.rowContent}>
                <Text style={[T.bodyMedium, { color: palette.text }]} numberOfLines={1}>
                    {title}
                </Text>
                {subtitle ? (
                    <Text style={[T.label, { color: palette.textMuted, marginTop: 2 }]} numberOfLines={1}>
                        {subtitle}
                    </Text>
                ) : null}
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
                {badge ? (
                    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
                        <Text style={[T.meta, { color: colors.text }]}>{badge}</Text>
                    </View>
                ) : null}
                {meta ? (
                    <Text style={[T.meta, { color: palette.textSoft }]}>{meta}</Text>
                ) : null}
            </View>
        </View>
    );

    if (onPress) {
        return (
            <TouchableOpacity activeOpacity={0.88} onPress={onPress}>
                {inner}
            </TouchableOpacity>
        );
    }
    return inner;
}

// ---------------------------------------------------------------------------
// SegmentedControl — tab picker
// ---------------------------------------------------------------------------
type SegOption<T extends string> = { key: T; label: string; count?: number };

type SegmentedControlProps<T extends string> = {
    value: T;
    onChange: (v: T) => void;
    options: SegOption<T>[];
    labelStyle?: TextStyle;
};

export function SegmentedControl<T extends string>({
    value, onChange, options, labelStyle,
}: SegmentedControlProps<T>) {
    const { theme } = useTheme();
    const palette = getEditorialPalette(theme);

    return (
        <View style={[styles.segShell, { backgroundColor: palette.surfaceMid }]}>
            {options.map((opt) => {
                const active = value === opt.key;
                return (
                    <TouchableOpacity
                        key={opt.key}
                        activeOpacity={0.8}
                        onPress={() => onChange(opt.key)}
                        style={[
                            styles.segPill,
                            active && [styles.segPillActive, { backgroundColor: palette.surface, ...cardShadow(theme) }],
                        ]}
                    >
                        <Text
                            style={[
                                T.labelBold,
                                { color: active ? palette.text : palette.textMuted },
                                labelStyle,
                            ]}
                            numberOfLines={1}
                        >
                            {opt.label}
                            {opt.count !== undefined ? ` ${opt.count}` : ""}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

// ---------------------------------------------------------------------------
// SearchField — pill-shaped search input
// ---------------------------------------------------------------------------
type SearchFieldProps = {
    value: string;
    onChangeText: (t: string) => void;
    placeholder?: string;
};

export function SearchField({ value, onChangeText, placeholder = "Szukaj..." }: SearchFieldProps) {
    const { theme } = useTheme();
    const palette = getEditorialPalette(theme);

    return (
        <View style={[styles.searchWrap, { backgroundColor: palette.surfaceMid }]}>
            <Ionicons name="search-outline" size={18} color={palette.textSoft} />
            <TextInput
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={palette.textSoft}
                style={[T.body, styles.searchInput, { color: palette.text }]}
                returnKeyType="search"
                clearButtonMode="while-editing"
            />
        </View>
    );
}

// ---------------------------------------------------------------------------
// Badge — pill label
// ---------------------------------------------------------------------------
type BadgeProps = {
    label: string;
    tone?: Tone;
};

export function Badge({ label, tone = "primary" }: BadgeProps) {
    const { theme } = useTheme();
    const palette = getEditorialPalette(theme);
    const colors = toneColors(tone, palette);

    return (
        <View style={[styles.badgePill, { backgroundColor: colors.bg }]}>
            <Text style={[T.meta, { color: colors.text }]}>{label}</Text>
        </View>
    );
}

// ---------------------------------------------------------------------------
// PrimaryButton
// ---------------------------------------------------------------------------
type PrimaryButtonProps = {
    label: string;
    onPress: () => void;
    icon?: keyof typeof Ionicons.glyphMap;
    tone?: Tone;
    disabled?: boolean;
};

export function PrimaryButton({ label, onPress, icon, tone = "primary", disabled }: PrimaryButtonProps) {
    const { theme } = useTheme();
    const palette = getEditorialPalette(theme);
    const colors = toneColors(tone, palette);

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={onPress}
            disabled={disabled}
            style={[styles.primaryBtn, { backgroundColor: colors.icon, opacity: disabled ? 0.5 : 1 }]}
        >
            {icon ? <Ionicons name={icon} size={18} color="#ffffff" style={{ marginRight: 6 }} /> : null}
            <Text style={[T.labelBold, { color: "#ffffff" }]}>{label}</Text>
        </TouchableOpacity>
    );
}

// ---------------------------------------------------------------------------
// EmptyPlaceholder
// ---------------------------------------------------------------------------
type EmptyPlaceholderProps = {
    title: string;
    subtitle?: string;
    icon?: keyof typeof Ionicons.glyphMap;
};

export function EmptyPlaceholder({ title, subtitle, icon = "file-tray-outline" }: EmptyPlaceholderProps) {
    const { theme } = useTheme();
    const palette = getEditorialPalette(theme);

    return (
        <View style={[styles.emptyWrap, { backgroundColor: palette.surfaceLow }]}>
            <View style={[styles.emptyIconWrap, { backgroundColor: palette.surfaceMid }]}>
                <Ionicons name={icon} size={28} color={palette.textSoft} />
            </View>
            <Text style={[T.title, { color: palette.text, textAlign: "center", marginTop: S[3] }]}>
                {title}
            </Text>
            {subtitle ? (
                <Text style={[T.label, { color: palette.textMuted, textAlign: "center", marginTop: 6 }]}>
                    {subtitle}
                </Text>
            ) : null}
        </View>
    );
}

// ---------------------------------------------------------------------------
// StyleSheet
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
    // SectionHeader
    sectionHeader: {
        paddingVertical: S[3],
        marginBottom: S[2],
    },
    sectionHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    sectionHeaderRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    metaBadge: {
        borderRadius: R.full,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    // StatCard
    statCard: {
        borderRadius: R.lg,
        padding: S[4],
    },
    statIcon: {
        width: 40,
        height: 40,
        borderRadius: R.md,
        alignItems: "center",
        justifyContent: "center",
    },
    // RowCard
    rowCard: {
        borderRadius: R.lg,
        paddingHorizontal: S[4],
        paddingVertical: S[3],
        flexDirection: "row",
        alignItems: "center",
        gap: S[3],
    },
    rowIcon: {
        width: 40,
        height: 40,
        borderRadius: R.md,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    rowContent: {
        flex: 1,
    },
    badge: {
        borderRadius: R.full,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    // SegmentedControl
    segShell: {
        borderRadius: R.md,
        flexDirection: "row",
        padding: 4,
        gap: 4,
    },
    segPill: {
        flex: 1,
        borderRadius: R.sm,
        paddingVertical: 8,
        paddingHorizontal: 6,
        alignItems: "center",
    },
    segPillActive: {
        borderRadius: R.sm,
    },
    // SearchField
    searchWrap: {
        borderRadius: R.full,
        paddingHorizontal: S[4],
        paddingVertical: S[2] + 2,
        flexDirection: "row",
        alignItems: "center",
        gap: S[2],
    },
    searchInput: {
        flex: 1,
        padding: 0,
        margin: 0,
    },
    // Badge
    badgePill: {
        borderRadius: R.full,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    // PrimaryButton
    primaryBtn: {
        borderRadius: R.full,
        height: 52,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        paddingHorizontal: S[6],
    },
    // EmptyPlaceholder
    emptyWrap: {
        borderRadius: R.lg,
        padding: S[8],
        alignItems: "center",
    },
    emptyIconWrap: {
        width: 56,
        height: 56,
        borderRadius: R.xl,
        alignItems: "center",
        justifyContent: "center",
    },
});

// ---------------------------------------------------------------------------
// Legacy aliases — keep existing imports working
// ---------------------------------------------------------------------------
export const EditorialPanel = ({
    children, style,
}: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => {
    const { theme } = useTheme();
    const palette = getEditorialPalette(theme);
    const shadow = cardShadow(theme);
    return (
        <View style={[{ backgroundColor: palette.surface, borderRadius: R.lg }, shadow, style]}>
            {children}
        </View>
    );
};

export const EditorialSectionHeader = SectionHeader;
export const EditorialStatCard = StatCard;
export const EditorialRowCard = RowCard;
export const EditorialSegmentedControl = SegmentedControl;
export const EditorialSearchField = SearchField;

export default function MobileBlocksRoute() { return null; }
