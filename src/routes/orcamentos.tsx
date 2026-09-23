import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  viewed_at: string | null;
  created_at: string;
  quote_items?: { id: string; description: string; quantity: number; unit_price: number; total: number }[];
  quote_requests?: RequestRow;
};

type BusinessContact = {
  id: string;
  owner_id: string;
  business_name: string;
  slug: string | null;
  whatsapp: string | null;
  phone: string | null;
  address: string | null;
  bairro: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
};

type PublicProfile = {
  owner_id: string;
  slug: string;
  business_name: string;
};

type PersonalIdentity = {
  full_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
};


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
  const [userEmail, setUserEmail] = useState("");
  const [selectedQuote, setSelectedQuote] = useState<QuoteRow | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<RequestRow | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [clientRequests, setClientRequests] = useState<RequestRow[]>([]);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [clientQuotes, setClientQuotes] = useState<QuoteRow[]>([]);
  const [businessContacts, setBusinessContacts] = useState<Record<string, BusinessContact>>({});
  const [requesterProfiles, setRequesterProfiles] = useState<Record<string, PublicProfile>>({});
  const [personalIdentity, setPersonalIdentity] = useState<PersonalIdentity | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [activeMetric, setActiveMetric] = useState<"pending" | "total" | "received" | "supplier-pending" | "supplier-sent" | null>(null);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterType, setFilterType] = useState("all");
  const detailsRef = useRef<HTMLElement | null>(null);

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
        .select("id,owner_id,business_name,slug,whatsapp,phone,address,bairro,city,state,cep")
        .eq("owner_id", currentUser.id)
        .maybeSingle();

      if (!mounted) return;
      setUserId(currentUser.id);
      setUserEmail(currentUser.email || "");

      const { data: identityData } = await supabase
        .from("profiles")
        .select("full_name,address,city,state,cep")
        .eq("id", currentUser.id)
        .maybeSingle();
      if (mounted) setPersonalIdentity((identityData ?? null) as PersonalIdentity | null);

      if (business?.id) {
        setBusinessId(business.id);
        setBusinessContacts({ [business.id]: business as BusinessContact });

        const [{ data: requestRows, error: requestsError }, { data: quoteRows, error: quotesError }] = await Promise.all([
          supabase.from("quote_requests")
            .select("id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name)")
            .eq("business_id", business.id)
            .order("created_at", { ascending: false }),
          supabase.from("quotes")
            .select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,viewed_at,created_at,quote_items(id,description,quantity,unit_price,total),quote_requests(id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name))")
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
          .select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,viewed_at,created_at,quote_items(id,description,quantity,unit_price,total),quote_requests(id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name))")
          .eq("client_id", currentUser.id)
          .order("created_at", { ascending: false });

        const allRequests = [
          ...((requestRows ?? []) as unknown as RequestRow[]),
          ...((requestedByUser ?? []) as unknown as RequestRow[]),
          ...((quoteRows ?? []).map((quote: any) => quote.quote_requests).filter(Boolean) as RequestRow[]),
          ...((receivedByUser ?? []).map((quote: any) => quote.quote_requests).filter(Boolean) as RequestRow[]),
        ];
        const requesterIds = [...new Set(allRequests.map((request) => request.requester_id).filter(Boolean))];
        if (requesterIds.length > 0) {
          const { data: requesterBusinesses } = await supabase
            .from("business_profiles")
            .select("owner_id,slug,business_name")
            .in("owner_id", requesterIds)
            .eq("active", true);
          const profileMap = (requesterBusinesses ?? []).reduce<Record<string, PublicProfile>>((map, profile) => {
            map[profile.owner_id] = profile as PublicProfile;
            return map;
          }, {});
          if (mounted) setRequesterProfiles(profileMap);
        }

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
      } else {
        const { data: requested, error: requestedError } = await supabase
          .from("quote_requests")
          .select("id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name)")
          .eq("requester_id", currentUser.id)
          .order("created_at", { ascending: false });

        const { data: received, error: receivedError } = await supabase
          .from("quotes")
          .select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,viewed_at,created_at,quote_items(id,description,quantity,unit_price,total),quote_requests(id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name))")
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

          const businessIds = [...new Set((received ?? []).map((quote: any) => quote.business_id).filter(Boolean))];
          if (businessIds.length > 0) {
            const { data: businesses } = await supabase
              .from("business_profiles")
              .select("id,owner_id,business_name,slug,whatsapp,phone,address,bairro,city,state,cep")
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
        .select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,viewed_at,created_at,quote_items(id,description,quantity,unit_price,total),quote_requests(id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name))")
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
            .select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,viewed_at,created_at,quote_items(id,description,quantity,unit_price,total),quote_requests(id,business_id,requester_id,service_id,client_name,client_email,client_phone,event_title,event_date,event_location,description,status,created_at,services(name))")
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

  function publicProfileUrl(requesterId: string | null | undefined) {
    const profile = requesterId ? requesterProfiles[requesterId] : null;
    return profile ? window.location.origin + "/fornecedor/" + profile.slug : "";
  }

  function buildRequestWhatsAppMessage(request: RequestRow) {
    const supplier = businessContacts[request.business_id];
    const supplierAddress = supplier?.address
      || [supplier?.bairro, supplier?.city, supplier?.state].filter(Boolean).join(" — ")
      || [supplier?.cep, supplier?.city, supplier?.state].filter(Boolean).join(" — ")
      || personalIdentity?.address
      || [personalIdentity?.city, personalIdentity?.state].filter(Boolean).join(" — ")
      || personalIdentity?.cep
      || "Não informado";
    const supplierProfileUrl = supplier?.slug
      ? window.location.origin + "/fornecedor/" + supplier.slug
      : "";

    return [
      "Olá, " + request.client_name,
      "",
      "Recebemos a sua solicitação pelo Losi Conecta e vou preparar uma proposta para você.",
      "",
      "Me diga: Como eu posso colaborar contigo?",
      "",
      "Dados do fornecedor:",
      "",
      "Nome: " + (personalIdentity?.full_name || supplier?.business_name || "Fornecedor"),
      "Endereço completo: " + supplierAddress,
      "Nome da empresa: " + (supplier?.business_name || "Não informado"),
      supplierProfileUrl ? "Link do perfil público: " + supplierProfileUrl : "",
    ].filter(Boolean).join("\n");
  }

  function buildQuoteWhatsAppMessage(quote: QuoteRow, recipientName: string, senderName: string) {
    const request = quote.quote_requests;
    const profileUrl = publicProfileUrl(request?.requester_id);
    const itemLines = (quote.quote_items ?? [])
      .map((item) => "• " + item.quantity + "x " + item.description + " — " + money(Number(item.total)))
      .join("\n");

    return [
      "ORÇAMENTO — LOSI CONECTA",
      "",
      "DESTINATÁRIO: " + recipientName,
      "FORNECEDOR: " + senderName,
      "SOLICITANTE: " + (request?.client_name || "Cliente"),
      "",
      "CONTATO DO SOLICITANTE",
      "Nome: " + (request?.client_name || recipientName),
      request?.client_phone ? "WhatsApp/Telefone: " + request.client_phone : "",
      request?.client_email ? "E-mail: " + request.client_email : "",
      "",
      "DADOS DO EVENTO",
      "Evento: " + (request?.event_title || "Não informado"),
      "Data: " + formatQuoteDate(request?.event_date ?? null),
      request?.event_location ? "Local: " + request.event_location : "",
      profileUrl ? "" : "",
      profileUrl ? "🔗 PERFIL PÚBLICO DE QUEM SOLICITOU: " + profileUrl : "",
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
    const request = quote.quote_requests;
    const business = businessContacts[quote.business_id];
    const message = buildQuoteWhatsAppMessage(
      quote,
      request?.client_name || "cliente",
      business?.business_name || "Fornecedor",
    );
    const number = normalizeWhatsAppNumber(request?.client_phone);
    const url = number
      ? "https://wa.me/" + number + "?text=" + encodeURIComponent(message)
      : "https://wa.me/?text=" + encodeURIComponent(message);
    window.open(url, "_blank", "noopener,noreferrer");
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

  const selectedSupplier = selectedQuote ? businessContacts[selectedQuote.business_id] : null;
  const selectedRequester = selectedQuote?.quote_requests;
  const selectedRequesterProfile = selectedRequester ? requesterProfiles[selectedRequester.requester_id] : null;
  const selectedSupplierSlug = selectedSupplier?.slug || "";
  const selectedItemLines = selectedQuote?.quote_items ?? [];

  const closeQuoteModal = () => setSelectedQuote(null);
  const closeRequestModal = () => setSelectedRequest(null);


  const isSupplier = Boolean(businessId);

  // Uma solicitação só deixa de estar "Aguardando orçamento" quando existe
  // um orçamento vinculado a ela. O status textual da solicitação não é
  // usado como fonte única da verdade, evitando divergência entre os painéis.
  const clientQuoteRequestIds = new Set(clientQuotes.map((quote) => quote.request_id));
  const supplierQuoteRequestIds = new Set(quotes.map((quote) => quote.request_id));

  const clientPendingRequests = clientRequests.filter(
    (request) => !clientQuoteRequestIds.has(request.id),
  );

  const supplierPendingRequests = requests.filter(
    (request) => !supplierQuoteRequestIds.has(request.id),
  );

  const metricRequests =
    activeMetric === "pending"
      ? clientPendingRequests
      : activeMetric === "received"
        ? requests
        : activeMetric === "supplier-pending"
          ? supplierPendingRequests
          : [];

  const metricQuotes =
    activeMetric === "total"
      ? clientQuotes
      : activeMetric === "supplier-sent"
        ? quotes
        : [];

  function dateOnly(value: string | null) {
    return value ? new Date(value + "T12:00:00").toLocaleDateString("pt-BR") : "Não informada";
  }

  function dateTime(value: string | null) {
    return value
      ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
      : "Não informada";
  }

  useEffect(() => {
    if (!activeMetric) return;
    const timer = window.setTimeout(() => {
      detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [activeMetric]);

  async function deleteQuote(quote: QuoteRow) {
    const confirmed = window.confirm("Excluir este orçamento? Esta ação não pode ser desfeita.");
    if (!confirmed) return;

    const { error } = await supabase.from("quotes").delete().eq("id", quote.id);
    if (error) {
      console.error("Erro ao excluir orçamento:", error);
      setMessageType("error");
      setMessage(error.message || "Não foi possível excluir o orçamento.");
      return;
    }

    setQuotes((current) => current.filter((item) => item.id !== quote.id));
    setClientQuotes((current) => current.filter((item) => item.id !== quote.id));
    if (selectedQuote?.id === quote.id) setSelectedQuote(null);
    setMessageType("success");
    setMessage("Orçamento excluído com sucesso.");
  }

  function serviceName(request: RequestRow | null | undefined) {
    return request?.services?.name || "Serviço não informado";
  }

  const availableTypes = [...new Set([
    ...clientRequests.map((request) => serviceName(request)),
    ...clientQuotes.map((quote) => serviceName(quote.quote_requests)),
    ...requests.map((request) => serviceName(request)),
    ...quotes.map((quote) => serviceName(quote.quote_requests)),
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
          <button
            type="button"
            className={"quotes-metric-card" + (activeMetric === "pending" ? " active" : "")}
            onClick={() => setActiveMetric(activeMetric === "pending" ? null : "pending")}
          >
            <span>Solicitações aguardando</span>
            <strong>{clientPendingRequests.length}</strong>
            <small>Pedidos feitos por você que ainda não receberam proposta</small>
          </button>

          <button
            type="button"
            className={"quotes-metric-card" + (activeMetric === "total" ? " active" : "")}
            onClick={() => setActiveMetric(activeMetric === "total" ? null : "total")}
          >
            <span>Propostas recebidas</span>
            <strong>{clientQuotes.length}</strong>
            <small>Orçamentos enviados pelos fornecedores para você</small>
          </button>

          {isSupplier && (
            <>
              <button
                type="button"
                className={"quotes-metric-card" + (activeMetric === "received" ? " active" : "")}
                onClick={() => setActiveMetric(activeMetric === "received" ? null : "received")}
              >
                <span>Pedidos recebidos</span>
                <strong>{requests.length}</strong>
                <small>Solicitações de clientes para sua empresa</small>
              </button>

              <button
                type="button"
                className={"quotes-metric-card" + (activeMetric === "supplier-sent" ? " active" : "")}
                onClick={() => setActiveMetric(activeMetric === "supplier-sent" ? null : "supplier-sent")}
              >
                <span>Propostas enviadas</span>
                <strong>{quotes.length}</strong>
                <small>Orçamentos preparados e enviados por sua empresa</small>
              </button>
            </>
          )}
        </div>
        {activeMetric && (
          <section ref={detailsRef} className="quotes-metric-details">
            <div className="quotes-section-head">
              <div>
                <div className="quotes-kicker">{activeMetric === "supplier-sent" ? "ENVIADOS" : activeMetric === "pending" || activeMetric === "supplier-pending" ? "AGUARDANDO" : "RECEBIDOS"}</div>
                <h2>{activeMetric === "pending" ? "Solicitações aguardando orçamento" : activeMetric === "received" ? "Solicitações recebidas" : activeMetric === "supplier-pending" ? "Solicitações recebidas aguardando resposta" : activeMetric === "supplier-sent" ? "Orçamentos enviados" : "Orçamentos recebidos"}</h2>
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

            {(activeMetric === "pending" || activeMetric === "received" || activeMetric === "supplier-pending") ? (
              filteredMetricRequests.length === 0 ? <div className="quotes-empty">Nenhum registro encontrado com esses filtros.</div> : (
                <div className="quote-request-list">
                  {filteredMetricRequests.map((request) => (
                    <article key={request.id} className="quote-request-card">
                      <div>
                        <span className={"quote-status " + request.status}>{statusLabel(request.status)}</span>
                        <span className="quote-context-label">{activeMetric === "received" || activeMetric === "supplier-pending" ? "SOLICITAÇÃO RECEBIDA DO CLIENTE" : "SOLICITAÇÃO FEITA POR VOCÊ"}</span>
                        <h3>{request.event_title}</h3>
                        <strong>{serviceName(request)}</strong>
                        <p><strong>Solicitado por:</strong> {request.client_name}</p>
                        {request.client_phone && <p>WhatsApp/Telefone: {request.client_phone}</p>}
                        {request.client_email && <p>E-mail: {request.client_email}</p>}
                        <p>{activeMetric === "received" || activeMetric === "supplier-pending" ? "Solicitação recebida em" : "Solicitação enviada em"} <strong>{dateTime(request.created_at)}</strong></p>
                        <p>Data do evento: {dateOnly(request.event_date)} · {request.event_location || "Local não informado"}</p>
                        <div className="quote-request-actions">
                          <button
                            type="button"
                            className="quotes-secondary quote-detail-button"
                            onClick={() => setSelectedRequest(request)}
                          >
                            Ver detalhes
                          </button>
                          {isSupplier && (activeMetric === "supplier-pending" || (activeMetric === "received" && request.status === "pending")) && (
                            <button
                              className="quotes-whatsapp"
                              type="button"
                              onClick={() => openWhatsApp(request.client_phone, buildRequestWhatsAppMessage(request))}
                            >
                              Responder solicitação pelo WhatsApp
                            </button>
                          )}
                        </div>
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
                        <span className="quote-context-label">{activeMetric === "supplier-sent" ? "PROPOSTA ENVIADA POR VOCÊ" : "PROPOSTA RECEBIDA DO FORNECEDOR"}</span>
                        <h3>{quote.quote_requests?.event_title || "Orçamento"}</h3>
                        <strong>{serviceName(quote.quote_requests)}</strong>
                        <p><strong>Solicitado por:</strong> {quote.quote_requests?.client_name || "Não informado"}</p>
                        {quote.quote_requests?.client_phone && <p>WhatsApp/Telefone: {quote.quote_requests.client_phone}</p>}
                        {quote.quote_requests?.client_email && <p>E-mail: {quote.quote_requests.client_email}</p>}
                        <p>Solicitação enviada em <strong>{dateTime(quote.quote_requests?.created_at ?? null)}</strong></p>
                        <p>Orçamento recebido em <strong>{dateTime(quote.sent_at || quote.created_at)}</strong></p>
                        <p>Data do evento: {dateOnly(quote.quote_requests?.event_date ?? null)} · {quote.quote_requests?.event_location || "Local não informado"}</p>
                        {quote.notes && <p>{quote.notes}</p>}
                      </div>
                      <div className="quote-client-total">
                        <button className="quotes-secondary quote-view-button" type="button" onClick={() => setSelectedQuote(quote)}>Ver proposta</button>
                        <span>Total</span>
                        <strong>{money(Number(quote.total))}</strong>
                        <div className="quote-client-actions">
                          <button className="quotes-whatsapp" type="button" onClick={() => shareQuoteOnWhatsApp(quote)}>Compartilhar no WhatsApp</button>
                          {(quote.status === "sent" || quote.status === "viewed") && <><button className="quotes-primary" type="button" onClick={() => respondToQuote(quote, "accepted")}>Aceitar</button><button className="quotes-secondary" type="button" onClick={() => respondToQuote(quote, "rejected")}>Recusar</button></>}
                          <button className="quotes-secondary quote-delete-button" type="button" onClick={() => deleteQuote(quote)}>Excluir orçamento</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )
            )}
          </section>
        )}


        {selectedRequest && (
          <div className="quote-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeRequestModal(); }}>
            <section className="quote-modal" role="dialog" aria-modal="true" aria-labelledby="request-modal-title">
              <div className="quote-modal-head">
                <div>
                  <div className="quotes-kicker">DETALHAMENTO DA SOLICITAÇÃO</div>
                  <h2 id="request-modal-title">{selectedRequest.event_title}</h2>
                </div>
                <button type="button" className="quotes-secondary quote-modal-close" onClick={closeRequestModal} aria-label="Fechar">Fechar</button>
              </div>

              <div className="quote-modal-parties">
                <div className="quote-modal-party">
                  <span>CLIENTE / SOLICITANTE</span>
                  <strong>{selectedRequest.client_name || "Não informado"}</strong>
                  <p>E-mail: {selectedRequest.client_email || "Não informado"}</p>
                  <p>WhatsApp/Telefone: {selectedRequest.client_phone || "Não informado"}</p>
                </div>
              </div>

              <div className="quote-modal-event">
                <h3>Dados do evento</h3>
                <p><strong>Serviço solicitado:</strong> {serviceName(selectedRequest)}</p>
                <p><strong>Data do evento:</strong> {dateOnly(selectedRequest.event_date)}</p>
                <p><strong>Local:</strong> {selectedRequest.event_location || "Não informado"}</p>
                <p><strong>Solicitação recebida em:</strong> {dateTime(selectedRequest.created_at)}</p>
                <p><strong>Status:</strong> {statusLabel(selectedRequest.status)}</p>
              </div>

              <div className="quote-modal-items">
                <h3>Detalhes do pedido</h3>
                <div className="quote-modal-request-description">
                  {selectedRequest.description
                    ? <p>{selectedRequest.description}</p>
                    : <p>Nenhuma descrição adicional foi informada pelo solicitante.</p>}
                </div>
              </div>

              {isSupplier && (
                <>
                  <div className="quote-modal-total quote-modal-request-next">
                    <span>Próxima etapa</span>
                    <strong>Preparar e enviar o orçamento ao cliente.</strong>
                  </div>
                  <div className="quote-modal-actions">
                  <button
                    type="button"
                    className="quotes-whatsapp"
                    onClick={() => openWhatsApp(selectedRequest.client_phone, buildRequestWhatsAppMessage(selectedRequest))}
                  >
                    Responder pelo WhatsApp
                  </button>
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {selectedQuote && (
          <div className="quote-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeQuoteModal(); }}>
            <section className="quote-modal" role="dialog" aria-modal="true" aria-labelledby="quote-modal-title">
              <div className="quote-modal-head">
                <div>
                  <div className="quotes-kicker">DETALHAMENTO DA PROPOSTA</div>
                  <h2 id="quote-modal-title">{selectedRequester?.event_title || "Proposta"}</h2>
                </div>
                <button type="button" className="quotes-secondary quote-modal-close" onClick={closeQuoteModal}>Fechar</button>
              </div>

              <div className="quote-modal-parties">
                <div className="quote-modal-party">
                  <span>{isSupplier ? "SOLICITANTE" : "FORNECEDOR"}</span>
                  <strong>{isSupplier ? (selectedRequester?.client_name || "Não informado") : (selectedSupplier?.business_name || "Fornecedor")}</strong>
                  <p>E-mail: {isSupplier ? (selectedRequester?.client_email || "Não informado") : "E-mail não disponibilizado no perfil"}</p>
                  <p>Contato: {isSupplier ? (selectedRequester?.client_phone || "Não informado") : (selectedSupplier?.whatsapp || selectedSupplier?.phone || "Não informado")}</p>
                  {!isSupplier && selectedSupplier?.id && (
                    <Link className="quote-modal-profile-link" to={"/fornecedor/" + selectedSupplierSlug}>Perfil público do fornecedor</Link>
                  )}
                  {isSupplier && selectedRequesterProfile?.slug && (
                    <Link className="quote-modal-profile-link" to={"/fornecedor/" + selectedRequesterProfile.slug}>Perfil público do solicitante</Link>
                  )}
                </div>
              </div>

              <div className="quote-modal-event">
                <h3>Dados do evento</h3>
                <p><strong>Serviço:</strong> {serviceName(selectedRequester)}</p>
                <p><strong>Data:</strong> {dateOnly(selectedRequester?.event_date ?? null)}</p>
                <p><strong>Local:</strong> {selectedRequester?.event_location || "Não informado"}</p>
                {selectedRequester?.description && <p><strong>Detalhes:</strong> {selectedRequester.description}</p>}
              </div>

              <div className="quote-modal-items">
                <h3>Itens da proposta</h3>
                {selectedItemLines.length ? selectedItemLines.map((item) => (
                  <div key={item.id} className="quote-modal-item">
                    <div><strong>{item.description}</strong><span>{item.quantity} x {money(Number(item.unit_price))}</span></div>
                    <strong>{money(Number(item.total))}</strong>
                  </div>
                )) : <p>Nenhum item detalhado.</p>}
              </div>

              <div className="quote-modal-total">
                <div><span>Subtotal</span><strong>{money(Number(selectedQuote.subtotal))}</strong></div>
                <div><span>Desconto</span><strong>{money(Number(selectedQuote.discount))}</strong></div>
                <div className="grand"><span>TOTAL</span><strong>{money(Number(selectedQuote.total))}</strong></div>
              </div>

              {selectedQuote.validity_until && <p className="quote-modal-note"><strong>Validade:</strong> {dateOnly(selectedQuote.validity_until)}</p>}
              {selectedQuote.notes && <p className="quote-modal-note"><strong>Observações:</strong> {selectedQuote.notes}</p>}
            </section>
          </div>
        )}
        {message && <div className={"quotes-message " + messageType} role="status">{message}</div>}



      </section>
    </main>
  );
}
