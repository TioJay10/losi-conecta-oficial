import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";

const PRESENCE_PREFIX = "losi-user-presence-";

type OnlinePresenceContextValue = {
  onlineUsers: Set<string>;
  currentUserId: string | null;
};

const OnlinePresenceContext = createContext<OnlinePresenceContextValue>({
  onlineUsers: new Set<string>(),
  currentUserId: null,
});

function presenceChannel(userId: string) {
  try {
    return supabase.channel(PRESENCE_PREFIX + userId, {
      config: {
        presence: { key: userId },
      },
    });
  } catch (error) {
    console.warn("Presença online indisponível:", error);
    return null;
  }
}

export function OnlinePresenceTracker({ userId }: { userId: string | null }) {
  useEffect(() => {
    if (!userId) return;

    const channel = presenceChannel(userId);
    if (!channel) return;
    let active = true;

    channel.subscribe(async (status) => {
      if (status !== "SUBSCRIBED" || !active) return;
      const result = await channel.track({
        userId,
        online_at: new Date().toISOString(),
      });
      if (result !== "ok") {
        console.warn("Não foi possível registrar presença online:", result);
      }
    });

    return () => {
      active = false;
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return null;
}

function usePresenceSubscription(userId: string | null, skip = false) {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    if (!userId || skip) {
      setOnline(false);
      return;
    }

    let active = true;
    const channel = presenceChannel(userId);
    if (!channel) return;

    const sync = () => {
      if (!active) return;
      const state = channel.presenceState() as Record<string, unknown[]>;
      setOnline(Object.keys(state).length > 0);
    };

    channel.on("presence", { event: "sync" }, sync);
    channel.on("presence", { event: "join" }, sync);
    channel.on("presence", { event: "leave" }, sync);

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") sync();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        if (active) setOnline(false);
      }
    });

    return () => {
      active = false;
      setOnline(false);
      void supabase.removeChannel(channel);
    };
  }, [userId, skip]);

  return online;
}

export function OnlineStatus({
  userId,
  compact = false,
}: {
  userId: string | null;
  compact?: boolean;
}) {
  const { onlineUsers, currentUserId } = useContext(OnlinePresenceContext);
  const isCurrentUser = Boolean(userId && currentUserId === userId);
  const ownPresence = isCurrentUser && onlineUsers.has(userId as string);
  const subscribedPresence = usePresenceSubscription(userId, isCurrentUser);
  const online = ownPresence || subscribedPresence;

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
    if (!userId) {
      setOnlineUsers(new Set());
      return;
    }

    const channel = presenceChannel(userId);
    if (!channel) return;
    let active = true;

    const sync = () => {
      if (!active) return;
      setOnlineUsers(new Set([userId]));
    };

    channel.subscribe(async (status) => {
      if (status !== "SUBSCRIBED" || !active) return;
      const result = await channel.track({
        userId,
        online_at: new Date().toISOString(),
      });
      if (result === "ok") sync();
    });

    return () => {
      active = false;
      setOnlineUsers(new Set());
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const value = useMemo(() => ({ onlineUsers, currentUserId: userId }), [onlineUsers, userId]);

  return (
    <OnlinePresenceContext.Provider value={value}>
      {children}
    </OnlinePresenceContext.Provider>
  );
}

export function useOnlineStatus(userId: string | null) {
  const { onlineUsers, currentUserId } = useContext(OnlinePresenceContext);
  const isCurrentUser = Boolean(userId && currentUserId === userId);
  const ownPresence = isCurrentUser && onlineUsers.has(userId as string);
  const subscribedPresence = usePresenceSubscription(userId, isCurrentUser);
  return Boolean(ownPresence || subscribedPresence);
}
