import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { InconsistencyConversation, InconsistencyMessage } from "./InconsistencyChat";

type ConversationWithUser = InconsistencyConversation & {
  user: { full_name: string | null; avatar_url: string | null } | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function AdminInconsistencyCenter() {
  const [items, setItems] = useState<ConversationWithUser[]>([]);
  const [selected, setSelected] = useState<ConversationWithUser | null>(null);
  const [messages, setMessages] = useState<InconsistencyMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<"all" | "new" | "in_progress" | "resolved">("all");
  const messagesRef = useRef<HTMLDivElement | null>(null);

  async function loadConversations() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("inconsistency_conversations")
      .select("id,user_id,title,issue_type,description,status,admin_viewed_at,user_viewed_at,created_at,updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar inconsistências:", error);
      setLoading(false);
      return;
    }

    const conversations = (data ?? []) as Array<Omit<ConversationWithUser, "user"> & { user_id: string }>;
    const userIds = [...new Set(conversations.map((item) => item.user_id).filter(Boolean))];
    let profilesById = new Map<string, { full_name: string | null; avatar_url: string | null }>();

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id,full_name,avatar_url")
        .in("id", userIds);
      if (profilesError) {
        console.error("Erro ao carregar fotos dos usuários das inconsistências:", profilesError);
      } else {
        profilesById = new Map(
          (profiles ?? []).map(
            (profile): [string, { full_name: string | null; avatar_url: string | null }] => [
              profile.id,
              { full_name: profile.full_name, avatar_url: profile.avatar_url },
            ],
          ),
        );
      }
    }

    setItems(
      conversations.map((item) => ({
        ...item,
        user: profilesById.get(item.user_id) ?? null,
      })) as ConversationWithUser[],
    );
    setLoading(false);
  }

  async function openConversation(item: ConversationWithUser) {
    if (!supabase) return;
    setSelected(item);
    setDraft("");
    const { data, error } = await supabase
      .from("inconsistency_messages")
      .select("id,conversation_id,sender_id,sender_role,message,created_at")
      .eq("conversation_id", item.id)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Erro ao carregar conversa de inconsistência:", error);
      return;
    }
    setMessages((data ?? []) as InconsistencyMessage[]);
    await supabase
      .from("inconsistency_conversations")
      .update({ admin_viewed_at: new Date().toISOString(), status: item.status === "new" ? "in_progress" : item.status })
      .eq("id", item.id);
    const updated = { ...item, admin_viewed_at: new Date().toISOString(), status: item.status === "new" ? "in_progress" : item.status } as ConversationWithUser;
    setSelected(updated);
    setItems((current) => current.map((row) => row.id === item.id ? updated : row));
  }

  async function sendReply(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !selected || !draft.trim() || sending) return;
    setSending(true);
    const message = draft.trim();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setSending(false); return; }
    const { data, error } = await supabase
      .from("inconsistency_messages")
      .insert({ conversation_id: selected.id, sender_id: userData.user.id, sender_role: "admin", message })
      .select("id,conversation_id,sender_id,sender_role,message,created_at")
      .single();
    if (error || !data) {
      console.error("Erro ao responder inconsistência:", error);
    } else {
      setMessages((current) => [...current, data as InconsistencyMessage]);
      setDraft("");
      await supabase.from("inconsistency_conversations").update({ status: "in_progress", user_viewed_at: null }).eq("id", selected.id);
      await supabase.from("notifications").insert({
        user_id: selected.user_id,
        type: "inconsistency_reply",
        title: "Resposta do administrador",
        message: "O administrador respondeu à sua notificação de inconsistência.",
        link: "/notificar-inconsistencia",
      });
    }
    setSending(false);
  }

  async function resolveConversation() {
    if (!supabase || !selected) return;
    await supabase.from("inconsistency_conversations").update({ status: "resolved", admin_viewed_at: new Date().toISOString() }).eq("id", selected.id);
    const updated = { ...selected, status: "resolved" as const };
    setSelected(updated);
    setItems((current) => current.map((row) => row.id === selected.id ? updated : row));
  }

  useEffect(() => { void loadConversations(); }, []);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("admin-inconsistency-center")
      .on("postgres_changes", { event: "*", schema: "public", table: "inconsistency_conversations" }, () => { void loadConversations(); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "inconsistency_messages" }, (payload) => {
        const incoming = payload.new as InconsistencyMessage;
        if (selected?.id === incoming.conversation_id) {
          setMessages((current) => current.some((item) => item.id === incoming.id) ? current : [...current, incoming]);
        }
        void loadConversations();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [selected?.id]);

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages]);

  const filtered = items.filter((item) => filter === "all" || item.status === filter);
  const unreadCount = items.filter((item) => !item.admin_viewed_at && item.status !== "resolved").length;

  if (loading) return <section className="admin-inconsistency-center"><div className="admin-inconsistency-empty">Carregando notificações de inconsistências...</div></section>;

  return (
    <section className="admin-inconsistency-center">
      <div className="admin-inconsistency-head">
        <div>
          <div className="admin-badge">SUPORTE</div>
          <h2>Notificações de Inconsistências</h2>
          <p>Canal exclusivo para receber e responder relatos de erros, bugs e inconsistências enviados pelos usuários.</p>
        </div>
        <div className="admin-inconsistency-counter">{unreadCount} nova(s)</div>
      </div>

      <div className="admin-inconsistency-layout">
        <div className="admin-inconsistency-list-group">
          <div className="admin-inconsistency-filters">
            {(["all","new","in_progress","resolved"] as const).map((value) => (
              <button key={value} type="button" className={filter === value ? "is-active" : ""} onClick={() => setFilter(value)}>
                {value === "all" ? "Todas" : value === "new" ? "Novas" : value === "in_progress" ? "Em atendimento" : "Resolvidas"}
              </button>
            ))}
          </div>
          <div className="admin-inconsistency-list">
            {filtered.length === 0 ? <div className="admin-inconsistency-empty">Nenhuma ocorrência nesta categoria.</div> : filtered.map((item) => (
              <button key={item.id} type="button" className={"admin-inconsistency-item " + (selected?.id === item.id ? "is-selected" : "")} onClick={() => void openConversation(item)}>
                {item.user?.avatar_url ? <img className="admin-inconsistency-item-avatar admin-inconsistency-avatar-image" src={item.user.avatar_url} alt={item.user.full_name ? `Foto de perfil de ${item.user.full_name}` : "Foto de perfil"} /> : <span className="admin-inconsistency-item-avatar">{(item.user?.full_name || "U").slice(0,1).toUpperCase()}</span>}
                <span className="admin-inconsistency-item-copy">
                  <strong>{item.title}</strong>
                  <small>{item.user?.full_name || "Usuário"} · {item.issue_type}</small>
                  <em>{formatDate(item.updated_at)}</em>
                </span>
                {!item.admin_viewed_at && item.status !== "resolved" && <span className="admin-inconsistency-new-dot" aria-label="Nova" />}
              </button>
            ))}
          </div>
        </div>

        {selected ? (
          <div className="admin-inconsistency-chat">
            <header className="admin-inconsistency-chat-header">
              <div className="admin-inconsistency-chat-user">
                {selected.user?.avatar_url ? <img className="admin-inconsistency-item-avatar admin-inconsistency-avatar-image" src={selected.user.avatar_url} alt={selected.user.full_name ? `Foto de perfil de ${selected.user.full_name}` : "Foto de perfil"} /> : <span className="admin-inconsistency-item-avatar">{(selected.user?.full_name || "U").slice(0,1).toUpperCase()}</span>}
                <div><strong>{selected.user?.full_name || "Usuário"}</strong><span>{selected.issue_type} · {selected.title}</span></div>
              </div>
              <button type="button" className="admin-inconsistency-close" onClick={() => setSelected(null)} aria-label="Fechar conversa">×</button>
            </header>
            <div className="admin-inconsistency-summary"><strong>Descrição inicial</strong><p>{selected.description}</p></div>
            <div className="admin-inconsistency-messages" ref={messagesRef}>
              {messages.map((item) => (
                <div key={item.id} className={"inconsistency-message-row " + (item.sender_role === "admin" ? "is-admin-user" : "is-client-user")}>
                  {item.sender_role === "user" && (
                    selected.user?.avatar_url ? (
                      <img
                        className="admin-inconsistency-message-avatar"
                        src={selected.user.avatar_url}
                        alt={selected.user.full_name ? `Foto de perfil de ${selected.user.full_name}` : "Foto de perfil"}
                      />
                    ) : (
                      <span className="admin-inconsistency-message-avatar admin-inconsistency-message-avatar-fallback">
                        {(selected.user?.full_name || "U").slice(0, 1).toUpperCase()}
                      </span>
                    )
                  )}
                  <div className="admin-inconsistency-bubble">
                    <span>{item.sender_role === "admin" ? "Administrador" : "Usuário"}</span>
                    <p>{item.message}</p>
                    <small>{formatDate(item.created_at)}</small>
                  </div>
                </div>
              ))}
            </div>
            {selected.status !== "resolved" ? (
              <form className="admin-inconsistency-composer" onSubmit={sendReply}>
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Responder ao usuário..." maxLength={2000} />
                <button type="submit" disabled={!draft.trim() || sending}>{sending ? "..." : "Responder"}</button>
                <button type="button" className="is-resolve" onClick={() => void resolveConversation()}>Encerrar</button>
              </form>
            ) : <div className="admin-inconsistency-resolved">Ocorrência encerrada.</div>}
          </div>
        ) : (
          <div className="admin-inconsistency-chat admin-inconsistency-chat-empty"><strong>Selecione uma ocorrência</strong><span>O chat exclusivo aparecerá aqui.</span></div>
        )}
      </div>
    </section>
  );
}
