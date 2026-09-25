import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type Business = {
  id: string;
  business_name: string;
  slug: string;
  logo_url: string | null;
  owner_id: string;
};

type UserProfile = { id: string; full_name: string | null; avatar_url: string | null };
type SupplierProfile = { owner_id: string; business_name: string; logo_url: string | null; slug: string; };

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

export function ProviderChat({ business, userId, onRequireAuth }: Props) {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [pendingChatId, setPendingChatId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [supplierProfiles, setSupplierProfiles] = useState<Record<string, SupplierProfile>>({});
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const isSupplier = Boolean(userId && userId === business.owner_id);

  function getSenderIdentity(senderId: string) {
    const supplier = supplierProfiles[senderId];
    if (supplier) {
      return { name: supplier.business_name, avatar: supplier.logo_url || profiles[senderId]?.avatar_url || null };
    }
    const profile = profiles[senderId];
    return { name: profile?.full_name || "Usuário", avatar: profile?.avatar_url || null };
  }

  const sortedConversations = useMemo(
    () => [...conversations].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [conversations],
  );

  useEffect(() => {
    const chatId = new URLSearchParams(window.location.search).get("chat");
    if (chatId) {
      setPendingChatId(chatId);
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!open || !userId) return;

    let mounted = true;
    async function loadConversations() {
      setLoading(true);
      setError("");
      const { data, error: loadError } = await supabase
        .from("chat_conversations")
        .select("id,business_id,requester_id,supplier_id,updated_at,last_message_at,last_message_preview")
        .eq("business_id", business.id)
        .or("requester_id.eq." + userId + ",supplier_id.eq." + userId)
        .order("updated_at", { ascending: false });

      if (!mounted) return;
      if (loadError) {
        console.error("Erro ao carregar conversas:", loadError);
        setError("Não foi possível carregar as conversas.");
      } else {
        setConversations((data ?? []) as Conversation[]);
      }
      setLoading(false);
    }

    void loadConversations();
    return () => { mounted = false; };
  }, [open, userId, business.id]);

  useEffect(() => {
    if (!open || !userId || conversations.length === 0) return;
    const ids = Array.from(new Set(conversations.map((conversation) => isSupplier ? conversation.requester_id : conversation.supplier_id)));
    const missing = ids.filter((id) => !profiles[id]);
    if (!missing.length) return;
    let mounted = true;
    async function loadProfiles() {
      const { data, error } = await supabase.from("profiles").select("id,full_name,avatar_url").in("id", missing);
      if (!mounted || error) return;
      const next = { ...profiles };
      for (const profile of (data ?? []) as UserProfile[]) next[profile.id] = profile;
      setProfiles(next);
    }
    void loadProfiles();
    return () => { mounted = false; };
  }, [open, userId, conversations, isSupplier]);

  useEffect(() => {
    if (!pendingChatId || conversations.length === 0) return;
    const found = conversations.find((conversation) => conversation.id === pendingChatId);
    if (found) {
      setActiveConversation(found);
      setPendingChatId(null);
    }
  }, [pendingChatId, conversations]);

  useEffect(() => {
    if (!activeConversation || !userId) return;
    const participantIds = [activeConversation.requester_id, activeConversation.supplier_id];
    const missing = participantIds.filter((id) => !profiles[id]);
    if (!missing.length) return;
    let mounted = true;
    async function loadActiveProfiles() {
      const { data, error } = await supabase.from("profiles").select("id,full_name,avatar_url").in("id", missing);
      if (!mounted || error) return;
      setProfiles((current) => {
        const next = { ...current };
        for (const profile of (data ?? []) as UserProfile[]) next[profile.id] = profile;
        return next;
      });
    }
    void loadActiveProfiles();
    return () => { mounted = false; };
  }, [activeConversation?.id, userId, profiles]);

  useEffect(() => {
    if (!activeConversation || messages.length === 0) return;
    let mounted = true;

    async function loadSenderIdentities() {
      const senderIds = Array.from(new Set(messages.map((message) => message.sender_id)));
      const missingProfiles = senderIds.filter((id) => !profiles[id]);
      const missingSuppliers = senderIds.filter((id) => !supplierProfiles[id]);

      const [profileResult, supplierResult] = await Promise.all([
        missingProfiles.length
          ? supabase.from("profiles").select("id,full_name,avatar_url").in("id", missingProfiles)
          : Promise.resolve({ data: [], error: null }),
        missingSuppliers.length
          ? supabase.from("business_profiles").select("owner_id,business_name,logo_url,slug").in("owner_id", missingSuppliers).eq("active", true).eq("approval_status", "approved")
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (!mounted) return;

      if (!profileResult.error) {
        setProfiles((current) => {
          const next = { ...current };
          for (const profile of (profileResult.data ?? []) as UserProfile[]) next[profile.id] = profile;
          return next;
        });
      }

      if (!supplierResult.error) {
        setSupplierProfiles((current) => {
          const next = { ...current };
          for (const supplier of (supplierResult.data ?? []) as SupplierProfile[]) next[supplier.owner_id] = supplier;
          return next;
        });
      }
    }

    void loadSenderIdentities();
    return () => { mounted = false; };
  }, [activeConversation?.id, messages, profiles, supplierProfiles]);

  useEffect(() => {
    if (!activeConversation || !userId) return;

    let mounted = true;
    async function loadMessages() {
      setLoading(true);
      const { data, error: loadError } = await supabase
        .from("chat_messages")
        .select("id,conversation_id,sender_id,content,created_at,delivered_at,read_at")
        .eq("conversation_id", activeConversation.id)
        .order("created_at", { ascending: true });

      if (!mounted) return;
      if (loadError) {
        console.error("Erro ao carregar mensagens:", loadError);
        setError("Não foi possível carregar as mensagens.");
      } else {
        setMessages((data ?? []) as Message[]);
        await markIncomingAsRead((data ?? []) as Message[]);
      }
      setLoading(false);
    }

    void loadMessages();

    const channel = supabase
      .channel("chat-messages-" + activeConversation.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: "conversation_id=eq." + activeConversation.id },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((current) => current.some((message) => message.id === incoming.id) ? current : [...current, incoming]);
          if (incoming.sender_id !== userId) void markIncomingAsRead([incoming]);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages", filter: "conversation_id=eq." + activeConversation.id },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((current) => current.map((message) => message.id === updated.id ? { ...message, ...updated } : message));
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [activeConversation?.id, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function markIncomingAsRead(rows: Message[]) {
    if (!userId) return;
    const unread = rows.filter((message) => message.sender_id !== userId && !message.read_at);
    if (!unread.length) return;
    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from("chat_messages")
      .update({ read_at: readAt })
      .in("id", unread.map((message) => message.id));
    if (!error) {
      const unreadIds = new Set(unread.map((message) => message.id));
      setMessages((current) => current.map((message) => unreadIds.has(message.id) ? { ...message, read_at: readAt } : message));
    }
  }

  async function openNewConversation() {
    if (!userId) {
      onRequireAuth();
      return;
    }
    if (userId === business.owner_id) return;

    setOpen(true);
    setLoading(true);
    setError("");

    // Uma conversa pertence às duas pessoas, não ao caminho pelo qual o perfil foi aberto.
    // Primeiro procuramos o histórico nos dois sentidos. Isso evita criar uma segunda
    // conversa quando, por exemplo, o fornecedor recebeu uma mensagem do usuário e
    // depois abre o perfil público desse mesmo usuário/fornecedor para responder.
    const selectDirect = await supabase
      .from("chat_conversations")
      .select("id,business_id,requester_id,supplier_id,updated_at,last_message_at,last_message_preview")
      .eq("requester_id", userId)
      .eq("supplier_id", business.owner_id)
      .maybeSingle();

    let data = selectDirect.data;
    let lookupError = selectDirect.error;

    if (!data && !lookupError) {
      const selectReverse = await supabase
        .from("chat_conversations")
        .select("id,business_id,requester_id,supplier_id,updated_at,last_message_at,last_message_preview")
        .eq("requester_id", business.owner_id)
        .eq("supplier_id", userId)
        .maybeSingle();

      data = selectReverse.data;
      lookupError = selectReverse.error;
    }

    // Compatibilidade com conversas antigas: se não houver uma conversa pelo par,
    // ainda verificamos a conversa vinculada ao fornecedor deste perfil.
    if (!data && !lookupError) {
      const selectByBusiness = await supabase
        .from("chat_conversations")
        .select("id,business_id,requester_id,supplier_id,updated_at,last_message_at,last_message_preview")
        .eq("business_id", business.id)
        .eq("requester_id", userId)
        .maybeSingle();

      data = selectByBusiness.data;
      lookupError = selectByBusiness.error;
    }

    if (lookupError) {
      console.error("Erro ao localizar conversa:", lookupError);
      setError("Não foi possível iniciar o chat.");
    } else {
      if (!data) {
        const created = await supabase
          .from("chat_conversations")
          .insert({ business_id: business.id, requester_id: userId, supplier_id: business.owner_id })
          .select("id,business_id,requester_id,supplier_id,updated_at,last_message_at,last_message_preview")
          .single();

        if (created.error) {
          console.error("Erro ao criar conversa:", created.error);
          setError("Não foi possível iniciar o chat.");
          setLoading(false);
          return;
        }
        data = created.data;
      }

      const conversation = data as Conversation;
      setConversations((current) => [conversation, ...current.filter((item) => item.id !== conversation.id)]);
      setActiveConversation(conversation);
    }
    setLoading(false);
  }

  async function sendMessage() {
    const content = draft.trim();
    if (!content || !activeConversation || !userId || sending) return;

    setSending(true);
    setError("");
    const { data, error: sendError } = await supabase
      .from("chat_messages")
      .insert({
        conversation_id: activeConversation.id,
        sender_id: userId,
        content: content.slice(0, 2000),
      })
      .select("id,conversation_id,sender_id,content,created_at,delivered_at,read_at")
      .single();

    if (sendError || !data) {
      console.error("Erro ao enviar mensagem:", sendError);
      setError("Não foi possível enviar a mensagem.");
    } else {
      const message = data as Message;
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      setDraft("");
      const updated = {
        ...activeConversation,
        updated_at: message.created_at,
        last_message_at: message.created_at,
        last_message_preview: message.content.slice(0, 160),
      };
      setActiveConversation(updated);
      setConversations((current) => current.map((item) => item.id === updated.id ? updated : item));
    }
    setSending(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  function closeChat() {
    setOpen(false);
    setActiveConversation(null);
    setError("");
  }

  return (
    <>
      <button
        type="button"
        className="provider-chat-trigger"
        onClick={() => {
          if (!userId) {
            onRequireAuth();
            return;
          }
          if (isSupplier) {
            setOpen(true);
          } else {
            void openNewConversation();
          }
        }}
        aria-label={isSupplier ? "Abrir mensagens" : "Conversar com este fornecedor"}
      >
        <span className="provider-chat-trigger-icon" aria-hidden="true">▰</span>
        <span>{isSupplier ? "Mensagens" : "Chat"}</span>
      </button>

      {open && (
        <div className="provider-chat-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeChat();
        }}>
          <section className="provider-chat-window" role="dialog" aria-modal="true" aria-labelledby="provider-chat-title">
            <header className="provider-chat-header">
              <div className="provider-chat-header-profile">
                <div className="provider-chat-avatar">
                  {business.logo_url ? <img src={business.logo_url} alt="" /> : business.business_name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <strong id="provider-chat-title">{business.business_name}</strong>
                  <span>{isSupplier ? "Caixa de mensagens" : "Chat interno LOSI CONECTA"}</span>
                </div>
              </div>
              <button type="button" className="provider-chat-close" onClick={closeChat} aria-label="Fechar chat">×</button>
            </header>

            {activeConversation ? (
              <>
                <div className="provider-chat-conversation-bar">
                  <button type="button" onClick={() => setActiveConversation(null)} aria-label="Voltar para conversas">‹</button>
                  <div className="provider-chat-active-participant">
                    {(() => {
                      const participantId = isSupplier ? activeConversation.requester_id : activeConversation.supplier_id;
                      const participant = profiles[participantId];
                      const supplier = supplierProfiles[participantId];
                      const name = supplier?.business_name || participant?.full_name || business.business_name;
                      const avatar = supplier?.logo_url || participant?.avatar_url || null;
                      return <>
                        <div className="provider-chat-participant-avatar">
                          {avatar ? <img src={avatar} alt={name} /> : name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="provider-chat-participant-copy">
                          <strong>{name}</strong>
                          <span>{supplierProfiles[participantId] ? "Fornecedor" : "Perfil pessoal"}</span>
                        </div>
                      </>;
                    })()}
                  </div>
                </div>
                <div className="provider-chat-messages" aria-live="polite">
                  {loading && messages.length === 0 && <div className="provider-chat-empty">Carregando mensagens...</div>}
                  {!loading && messages.length === 0 && <div className="provider-chat-empty">Ainda não há mensagens. Envie a primeira.</div>}
                  {messages.map((message) => {
                    const mine = message.sender_id === userId;
                    return (
                      <div key={message.id} className={"provider-chat-message-row " + (mine ? "mine" : "theirs")}>
                        <div className="provider-chat-message-identity">
                          {(() => {
                            const sender = getSenderIdentity(message.sender_id);
                            return <>
                              <div className="provider-chat-message-avatar">
                                {sender.avatar ? <img src={sender.avatar} alt={sender.name} /> : sender.name.slice(0, 1).toUpperCase()}
                              </div>
                              <span className="provider-chat-message-sender-name">{sender.name}</span>
                            </>;
                          })()}
                        </div>
                        <div className="provider-chat-message-bubble">
                          <p>{message.content}</p>
                          <div className="provider-chat-message-meta">
                            <time>{new Date(message.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>
                            <span className="provider-chat-message-checks" aria-label={message.read_at ? "Mensagem lida" : message.delivered_at ? "Mensagem recebida" : "Mensagem não recebida"}>
                              <span className={message.delivered_at ? "is-active" : ""}>✓</span><span className={message.read_at ? "is-active" : ""}>✓</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
                {error && <div className="provider-chat-error">{error}</div>}
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
              <>
                <div className="provider-chat-list">
                  {loading && <div className="provider-chat-empty">Carregando conversas...</div>}
                  {!loading && sortedConversations.length === 0 && (
                    <div className="provider-chat-empty">
                      <strong>{isSupplier ? "Nenhuma conversa ainda" : "Comece uma conversa"}</strong>
                      <span>{isSupplier ? "Quando alguém falar com você, a conversa aparecerá aqui." : "Tire suas dúvidas com o fornecedor antes de seguir para o WhatsApp."}</span>
                    </div>
                  )}
                  {sortedConversations.map((conversation) => (
                    <button type="button" className="provider-chat-conversation-item" key={conversation.id} onClick={() => setActiveConversation(conversation)}>
                      <div className="provider-chat-conversation-avatar">
                        {business.logo_url ? <img src={business.logo_url} alt="" /> : business.business_name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="provider-chat-conversation-copy">
                        <strong>{isSupplier ? "Cliente" : business.business_name}</strong>
                        <span>{conversation.last_message_preview || "Nova conversa"}</span>
                      </div>
                      <time>{new Date(conversation.updated_at).toLocaleDateString("pt-BR")}</time>
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="provider-chat-footer-note">
              O chat é interno ao LOSI CONECTA. Para continuar a negociação, você também pode usar o WhatsApp do fornecedor.
            </div>
          </section>
        </div>
      )}
    </>
  );
}
