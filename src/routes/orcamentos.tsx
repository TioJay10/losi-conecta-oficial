import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { AppLogo } from "../components/AppLogo";

type RequestRow = {
  id: string;
  business_id: string;
  requester_id: string;
  service_id: string | null;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  event_title: string;
  event_date: string | null;
  event_location: string | null;
  description: string | null;
  status: string;
  created_at: string;
  services?: { name: string } | null;
};

type QuoteRow = {
  id: string;
  request_id: string;
  business_id: string;
  client_id: string;
  subtotal: number;
  discount: number;
  total: number;
  validity_until: string | null;
  notes: string | null;
  status: string;
  sent_at: string | null;
  created_at: string;
  quote_items?: { id: string; description: string; quantity: number; unit_price: number; total: number }[];
  quote_requests?: RequestRow;
};

type BusinessContact = {
  id: string;
  business_name: string;
  whatsapp: string | null;
  phone: string | null;
};

type ItemDraft = { description: string; quantity: string; unit_price: string };

export const Route = createFileRoute("/orcamentos")({
  component: QuotesPage,
});

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Aguardando orçamento",
    quoted: "Orçamento enviado",
    accepted: "Aceito",
    rejected: "Recusado",
    cancelled: "Cancelado",
    expired: "Expirado",
    draft: "Rascunho",
    sent: "Enviado",
    viewed: "Visualizado",
  };
  return labels[status] || status;
}

function QuotesPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [businessContacts, setBusinessContacts] = useState<Record<string, BusinessContact>>({});
  const [selectedRequest, setSelectedRequest] = useState<RequestRow | null>(null);
  const [items, setItems] = useState<ItemDraft[]>([{ description: "", quantity: "1", unit_price: "" }]);
  const [discount, setDiscount] = useState("0");
  const [validityUntil, setValidityUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [sentThisMonth, setSentThisMonth] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = sessionData.session?.user;
      if (!currentUser) {
        navigate({ to: "/entrar" });
        return;
      }

      const { data: business } = await supabase
        .from("business_profiles")
        .select("id,business_name")
        .eq("owner_id", currentUser.id)
        .maybeSingle();

      if (!mounted) return;
      setUserId(currentUser.id);

      if (business?.id) {
        setBusinessId(business.id);
        setBusinessName(business.business_name);

        const [{ data: requestRows, error: requestsError }, { data: quoteRows, error: quotesError }] = await Promise.all([
          supabase.from("quote_requests")
            .select("id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name)")
            .eq("business_id", business.id)
            .order("created_at", { ascending: false }),
          supabase.from("quotes")
            .select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,created_at,quote_items(id,description,quantity,unit_price,total),quote_requests(id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at)")
            .eq("business_id", business.id)
            .order("created_at", { ascending: false }),
        ]);

        if (requestsError) console.error("Erro ao carregar solicitações de orçamento:", requestsError);
        if (quotesError) console.error("Erro ao carregar orçamentos enviados:", quotesError);

        if (mounted) {
          setRequests((requestRows ?? []) as unknown as RequestRow[]);
          setQuotes((quoteRows ?? []) as unknown as QuoteRow[]);
          if (requestsError || quotesError) {
            setMessage("Não foi possível carregar todos os dados de orçamento. Tente atualizar a página.");
          }
        }

        const firstDay = new Date();
        firstDay.setDate(1);
        firstDay.setHours(0, 0, 0, 0);
        const { count, error: sentCountError } = await supabase.from("quotes")
          .select("id", { count: "exact", head: true })
          .eq("business_id", business.id)
          .not("sent_at", "is", null)
          .gte("sent_at", firstDay.toISOString());

        if (sentCountError) console.error("Erro ao contar orçamentos enviados no mês:", sentCountError);
        if (mounted) setSentThisMonth(count ?? 0);
      } else {
        const { data: received, error: receivedError } = await supabase
          .from("quotes")
          .select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,created_at,quote_items(id,description,quantity,unit_price,total),quote_requests(id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at)")
          .eq("client_id", currentUser.id)
          .order("created_at", { ascending: false });

        if (receivedError) console.error("Erro ao carregar orçamentos recebidos:", receivedError);

        if (mounted) {
          setQuotes((received ?? []) as unknown as QuoteRow[]);

          const businessIds = [...new Set((received ?? []).map((quote: any) => quote.business_id).filter(Boolean))];
          if (businessIds.length > 0) {
            const { data: businesses } = await supabase
              .from("business_profiles")
              .select("id,business_name,whatsapp,phone")
              .in("id", businessIds);

            const contacts = (businesses ?? []).reduce<Record<string, BusinessContact>>((map, business) => {
              map[business.id] = business as BusinessContact;
              return map;
            }, {});
            setBusinessContacts(contacts);
          }
        }
      }

      if (mounted) setLoading(false);
    }

    load();
    return () => { mounted = false; };
  }, [navigate]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0),
    [items],
  );
  const discountValue = Math.max(0, Number(discount) || 0);
  const total = Math.max(0, subtotal - discountValue);

  function updateItem(index: number, field: keyof ItemDraft, value: string) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  }

  function resetForm() {
    setSelectedRequest(null);
    setItems([{ description: "", quantity: "1", unit_price: "" }]);
    setDiscount("0");
    setValidityUntil("");
    setNotes("");
  }

  async function sendQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRequest || !businessId || !userId || saving) return;
    setMessage("");
    setMessageType("");
    setSaving(true);

    const validItems = items
      .map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.unit_price) || 0,
      }))
      .filter((item) => item.description && item.quantity > 0);

    if (!validItems.length) {
      setMessageType("error");
      setMessage("NÃO FOI POSSÍVEL ENVIAR O ORÇAMENTO");
      setSaving(false);
      return;
    }

    const { data: quote, error: quoteError } = await supabase.from("quotes").insert({
      request_id: selectedRequest.id,
      business_id: businessId,
      client_id: selectedRequest.requester_id,
      subtotal,
      discount: discountValue,
      total,
      validity_until: validityUntil || null,
      notes: notes.trim() || null,
      status: "sent",
      sent_at: new Date().toISOString(),
    }).select("id").single();

    if (quoteError || !quote) {
      console.error("Erro ao criar orçamento:", quoteError);
      setMessageType("error");
      setMessage("NÃO FOI POSSÍVEL ENVIAR O ORÇAMENTO");
      setSaving(false);
      return;
    }

    const { error: itemsError } = await supabase.from("quote_items").insert(
      validItems.map((item) => ({
        quote_id: quote.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.quantity * item.unit_price,
      })),
    );

    if (itemsError) {
      console.error("Erro ao salvar itens do orçamento:", itemsError);
      await supabase.from("quotes").delete().eq("id", quote.id);
      setMessageType("error");
      setMessage("NÃO FOI POSSÍVEL ENVIAR O ORÇAMENTO");
      setSaving(false);
      return;
    }

    const { error: requestStatusError } = await supabase
      .from("quote_requests")
      .update({ status: "quoted" })
      .eq("id", selectedRequest.id)
      .eq("business_id", businessId);

    if (requestStatusError) {
      console.error("Erro ao atualizar status da solicitação:", requestStatusError);
    }
    const refreshed = await supabase
      .from("quotes")
      .select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,created_at,quote_items(id,description,quantity,unit_price,total),quote_requests(id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at)")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (refreshed.error) {
      console.error("Erro ao atualizar histórico de orçamentos:", refreshed.error);
    }
    setQuotes((refreshed.data ?? []) as unknown as QuoteRow[]);
    setRequests((current) => current.map((request) => request.id === selectedRequest.id ? { ...request, status: "quoted" } : request));
    setSentThisMonth((value) => value + 1);
    resetForm();
    setMessageType("success");
    setMessage("ORÇAMENTO ENVIADO COM SUCESSO");
    setSaving(false);
  }

  function normalizeWhatsAppNumber(value: string | null | undefined) {
    const digits = (value ?? "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("55")) return digits;
    if (digits.length === 10 || digits.length === 11) return "55" + digits;
    return digits;
  }

  function formatQuoteDate(value: string | null) {
    return value ? new Date(value + "T12:00:00").toLocaleDateString("pt-BR") : "Não informada";
  }

  function buildQuoteWhatsAppMessage(quote: QuoteRow, recipientName: string, senderName: string) {
    const request = quote.quote_requests;
    const itemLines = (quote.quote_items ?? [])
      .map((item) => "• " + item.quantity + "x " + item.description + " — " + money(Number(item.total)))
      .join("\n");

    return [
      "Olá, " + recipientName + "! Segue o orçamento solicitado para seu evento.",
      "",
      "Fornecedor: " + senderName,
      "Evento: " + (request?.event_title || "Não informado"),
      "Data: " + formatQuoteDate(request?.event_date ?? null),
      request?.event_location ? "Local: " + request.event_location : "",
      "",
      "Itens:",
      itemLines || "• Itens conforme orçamento no LOSI CONECTA",
      "",
      "Subtotal: " + money(Number(quote.subtotal)),
      "Desconto: " + money(Number(quote.discount)),
      "TOTAL: " + money(Number(quote.total)),
      quote.validity_until ? "Validade: " + formatQuoteDate(quote.validity_until) : "",
      quote.notes ? "Observações: " + quote.notes : "",
      "",
      "Orçamento enviado pelo LOSI CONECTA.",
    ].filter(Boolean).join("\n");
  }

  function openWhatsApp(phone: string | null | undefined, text: string) {
    const number = normalizeWhatsAppNumber(phone);
    if (!number) {
      setMessage("O telefone/WhatsApp do cliente não foi informado neste orçamento.");
      return;
    }
    window.open("https://wa.me/" + number + "?text=" + encodeURIComponent(text), "_blank", "noopener,noreferrer");
  }

  function shareQuoteOnWhatsApp(quote: QuoteRow) {
    const business = businessContacts[quote.business_id];
    const message = buildQuoteWhatsAppMessage(
      quote,
      "cliente",
      business?.business_name || "Fornecedor",
    );
    window.open("https://wa.me/?text=" + encodeURIComponent(message), "_blank", "noopener,noreferrer");
  }

  async function respondToQuote(quote: QuoteRow, status: "accepted" | "rejected") {
    const { error } = await supabase.from("quotes").update({
      status,
      responded_at: new Date().toISOString(),
    }).eq("id", quote.id).eq("client_id", userId);

    if (error) {
      console.error("Erro ao responder orçamento:", error);
      setMessage(error.message || "Não foi possível atualizar o orçamento.");
      return;
    }

    setQuotes((current) => current.map((item) => item.id === quote.id ? { ...item, status } : item));
  }

  if (loading) return <main className="quotes-page-state">Carregando orçamentos...</main>;

  const providerMode = Boolean(businessId);
  const pendingRequests = requests.filter((request) => request.status === "pending");

  return (
    <main className="quotes-page">
      <header className="quotes-header">
        <AppLogo className="catalog-logo">LOSI <span>CONECTA</span></AppLogo>
        <Link to="/painel" className="quotes-back">Voltar ao painel</Link>
      </header>

      <section className="quotes-content">
        <div className="quotes-kicker">ORÇAMENTOS</div>
        <h1>{providerMode ? "Orçamentos da sua empresa" : "Meus orçamentos"}</h1>
        <p className="quotes-intro">{providerMode ? "Receba solicitações, monte propostas e acompanhe o que já foi enviado aos seus clientes." : "Acompanhe os orçamentos enviados pelos fornecedores que você contatou."}</p>

        {providerMode ? (
          <>
            <div className="quotes-metrics">
              <article><span>Enviados este mês</span><strong>{sentThisMonth}</strong></article>
              <article><span>Aguardando orçamento</span><strong>{pendingRequests.length}</strong></article>
              <article><span>Total de orçamentos</span><strong>{quotes.length}</strong></article>
            </div>

            {message && <div className={"quotes-message " + messageType} role="status">{message}</div>}

            {selectedRequest ? (
              <form className="quote-builder" onSubmit={sendQuote}>
                <div className="quote-builder-head">
                  <div>
                    <div className="quotes-kicker">NOVO ORÇAMENTO</div>
                    <h2>{selectedRequest.event_title}</h2>
                    <p>Cliente: <strong>{selectedRequest.client_name}</strong>{selectedRequest.client_phone ? " · " + selectedRequest.client_phone : ""}</p>
                  </div>
                  <button type="button" className="quotes-secondary" onClick={resetForm}>Cancelar</button>
                </div>
                <div className="quote-builder-grid">
                  <div>
                    <label>Itens do orçamento</label>
                    {items.map((item, index) => (
                      <div className="quote-item-row" key={index}>
                        <input value={item.description} onChange={(e) => updateItem(index, "description", e.target.value)} placeholder="Descrição do serviço/item" />
                        <input value={item.quantity} onChange={(e) => updateItem(index, "quantity", e.target.value)} type="number" min="0.01" step="0.01" placeholder="Qtd." />
                        <input value={item.unit_price} onChange={(e) => updateItem(index, "unit_price", e.target.value)} type="number" min="0" step="0.01" placeholder="Valor unitário" />
                        {items.length > 1 && <button type="button" className="quote-remove-item" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>}
                      </div>
                    ))}
                    <button type="button" className="quotes-secondary" onClick={() => setItems((current) => [...current, { description: "", quantity: "1", unit_price: "" }])}>+ Adicionar item</button>
                  </div>
                  <div className="quote-side-fields">
                    <label>Desconto<input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} /></label>
                    <label>Validade<input type="date" value={validityUntil} onChange={(e) => setValidityUntil(e.target.value)} /></label>
                    <label>Observações<textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Condições, prazo, formas de pagamento..." /></label>
                  </div>
                </div>
                <div className="quote-total-box">
                  <span>Subtotal <strong>{money(subtotal)}</strong></span>
                  <span>Desconto <strong>{money(discountValue)}</strong></span>
                  <span>Total <strong>{money(total)}</strong></span>
                </div>
                <button className="quotes-primary" type="submit" disabled={saving}>{saving ? "Enviando..." : "Enviar orçamento ao cliente"}</button>
              </form>
            ) : (
              <section className="quotes-section">
                <div className="quotes-section-head"><div><div className="quotes-kicker">SOLICITAÇÕES</div><h2>Pedidos de orçamento</h2></div></div>
                {pendingRequests.length === 0 ? <div className="quotes-empty">Nenhuma solicitação aguardando orçamento.</div> : (
                  <div className="quote-request-list">
                    {pendingRequests.map((request) => (
                      <article key={request.id} className="quote-request-card">
                        <div>
                          <span className="quote-status pending">{statusLabel(request.status)}</span>
                          <h3>{request.event_title}</h3>
                          <strong>{request.client_name}</strong>
                          <p>{request.event_date ? new Date(request.event_date + "T12:00:00").toLocaleDateString("pt-BR") + " · " : ""}{request.event_location || "Local não informado"}</p>
                          {request.description && <p>{request.description}</p>}
                        </div>
                        <button className="quotes-primary" type="button" onClick={() => setSelectedRequest(request)}>Fazer orçamento</button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}

            <section className="quotes-section">
              <div className="quotes-section-head"><div><div className="quotes-kicker">HISTÓRICO</div><h2>Orçamentos enviados</h2></div></div>
              {quotes.length === 0 ? <div className="quotes-empty">Você ainda não enviou nenhum orçamento.</div> : (
                <div className="quote-history-list">
                  {quotes.map((quote) => (
                    <article key={quote.id} className="quote-history-card">
                      <div><span className={"quote-status " + quote.status}>{statusLabel(quote.status)}</span><h3>{quote.quote_requests?.event_title || "Orçamento"}</h3><p>Cliente: {quote.quote_requests?.client_name || "—"}</p></div>
                      <div className="quote-history-actions">
                        <strong>{money(Number(quote.total))}</strong>
                        <button
                          className="quotes-whatsapp"
                          type="button"
                          onClick={() => openWhatsApp(
                            quote.quote_requests?.client_phone,
                            buildQuoteWhatsAppMessage(quote, quote.quote_requests?.client_name || "cliente", businessName),
                          )}
                          disabled={!normalizeWhatsAppNumber(quote.quote_requests?.client_phone)}
                          title={!normalizeWhatsAppNumber(quote.quote_requests?.client_phone) ? "WhatsApp do cliente não informado" : "Enviar orçamento pelo WhatsApp"}
                        >
                          Enviar pelo WhatsApp
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="quotes-section">
            <div className="quotes-section-head"><div><div className="quotes-kicker">RECEBIDOS</div><h2>Orçamentos enviados para você</h2></div></div>
            {quotes.length === 0 ? <div className="quotes-empty">Você ainda não recebeu nenhum orçamento.</div> : (
              <div className="quote-history-list">
                {quotes.map((quote) => (
                  <article key={quote.id} className="quote-client-card">
                    <div>
                      <span className={"quote-status " + quote.status}>{statusLabel(quote.status)}</span>
                      <h3>{quote.quote_requests?.event_title || "Orçamento"}</h3>
                      <p>{quote.quote_requests?.event_location || "Local não informado"}{quote.validity_until ? " · válido até " + new Date(quote.validity_until + "T12:00:00").toLocaleDateString("pt-BR") : ""}</p>
                      {quote.notes && <p>{quote.notes}</p>}
                      <div className="quote-client-items">{(quote.quote_items ?? []).map((item) => <div key={item.id}><span>{item.description} × {item.quantity}</span><strong>{money(Number(item.total))}</strong></div>)}</div>
                    </div>
                    <div className="quote-client-total">
                      <span>Total</span>
                      <strong>{money(Number(quote.total))}</strong>
                      <div className="quote-client-actions">
                        <button className="quotes-whatsapp" type="button" onClick={() => shareQuoteOnWhatsApp(quote)}>
                          Compartilhar no WhatsApp
                        </button>
                        {(quote.status === "sent" || quote.status === "viewed") && <><button className="quotes-primary" type="button" onClick={() => respondToQuote(quote, "accepted")}>Aceitar</button><button className="quotes-secondary" type="button" onClick={() => respondToQuote(quote, "rejected")}>Recusar</button></>}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
