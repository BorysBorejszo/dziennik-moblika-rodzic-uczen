import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import * as React from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getCurrentDjangoUserId, getDjangoIdFromToken } from "../api/auth";
import { getAnnouncements, Announcement } from "../api/announcements";
import { getConversations, getSentMessages, MessageRecord, Conversation } from "../api/messages";
import { findDjangoUserIdByUsername } from "../api/users";
import { EmptyPlaceholder } from "../components/editorial/MobileBlocks";
import ErrorState from "../components/ErrorState";
import Header from "../components/Header";
import { SkeletonCard } from "../components/ui/SkeletonItem";
import UserGate from "../components/UserGate";
import { useUser } from "../context/UserContext";
import { R, S, T, cardShadow, getEditorialPalette } from "../theme/editorial";
import { useTheme } from "../theme/ThemeContext";

type Tab = "odebrane" | "wyslane" | "ogloszenia";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function partnerDisplayName(p: Conversation["partner"]): string {
  const full = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
  return full || p.username || `Użytkownik ${p.id}`;
}

export default function Messages() {
  const { user } = useUser();
  const router = useRouter();
  const { theme } = useTheme();
  const palette = getEditorialPalette(theme);
  const shadow = cardShadow(theme);

  const [myId, setMyId] = React.useState<number | null>(null);
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [sent, setSent] = React.useState<MessageRecord[]>([]);
  const [announcements, setAnnouncements] = React.useState<Announcement[]>([]);
  const [tab, setTab] = React.useState<Tab>("odebrane");
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  const resolveMyId = React.useCallback(async (): Promise<number | null> => {
    if (!user) return null;
    let id = Number(user.serverId ?? user.id ?? -1);
    try {
      const tokenId = await getDjangoIdFromToken();
      if (tokenId) return Number(tokenId);
      const currentId = await getCurrentDjangoUserId();
      if (currentId) return Number(currentId);
    } catch {}
    if ((!id || id <= 0) && user.username) {
      try {
        const mapped = await findDjangoUserIdByUsername(user.username);
        if (mapped) return Number(mapped);
      } catch {}
    }
    return id > 0 ? id : null;
  }, [user]);

  const fetchAll = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const id = await resolveMyId();
      setMyId(id);
      const [convData, sentData, announcementsData] = await Promise.all([
        getConversations(),
        id ? getSentMessages(id) : Promise.resolve([]),
        getAnnouncements(),
      ]);
      setConversations(convData);
      setSent(sentData.sort((a, b) => new Date(b.data_wyslania).getTime() - new Date(a.data_wyslania).getTime()));
      setAnnouncements(announcementsData.sort((a, b) => new Date(b.data_publikacji).getTime() - new Date(a.data_publikacji).getTime()));
    } catch {
      setError("Nie udało się pobrać wiadomości.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, resolveMyId]);

  React.useEffect(() => {
    if (user?.username || user?.id) void fetchAll();
  }, [fetchAll, user?.id, user?.username, reloadKey]);

  const totalUnread = React.useMemo(
    () => conversations.reduce((s, c) => s + c.nieprzeczytane, 0),
    [conversations]
  );

  const filteredConversations = React.useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => {
      const name = partnerDisplayName(c.partner).toLowerCase();
      return (
        name.includes(q) ||
        c.ostatnia_wiadomosc.temat.toLowerCase().includes(q) ||
        c.ostatnia_wiadomosc.tresc.toLowerCase().includes(q)
      );
    });
  }, [conversations, search]);

  const filteredSent = React.useMemo(() => {
    if (!search.trim()) return sent;
    const q = search.toLowerCase();
    return sent.filter(
      (m) =>
        m.temat.toLowerCase().includes(q) ||
        (m.odbiorca_username ?? "").toLowerCase().includes(q) ||
        m.tresc.toLowerCase().includes(q)
    );
  }, [sent, search]);

  const filteredAnnouncements = React.useMemo(() => {
    if (!search.trim()) return announcements;
    const q = search.toLowerCase();
    return announcements.filter(
      (a) =>
        a.tytul.toLowerCase().includes(q) ||
        a.tresc.toLowerCase().includes(q) ||
        a.autor_name?.toLowerCase().includes(q)
    );
  }, [announcements, search]);

  const renderConversation = ({ item }: { item: Conversation }) => {
    const name = partnerDisplayName(item.partner);
    const avatarChar = name[0]?.toUpperCase() ?? "?";
    const unread = item.nieprzeczytane > 0;
    const msg = item.ostatnia_wiadomosc;

    return (
      <TouchableOpacity
        onPress={() =>
          router.push(
            `/wiadomosci/chat/${item.partner.id}?name=${encodeURIComponent(name)}&subject=${encodeURIComponent(msg.temat)}`
          )
        }
        activeOpacity={0.85}
        style={[styles.msgRow, { backgroundColor: palette.surface }, shadow]}
        accessibilityRole="button"
      >
        <View style={[styles.avatar, { backgroundColor: unread ? palette.primaryFixed : palette.surfaceMid }]}>
          <Text style={[T.title, { color: unread ? palette.infoText : palette.textMuted }]}>
            {avatarChar}
          </Text>
        </View>
        <View style={styles.msgBody}>
          <View style={styles.msgTop}>
            <Text
              style={[T.bodyMedium, { color: palette.text, fontWeight: unread ? "700" : "400", flex: 1 }]}
              numberOfLines={1}
            >
              {name}
            </Text>
            <Text style={[T.meta, { color: palette.textSoft, marginLeft: 8 }]}>
              {formatDate(msg.data_wyslania)}
            </Text>
          </View>
          <Text style={[T.bodyMedium, { color: palette.text, fontWeight: "600", marginTop: 2 }]} numberOfLines={1}>
            {msg.temat}
          </Text>
          <Text style={[T.label, { color: palette.textSoft, marginTop: 2 }]} numberOfLines={2}>
            {msg.tresc}
          </Text>
        </View>
        {unread ? (
          <View style={[styles.badge, { backgroundColor: palette.primary }]}>
            <Text style={[T.meta, { color: palette.onPrimary, fontWeight: "700", fontSize: 11 }]}>
              {item.nieprzeczytane}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderSent = ({ item }: { item: MessageRecord }) => {
    const recipientName = item.odbiorca_username ?? `Użytkownik ${item.odbiorca_id}`;
    const avatarChar = recipientName[0]?.toUpperCase() ?? "?";

    return (
      <TouchableOpacity
        onPress={() =>
          router.push(
            `/wiadomosci/chat/${item.odbiorca_id}?name=${encodeURIComponent(recipientName)}&subject=${encodeURIComponent(item.temat)}`
          )
        }
        activeOpacity={0.85}
        style={[styles.msgRow, { backgroundColor: palette.surface }, shadow]}
        accessibilityRole="button"
      >
        <View style={[styles.avatar, { backgroundColor: palette.surfaceMid }]}>
          <Text style={[T.title, { color: palette.textMuted }]}>{avatarChar}</Text>
        </View>
        <View style={styles.msgBody}>
          <View style={styles.msgTop}>
            <Text style={[T.bodyMedium, { color: palette.text, flex: 1 }]} numberOfLines={1}>
              {recipientName}
            </Text>
            <Text style={[T.meta, { color: palette.textSoft, marginLeft: 8 }]}>
              {formatDate(item.data_wyslania)}
            </Text>
          </View>
          <Text style={[T.bodyMedium, { color: palette.text, fontWeight: "600", marginTop: 2 }]} numberOfLines={1}>
            {item.temat}
          </Text>
          <Text style={[T.label, { color: palette.textSoft, marginTop: 2 }]} numberOfLines={2}>
            {item.tresc}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderAnnouncement = ({ item }: { item: Announcement }) => {
    const avatarChar = item.autor_name?.[0]?.toUpperCase() ?? "O";
    return (
      <TouchableOpacity
        onPress={() =>
          router.push(
            `/wiadomosci/ogloszenia/${item.id}?tytul=${encodeURIComponent(item.tytul)}&autor=${encodeURIComponent(item.autor_name ?? "Dyrekcja")}&data=${encodeURIComponent(item.data_publikacji)}`
          )
        }
        activeOpacity={0.85}
        style={[styles.msgRow, { backgroundColor: palette.surface }, shadow]}
        accessibilityRole="button"
      >
        <View style={[styles.avatar, { backgroundColor: palette.primaryFixed }]}>
          <Text style={[T.title, { color: palette.infoText }]}>{avatarChar}</Text>
        </View>
        <View style={styles.msgBody}>
          <View style={styles.msgTop}>
            <Text style={[T.bodyMedium, { color: palette.text, flex: 1 }]} numberOfLines={1}>
              {item.autor_name ?? "Dyrekcja"}
            </Text>
            <Text style={[T.meta, { color: palette.textSoft, marginLeft: 8 }]}>
              {formatDate(item.data_publikacji)}
            </Text>
          </View>
          <Text style={[T.bodyMedium, { color: palette.text, fontWeight: "600", marginTop: 2 }]} numberOfLines={1}>
            {item.tytul}
          </Text>
          <Text style={[T.label, { color: palette.textSoft, marginTop: 2 }]} numberOfLines={2}>
            {item.tresc}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={palette.textSoft} style={{ marginLeft: 4, marginTop: 2 }} />
      </TouchableOpacity>
    );
  };

  const listData =
    tab === "odebrane" ? filteredConversations :
    tab === "wyslane" ? filteredSent :
    filteredAnnouncements;

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    if (tab === "odebrane") return renderConversation({ item });
    if (tab === "wyslane") return renderSent({ item });
    return renderAnnouncement({ item });
  };

  return (
    <UserGate>
      <View style={[styles.root, { backgroundColor: palette.background }]}>
        <Header
          title="Wiadomości"
          subtitle={totalUnread > 0 ? `${totalUnread} nieprzeczytanych` : "Skrzynka odbiorcza"}
        />
        <View style={styles.body}>
          {/* New message button */}
          <TouchableOpacity
            onPress={() => router.push("/wiadomosci/nowa_wiadomosc")}
            style={[styles.newBtn, { backgroundColor: palette.primary }]}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Ionicons name="create-outline" size={18} color={palette.onPrimary} />
            <Text style={[T.bodyMedium, { color: palette.onPrimary, marginLeft: 6, fontWeight: "600" }]}>
              Nowa wiadomość
            </Text>
          </TouchableOpacity>

          {/* Tabs */}
          <View style={[styles.tabs, { backgroundColor: palette.surfaceMid }]}>
            {(["odebrane", "wyslane", "ogloszenia"] as Tab[]).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setTab(t)}
                style={[styles.tab, tab === t && [{ backgroundColor: palette.primary }, shadow]]}
                accessibilityRole="tab"
              >
                <Text style={[T.label, { color: tab === t ? palette.onPrimary : palette.textSoft, fontWeight: "600" }]}>
                  {t === "odebrane" ? "Odebrane" : t === "wyslane" ? "Wysłane" : "Ogłoszenia"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Search */}
          <View style={[styles.searchBar, { backgroundColor: palette.inputSurface }]}>
            <Ionicons name="search-outline" size={18} color={palette.textSoft} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Szukaj w wiadomościach..."
              placeholderTextColor={palette.textSoft}
              style={[styles.searchInput, { color: palette.text }]}
            />
          </View>

          {loading ? (
            <View style={styles.skeletonList}>
              <SkeletonCard /><SkeletonCard /><SkeletonCard />
            </View>
          ) : error ? (
            <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
          ) : listData.length === 0 ? (
            <EmptyPlaceholder
              title={tab === "ogloszenia" ? "Brak ogłoszeń" : tab === "odebrane" ? "Brak rozmów" : "Brak wysłanych"}
              subtitle={search ? "Nic nie pasuje do wyszukiwania." : "Tutaj pojawią się nowe wiadomości."}
              icon={tab === "ogloszenia" ? "megaphone-outline" : "chatbubbles-outline"}
            />
          ) : (
            <FlatList
              data={listData}
              keyExtractor={(item, idx) => {
                if (tab === "odebrane") return `c-${(item as Conversation).partner.id}`;
                if (tab === "wyslane") return `s-${(item as MessageRecord).id}`;
                return `a-${(item as Announcement).id}`;
              }}
              renderItem={renderItem}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => { setRefreshing(true); void fetchAll(); }}
                  tintColor={palette.primary}
                />
              }
            />
          )}
        </View>
      </View>
    </UserGate>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, paddingHorizontal: S[4], paddingTop: S[3] },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: R.full,
    paddingVertical: S[3],
    paddingHorizontal: S[5],
    marginBottom: S[4],
  },
  tabs: {
    flexDirection: "row",
    borderRadius: R.full,
    padding: 4,
    marginBottom: S[3],
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: S[2],
    borderRadius: R.full,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: R.full,
    paddingHorizontal: S[3],
    paddingVertical: S[2],
    marginBottom: S[3],
    gap: S[2],
  },
  searchInput: { flex: 1, fontSize: 14 },
  skeletonList: { gap: S[3] },
  separator: { height: S[2] },
  listContent: { paddingBottom: 120 },
  msgRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: R.lg,
    padding: S[4],
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: R.full,
    alignItems: "center",
    justifyContent: "center",
    marginRight: S[3],
    flexShrink: 0,
  },
  msgBody: { flex: 1 },
  msgTop: { flexDirection: "row", alignItems: "center" },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: S[2],
    marginTop: 2,
    flexShrink: 0,
  },
});
