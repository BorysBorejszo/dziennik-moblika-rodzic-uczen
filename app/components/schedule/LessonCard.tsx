import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CalendarEvent, CalendarEventKind } from "../../api/calendar";
import { Lesson } from "../../api/schedule";
import { EditorialPalette, editorialType, getEditorialShadow, ThemeMode } from "../../theme/editorial";
import { dotColorForKind, eventKindLabel, subjectColor, subjectInitial } from "./scheduleHelpers";

const eventKindIcon = (
    kind: CalendarEventKind
): React.ComponentProps<typeof Ionicons>["name"] => {
    switch (kind) {
        case "homework": return "book-outline";
        case "test": return "alert-circle-outline";
        case "kartkowka": return "pencil-outline";
        case "substitution": return "swap-horizontal-outline";
        default: return "megaphone-outline";
    }
};

type Props = {
    lesson: Lesson;
    index: number;
    nowStatus?: "now" | "next" | null;
    marginTopOverride?: number;
    matchedEvents?: CalendarEvent[];
    palette: EditorialPalette;
    theme: ThemeMode;
    onPress: () => void;
    onEventPress: (event: CalendarEvent) => void;
};

export const LessonCard: React.FC<Props> = ({
    lesson,
    index,
    nowStatus = null,
    marginTopOverride,
    matchedEvents,
    palette,
    theme,
    onPress,
    onEventPress,
}) => {
    const isSubstitute = Boolean(lesson.isSubstitute);
    const lessonNumber = index + 1;

    const timeParts = lesson.time.split(/[-–]/).map((s) => s.trim()).filter(Boolean);
    const startLabel = timeParts[0] ?? lesson.time;
    const endLabel = timeParts[1];

    const avatarBg = isSubstitute ? palette.warning : subjectColor(lesson.subject);
    const hasEvents = matchedEvents && matchedEvents.length > 0;
    const cardMargin = marginTopOverride ?? (index === 0 ? 0 : 10);

    if (hasEvents) {
        return (
            <View
                style={[
                    styles.card,
                    { backgroundColor: palette.surface, marginTop: cardMargin, flexDirection: "row" },
                    getEditorialShadow(theme),
                ]}
            >
                <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={onPress}
                    style={styles.splitLessonHalf}
                    accessibilityRole="button"
                    accessibilityLabel={`Lekcja ${lessonNumber}: ${lesson.subject}, ${startLabel}${endLabel ? ` – ${endLabel}` : ""}`}
                >
                    <View style={[styles.accent, { backgroundColor: avatarBg }]} />
                    <View style={styles.splitLessonInner}>
                        <View style={[styles.avatar, { backgroundColor: avatarBg, width: 38, height: 38, borderRadius: 12 }]}>
                            <Text style={[styles.avatarText, { fontSize: 16 }]}>
                                {subjectInitial(lesson.subject)}
                            </Text>
                        </View>
                        <View style={{ flex: 1, marginTop: 8 }}>
                            <Text style={[editorialType.eyebrow, { color: palette.textSoft }]}>
                                Lekcja {lessonNumber}
                            </Text>
                            <Text style={[editorialType.title, { color: palette.text, marginTop: 2 }]} numberOfLines={2}>
                                {lesson.subject}
                            </Text>
                            <Text style={[editorialType.meta, { color: palette.textMuted, marginTop: 2 }]} numberOfLines={1}>
                                {startLabel}{endLabel ? ` – ${endLabel}` : ""}
                            </Text>
                            {nowStatus === "now" ? (
                                <View style={[styles.statusPill, { backgroundColor: palette.danger, alignSelf: "flex-start", marginTop: 6 }]}>
                                    <Text style={[styles.statusPillText, { color: palette.onPrimary }]}>Trwa teraz</Text>
                                </View>
                            ) : nowStatus === "next" ? (
                                <View style={[styles.statusPill, { backgroundColor: palette.primary, alignSelf: "flex-start", marginTop: 6 }]}>
                                    <Text style={[styles.statusPillText, { color: palette.onPrimary }]}>Następna</Text>
                                </View>
                            ) : null}
                        </View>
                    </View>
                </TouchableOpacity>

                <View style={[styles.splitDivider, { backgroundColor: palette.outline }]} />

                <View style={styles.splitEventSide}>
                    {matchedEvents!.map((event) => {
                        const accent = dotColorForKind(event.kind, palette);
                        const iconBg =
                            event.kind === "test" ? palette.dangerSoft
                            : event.kind === "kartkowka" ? palette.warningSoft
                            : event.kind === "homework" ? palette.warningSoft
                            : palette.primaryFixed;
                        return (
                            <TouchableOpacity
                                key={`inline-ev-${event.id}`}
                                activeOpacity={0.75}
                                onPress={() => onEventPress(event)}
                                style={styles.splitEventItem}
                                accessibilityRole="button"
                                accessibilityLabel={`${eventKindLabel(event.kind)}: ${event.title}`}
                            >
                                <View style={[styles.splitEventIcon, { backgroundColor: iconBg }]}>
                                    <Ionicons name={eventKindIcon(event.kind)} size={15} color={accent} />
                                </View>
                                <View style={[styles.splitEventKindBadge, { backgroundColor: accent + "22", marginTop: 8 }]}>
                                    <Text style={[editorialType.meta, { color: accent }]}>
                                        {eventKindLabel(event.kind)}
                                    </Text>
                                </View>
                                <Text style={[editorialType.body, { color: palette.text, marginTop: 6 }]} numberOfLines={2}>
                                    {event.title}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        );
    }

    return (
        <View
            style={[
                styles.card,
                { backgroundColor: palette.surface, marginTop: cardMargin },
                getEditorialShadow(theme),
            ]}
        >
            <View style={[styles.accent, { backgroundColor: isSubstitute ? palette.warning : avatarBg }]} />
            <View style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
                    <Text style={styles.avatarText}>{subjectInitial(lesson.subject)}</Text>
                </View>

                <View style={{ flex: 1, paddingHorizontal: 14 }}>
                    <View style={styles.eyebrowRow}>
                        <Text style={[editorialType.eyebrow, { color: palette.textSoft }]}>
                            Lekcja {lessonNumber}
                        </Text>
                        {nowStatus === "now" ? (
                            <View style={[styles.statusPill, { backgroundColor: palette.danger }]}>
                                <Text style={[styles.statusPillText, { color: palette.onPrimary }]}>Trwa teraz</Text>
                            </View>
                        ) : nowStatus === "next" ? (
                            <View style={[styles.statusPill, { backgroundColor: palette.primary }]}>
                                <Text style={[styles.statusPillText, { color: palette.onPrimary }]}>Następna</Text>
                            </View>
                        ) : null}
                        {isSubstitute ? (
                            <View style={[styles.subBadge, { backgroundColor: palette.warningSoft }]}>
                                <Text style={[editorialType.meta, { color: palette.warningText }]}>Zastępstwo</Text>
                            </View>
                        ) : null}
                    </View>

                    <Text style={[editorialType.title, { color: palette.text, marginTop: 4 }]} numberOfLines={1}>
                        {lesson.subject}
                    </Text>

                    {isSubstitute ? (
                        <View style={{ marginTop: 4 }}>
                            <Text style={[editorialType.body, { color: palette.text, fontWeight: "600" }]} numberOfLines={1}>
                                {lesson.substituteTeacher}
                            </Text>
                            {lesson.originalTeacher ? (
                                <Text style={[editorialType.meta, { color: palette.textSoft, textDecorationLine: "line-through", marginTop: 2 }]} numberOfLines={1}>
                                    {lesson.originalTeacher}
                                </Text>
                            ) : null}
                        </View>
                    ) : (
                        <Text style={[editorialType.body, { color: palette.textMuted, marginTop: 2 }]} numberOfLines={1}>
                            {lesson.teacher}
                        </Text>
                    )}

                    {lesson.room ? (
                        <View style={styles.roomRow}>
                            <Ionicons name="location-outline" size={12} color={palette.textSoft} />
                            <Text style={[editorialType.meta, { color: palette.textSoft, marginLeft: 4 }]} numberOfLines={1}>
                                {lesson.room}
                            </Text>
                        </View>
                    ) : null}
                </View>

                <View style={styles.times}>
                    <Text style={[editorialType.title, { color: palette.text, fontSize: 16, letterSpacing: -0.1 }]}>
                        {startLabel}
                    </Text>
                    {endLabel ? (
                        <Text style={[editorialType.meta, { color: palette.textSoft, marginTop: 4 }]}>
                            {endLabel}
                        </Text>
                    ) : null}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: 18,
        overflow: "hidden",
        position: "relative",
        alignItems: "stretch",
    },
    accent: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 14,
        paddingLeft: 18,
    },
    avatar: {
        width: 46,
        height: 46,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarText: {
        color: "#ffffff",
        fontSize: 20,
        fontWeight: "800",
        letterSpacing: -0.5,
    },
    eyebrowRow: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 6,
    },
    statusPill: {
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    statusPillText: {
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 0.4,
        textTransform: "uppercase",
    },
    subBadge: {
        marginLeft: 10,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    roomRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 6,
    },
    times: {
        alignItems: "flex-end",
        minWidth: 56,
    },
    splitLessonHalf: {
        flex: 1,
        position: "relative",
    },
    splitLessonInner: {
        paddingVertical: 14,
        paddingLeft: 18,
        paddingRight: 12,
    },
    splitDivider: {
        width: StyleSheet.hairlineWidth,
        marginVertical: 12,
    },
    splitEventSide: {
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 12,
        justifyContent: "center",
    },
    splitEventItem: {
        flex: 1,
    },
    splitEventIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    splitEventKindBadge: {
        alignSelf: "flex-start",
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
});

export default function LessonCardRoute() { return null; }
