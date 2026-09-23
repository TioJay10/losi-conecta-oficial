import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

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
    try { return localStorage.getItem("losi-notification-sound") !== "off"; } catch { return true; }
  });
  const audioContextRef = useRef<AudioContext | null>(null);

  const unreadCount = items.filter((item) => !item.read_at).length;

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user.id ?? null;
      if (mounted) setUserId(id);
    });
    return () => { mounted = false; };
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
        { event: "INSERT", schema: "public", table: "notifications", filter: "user_id=eq." + userId },
        (payload) => {
          const next = payload.new as NotificationItem;
          setItems((current) => [next, ...current].slice(0, 20));
          if (soundEnabled) playNotificationSound();
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [userId, soundEnabled]);

  function playNotificationSound() {
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
    try { localStorage.setItem("losi-notification-sound", next ? "on" : "off"); } catch {}
    if (next) playNotificationSound();
  }

  async function markRead(id: string) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) {
      console.error("Erro ao marcar notificação como lida:", error);
      return;
    }
    setItems((current) => current.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
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
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? now })));
  }

  if (!userId) return null;

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={unreadCount ? unreadCount + " notificações não lidas" : "Notificações"}
        aria-expanded={open}
        style={{
          position: "relative", width: 42, height: 42, borderRadius: 12,
          border: "1px solid #dfe3ea", background: "#fff", color: "#172033",
          cursor: "pointer", display: "grid", placeItems: "center", fontSize: 19,
        }}
      >
        <span aria-hidden="true">♢</span>
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4, minWidth: 18, height: 18,
            padding: "0 4px", borderRadius: 99, background: "#c23b3b", color: "#fff",
            fontSize: 10, fontWeight: 800, display: "grid", placeItems: "center",
            boxSizing: "border-box",
          }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {open && (
        <section
          aria-label="Central de notificações"
          style={{
            position: "absolute", top: 50, right: 0, width: "min(390px, calc(100vw - 32px))",
            background: "#fff", border: "1px solid #e1e5ec", borderRadius: 16,
            boxShadow: "0 20px 55px rgba(7,17,31,.18)", zIndex: 100,
            overflow: "hidden",
          }}
        >
          <header style={{
            padding: "16px 18px", display: "flex", alignItems: "center",
            justifyContent: "space-between", gap: 12, borderBottom: "1px solid #edf0f4",
          }}>
            <div>
              <strong style={{ display: "block", fontSize: 15, color: "#172033" }}>Notificações</strong>
              <span style={{ display: "block", marginTop: 3, fontSize: 12, color: "#7a8494" }}>
                {unreadCount ? unreadCount + " nova" + (unreadCount === 1 ? "" : "s") : "Tudo em dia"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" onClick={toggleSound} title={soundEnabled ? "Desativar som" : "Ativar som"} style={{ border: "1px solid #e1e5ec", background: "#fff", borderRadius: 8, padding: "6px 8px", cursor: "pointer", fontSize: 12 }}>
                {soundEnabled ? "Som" : "Som off"}
              </button>
              {unreadCount > 0 && <button type="button" onClick={markAllRead} style={{ border: 0, background: "transparent", color: "#8a6d2f", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Marcar lidas</button>}
            </div>
          </header>

          <div style={{ maxHeight: 430, overflowY: "auto" }}>
            {items.length === 0 ? (
              <div style={{ padding: "34px 20px", textAlign: "center", color: "#7a8494", fontSize: 13, lineHeight: 1.5 }}>
                Você ainda não recebeu notificações.
              </div>
            ) : items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  void markRead(item.id);
                  if (item.link) window.location.href = item.link;
                }}
                style={{
                  width: "100%", border: 0, borderBottom: "1px solid #f0f2f5", textAlign: "left",
                  padding: "14px 18px", background: item.read_at ? "#fff" : "#fbf8ef",
                  cursor: item.link ? "pointer" : "default",
                }}
              >
                <div style={{ display: "flex", gap: 10 }}>
                  <span style={{ width: 8, height: 8, marginTop: 6, flex: "0 0 auto", borderRadius: 99, background: item.read_at ? "#d7dce5" : "#d6b46a" }} />
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: "block", color: "#172033", fontSize: 13 }}>{item.title}</strong>
                    <span style={{ display: "block", marginTop: 4, color: "#687386", fontSize: 12, lineHeight: 1.45 }}>{item.message}</span>
                    <span style={{ display: "block", marginTop: 7, color: "#9aa2af", fontSize: 11 }}>{formatRelativeDate(item.created_at)}</span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
