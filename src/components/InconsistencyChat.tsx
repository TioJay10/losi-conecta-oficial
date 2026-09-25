import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

export type InconsistencyConversation = {
  id: string;
  user_id: string;
  title: string;
  issue_type: string;
  description: string;
  status: "new" | "in_progress" | "resolved";
  admin_viewed_at: string | null;
  user_viewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type InconsistencyMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: "user" | "admin";
  message: string;
  created_at: string;
};

const ISSUE_TYPES = [
  "Erro de carregamento",
  "Erro ao acessar fornecedor",
  "Erro ao enviar mensagem",
  "Erro no cadastro ou login",
  "Problema com minha conta",
  "Problema com favoritos",
  "Problema com notificações",
  "Botão ou link não funciona",
  "Problema de layout ou responsividade",
  "Lentidão ou travamento",
  "Informações incorretas",
  "Outro",
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function InconsistencyUserChat({ userId }: { userId: string }) {
  const [conversation, setConversation] = useState<InconsistencyConversation | null>(null);
  const [messages, setMessages] = useState<InconsistencyMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState("");
  const [issueType, setIssueType] = useState("");
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState("");
  const messagesRef = useRef<HTMLDivElement | null>(null);

  async function loadConversation() {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("inconsistency_conversations")
      .select("id,user_id,title,issue_type,description,status,admin_viewed_at,user_viewed_at,created_at,updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Erro ao carregar notificação de inconsistência:", error);
      setFeedback("Não foi possível carregar suas notificações. Tente novamente.");
      setLoading(false);
      return;
    }

    const row = data as InconsistencyConversation | null;
    setConversation(row);
    if (row) await loadMessages(row.id);
    setLoading(false);
  }

  async function loadMessages(conversationId: string) {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("inconsistency_messages")
      .select("id,conversation_id,sender_id,sender_role,message,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (!error) setMessages((data ?? []) as InconsistencyMessage[]);
    else console.error("Erro ao carregar mensagens de inconsistência:", error);
  }

  useEffect(() => {
    void loadConversation();
  }, [userId]);

  useEffect(() => {
    if (!conversation || !supabase) return;
    const channel = supabase
      .channel("user-inconsistency-" + conversation.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "inconsistency_messages", filter: "conversation_id=eq." + conversation.id }, (payload) => {
        const incoming = payload.new as InconsistencyMessage;
        setMessages((current) => current.some((item) => item.id === incoming.id) ? current : [...current, incoming]);
        if (incoming.sender_role === "admin") {
          void supabase.from("inconsistency_conversations").update({ user_viewed_at: new Date().toISOString() }).eq("id", conversation.id).eq("user_id", userId);
        }
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [conversation?.id, userId]);

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages]);

  const canCreate = useMemo(() => title.trim() && issueType && description.trim(), [title, issueType, description]);

  async function createConversation(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !canCreate || creating) return;
    setCreating(true);
    setFeedback("");
    const { data, error } = await supabase
      .from("inconsistency_conversations")
      .insert({ user_id: userId, title: title.trim(), issue_type: issueType, description: description.trim() })
      .select("id,user_id,title,issue_type,description,status,admin_viewed_at,user_viewed_at,created_at,updated_at")
      .single();

    if (error || !data) {
      console.error("Erro ao criar notificação de inconsistência:", error);
      setFeedback("Não foi possível enviar sua notificação. Tente novamente.");
      setCreating(false);
      return;
    }

    const row = data as InconsistencyConversation;
    const first = await supabase.from("inconsistency_messages").insert({
      conversation_id: row.id,
      sender_id: userId,
      sender_role: "user",
      message: description.trim(),
    });
    if (first.error) console.error("Erro ao registrar mensagem inicial:", first.error);

    setConversation(row);
    setMessages([{ id: crypto.randomUUID(), conversation_id: row.id, sender_id: userId, sender_role: "user", message: description.trim(), created_at: new Date().toISOString() }]);
    setTitle("");
    setIssueType("");
    setDescription("");
    setFeedback("Sua mensagem foi enviada com sucesso para o administrador.");
    setCreating(false);
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || !conversation || !draft.trim() || sending) return;
    setSending(true);
    const message = draft.trim();
    const { data, error } = await supabase
      .from("inconsistency_messages")
      .insert({ conversation_id: conversation.id, sender_id: userId, sender_role: "user", message })
      .select("id,conversation_id,sender_id,sender_role,message,created_at")
      .single();

    if (error || !data) {
      setFeedback("Não foi possível enviar a mensagem.");
      console.error("Erro ao enviar mensagem de inconsistência:", error);
    } else {
      setMessages((current) => [...current, data as InconsistencyMessage]);
      setDraft("");
      setFeedback("Mensagem enviada ao administrador.");
    }
    setSending(false);
  }

  if (loading) return <div className="inconsistency-loading">Carregando canal de atendimento...</div>;

  if (!conversation || conversation.status === "resolved") {
    return (
      <div className="inconsistency-page-shell">
        {conversation?.status === "resolved" && <div className="inconsistency-resolved-note">Esta ocorrência foi encerrada. Se o problema continuar, você pode abrir uma nova notificação.</div>}
        <form className="inconsistency-card" onSubmit={createConversation}>
          <div className="inconsistency-card-header">
            <span className="inconsistency-eyebrow">SUPORTE LOSI CONECTA</span>
            <h1>Notificar Inconsistência</h1>
            <p>Encontrou um erro ou algo que não está funcionando como deveria? Envie os detalhes para o administrador.</p>
          </div>
          <div className="inconsistency-form">
            <label className="inconsistency-field">
              <span>Título</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Ex.: Não consigo enviar mensagem ao fornecedor" required />
            </label>
            <label className="inconsistency-field">
              <span>Tipo de inconsistência</span>
              <select value={issueType} onChange={(e) => setIssueType(e.target.value)} required>
                <option value="">Selecione uma opção</option>
                {ISSUE_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="inconsistency-field">
              <span>Descrição</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} placeholder="Conte o que aconteceu, em qual página ocorreu e, se possível, o que você estava fazendo no momento." required />
              <small>{description.length}/2000</small>
            </label>
          </div>
          {feedback && <div className="inconsistency-feedback success">{feedback}</div>}
          <button className="inconsistency-submit" type="submit" disabled={!canCreate || creating}>{creating ? "Enviando..." : "Enviar mensagem para o administrador"}</button>
        </form>
      </div>
    );
  }

  return (
    <div className="inconsistency-page-shell">
      <section className="inconsistency-chat">
        <header className="inconsistency-chat-header">
          <div className="inconsistency-chat-identity">
            <div className="inconsistency-chat-avatar">LC</div>
            <div>
              <strong>Notificar Inconsistência</strong>
              <span>{conversation.status === "new" ? "Aguardando atendimento" : "Atendimento em andamento"}</span>
            </div>
          </div>
          <span className="inconsistency-status">{conversation.status === "new" ? "NOVA" : "EM ATENDIMENTO"}</span>
        </header>
        <div className="inconsistency-chat-summary">
          <strong>{conversation.title}</strong>
          <span>{conversation.issue_type} · {formatDate(conversation.created_at)}</span>
          <p>{conversation.description}</p>
        </div>
        <div className="inconsistency-messages" ref={messagesRef}>
          {messages.map((item) => (
            <div key={item.id} className={"inconsistency-message-row " + (item.sender_role === "user" ? "is-user" : "is-admin")}>
              <div className="inconsistency-message">
                <span>{item.sender_role === "user" ? "Você" : "Administrador"}</span>
                <p>{item.message}</p>
                <small>{formatDate(item.created_at)}</small>
              </div>
            </div>
          ))}
        </div>
        {feedback && <div className="inconsistency-feedback success">{feedback}</div>}
        <form className="inconsistency-composer" onSubmit={sendMessage}>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Digite uma mensagem para o administrador..." maxLength={2000} />
          <button type="submit" disabled={!draft.trim() || sending}>{sending ? "..." : "Enviar"}</button>
        </form>
      </section>
    </div>
  );
}

export { ISSUE_TYPES };
