import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase";
import { OnlineStatus } from "./OnlinePresence";

type Business = {
  id: string;
  business_name: string;
  slug: string;
  logo_url: string | null;
  owner_id: string;
};

type UserProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

type Conversation = {
  id: string;
  business_id: string;
  requester_id: string;
  supplier_id: string;
  updated_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  delivered_at: string | null;
};

type Props = {
  business: Business;
  userId: string | null;
  onRequireAuth: () => void;
};

const conversationColumns = "id,business_id,requester_id,supplier_id,updated_at,last_message_at,last_message_preview";
const messageColumns = "id,conversation_id,sender_id,content,created_at,delivered_at,read_at";

function ProviderChatContent({ business, userId, onRequireAuth }: Props) {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [supplierNames, setSupplierNames] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const isSupplier = Boolean(userId && userId === business.owner_id);

  const sortedConversations = useMemo(
    () => [...conversations].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [conversations],
  );

  function setConversationList(rows: Conversation[]) {
    const unique = new Map<string, Conversation>();
    for (const row of rows) unique.set(row.id, row);
    setConversations([...unique.values()].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
  }

  async function ensureConversation(): Promise<Conversation | null> {
    if (!userId) {
      onRequireAuth();
      return null;
    }

    if (!business.id || !business.owner_id) {
      setError("Este perfil não está preparado para receber mensagens.");
      return null;
    }

    if (userId === business.owner_id) {
      setError("Este é o seu próprio perfil.");
      return null;
    }

    setLoading(true);
    setError("");

    try {
      const existing = await supabase
        .from("chat_conversations")
        .select(conversationColumns)
        .eq("business_id", business.id)
        .eq("requester_id", userId)
        .eq("supplier_id", business.owner_id)
        .maybeSingle();

      if (existing.error) {
        console.error("Erro ao localizar conversa:", existing.error);
        setError("Não foi possível localizar a conversa. Tente novamente.");
        return null;
      }

      if (existing.data) {
        const row = existing.data as Conversation;
        setConversationList([row, ...conversations]);
        return row;
      }

      const created = await supabase
        .from("chat_conversations")
        .insert({
          business_id: business.id,
          requester_id: userId,
          supplier_id: business.owner_id,
        })
        .select(conversationColumns)
        .single();

      if (created.error || !created.data) {
        console.error("Erro ao criar conversa:", created.error);
        setError("Não foi possível iniciar a conversa. Tente novamente.");
        return null;
      }

      const row = created.data as Conversation;
      setConversationList([row, ...conversations]);
      return row;
    } catch (caught) {
      console.error("Erro inesperado ao preparar conversa:", caught);
      setError("Não foi possível iniciar o chat. Tente novamente.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function openTargetChat() {
    if (!userId) {
      onRequireAuth();
      return;
    }

    if (isSupplier) {
      setOpen(true);
      return;
    }

    setOpen(true);
    const row = await ensureConversation();
    if (row) {
      setActiveConversation(row);
    }
  }

  async function loadSupplierInbox() {
    if (!userId || !isSupplier) return;

    setLoading(true);
    setError("");

    const result = await supabase
      .from("chat_conversations")
      .select(conversationColumns)
      .or("requester_id.eq." + userId + ",supplier_id.eq." + userId)
      .order("updated_at", { ascending: false });

    if (result.error) {
      console.error("Erro ao carregar caixa de mensagens:", result.error);
      setError("Não foi possível carregar suas conversas.");
      setConversationList([]);
    } else {
      setConversationList((result.data ?? []) as Conversation[]);
    }

    setLoading(false);
  }

  async function loadConversationMessages(conversation: Conversation) {
    if (!userId) return;

    setMessages([]);
    setError("");
    setLoading(true);

    const result = await supabase
      .from("chat_messages")
      .select(messageColumns)
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

    if (result.error) {
      console.error("Erro ao carregar mensagens:", result.error);
      setError("Não foi possível carregar as mensagens desta conversa.");
      setLoading(false);
      return;
    }

    const rows = (result.data ?? []) as Message[];
    setMessages(rows);
    setLoading(false);
    await markIncomingAsRead(rows);
    await loadIdentities(rows, conversation);
  }

  async function loadIdentities(rows: Message[], conversation: Conversation) {
    const ids = Array.from(new Set([
      conversation.requester_id,
      conversation.supplier_id,
      ...rows.map((row) => row.sender_id),
    ])).filter(Boolean);

    if (!ids.length) return;

    const [profileResult, businessResult] = await Promise.all([
      supabase.from("profiles").select("id,full_name,avatar_url").in("id", ids),
      supabase.from("business_profiles").select("owner_id,business_name").in("owner_id", ids),
    ]);

    if (!profileResult.error) {
      setProfiles((current) => {
        const next = { ...current };
        for (const row of (profileResult.data ?? []) as UserProfile[]) next[row.id] = row;
        return next;
      });
    }

    if (!businessResult.error) {
      setSupplierNames((current) => {
        const next = { ...current };
        for (const row of (businessResult.data ?? []) as { owner_id: string; business_name: string }[]) {
          next[row.owner_id] = row.business_name;
        }
        return next;
      });
    }
  }

  async function markIncomingAsRead(rows: Message[]) {
    if (!userId) return;

    const unread = rows.filter((row) => row.sender_id !== userId && !row.read_at);
    if (!unread.length) return;

    const readAt = new Date().toISOString();
    const result = await supabase
      .from("chat_messages")
      .update({ read_at: readAt })
      .in("id", unread.map((row) => row.id));

    if (!result.error) {
      const ids = new Set(unread.map((row) => row.id));
      setMessages((current) => current.map((row) => ids.has(row.id) ? { ...row, read_at: readAt } : row));
    }
  }

  async function selectConversation(row: Conversation) {
    setActiveConversation(row);
    await loadConversationMessages(row);
  }

  async function sendMessage() {
    const content = draft.trim();
    if (!content || !activeConversation || !userId || sending) return;

    setSending(true);
    setError("");

    const result = await supabase
      .from("chat_messages")
      .insert({
        conversation_id: activeConversation.id,
        sender_id: userId,
        content: content.slice(0, 2000),
      })
      .select(messageColumns)
      .single();

    if (result.error || !result.data) {
      console.error("Erro ao enviar mensagem:", result.error);
      setError("Não foi possível enviar a mensagem.");
      setSending(false);
      return;
    }

    const message = result.data as Message;
    setMessages((current) => current.some((row) => row.id === message.id) ? current : [...current, message]);
    setDraft("");

    const updated: Conversation = {
      ...activeConversation,
      updated_at: message.created_at,
      last_message_at: message.created_at,
      last_message_preview: message.content.slice(0, 160),
    };

    setActiveConversation(updated);
    setConversations((current) => current.map((row) => row.id === updated.id ? updated : row));
    setSending(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  function closeChat() {
    setOpen(false);
    setActiveConversation(null);
    setMessages([]);
    setDraft("");
    setError("");
  }

  function participantIdFor(conversation: Conversation) {
    return isSupplier ? conversation.requester_id : conversation.supplier_id;
  }

  function participantNameFor(conversation: Conversation) {
    const id = participantIdFor(conversation);
    return supplierNames[id] || profiles[id]?.full_name || business.business_name;
  }

  function participantAvatarFor(conversation: Conversation) {
    const id = participantIdFor(conversation);
    return profiles[id]?.avatar_url || null;
  }

  useEffect(() => {
    if (!open || !userId) return;

    if (isSupplier) {
      void loadSupplierInbox();
    }
  }, [open, userId, business.id, isSupplier]);

  useEffect(() => {
    if (!activeConversation || !userId) return;

    const channel = supabase
      .channel("provider-chat-" + activeConversation.id)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: "conversation_id=eq." + activeConversation.id,
        },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((current) => current.some((row) => row.id === incoming.id) ? current : [...current, incoming]);
          if (incoming.sender_id !== userId) void markIncomingAsRead([incoming]);
          void loadIdentities([incoming], activeConversation);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
          filter: "conversation_id=eq." + activeConversation.id,
        },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((current) => current.map((row) => row.id === updated.id ? { ...row, ...updated } : row));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeConversation?.id, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <>
      <div className="provider-chat-trigger-group">
        <button
          type="button"
          className="provider-chat-trigger"
          onClick={() => void openTargetChat()}
          aria-label={isSupplier ? "Abrir mensagens" : "Conversar com este fornecedor"}
          disabled={loading && !open}
        >
          <svg className="provider-chat-trigger-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-5.2 3v-3H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" />
            <path d="M7.5 10h9M7.5 13h6" />
          </svg>
        </button>
        <OnlineStatus userId={business.owner_id} />
      </div>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="provider-chat-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeChat();
          }}
        >
          <section className="provider-chat-window" role="dialog" aria-modal="true" aria-labelledby="provider-chat-title">
            <header className="provider-chat-header">
              <div className="provider-chat-header-profile">
                <div className="provider-chat-header-identity">
                  <div className="provider-chat-avatar">
                    {business.logo_url ? <img src={business.logo_url} alt="" /> : business.business_name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="provider-chat-header-copy">
                    <strong id="provider-chat-title">{business.business_name}</strong>
                    <span>{isSupplier ? "Caixa de mensagens" : "Chat interno LOSI CONECTA"}</span>
                  </div>
                </div>
              </div>
              <button type="button" className="provider-chat-close" onClick={closeChat} aria-label="Fechar chat">×</button>
            </header>

            {error && <div className="provider-chat-error" role="alert">{error}</div>}

            {activeConversation ? (
              <>
                <div className="provider-chat-conversation-bar">
                  <button type="button" onClick={() => { setActiveConversation(null); setMessages([]); setError(""); }} aria-label="Voltar para conversas">‹</button>
                  <div className="provider-chat-active-participant">
                    <div className="provider-chat-participant-avatar">
                      {participantAvatarFor(activeConversation)
                        ? <img src={participantAvatarFor(activeConversation) as string} alt={participantNameFor(activeConversation)} />
                        : participantNameFor(activeConversation).slice(0, 1).toUpperCase()}
                    </div>
                    <div className="provider-chat-participant-copy">
                      <strong>{participantNameFor(activeConversation)}</strong>
                      <span>{isSupplier ? "Cliente" : "Fornecedor"}</span>
                      <OnlineStatus userId={participantIdFor(activeConversation)} compact />
                    </div>
                  </div>
                </div>

                <div className="provider-chat-messages" aria-live="polite">
                  {loading && messages.length === 0 && <div className="provider-chat-empty">Carregando mensagens...</div>}
                  {!loading && messages.length === 0 && <div className="provider-chat-empty">Ainda não há mensagens. Envie a primeira.</div>}
                  {messages.map((message) => {
                    const mine = message.sender_id === userId;
                    const senderName = supplierNames[message.sender_id] || profiles[message.sender_id]?.full_name || (mine ? "Você" : "Usuário");
                    const senderAvatar = profiles[message.sender_id]?.avatar_url || null;
                    return (
                      <div key={message.id} className={"provider-chat-message-row " + (mine ? "mine" : "theirs")}>
                        <div className="provider-chat-message-identity">
                          <div className="provider-chat-message-avatar">
                            {senderAvatar ? <img src={senderAvatar} alt={senderName} /> : senderName.slice(0, 1).toUpperCase()}
                          </div>
                          <span className="provider-chat-message-sender-name">{senderName}</span>
                        </div>
                        <div className="provider-chat-message-bubble">
                          <p>{message.content}</p>
                          <div className="provider-chat-message-meta">
                            <time>{new Date(message.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>
                            <span className="provider-chat-message-checks" aria-label={message.read_at ? "Mensagem lida" : message.delivered_at ? "Mensagem recebida" : "Mensagem não recebida"}>
                              <span className={message.delivered_at ? "is-active" : ""}>✓</span>
                              <span className={message.read_at ? "is-active" : ""}>✓</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <div className="provider-chat-composer">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    maxLength={2000}
                    placeholder="Digite uma mensagem"
                    aria-label="Mensagem"
                  />
                  <button type="button" onClick={() => void sendMessage()} disabled={sending || !draft.trim()} aria-label="Enviar mensagem">
                    {sending ? "…" : "➤"}
                  </button>
                </div>
              </>
            ) : (
              <div className="provider-chat-list">
                {loading && <div className="provider-chat-empty">Carregando conversas...</div>}

                {!loading && sortedConversations.length === 0 && (
                  <div className="provider-chat-empty">
                    <strong>{isSupplier ? "Nenhuma conversa ainda" : "Inicie uma nova conversa"}</strong>
                    <span>{isSupplier ? "Quando alguém falar com você, a conversa aparecerá aqui." : "A conversa será criada automaticamente para você."}</span>
                    {!isSupplier && (
                      <button type="button" className="provider-chat-start-button" onClick={() => void openTargetChat()}>
                        Iniciar conversa
                      </button>
                    )}
                  </div>
                )}

                {!loading && !isSupplier && sortedConversations.length > 0 && (
                  <div className="provider-chat-new-conversation-row">
                    <button type="button" className="provider-chat-start-button" onClick={() => void openTargetChat()}>
                      + Abrir conversa
                    </button>
                  </div>
                )}

                {sortedConversations.map((conversation) => (
                  <button
                    type="button"
                    className="provider-chat-conversation-item"
                    key={conversation.id}
                    onClick={() => void selectConversation(conversation)}
                  >
                    <div className="provider-chat-conversation-avatar">
                      {business.logo_url ? <img src={business.logo_url} alt="" /> : business.business_name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="provider-chat-conversation-copy">
                      <strong>{isSupplier ? participantNameFor(conversation) : business.business_name}</strong>
                      <span>{conversation.last_message_preview || "Nova conversa"}</span>
                    </div>
                    <time>{new Date(conversation.updated_at).toLocaleDateString("pt-BR")}</time>
                  </button>
                ))}
              </div>
            )}

            <div className="provider-chat-footer-note">
              O chat é interno ao LOSI CONECTA. Para continuar a negociação, você também pode usar o WhatsApp do fornecedor.
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}

export function ProviderChat(props: Props) {
  return <ProviderChatContent {...props} />;
}
