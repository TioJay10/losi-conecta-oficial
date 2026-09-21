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
  const [clientRequests, setClientRequests] = useState<RequestRow[]>([]);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [clientQuotes, setClientQuotes] = useState<QuoteRow[]>([]);
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
  const [activeMetric, setActiveMetric] = useState<"sent" | "pending" | "total" | "received" | "supplier-pending" | "supplier-sent" | null>(null);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterType, setFilterType] = useState("all");

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
            .select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,created_at,quote_items(id,description,quantity,unit_price,total),quote_requests(id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name))")
            .eq("business_id", business.id)
            .order("created_at", { ascending: false }),
        ]);

        if (requestsError) console.error("Erro ao carregar solicitações de orçamento:", requestsError);
        if (quotesError) console.error("Erro ao carregar orçamentos enviados:", quotesError);

        const { data: requestedByUser } = await supabase
          .from("quote_requests")
          .select("id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name)")
          .eq("requester_id", currentUser.id)
          .order("created_at", { ascending: false });

        const { data: receivedByUser } = await supabase
          .from("quotes")
          .select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,created_at,quote_items(id,description,quantity,unit_price,total),quote_requests(id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name))")
          .eq("client_id", currentUser.id)
          .order("created_at", { ascending: false });

        if (mounted) {
          setRequests((requestRows ?? []) as unknown as RequestRow[]);
          setQuotes((quoteRows ?? []) as unknown as QuoteRow[]);
          setClientRequests((requestedByUser ?? []) as unknown as RequestRow[]);
          setClientQuotes((receivedByUser ?? []) as unknown as QuoteRow[]);
          if (requestsError || quotesError) {
            setMessage("Não foi possível carregar todos os dados de orçamento. Tente atualizar a página.");
          }
        }

        const firstDay = new Date();
        firstDay.setDate(1);
        firstDay.setHours(0, 0, 0, 0);
        const requestedRowsForMonth = (requestedByUser ?? []).filter((request: any) => new Date(request.created_at) >= firstDay);
        if (mounted) setSentThisMonth(requestedRowsForMonth.length);
      } else {
        const { data: requested, error: requestedError } = await supabase
          .from("quote_requests")
          .select("id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name)")
          .eq("requester_id", currentUser.id)
          .order("created_at", { ascending: false });

        const { data: received, error: receivedError } = await supabase
          .from("quotes")
          .select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,created_at,quote_items(id,description,quantity,unit_price,total),quote_requests(id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name))")
          .eq("client_id", currentUser.id)
          .order("created_at", { ascending: false });

        if (requestedError) console.error("Erro ao carregar solicitações enviadas:", requestedError);
        if (receivedError) console.error("Erro ao carregar orçamentos recebidos:", receivedError);

        if (mounted) {
          setClientRequests((requested ?? []) as unknown as RequestRow[]);
          setClientQuotes((received ?? []) as unknown as QuoteRow[]);
          const firstDay = new Date();
          firstDay.setDate(1);
          firstDay.setHours(0, 0, 0, 0);
          setSentThisMonth((requested ?? []).filter((request: any) => new Date(request.created_at) >= firstDay).length);

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

  useEffect(() => {
    if (loading || !userId) return;

    let active = true;

    async function refreshQuoteData() {
      const clientRequestsPromise = supabase
        .from("quote_requests")
        .select("id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name)")
        .eq("requester_id", userId)
        .order("created_at", { ascending: false });

      const clientQuotesPromise = supabase
        .from("quotes")
        .select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,created_at,quote_items(id,description,quantity,unit_price,total),quote_requests(id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name))")
        .eq("client_id", userId)
        .order("created_at", { ascending: false });

      const [requestedResult, receivedResult] = await Promise.all([
        clientRequestsPromise,
        clientQuotesPromise,
      ]);

      if (!active) return;

      if (!requestedResult.error) {
        setClientRequests((requestedResult.data ?? []) as unknown as RequestRow[]);
        const firstDay = new Date();
        firstDay.setDate(1);
        firstDay.setHours(0, 0, 0, 0);
        setSentThisMonth((requestedResult.data ?? []).filter((request: any) => new Date(request.created_at) >= firstDay).length);
      }

      if (!receivedResult.error) {
        setClientQuotes((receivedResult.data ?? []) as unknown as QuoteRow[]);
      }

      if (businessId) {
        const [supplierRequestsResult, supplierQuotesResult] = await Promise.all([
          supabase
            .from("quote_requests")
            .select("id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name)")
            .eq("business_id", businessId)
            .order("created_at", { ascending: false }),
          supabase
            .from("quotes")
            .select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,created_at,quote_items(id,description,quantity,unit_price,total),quote_requests(id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name))")
            .eq("business_id", businessId)
            .order("created_at", { ascending: false }),
        ]);

        if (!active) return;

        if (!supplierRequestsResult.error) {
          setRequests((supplierRequestsResult.data ?? []) as unknown as RequestRow[]);
        }
        if (!supplierQuotesResult.error) {
          setQuotes((supplierQuotesResult.data ?? []) as unknown as QuoteRow[]);
        }
      }
    }

    refreshQuoteData();
    const intervalId = window.setInterval(refreshQuoteData, 5000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [loading, userId, businessId]);

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
      .select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,created_at,quote_items(id,description,quantity,unit_price,total),quote_requests(id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name))")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (refreshed.error) {
      console.error("Erro ao atualizar histórico de orçamentos:", refreshed.error);
    }
    setQuotes((refreshed.data ?? []) as unknown as QuoteRow[]);
    setRequests((current) => current.map((request) => request.id === selectedRequest.id ? { ...request, status: "quoted" } : request));
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

    setClientQuotes((current) => current.map((item) => item.id === quote.id ? { ...item, status } : item));
  }

  if (loading) return <main className="quotes-page-state">Carregando orçamentos...</main>;

  const isSupplier = Boolean(businessId);
  const pendingRequests = requests.filter((request) => request.status === "pending");
  const sentRequestsThisMonth = clientRequests.filter((request) => {
    const created = new Date(request.created_at);
    const firstDay = new Date();
    firstDay.setDate(1);
    firstDay.setHours(0, 0, 0, 0);
    return created >= firstDay;
  });

  const metricRequests = activeMetric === "sent"
    ? sentRequestsThisMonth
    : activeMetric === "pending"
      ? clientRequests.filter((request) => request.status === "pending")
      : [];

  const metricQuotes = activeMetric === "total" ? clientQuotes : activeMetric === "supplier-sent" ? quotes : [];

  function dateOnly(value: string | null) {
    return value ? new Date(value + "T12:00:00").toLocaleDateString("pt-BR") : "Não informada";
  }

  function dateTime(value: string | null) {
    return value
      ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
      : "Não informada";
  }

  function serviceName(request: RequestRow | null | undefined) {
    return request?.services?.name || "Serviço não informado";
  }

  const availableTypes = [...new Set([
    ...clientRequests.map((request) => serviceName(request)),
    ...clientQuotes.map((quote) => serviceName(quote.quote_requests)),
  ].filter((type) => type !== "Serviço não informado"))].sort();

  const matchesFilters = (createdAt: string, type: string) => {
    const date = new Date(createdAt);
    if (filterFrom && date < new Date(filterFrom + "T00:00:00")) return false;
    if (filterTo && date > new Date(filterTo + "T23:59:59")) return false;
    if (filterType !== "all" && type !== filterType) return false;
    return true;
  };

  const filteredMetricRequests = metricRequests.filter((request) =>
    matchesFilters(request.created_at, serviceName(request))
  );

  const filteredMetricQuotes = metricQuotes.filter((quote) =>
    matchesFilters(quote.sent_at || quote.created_at, serviceName(quote.quote_requests))
  );

  const closeMetric = () => setActiveMetric(null);

  return (
    <main className="quotes-page">
      <header className="quotes-header">
        <AppLogo className="catalog-logo">LOSI <span>CONECTA</span></AppLogo>
        <Link to="/painel" className="quotes-back">Voltar ao painel</Link>
      </header>

      <section className="quotes-content">
        <div className="quotes-kicker">ORÇAMENTOS</div>
        <h1>Orçamentos e solicitações</h1>
        <p className="quotes-intro">Acompanhe o que você solicitou, os orçamentos que recebeu e, quando também for fornecedor, as solicitações e propostas da sua empresa.</p>

        {isSupplier && (
          <div className="quotes-supplier-intro">
            <div>
              <div className="quotes-kicker">ÁREA DO FORNECEDOR</div>
              <h2>Receber solicitações e enviar orçamentos</h2>
              <p>Esta área aparece porque sua conta também possui um perfil de fornecedor.</p>
            </div>
          </div>
        )}

        <div className="quotes-metrics">
          {isSupplier ? <>
            <button type="button" className={"quotes-metric-card" + (activeMetric === "received" ? " active" : "")} onClick={() => setActiveMetric(activeMetric === "received" ? null : "received")}><span>Solicitações recebidas</span><strong>{requests.length}</strong><small>Pedidos enviados para sua empresa</small></button>
            <button type="button" className={"quotes-metric-card" + (activeMetric === "supplier-pending" ? " active" : "")} onClick={() => setActiveMetric(activeMetric === "supplier-pending" ? null : "supplier-pending")}><span>Aguardando orçamento</span><strong>{pendingRequests.length}</strong><small>Solicitações aguardando resposta</small></button>
            <button type="button" className={"quotes-metric-card" + (activeMetric === "supplier-sent" ? " active" : "")} onClick={() => setActiveMetric(activeMetric === "supplier-sent" ? null : "supplier-sent")}><span>Orçamentos enviados</span><strong>{quotes.length}</strong><small>Propostas enviadas pela empresa</small></button>
          </> : <>
            <button type="button" className={"quotes-metric-card" + (activeMetric === "sent" ? " active" : "")} onClick={() => setActiveMetric(activeMetric === "sent" ? null : "sent")}><span>Enviados este mês</span><strong>{sentThisMonth}</strong><small>Ver solicitações enviadas</small></button>
            <button type="button" className={"quotes-metric-card" + (activeMetric === "pending" ? " active" : "")} onClick={() => setActiveMetric(activeMetric === "pending" ? null : "pending")}><span>Aguardando orçamento</span><strong>{clientRequests.filter((request) => request.status === "pending").length}</strong><small>Ver o que ainda aguarda retorno</small></button>
            <button type="button" className={"quotes-metric-card" + (activeMetric === "total" ? " active" : "")} onClick={() => setActiveMetric(activeMetric === "total" ? null : "total")}><span>Total de orçamentos</span><strong>{clientQuotes.length}</strong><small>Ver orçamentos recebidos</small></button>
          </>}
        </div>

        {activeMetric && (
          <section className="quotes-metric-details">
            <div className="quotes-section-head">
              <div>
                <div className="quotes-kicker">{activeMetric === "sent" || activeMetric === "supplier-sent" ? "ENVIADOS" : activeMetric === "pending" || activeMetric === "supplier-pending" ? "AGUARDANDO" : "RECEBIDOS"}</div>
                <h2>{activeMetric === "sent" ? "Solicitações enviadas" : activeMetric === "pending" || activeMetric === "supplier-pending" ? "Solicitações aguardando orçamento" : activeMetric === "received" ? "Solicitações recebidas" : activeMetric === "supplier-sent" ? "Orçamentos enviados" : "Orçamentos recebidos"}</h2>
              </div>
              <button type="button" className="quotes-secondary" onClick={closeMetric}>Fechar</button>
            </div>

            <div className="quotes-filters">
              <label>De<input type="date" value={filterFrom} onChange={(event) => setFilterFrom(event.target.value)} /></label>
              <label>Até<input type="date" value={filterTo} onChange={(event) => setFilterTo(event.target.value)} /></label>
              <label>Tipo
                <select value={filterType} onChange={(event) => setFilterType(event.target.value)}>
                  <option value="all">Todos os tipos</option>
                  {availableTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <button type="button" className="quotes-secondary" onClick={() => { setFilterFrom(""); setFilterTo(""); setFilterType("all"); }}>Limpar filtros</button>
            </div>

            {(activeMetric === "sent" || activeMetric === "pending" || activeMetric === "received" || activeMetric === "supplier-pending") ? (
              filteredMetricRequests.length === 0 ? <div className="quotes-empty">Nenhum registro encontrado com esses filtros.</div> : (
                <div className="quote-request-list">
                  {filteredMetricRequests.map((request) => (
                    <article key={request.id} className="quote-request-card">
                      <div>
                        <span className={"quote-status " + request.status}>{statusLabel(request.status)}</span>
                        <h3>{request.event_title}</h3>
                        <strong>{serviceName(request)}</strong>
                        <p>{activeMetric === "received" || activeMetric === "supplier-pending" ? "Solicitação recebida em" : "Solicitação enviada em"} <strong>{dateTime(request.created_at)}</strong></p>
                        <p>Data do evento: {dateOnly(request.event_date)} · {request.event_location || "Local não informado"}</p>
                        {request.description && <p>{request.description}</p>}
                      </div>
                    </article>
                  ))}
                </div>
              )
            ) : (
              filteredMetricQuotes.length === 0 ? <div className="quotes-empty">Nenhum orçamento encontrado com esses filtros.</div> : (
                <div className="quote-history-list">
                  {filteredMetricQuotes.map((quote) => (
                    <article key={quote.id} className="quote-client-card">
                      <div>
                        <span className={"quote-status " + quote.status}>{statusLabel(quote.status)}</span>
                        <h3>{quote.quote_requests?.event_title || "Orçamento"}</h3>
                        <strong>{serviceName(quote.quote_requests)}</strong>
                        <p>Orçamento retornado em <strong>{dateTime(quote.sent_at || quote.created_at)}</strong></p>
                        <p>Evento: {dateOnly(quote.quote_requests?.event_date ?? null)} · {quote.quote_requests?.event_location || "Local não informado"}</p>
                        {quote.notes && <p>{quote.notes}</p>}
                      </div>
                      <div className="quote-client-total">
                        <span>Total</span>
                        <strong>{money(Number(quote.total))}</strong>
                        <div className="quote-client-actions">
                          <button className="quotes-whatsapp" type="button" onClick={() => shareQuoteOnWhatsApp(quote)}>Compartilhar no WhatsApp</button>
                          {(quote.status === "sent" || quote.status === "viewed") && <><button className="quotes-primary" type="button" onClick={() => respondToQuote(quote, "accepted")}>Aceitar</button><button className="quotes-secondary" type="button" onClick={() => respondToQuote(quote, "rejected")}>Recusar</button></>}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )
            )}
          </section>
        )}

        {message && <div className={"quotes-message " + messageType} role="status">{message}</div>}

        {isSupplier ? (
          <>

            <div className={"quotes-supplier-area " + (activeMetric || "none")}>
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
                      <div>
                        <span className={"quote-status " + quote.status}>{statusLabel(quote.status)}</span>
                        <h3>{quote.quote_requests?.event_title || "Orçamento"}</h3>
                        <p>Cliente: {quote.quote_requests?.client_name || "—"}</p>
                        <p>Orçamento enviado em <strong>{dateTime(quote.sent_at || quote.created_at)}</strong></p>
                      </div>
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
            </div>
          </>
        ) : null}

      </section>
    </main>
  );
}
