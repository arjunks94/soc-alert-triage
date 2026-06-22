import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useWallboardAuthStore } from '../stores/wallboardAuthStore';
import { isWallboardHost } from '../utils/wallboard';

type MessageHandler = (data: Record<string, unknown>) => void;

export function useWebSocket(channel: 'alerts' | 'incidents' | 'dashboard' | 'events', onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;
  const mainToken = useAuthStore((s) => s.accessToken);
  const wallboardToken = useWallboardAuthStore((s) => s.accessToken);
  const accessToken = isWallboardHost() ? wallboardToken : mainToken;

  const connect = useCallback(() => {
    if (!accessToken) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/ws/${channel}?token=${encodeURIComponent(accessToken)}`
    );

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handlerRef.current(data);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = (event) => {
      if (event.code !== 4001) {
        setTimeout(connect, 5000);
      }
    };

    wsRef.current = ws;
  }, [channel, accessToken]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return wsRef;
}
