import Ionicons from "@expo/vector-icons/Ionicons";
import * as DocumentPicker from "expo-document-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import {
    getCompletedHomeworkIds,
    getHomeworkForClass,
    getMySubmissions,
    HomeworkItem,
    setHomeworkCompleted,
    Submission,
    submitHomework,
} from "./api/homework";
import { AppSidebar } from "./components/app-sidebar";
import { EditorialSectionHeader } from "./components/editorial/MobileBlocks";
import Header from "./components/Header";
import SafeView from "./components/SafeView";
import Card from "./components/ui/Card";
import EmptyState from "./components/ui/EmptyState";
import { useUser } from "./context/UserContext";
import {
    EditorialPalette,
    editorialType,
    getEditorialPalette,
    getEditorialShadow,
} from "./theme/editorial";
import { useTheme } from "./theme/ThemeContext";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const startOfDay = (d: Date): Date => {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
};

const formatDueDate = (iso: string): string => {
    if (!iso) return "Brak terminu";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "Brak terminu";
    return date.toLocaleDateString("pl-PL", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
};

type DueTone = { label: string; soft: string; text: string };

const getDueTone = (iso: string, palette: EditorialPalette): DueTone => {
    if (!iso) return { label: "Bez terminu", soft: palette.surfaceMuted, text: palette.textMuted };
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return { label: "Bez terminu", soft: palette.surfaceMuted, text: palette.textMuted };
    const now = startOfDay(new Date());
    const due = startOfDay(date);
    const diffDays = Math.round((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays < 0) return { label: `Zaległe (${Math.abs(diffDays)} dni)`, soft: palette.dangerSoft, text: palette.dangerText };
    if (diffDays === 0) return { label: "Na dzis", soft: palette.warningSoft, text: palette.warningText };
    if (diffDays === 1) return { label: "Jutro", soft: palette.warningSoft, text: palette.warningText };
    if (diffDays <= 7) return { label: `Za ${diffDays} dni`, soft: palette.infoSoft, text: palette.infoText };
    return { label: `Za ${diffDays} dni`, soft: palette.successSoft, text: palette.successText };
};

type SortMode = "due_asc" | "due_desc" | "overdue" | "subject";

const sortByDueAsc = (a: HomeworkItem, b: HomeworkItem): number => {
    const ta = a.due ? new Date(a.due).getTime() : Infinity;
    const tb = b.due ? new Date(b.due).getTime() : Infinity;
    return ta - tb;
};

const sortByDueDesc = (a: HomeworkItem, b: HomeworkItem): number =>
    sortByDueAsc(b, a);

const sortByIssuedDesc = (a: HomeworkItem, b: HomeworkItem): number => {
    const ta = a.issued ? new Date(a.issued).getTime() : 0;
    const tb = b.issued ? new Date(b.issued).getTime() : 0;
    return tb - ta;
};

const sortBySubject = (a: HomeworkItem, b: HomeworkItem): number =>
    a.subject.localeCompare(b.subject, "pl");

const sortByOverdueThenDue = (a: HomeworkItem, b: HomeworkItem): number => {
    const now = Date.now();
    const ta = a.due ? new Date(a.due).getTime() : Infinity;
    const tb = b.due ? new Date(b.due).getTime() : Infinity;
    const aOverdue = ta < now ? 0 : 1;
    const bOverdue = tb < now ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    return ta - tb;
};

const statusLabel = (status: Submission["status"]) => {
    switch (status) {
        case "sprawdzone": return "Sprawdzone";
        case "odrzucone": return "Odrzucone";
        default: return "Oddane";
    }
};
const statusSoft = (status: Submission["status"], palette: EditorialPalette) => {
    switch (status) {
        case "sprawdzone": return palette.successSoft;
        case "odrzucone": return palette.dangerSoft;
        default: return palette.infoSoft;
    }
};
const statusText = (status: Submission["status"], palette: EditorialPalette) => {
    switch (status) {
        case "sprawdzone": return palette.successText;
        case "odrzucone": return palette.dangerText;
        default: return palette.infoText;
    }
};

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

type HomeworkRowProps = {
    item: HomeworkItem;
    palette: EditorialPalette;
    completed: boolean;
    submission?: Submission;
    onToggle: (item: HomeworkItem) => void;
    onOpen: (item: HomeworkItem) => void;
};

function HomeworkRow({ item, palette, completed, submission, onToggle, onOpen }: HomeworkRowProps) {
    const dueTone = getDueTone(item.due, palette);

    return (
        <Card style={{ marginTop: 12 }}>
            <View style={styles.rowInner}>
                <Pressable
                    onPress={() => onToggle(item)}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    style={[
                        styles.checkbox,
                        completed || submission?.status === "sprawdzone"
                            ? { backgroundColor: palette.success, borderColor: palette.success }
                            : { backgroundColor: "transparent", borderColor: palette.outline },
                    ]}
                >
                    {(completed || submission?.status === "sprawdzone") ? (
                        <Ionicons name="checkmark" size={18} color={palette.onPrimary} />
                    ) : null}
                </Pressable>

                <Pressable style={{ flex: 1, paddingRight: 12 }} onPress={() => onOpen(item)}>
                    <Text
                        style={[
                            editorialType.title,
                            { color: completed ? palette.textSoft : palette.text, textDecorationLine: completed ? "line-through" : "none" },
                        ]}
                        numberOfLines={1}
                    >
                        {item.subject}
                    </Text>
                    {item.description ? (
                        <Text
                            style={[editorialType.body, { color: palette.textMuted, marginTop: 6, textDecorationLine: completed ? "line-through" : "none" }]}
                            numberOfLines={3}
                        >
                            {item.description}
                        </Text>
                    ) : null}
                    <View style={styles.metaRow}>
                        <Ionicons name="calendar-outline" size={14} color={palette.textSoft} />
                        <Text style={[editorialType.meta, { color: palette.textSoft, marginLeft: 6 }]}>
                            {formatDueDate(item.due)}
                        </Text>
                    </View>
                    {item.teacher ? (
                        <View style={styles.metaRow}>
                            <Ionicons name="person-outline" size={14} color={palette.textSoft} />
                            <Text style={[editorialType.meta, { color: palette.textSoft, marginLeft: 6 }]} numberOfLines={1}>
                                {item.teacher}
                            </Text>
                        </View>
                    ) : null}
                </Pressable>

                <Pressable style={{ alignItems: "flex-end", gap: 8 }} onPress={() => onOpen(item)}>
                    {submission ? (
                        <View style={[styles.dueBadge, { backgroundColor: statusSoft(submission.status, palette) }]}>
                            <Text style={[editorialType.meta, { color: statusText(submission.status, palette) }]}>
                                {statusLabel(submission.status)}
                            </Text>
                        </View>
                    ) : completed ? (
                        <View style={[styles.dueBadge, { backgroundColor: palette.successSoft }]}>
                            <Text style={[editorialType.meta, { color: palette.successText }]}>Zrobione</Text>
                        </View>
                    ) : (
                        <View style={[styles.dueBadge, { backgroundColor: dueTone.soft }]}>
                            <Text style={[editorialType.meta, { color: dueTone.text }]}>{dueTone.label}</Text>
                        </View>
                    )}
                    <View style={[styles.openHint, { backgroundColor: palette.pageSection }]}>
                        <Ionicons name="chevron-forward" size={14} color={palette.textSoft} />
                    </View>
                </Pressable>
            </View>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Submission modal
// ---------------------------------------------------------------------------

type SubmitModalProps = {
    item: HomeworkItem | null;
    existing?: Submission;
    palette: EditorialPalette;
    theme: "light" | "dark";
    onClose: () => void;
    onSubmitted: (sub: Submission) => void;
};

function SubmitModal({ item, existing, palette, theme, onClose, onSubmitted }: SubmitModalProps) {
    const [tresc, setTresc] = useState(existing?.tresc ?? "");
    const [komentarz, setKomentarz] = useState(existing?.komentarz ?? "");
    const [file, setFile] = useState<{ name: string; uri: string; mimeType?: string } | null>(null);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (item) {
            setTresc(existing?.tresc ?? "");
            setKomentarz(existing?.komentarz ?? "");
            setFile(null);
        }
    }, [item?.id]);

    const pickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: "*/*",
                copyToCacheDirectory: true,
            });
            if (!result.canceled && result.assets?.[0]) {
                const asset = result.assets[0];
                setFile({ name: asset.name, uri: asset.uri, mimeType: asset.mimeType ?? undefined });
            }
        } catch {
            Alert.alert("Błąd", "Nie udało się wybrać pliku.");
        }
    };

    const handleSend = async () => {
        if (!item) return;
        if (!tresc.trim()) {
            Alert.alert("Brak treści", "Wpisz treść odpowiedzi.");
            return;
        }
        setSending(true);
        try {
            const result = await submitHomework({
                homework: item.id,
                tresc: tresc.trim(),
                komentarz: komentarz.trim() || undefined,
                file: file ?? null,
            });
            if (result) {
                onSubmitted(result);
                Alert.alert("Wysłano", "Praca domowa została oddana.");
            } else {
                Alert.alert("Błąd", "Nie udało się oddać pracy. Spróbuj ponownie.");
            }
        } finally {
            setSending(false);
        }
    };

    const isAlreadyChecked = existing?.status === "sprawdzone";
    const inputBg = theme === "dark" ? "#1a1a1a" : "#f5f5f5";
    const borderColor = theme === "dark" ? "#333" : "#e0e0e0";

    return (
        <Modal visible={item !== null} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.scrim} onPress={onClose}>
                <Pressable style={[styles.sheet, { backgroundColor: palette.surface }]} onPress={() => {}}>
                    <View style={styles.handleBar} />

                    {/* Header */}
                    <View style={styles.sheetHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={[editorialType.eyebrow, { color: palette.textSoft }]}>
                                {item?.subject ?? ""}
                            </Text>
                            <Text style={[editorialType.headline, { color: palette.text, marginTop: 4 }]} numberOfLines={2}>
                                {item?.description ? item.description.slice(0, 80) + (item.description.length > 80 ? "…" : "") : "Praca domowa"}
                            </Text>
                            {item?.due ? (
                                <View style={[styles.metaRow, { marginTop: 8 }]}>
                                    <Ionicons name="calendar-outline" size={14} color={palette.textSoft} />
                                    <Text style={[editorialType.meta, { color: palette.textSoft, marginLeft: 6 }]}>
                                        Termin: {formatDueDate(item.due)}
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                        <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: palette.pageSection }]}>
                            <Ionicons name="close" size={20} color={palette.textMuted} />
                        </TouchableOpacity>
                    </View>

                    {/* Existing submission status */}
                    {existing ? (
                        <View style={[styles.statusCard, { backgroundColor: statusSoft(existing.status, palette) }]}>
                            <Ionicons
                                name={existing.status === "sprawdzone" ? "checkmark-circle" : existing.status === "odrzucone" ? "close-circle" : "time"}
                                size={18}
                                color={statusText(existing.status, palette)}
                            />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={[editorialType.title, { color: statusText(existing.status, palette) }]}>
                                    {statusLabel(existing.status)}
                                </Text>
                                {existing.ocena ? (
                                    <Text style={[editorialType.meta, { color: statusText(existing.status, palette), marginTop: 2 }]}>
                                        Ocena: {existing.ocena}
                                    </Text>
                                ) : null}
                                {existing.komentarz ? (
                                    <Text style={[editorialType.meta, { color: statusText(existing.status, palette), marginTop: 2 }]}>
                                        {existing.komentarz}
                                    </Text>
                                ) : null}
                            </View>
                        </View>
                    ) : null}

                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {!isAlreadyChecked ? (
                            <>
                                {/* Treść */}
                                <View style={{ marginTop: 20 }}>
                                    <Text style={[editorialType.eyebrow, { color: palette.textSoft, marginBottom: 8 }]}>
                                        TREŚĆ ODPOWIEDZI
                                    </Text>
                                    <TextInput
                                        style={[styles.textArea, { backgroundColor: inputBg, borderColor, color: palette.text }]}
                                        placeholder="Wpisz swoją odpowiedź..."
                                        placeholderTextColor={palette.textSoft}
                                        value={tresc}
                                        onChangeText={setTresc}
                                        multiline
                                        numberOfLines={5}
                                        textAlignVertical="top"
                                    />
                                </View>

                                {/* Załącznik */}
                                <View style={{ marginTop: 20 }}>
                                    <Text style={[editorialType.eyebrow, { color: palette.textSoft, marginBottom: 8 }]}>
                                        ZAŁĄCZNIK (opcjonalnie)
                                    </Text>
                                    <TouchableOpacity
                                        onPress={pickFile}
                                        activeOpacity={0.8}
                                        style={[styles.fileBtn, { backgroundColor: inputBg, borderColor }]}
                                    >
                                        <Ionicons
                                            name={file ? "document-attach" : "attach-outline"}
                                            size={20}
                                            color={file ? palette.primary : palette.textSoft}
                                        />
                                        <Text
                                            style={[editorialType.body, { marginLeft: 10, flex: 1, color: file ? palette.primary : palette.textSoft }]}
                                            numberOfLines={1}
                                        >
                                            {file ? file.name : "Wybierz plik (PDF, DOCX, JPG — max 25 MB)"}
                                        </Text>
                                        {file ? (
                                            <TouchableOpacity onPress={() => setFile(null)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                                                <Ionicons name="close-circle" size={18} color={palette.textSoft} />
                                            </TouchableOpacity>
                                        ) : null}
                                    </TouchableOpacity>
                                </View>

                                {/* Komentarz */}
                                <View style={{ marginTop: 20 }}>
                                    <Text style={[editorialType.eyebrow, { color: palette.textSoft, marginBottom: 8 }]}>
                                        KOMENTARZ (opcjonalnie)
                                    </Text>
                                    <TextInput
                                        style={[styles.textArea, { backgroundColor: inputBg, borderColor, color: palette.text, minHeight: 80 }]}
                                        placeholder="Dodatkowy komentarz do nauczyciela..."
                                        placeholderTextColor={palette.textSoft}
                                        value={komentarz}
                                        onChangeText={setKomentarz}
                                        multiline
                                        numberOfLines={3}
                                        textAlignVertical="top"
                                    />
                                </View>

                                {/* Send button */}
                                <TouchableOpacity
                                    onPress={handleSend}
                                    disabled={sending}
                                    activeOpacity={0.85}
                                    style={[styles.sendBtn, { backgroundColor: palette.primary, opacity: sending ? 0.7 : 1 }]}
                                >
                                    {sending ? (
                                        <ActivityIndicator color={palette.onPrimary} />
                                    ) : (
                                        <>
                                            <Ionicons name="send" size={18} color={palette.onPrimary} />
                                            <Text style={[editorialType.title, { color: palette.onPrimary, marginLeft: 10 }]}>
                                                Oddaj pracę
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </>
                        ) : (
                            <View style={{ marginTop: 20, alignItems: "center" }}>
                                <Ionicons name="checkmark-circle" size={48} color={palette.success} />
                                <Text style={[editorialType.title, { color: palette.text, marginTop: 12 }]}>
                                    Praca sprawdzona
                                </Text>
                                <Text style={[editorialType.body, { color: palette.textMuted, marginTop: 8, textAlign: "center" }]}>
                                    Nauczyciel zaakceptował Twoją pracę.
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HomeworkPage() {
    const { theme } = useTheme();
    const { user } = useUser();
    const palette = getEditorialPalette(theme);

    const [items, setItems] = useState<HomeworkItem[]>([]);
    const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());
    const [submissions, setSubmissions] = useState<Map<number, Submission>>(new Map());
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeItem, setActiveItem] = useState<HomeworkItem | null>(null);
    const [sortMode, setSortMode] = useState<SortMode>("due_asc");
    const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());

    const dateLabel = useMemo(
        () => new Date().toLocaleDateString("pl-PL", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
        []
    );

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const classId = user?.classId ?? null;
            const [list, doneIds, subs] = await Promise.all([
                getHomeworkForClass(classId),
                getCompletedHomeworkIds(),
                getMySubmissions(),
            ]);
            setItems(list);
            setCompletedIds(doneIds);
            const subsMap = new Map<number, Submission>();
            for (const s of subs) subsMap.set(s.homework, s);
            setSubmissions(subsMap);
        } catch (error) {
            console.error("[homework] load failed:", error);
            setItems([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?.classId]);

    useEffect(() => { void load(); }, [load]);

    const toggleCompleted = useCallback(async (item: HomeworkItem) => {
        const isDone = completedIds.has(item.id);
        const next = new Set(completedIds);
        if (isDone) next.delete(item.id);
        else next.add(item.id);
        setCompletedIds(next);
        try {
            await setHomeworkCompleted(item.id, !isDone);
        } catch {}
    }, [completedIds]);

    const handleSubmitted = useCallback((sub: Submission) => {
        setSubmissions((prev) => new Map(prev).set(sub.homework, sub));
        setActiveItem(null);
    }, []);

    const { todoItems, doneItems } = useMemo(() => {
        const todo: HomeworkItem[] = [];
        const done: HomeworkItem[] = [];
        for (const item of items) {
            if (completedIds.has(item.id)) done.push(item);
            else todo.push(item);
        }
        const sorter =
            sortMode === "due_desc" ? sortByDueDesc :
            sortMode === "overdue" ? sortByOverdueThenDue :
            sortMode === "subject" ? sortBySubject :
            sortByDueAsc;
        todo.sort(sorter);
        done.sort(sortByIssuedDesc);
        return { todoItems: todo, doneItems: done };
    }, [items, completedIds, sortMode]);

    const groupedBySubject = useMemo(() => {
        if (sortMode !== "subject") return null;
        const map = new Map<string, HomeworkItem[]>();
        for (const item of todoItems) {
            const arr = map.get(item.subject) ?? [];
            arr.push(item);
            map.set(item.subject, arr);
        }
        return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, "pl"));
    }, [todoItems, sortMode]);

    const toggleSubject = useCallback((subject: string) => {
        setExpandedSubjects(prev => {
            const next = new Set(prev);
            if (next.has(subject)) next.delete(subject);
            else next.add(subject);
            return next;
        });
    }, []);

    return (
        <SafeView edges={["top"]} style={{ flex: 1, backgroundColor: palette.background }}>
            <AppSidebar />
            <ScrollView
                stickyHeaderIndices={[0]}
                style={{ flex: 1, backgroundColor: palette.background }}
                contentContainerStyle={{ paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); void load(); }}
                        tintColor={palette.primary}
                    />
                }
            >
                <Header title="Prace domowe" subtitle={dateLabel} />

                <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                    {/* Sort bar */}
                    <View style={styles.sortBar}>
                        {/* Termin — dwie opcje asc/desc */}
                        <Pressable
                            onPress={() => setSortMode(prev => prev === "due_asc" ? "due_desc" : "due_asc")}
                            style={[
                                styles.sortPill,
                                (sortMode === "due_asc" || sortMode === "due_desc")
                                    ? { backgroundColor: palette.primary }
                                    : { backgroundColor: palette.pageSection },
                            ]}
                        >
                            <Ionicons
                                name="calendar-outline"
                                size={13}
                                color={(sortMode === "due_asc" || sortMode === "due_desc") ? palette.onPrimary : palette.textSoft}
                            />
                            <Text style={[editorialType.meta, { marginLeft: 5, color: (sortMode === "due_asc" || sortMode === "due_desc") ? palette.onPrimary : palette.textSoft }]}>
                                Termin
                            </Text>
                            {(sortMode === "due_asc" || sortMode === "due_desc") && (
                                <Ionicons
                                    name={sortMode === "due_asc" ? "arrow-up" : "arrow-down"}
                                    size={11}
                                    color={palette.onPrimary}
                                    style={{ marginLeft: 3 }}
                                />
                            )}
                        </Pressable>

                        {/* Zaległe */}
                        <Pressable
                            onPress={() => setSortMode("overdue")}
                            style={[styles.sortPill, sortMode === "overdue" ? { backgroundColor: palette.primary } : { backgroundColor: palette.pageSection }]}
                        >
                            <Ionicons name="alert-circle-outline" size={13} color={sortMode === "overdue" ? palette.onPrimary : palette.textSoft} />
                            <Text style={[editorialType.meta, { marginLeft: 5, color: sortMode === "overdue" ? palette.onPrimary : palette.textSoft }]}>Zaległe</Text>
                        </Pressable>

                        {/* Przedmiot */}
                        <Pressable
                            onPress={() => setSortMode("subject")}
                            style={[styles.sortPill, sortMode === "subject" ? { backgroundColor: palette.primary } : { backgroundColor: palette.pageSection }]}
                        >
                            <Ionicons name="book-outline" size={13} color={sortMode === "subject" ? palette.onPrimary : palette.textSoft} />
                            <Text style={[editorialType.meta, { marginLeft: 5, color: sortMode === "subject" ? palette.onPrimary : palette.textSoft }]}>Przedmiot</Text>
                        </Pressable>
                    </View>

                    <View style={{ marginTop: 4 }}>
                        <EditorialSectionHeader eyebrow="Do zrobienia" title="Zadania w toku" />
                        {todoItems.length === 0 ? (
                            <View style={{ marginTop: 4 }}>
                                <EmptyState
                                    title={loading ? "Ladowanie zadan" : "Brak zadan do zrobienia"}
                                    subtitle={loading ? "Pobieram prace domowe." : "Wszystko na biezaco. Nowe wpisy pojawia sie tutaj automatycznie."}
                                />
                            </View>
                        ) : sortMode === "subject" && groupedBySubject ? (
                            groupedBySubject.map(([subject, subjectItems]) => {
                                const expanded = expandedSubjects.has(subject);
                                return (
                                    <View key={subject} style={{ marginTop: 8 }}>
                                        <Pressable
                                            onPress={() => toggleSubject(subject)}
                                            style={[styles.subjectHeader, { backgroundColor: palette.pageSection }]}
                                        >
                                            <View style={[styles.subjectDot, { backgroundColor: palette.primary }]} />
                                            <Text style={[editorialType.title, { flex: 1, color: palette.text }]}>
                                                {subject}
                                            </Text>
                                            <View style={[styles.subjectCount, { backgroundColor: palette.surfaceMuted }]}>
                                                <Text style={[editorialType.meta, { color: palette.textSoft }]}>
                                                    {subjectItems.length}
                                                </Text>
                                            </View>
                                            <Ionicons
                                                name={expanded ? "chevron-up" : "chevron-down"}
                                                size={16}
                                                color={palette.textSoft}
                                                style={{ marginLeft: 8 }}
                                            />
                                        </Pressable>
                                        {expanded && subjectItems.map((item) => (
                                            <HomeworkRow
                                                key={item.id}
                                                item={item}
                                                palette={palette}
                                                completed={false}
                                                submission={submissions.get(item.id)}
                                                onToggle={toggleCompleted}
                                                onOpen={setActiveItem}
                                            />
                                        ))}
                                    </View>
                                );
                            })
                        ) : (
                            todoItems.map((item, index) => (
                                <View key={`todo-${item.id}`} style={{ marginTop: index === 0 ? -12 : 0 }}>
                                    <HomeworkRow
                                        item={item}
                                        palette={palette}
                                        completed={false}
                                        submission={submissions.get(item.id)}
                                        onToggle={toggleCompleted}
                                        onOpen={setActiveItem}
                                    />
                                </View>
                            ))
                        )}
                    </View>

                    <View style={{ marginTop: 30 }}>
                        <EditorialSectionHeader eyebrow="Zrobione" title="Ukonczone" />
                        {doneItems.length > 0 ? (
                            doneItems.map((item, index) => (
                                <View key={`done-${item.id}`} style={{ marginTop: index === 0 ? -12 : 0 }}>
                                    <HomeworkRow
                                        item={item}
                                        palette={palette}
                                        completed
                                        submission={submissions.get(item.id)}
                                        onToggle={toggleCompleted}
                                        onOpen={setActiveItem}
                                    />
                                </View>
                            ))
                        ) : (
                            <View style={{ marginTop: 4 }}>
                                <EmptyState
                                    title="Brak ukonczonych zadan"
                                    subtitle="Odznaczone zadania pojawia sie w tej sekcji."
                                />
                            </View>
                        )}
                    </View>
                </View>
            </ScrollView>

            <SubmitModal
                item={activeItem}
                existing={activeItem ? submissions.get(activeItem.id) : undefined}
                palette={palette}
                theme={theme}
                onClose={() => setActiveItem(null)}
                onSubmitted={handleSubmitted}
            />
        </SafeView>
    );
}

