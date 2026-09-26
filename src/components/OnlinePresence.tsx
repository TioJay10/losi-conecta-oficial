import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";

const PRESENCE_CHANNEL = "losi-global-presence";

type OnlinePresenceContextValue = {
  onlineUsers: Set<string>;
  currentUserId: string | null;
};

const OnlinePresenceContext = createContext<OnlinePresenceContextValue>({
  onlineUsers: new Set<string>(),
  currentUserId: null,
});

function createPresenceChannel() {
  try {
    return supabase.channel(PRESENCE_CHANNEL, {
      config: {
        presence: { key: "user" },
      },
    });
  } catch (error) {
    console.warn("Presença online indisponível:", error);
    return null;
  }
}

function readOnlineUsers(channel: ReturnType<typeof createPresenceChannel>) {
  if (!channel) return new Set<string>();
  const state = channel.presenceState() as Record<string, unknown[]>;
  return new Set(Object.keys(state));
}

export function OnlinePresenceTracker({ userId }: { userId: string | null }) {
  // Mantido por compatibilidade com chamadas antigas. A presença real é
  // administrada pelo OnlinePresenceProvider em um único canal compartilhado.
  void userId;
  return null;
}

export function OnlineStatus({
  userId,
  compact = false,
}: {
  userId: string | null;
  compact?: boolean;
}) {
  const { onlineUsers, currentUserId } = useContext(OnlinePresenceContext);
  const online = Boolean(userId && onlineUsers.has(userId));

  return (
    <span
      className={"provider-online-status" + (compact ? " provider-online-status-compact" : "")}
      title={online ? "Usuário online" : "Usuário offline"}
      aria-label={online ? "Online" : "Offline"}
    >
      <span className={"provider-online-dot " + (online ? "is-online" : "is-offline")} aria-hidden="true" />
      <span>{online ? "Online" : "Offline"}</span>
    </span>
  );
}

export function OnlinePresenceProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const channel = createPresenceChannel();
    if (!channel) {
      setOnlineUsers(new Set());
      return;
    }

    let active = true;

    const sync = () => {
      if (!active) return;
      setOnlineUsers(readOnlineUsers(channel));
    };

    channel.on("presence", { event: "sync" }, sync);
    channel.on("presence", { event: "join" }, sync);
    channel.on("presence", { event: "leave" }, sync);

    channel.subscribe(async (status) => {
      if (!active || status !== "SUBSCRIBED") return;

      if (userId) {
        const result = await channel.track({
          userId,
          online_at: new Date().toISOString(),
        });

        if (result !== "ok") {
          console.warn("Não foi possível registrar presença online:", result);
        }
      }

      sync();
    });

    return () => {
      active = false;
      void channel.untrack();
      void supabase.removeChannel(channel);
      setOnlineUsers(new Set());
    };
  }, [userId]);

  const value = useMemo(
    () => ({ onlineUsers, currentUserId: userId }),
    [onlineUsers, userId],
  );

  return (
    <OnlinePresenceContext.Provider value={value}>
      {children}
    </OnlinePresenceContext.Provider>
  );
}

export function useOnlineStatus(userId: string | null) {
  const { onlineUsers } = useContext(OnlinePresenceContext);
  return Boolean(userId && onlineUsers.has(userId));
}
