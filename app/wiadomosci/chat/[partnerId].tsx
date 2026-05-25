import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  createMessage,
  getInboxMessages,
  getSentMessages,
  MessageRecord,
  updateMessage,
} from "../../api/messages";
import { useUser } from "../../context/UserContext";
import { useConversationSocket } from "../../hooks/useConversationSocket";
import { R, S, T, getEditorialPalette } from "../../theme/editorial";
import { useTheme } from "../../theme/ThemeContext";

function formatBubbleTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("pl-PL", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function ChatScreen() {
  const { partnerId, name, subject: subjectParam } = useLocalSearchParams<{
    partnerId: string; name?: string; subject?: string;
  }>();
  const router = useRouter();
  const { user } = useUser();
  const { theme } = useTheme();
  const palette = getEditorialPalette(theme);

  const myId = user?.id ?? null;
  const partnerIdNum = partnerId ? Number(partnerId) : null;
  const partnerName = name ? decodeURIComponent(name) : `Użytkownik ${partnerId}`;
  const subject = subjectParam ? decodeURIComponent(subjectParam) : "";

  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList<MessageRecord>>(null);

  const { lastMessage, sendMessage } = useConversationSocket(myId, partnerIdNum);

  const loadMessages = useCallback(async () => {
    if (!myId || !partnerIdNum) return;
    const [inboxData, sentData] = await Promise.all([
      getInboxMessages(myId),
      getSentMessages(myId),
    ]);
    const seen = new Set<number>();
    const all: MessageRecord[] = [];
    for (const msg of [...inboxData, ...sentData]) {
      if (!seen.has(msg.id)) { seen.add(msg.id); all.push(msg); }
    }
    const filtered = all
      .filter((m) => m.nadawca_id === partnerIdNum || m.odbiorca_id === partnerIdNum)
      .sort((a, b) => new Date(a.data_wyslania).getTime() - new Date(b.data_wyslania).getTime());
    for (const m of filtered) {
      if (m.nadawca_id === partnerIdNum && !m.przeczytana) {
        updateMessage(m.id, { przeczytana: true }).catch(() => {});
      }
    }
    setMessages(filtered);
  }, [myId, partnerIdNum]);

  useEffect(() => { void loadMessages(); }, [loadMessages]);

  useEffect(() => {
    if (!lastMessage || !myId || !partnerIdNum) return;
    if (lastMessage.sender_id === myId) return;
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        nadawca_id: lastMessage.sender_id,
        nadawca_username: partnerName,
        odbiorca_id: myId,
        odbiorca_username: user?.name,
        temat: subject || "Chat",
        tresc: lastMessage.message,
        data_wyslania: lastMessage.timestamp ?? new Date().toISOString(),
        przeczytana: false,
      },
    ]);
  }, [lastMessage, myId, partnerIdNum, partnerName, subject, user?.name]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !myId || !partnerIdNum || sending) return;
    setInputText("");
    setSending(true);
    const optimistic: MessageRecord = {
      id: Date.now(),
      nadawca_id: myId,
      nadawca_username: user?.name,
      odbiorca_id: partnerIdNum,
      odbiorca_username: partnerName,
      temat: subject || "Chat",
      tresc: text,
      data_wyslania: new Date().toISOString(),
      przeczytana: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    sendMessage(text);
    await createMessage({
      nadawca_id: myId,
      odbiorca_id: partnerIdNum,
      temat: subject || "Chat",
      tresc: text,
    });
    setSending(false);
    flatListRef.current?.scrollToEnd({ animated: true });
  };

  const avatarChar = partnerName ? partnerName[0].toUpperCase() : "?";

  const renderMessage = ({ item, index }: { item: MessageRecord; index: number }) => {
    const isMe = item.nadawca_id === myId;
    const showSubjectChip = index === 0 && item.temat;

    return (
      <>
        {showSubjectChip ? (
          <View style={styles.subjectChipRow}>
            <View style={[styles.subjectChip, { backgroundColor: palette.surfaceMid }]}>
              <Text style={[T.meta, { color: palette.textSoft, fontWeight: "600" }]}>
                {item.temat}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={[styles.bubbleWrapper, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
          {!isMe && (
            <View style={[styles.avatarMini, { backgroundColor: palette.primaryFixed }]}>
              <Text style={[T.meta, { color: palette.infoText, fontWeight: "700" }]}>
                {avatarChar}
              </Text>
            </View>
          )}
          <View style={styles.bubbleColumn}>
            <View
              style={[
                styles.bubble,
                {
                  backgroundColor: isMe ? palette.primary : palette.surface,
                  borderBottomRightRadius: isMe ? R.xs : R.lg,
                  borderBottomLeftRadius: isMe ? R.lg : R.xs,
                },
              ]}
            >
              <Text style={[T.body, { color: isMe ? palette.onPrimary : palette.text }]}>
                {item.tresc}
              </Text>
            </View>
            <Text
              style={[
                T.meta,
                styles.bubbleTime,
                { color: palette.textSoft },
                isMe ? { textAlign: "right" } : { textAlign: "left" },
              ]}
            >
              {formatBubbleTime(item.data_wyslania)}
            </Text>
          </View>
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: palette.surface, borderBottomColor: palette.outline }]}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/messages')} style={styles.backBtn} accessibilityRole="button">
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <View style={[styles.avatarSmall, { backgroundColor: palette.primary }]}>
          <Text style={[T.title, { color: palette.onPrimary }]}>{avatarChar}</Text>
        </View>
        <View style={styles.headerTitle}>
          <Text style={[T.bodyMedium, { color: palette.text, fontWeight: "700" }]} numberOfLines={1}>
            {partnerName}
          </Text>
          {subject ? (
            <Text style={[T.meta, { color: palette.primary, fontWeight: "500" }]} numberOfLines={1}>
              {subject}
            </Text>
          ) : null}
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, idx) => `${item.id}-${idx}`}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Reply input */}
        <View style={[styles.inputBar, { backgroundColor: palette.surface, borderTopColor: palette.outline }]}>
          <TextInput
            style={[styles.textInput, { backgroundColor: palette.inputSurface, color: palette.text }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Napisz odpowiedź..."
            placeholderTextColor={palette.textSoft}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            style={[
              styles.sendBtn,
              { backgroundColor: palette.primary, opacity: !inputText.trim() || sending ? 0.4 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Wyślij"
          >
            <Ionicons name="send" size={18} color={palette.onPrimary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: S[4],
    paddingVertical: S[3],
    borderBottomWidth: 1,
    gap: S[3],
  },
  backBtn: { padding: S[1] },
  avatarSmall: {
    width: 40, height: 40, borderRadius: R.full,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { flex: 1 },
  subjectChipRow: { alignItems: "center", marginVertical: S[4] },
  subjectChip: {
    borderRadius: R.full, paddingHorizontal: S[4], paddingVertical: S[2],
  },
  listContent: { paddingHorizontal: S[3], paddingVertical: S[3] },
  bubbleWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: S[2],
    maxWidth: "80%",
  },
  bubbleLeft: { alignSelf: "flex-start" },
  bubbleRight: { alignSelf: "flex-end", flexDirection: "row-reverse" },
  avatarMini: {
    width: 28, height: 28, borderRadius: R.full,
    alignItems: "center", justifyContent: "center",
    marginRight: S[2], flexShrink: 0,
  },
  bubbleColumn: { flexShrink: 1 },
  bubble: {
    borderRadius: R.lg,
    paddingHorizontal: S[3],
    paddingVertical: S[2],
  },
  bubbleTime: { marginTop: 3, marginHorizontal: S[1] },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: S[3],
    paddingVertical: S[2],
    borderTopWidth: 1,
    gap: S[2],
  },
  textInput: {
    flex: 1, borderRadius: R.lg,
    paddingHorizontal: S[3], paddingVertical: S[2],
    fontSize: 15, maxHeight: 120, minHeight: 40,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: R.full,
    alignItems: "center", justifyContent: "center",
    marginBottom: 2,
  },
});