const styles = StyleSheet.create({
    sortBar: {
        flexDirection: "row",
        gap: 8,
        marginBottom: 12,
        marginTop: 8,
        flexWrap: "wrap",
    },
    sortPill: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
    },
    subjectHeader: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 10,
    },
    subjectDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    subjectCount: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    rowInner: {
        flexDirection: "row",
        alignItems: "flex-start",
        paddingHorizontal: 18,
        paddingVertical: 18,
    },
    checkbox: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
        marginTop: 2,
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 8,
    },
    dueBadge: {
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
        alignSelf: "flex-start",
    },
    openHint: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
    },
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
        height: "85%",
    },
    handleBar: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: "rgba(128,128,128,0.3)",
        alignSelf: "center",
        marginBottom: 20,
    },
    sheetHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    statusCard: {
        flexDirection: "row",
        alignItems: "flex-start",
        borderRadius: 16,
        padding: 14,
        marginTop: 16,
    },
    textArea: {
        borderRadius: 14,
        borderWidth: 1,
        padding: 14,
        fontSize: 15,
        lineHeight: 22,
        minHeight: 120,
    },
    fileBtn: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 14,
        borderWidth: 1,
        borderStyle: "dashed",
        padding: 14,
        gap: 0,
    },
    sendBtn: {
        marginTop: 24,
        height: 56,
        borderRadius: 999,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
});
