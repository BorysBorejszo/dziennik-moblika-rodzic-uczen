import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiBaseUrl } from '../api/auth';

export interface WSChatMessage {
  message: string;
  sender_id: number;
  timestamp?: string;
}

export function useConversationSocket(myId: number | null, partnerId: number | null) {
  const [lastMessage, setLastMessage] = useState<WSChatMessage | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retries = useRef(0);
  const MAX_RETRIES = 10;

  const connect = useCallback(() => {
    if (!myId || !partnerId) return;
    const a = Math.min(myId, partnerId);
    const b = Math.max(myId, partnerId);
    const base = getApiBaseUrl().replace(/^https/, 'wss').replace(/^http/, 'ws');
    const url = `${base}/ws/chat/chat_user_${a}_${b}/`;
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => { setConnected(true); retries.current = 0; };
      ws.onmessage = (e) => {
        try { setLastMessage(JSON.parse(e.data as string) as WSChatMessage); } catch {}
      };
      ws.onclose = () => {
        setConnected(false);
        if (retries.current < MAX_RETRIES) {
          const delay = Math.min(500 * 2 ** retries.current, 30_000);
          retries.current += 1;
          timerRef.current = setTimeout(connect, delay);
        }
      };
      ws.onerror = () => ws.close();
    } catch {}
  }, [myId, partnerId]);

  useEffect(() => {
    connect();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ message: text }));
    }
  }, []);

  return { lastMessage, sendMessage, connected };
}
