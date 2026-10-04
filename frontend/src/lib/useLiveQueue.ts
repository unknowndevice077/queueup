import { Client } from '@stomp/stompjs';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from './api';
import type { PublicQueueState } from './types';

export function webSocketUrl(
  apiBaseUrl: string = API_BASE_URL,
  location: Location = window.location,
): string {
  if (apiBaseUrl) {
    return `${apiBaseUrl.replace(/^http/, 'ws')}/ws`;
  }
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${location.host}/ws`;
}

/**
 * Subscribes to /topic/tenants/{slug}/queue and returns the latest pushed state plus connection status.
 * The server pushes the whole public queue on every change, so no client-side merging is needed.
 */
export function useLiveQueue(slug: string | undefined, onUpdate?: (state: PublicQueueState) => void) {
  const [state, setState] = useState<PublicQueueState | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!slug) {
      return;
    }
    const client = new Client({
      brokerURL: webSocketUrl(),
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        setConnected(true);
        client.subscribe(`/topic/tenants/${slug}/queue`, (message) => {
          const next = JSON.parse(message.body) as PublicQueueState;
          setState(next);
          onUpdate?.(next);
        });
      },
      onWebSocketClose: () => setConnected(false),
    });
    client.activate();
    return () => {
      void client.deactivate();
    };
    // onUpdate is intentionally excluded: callers pass inline callbacks and the subscription must stay stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return { state, connected };
}
