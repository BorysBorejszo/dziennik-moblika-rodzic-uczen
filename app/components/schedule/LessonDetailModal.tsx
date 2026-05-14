import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Lesson } from "../../api/schedule";
import { EditorialPalette, editorialType } from "../../theme/editorial";
import { subjectColor, subjectInitial } from "./scheduleHelpers";

type Props = {
    lesson: Lesson | null;
    palette: EditorialPalette;
    onClose: () => void;
};

export const LessonDetailModal: React.FC<Props> = ({ lesson, palette, onClose }) => (
    <Modal visible={lesson !== null} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="Zamknij">
            <Pressable style={[styles.sheet, { backgroundColor: palette.surface }]} onPress={() => {}}>
                {lesson ? (() => {
                    const isSub = Boolean(lesson.isSubstitute);
                    const bg = isSub ? palette.warning : subjectColor(lesson.subject);
                    const timeParts = lesson.time.split(/[-–]/).map((s) => s.trim()).filter(Boolean);
                    return (
                        <>
                            <View style={styles.handleBar} />
                            <View style={styles.headerRow}>
                                <View style={[styles.avatar, { backgroundColor: bg, width: 52, height: 52, borderRadius: 16 }]}>
                                    <Text style={[styles.avatarText, { fontSize: 22 }]}>
                                        {subjectInitial(lesson.subject)}
                                    </Text>
                                </View>
                                <View style={{ flex: 1, marginLeft: 14 }}>
                                    <Text style={[editorialType.eyebrow, { color: palette.textSoft }]}>Lekcja</Text>
                                    <Text style={[editorialType.headline, { color: palette.text, marginTop: 2 }]} numberOfLines={2}>
                                        {lesson.subject}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    onPress={onClose}
                                    style={[styles.closeBtn, { backgroundColor: palette.pageSection }]}
                                    accessibilityRole="button"
                                    accessibilityLabel="Zamknij szczegóły lekcji"
                                >
                                    <Ionicons name="close" size={20} color={palette.textMuted} />
                                </TouchableOpacity>
                            </View>
                            <View style={[styles.infoGrid, { backgroundColor: palette.pageSection }]}>
                                {timeParts.length > 0 ? (
                                    <View style={styles.infoRow}>
                                        <Ionicons name="time-outline" size={16} color={palette.textSoft} />
                                        <Text style={[editorialType.body, { color: palette.text, marginLeft: 10 }]}>
                                            {timeParts.join(" – ")}
                                        </Text>
                                    </View>
                                ) : null}
                                {lesson.teacher ? (
                                    <View style={styles.infoRow}>
                                        <Ionicons name="person-outline" size={16} color={palette.textSoft} />
                                        <Text style={[editorialType.body, { color: palette.text, marginLeft: 10 }]}>
                                            {lesson.teacher}
                                        </Text>
                                    </View>
                                ) : null}
                                {isSub && lesson.substituteTeacher ? (
                                    <View style={styles.infoRow}>
                                        <Ionicons name="swap-horizontal-outline" size={16} color={palette.warning} />
                                        <Text style={[editorialType.body, { color: palette.text, marginLeft: 10 }]}>
                                            Zastępstwo: {lesson.substituteTeacher}
                                        </Text>
                                    </View>
                                ) : null}
                                {lesson.room ? (
                                    <View style={styles.infoRow}>
                                        <Ionicons name="location-outline" size={16} color={palette.textSoft} />
                                        <Text style={[editorialType.body, { color: palette.text, marginLeft: 10 }]}>
                                            {lesson.room}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>
                        </>
                    );
                })() : null}
            </Pressable>
        </Pressable>
    </Modal>
);

const styles = StyleSheet.create({
    scrim: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
        justifyContent: "flex-end",
    },
    sheet: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 20,
        paddingBottom: 36,
    },
    handleBar: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: "rgba(128,128,128,0.3)",
        alignSelf: "center",
        marginBottom: 20,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "flex-start",
    },
    avatar: {
        alignItems: "center",
        justifyContent: "center",
    },
    avatarText: {
        color: "#ffffff",
        fontWeight: "800",
        letterSpacing: -0.5,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    infoGrid: {
        borderRadius: 16,
        padding: 16,
        marginTop: 16,
        gap: 12,
    },
    infoRow: {
        flexDirection: "row",
        alignItems: "center",
    },
});

export default function LessonDetailModalRoute() { return null; }
