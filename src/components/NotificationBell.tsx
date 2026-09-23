import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import "./notification-bell.css";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

function formatRelativeDate(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return "há " + minutes + " min";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return "há " + hours + " h";
  const days = Math.floor(hours / 24);
  return "há " + days + " d";
}

export function NotificationBell() {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem("losi-notification-sound") !== "off";
    } catch {
      return true;
    }
  });
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(soundEnabled);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const unreadCount = items.filter((item) => !item.read_at).length;

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user.id ?? null;
      if (mounted) setUserId(id);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      return;
    }

    let mounted = true;

    supabase
      .from("notifications")
      .select("id,type,title,message,link,read_at,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (error) {
          console.error("Erro ao carregar notificações:", error);
          return;
        }
        if (mounted) setItems((data ?? []) as NotificationItem[]);
      });

    const channel = supabase
      .channel("notifications:" + userId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: "user_id=eq." + userId,
        },
        (payload) => {
          const next = payload.new as NotificationItem;
          setItems((current) => [next, ...current].slice(0, 20));
          if (soundEnabledRef.current) playNotificationSound();
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  function playNotificationSound() {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }).webkitAudioContext;

      if (!AudioContextClass) return;

      const context = audioContextRef.current ?? new AudioContextClass();
      audioContextRef.current = context;

      if (context.state === "suspended") void context.resume();

      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(660, context.currentTime + 0.12);

      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.2);
    } catch (error) {
      console.debug("Som de notificação indisponível:", error);
    }
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundEnabledRef.current = next;

    try {
      localStorage.setItem("losi-notification-sound", next ? "on" : "off");
    } catch {}

    if (next) playNotificationSound();
  }

  async function markRead(id: string) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("Erro ao marcar notificação como lida:", error);
      return;
    }

    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, read_at: now } : item)),
    );
  }

  async function markAllRead() {
    if (!userId || unreadCount === 0) return;

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", userId)
      .is("read_at", null);

    if (error) {
      console.error("Erro ao marcar notificações como lidas:", error);
      return;
    }

    setItems((current) =>
      current.map((item) => ({ ...item, read_at: item.read_at ?? now })),
    );
  }

  if (!userId) return null;

  return (
    <div className="notification-bell-wrap">
      <button
        type="button"
        className="notification-bell-button"
        onClick={() => setOpen((value) => !value)}
        aria-label={
          unreadCount
            ? unreadCount + " notificações não lidas"
            : "Notificações"
        }
        aria-expanded={open}
        aria-controls="losi-notification-panel"
      >
        <svg
          className="notification-bell-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>

        {unreadCount > 0 && (
          <span className="notification-bell-badge">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          id="losi-notification-panel"
          className="notification-panel"
          aria-label="Central de notificações"
        >
          <header className="notification-panel-header">
            <div>
              <strong className="notification-panel-title">Notificações</strong>
              <span className="notification-panel-subtitle">
                {unreadCount
                  ? unreadCount +
                    " nova" +
                    (unreadCount === 1 ? "" : "s")
                  : "Tudo em dia"}
              </span>
            </div>

            <div className="notification-panel-actions">
              <button
                type="button"
                className="notification-action"
                onClick={toggleSound}
                title={soundEnabled ? "Desativar som" : "Ativar som"}
                aria-pressed={soundEnabled}
              >
                {soundEnabled ? "Som" : "Som off"}
              </button>

              {unreadCount > 0 && (
                <button
                  type="button"
                  className="notification-action notification-action--quiet"
                  onClick={markAllRead}
                >
                  Marcar lidas
                </button>
              )}
            </div>
          </header>

          <div className="notification-list">
            {items.length === 0 ? (
              <div className="notification-empty">
                Você ainda não recebeu notificações.
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={
                    "notification-item" +
                    (!item.read_at ? " notification-item--unread" : "") +
                    (item.link ? " notification-item--link" : "")
                  }
                  onClick={() => {
                    void markRead(item.id);
                    if (item.link) window.location.href = item.link;
                  }}
                >
                  <span className="notification-item-inner">
                    <span className="notification-item-dot" aria-hidden="true" />
                    <span className="notification-item-copy">
                      <strong className="notification-item-title">
                        {item.title}
                      </strong>
                      <span className="notification-item-message">
                        {item.message}
                      </span>
                      <span className="notification-item-time">
                        {formatRelativeDate(item.created_at)}
                      </span>
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}
