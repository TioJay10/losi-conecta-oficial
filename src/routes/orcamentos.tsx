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
  const [proposalRequestId, setProposalRequestId] = useState("");
  const [proposalItems, setProposalItems] = useState([{ description: "", quantity: "1", unitPrice: "" }]);
  const [proposalDiscount, setProposalDiscount] = useState("0");
  const [proposalValidity, setProposalValidity] = useState("");
  const [proposalNotes, setProposalNotes] = useState("");
  const [savingProposal, setSavingProposal] = useState(false);
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
      const element = detailsRef.current;
      if (!element) return;
      const top = element.getBoundingClientRect().top + window.scrollY - 18;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [activeMetric]);

  function proposalSubtotal() {
    return proposalItems.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice.replace(",", ".")) || 0;
      return sum + quantity * unitPrice;
    }, 0);
  }

  function proposalTotal() {
    return Math.max(0, proposalSubtotal() - (Number(proposalDiscount.replace(",", ".")) || 0));
  }

  function addProposalItem() {
    setProposalItems((items) => [...items, { description: "", quantity: "1", unitPrice: "" }]);
  }

  function removeProposalItem(index: number) {
    setProposalItems((items) => items.length === 1 ? items : items.filter((_, itemIndex) => itemIndex !== index));
  }

  function updateProposalItem(index: number, field: "description" | "quantity" | "unitPrice", value: string) {
    setProposalItems((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  }

  function resetProposalForm() {
    setProposalRequestId("");
    setProposalItems([{ description: "", quantity: "1", unitPrice: "" }]);
    setProposalDiscount("0");
    setProposalValidity("");
    setProposalNotes("");
  }

  async function createAndSendProposal() {
    if (!businessId || !userId) return;
    const request = supplierPendingRequests.find((item) => item.id === proposalRequestId);
    if (!request) {
      setMessageType("error");
      setMessage("Selecione uma solicitação para montar a proposta.");
      return;
    }

    const validItems = proposalItems
      .map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity),
        unit_price: Number(item.unitPrice.replace(",", ".")),
      }))
      .filter((item) => item.description && item.quantity > 0 && Number.isFinite(item.unit_price) && item.unit_price >= 0);

    if (!validItems.length) {
      setMessageType("error");
      setMessage("Adicione pelo menos um item válido à proposta.");
      return;
    }

    const subtotal = validItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const discount = Math.max(0, Number(proposalDiscount.replace(",", ".")) || 0);
    const total = Math.max(0, subtotal - discount);

    setSavingProposal(true);
    setMessage("");
    try {
      const { data: quote, error: quoteError } = await supabase
        .from("quotes")
        .insert({
          request_id: request.id,
          business_id: businessId,
          client_id: request.requester_id,
          subtotal,
          discount,
          total,
          validity_until: proposalValidity || null,
          notes: proposalNotes.trim() || null,
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .select("id,request_id,business_id,client_id,subtotal,discount,total,validity_until,notes,status,sent_at,viewed_at,created_at")
        .single();

      if (quoteError || !quote) throw quoteError || new Error("Não foi possível criar a proposta.");

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
        await supabase.from("quotes").delete().eq("id", quote.id).eq("business_id", businessId);
        throw itemsError;
      }

      await supabase.from("quote_requests").update({ status: "quoted" }).eq("id", request.id).eq("business_id", businessId);

      const supplier = businessContacts[businessId];
      const profileUrl = supplier?.slug
        ? window.location.origin + "/fornecedor/" + supplier.slug + "?proposta=" + quote.id
        : "";
      const supplierName = personalIdentity?.full_name || supplier?.business_name || "Fornecedor";
      const whatsappMessage = [
        "Olá, " + request.client_name + "!",
        "",
        "Preparei sua proposta pelo LOSI CONECTA.",
        "",
        "Fornecedor: " + supplierName,
        "Empresa: " + (supplier?.business_name || "Não informada"),
        "Telefone: " + (supplier?.phone || supplier?.whatsapp || "Não informado"),
        "E-mail: " + userEmail,
        "",
        "Valor total: " + money(total),
        proposalValidity ? "Validade: " + formatQuoteDate(proposalValidity) : "",
        "",
        profileUrl ? "Acesse sua proposta pelo link abaixo:" : "",
        profileUrl,
      ].filter(Boolean).join("\n");

      const number = normalizeWhatsAppNumber(request.client_phone);
      const whatsappUrl = number
        ? "https://wa.me/" + number + "?text=" + encodeURIComponent(whatsappMessage)
        : "https://wa.me/?text=" + encodeURIComponent(whatsappMessage);
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");

      const createdQuote = {
        ...(quote as QuoteRow),
        quote_items: validItems.map((item, index) => ({
          id: "local-" + index,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.quantity * item.unit_price,
        })),
        quote_requests: request,
      } as QuoteRow;
      setQuotes((current) => [createdQuote, ...current]);
      setRequests((current) => current.map((item) => item.id === request.id ? { ...item, status: "quoted" } : item));
      resetProposalForm();
      setMessageType("success");
      setMessage("Proposta criada e o WhatsApp foi aberto para envio ao cliente.");
    } catch (error: any) {
      console.error("Erro ao criar proposta:", error);
      setMessageType("error");
      setMessage(error?.message || "Não foi possível criar a proposta.");
    } finally {
      setSavingProposal(false);
    }
  }

  async function deleteQuote(quote: QuoteRow) {
    const confirmed = window.confirm("Excluir este orçamento? Esta ação não pode ser desfeita.");
    if (!confirmed) return;

    let query = supabase.from("quotes").delete().eq("id", quote.id);
    query = isSupplier
      ? query.eq("business_id", businessId)
      : query.eq("client_id", userId);

    const { data: deletedRows, error } = await query.select("id");
    if (error) {
      console.error("Erro ao excluir orçamento:", error);
      setMessageType("error");
      setMessage(error.message || "Não foi possível excluir o orçamento.");
      return;
    }

    if (!deletedRows?.length) {
      setMessageType("error");
      setMessage("Não foi possível excluir este orçamento. Ele pode não pertencer à sua conta ou já ter sido excluído.");
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

  if (loading) return <main className="quotes-page-state">Carregando orçamentos...</main>;

  return (
    <main className="quotes-page">
      <style>{`
        .proposal-builder{margin:28px 0 34px;padding:24px;border:1px solid rgba(31,41,55,.12);border-radius:20px;background:#fff;box-shadow:0 12px 30px rgba(31,41,55,.07)}
        .proposal-builder-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:22px}
        .proposal-builder-head h2{margin:4px 0 6px;font-size:24px;line-height:1.2}
        .proposal-builder-head p{margin:0;color:#667085;font-size:14px;line-height:1.55}
        .proposal-form-grid{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(180px,.6fr);gap:16px;margin-bottom:18px}
        .proposal-field{display:flex;flex-direction:column;gap:7px;min-width:0}
        .proposal-field label{font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#475467}
        .proposal-field input,.proposal-field select,.proposal-field textarea{width:100%;box-sizing:border-box;border:1px solid #d0d5dd;border-radius:11px;background:#fff;color:#101828;padding:12px 13px;font:inherit;outline:none}
        .proposal-field input:focus,.proposal-field select:focus,.proposal-field textarea:focus{border-color:#667085;box-shadow:0 0 0 3px rgba(102,112,133,.12)}
        .proposal-field textarea{min-height:94px;resize:vertical}
        .proposal-items{border:1px solid #eaecf0;border-radius:15px;overflow:hidden;margin:18px 0}
        .proposal-items-title{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:15px 16px;background:#f8f9fb;border-bottom:1px solid #eaecf0}
        .proposal-items-title strong{font-size:14px;color:#101828}
        .proposal-add{border:0;background:transparent;color:#344054;font-weight:700;cursor:pointer;padding:8px 4px}
        .proposal-item{display:grid;grid-template-columns:minmax(0,1fr) 92px 145px 42px;gap:10px;padding:14px 16px;border-bottom:1px solid #eaecf0}
        .proposal-item:last-child{border-bottom:0}
        .proposal-remove{border:1px solid #d0d5dd;background:#fff;border-radius:10px;cursor:pointer;font-size:18px;color:#667085}
        .proposal-summary{display:flex;justify-content:flex-end;margin:18px 0}
        .proposal-summary-box{width:min(100%,360px);border:1px solid #eaecf0;border-radius:15px;padding:16px;background:#fafafa}
        .proposal-summary-line{display:flex;justify-content:space-between;gap:20px;margin:7px 0;color:#475467;font-size:14px}
        .proposal-summary-line.total{margin-top:12px;padding-top:12px;border-top:1px solid #d0d5dd;color:#101828;font-size:17px;font-weight:800}
        .proposal-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:18px}
        .proposal-primary{border:0;border-radius:11px;padding:12px 18px;background:#1f2937;color:#fff;font-weight:800;cursor:pointer;min-height:44px}
        .proposal-primary:disabled{opacity:.55;cursor:not-allowed}
        .proposal-hint{margin:12px 0 0;color:#667085;font-size:12px;line-height:1.5}
        .proposal-client{padding:12px 14px;border-radius:12px;background:#f8f9fb;border:1px solid #eaecf0;margin-bottom:18px}
        .proposal-client strong{display:block;color:#101828}
        .proposal-client span{display:block;color:#667085;font-size:13px;margin-top:2px}
        @media(max-width:700px){
          .proposal-builder{padding:18px;margin-top:20px;border-radius:16px}
          .proposal-builder-head{display:block}
          .proposal-builder-head h2{font-size:21px}
          .proposal-form-grid{grid-template-columns:1fr}
          .proposal-item{grid-template-columns:minmax(0,1fr) 76px;gap:9px}
          .proposal-item .proposal-price{grid-column:1}
          .proposal-remove{grid-column:2;grid-row:1;align-self:end}
          .proposal-actions{display:grid;grid-template-columns:1fr}
          .proposal-primary{width:100%}
          .proposal-summary{justify-content:stretch}
          .proposal-summary-box{width:100%;box-sizing:border-box}
        }
      `}</style>
      <header className="quotes-header">
        <AppLogo className="catalog-logo">LOSI <span>CONECTA</span></AppLogo>
              <Link to="/painel" className="quotes-back">Voltar ao painel</Link>
      </header>

      <section className="quotes-content">
        <div className="quotes-kicker">ORÇAMENTOS</div>
        <h1>Orçamentos e solicitações</h1>
        <p className="quotes-intro">Acompanhe o que você solicitou, os orçamentos que recebeu e, quando também for fornecedor, as solicitações e propostas da sua empresa.</p>

        {isSupplier && (
          <section className="proposal-builder" aria-labelledby="proposal-builder-title">
            <div className="proposal-builder-head">
              <div>
                <div className="quotes-kicker">NOVA PROPOSTA</div>
                <h2 id="proposal-builder-title">Preparar orçamento para o cliente</h2>
                <p>Monte uma proposta detalhada com os dados do fornecedor e envie o acesso diretamente pelo WhatsApp.</p>
              </div>
            </div>

            {supplierPendingRequests.length === 0 ? (
              <div className="quotes-empty">Não há solicitações aguardando orçamento no momento.</div>
            ) : (
              <>
                <div className="proposal-field" style={{ marginBottom: 18 }}>
                  <label htmlFor="proposal-request">Cliente e solicitação</label>
                  <select id="proposal-request" value={proposalRequestId} onChange={(event) => setProposalRequestId(event.target.value)}>
                    <option value="">Selecione a solicitação</option>
                    {supplierPendingRequests.map((request) => (
                      <option key={request.id} value={request.id}>
                        {request.client_name} — {request.event_title} — {serviceName(request)}
                      </option>
                    ))}
                  </select>
                </div>

                {proposalRequestId && (() => {
                  const request = supplierPendingRequests.find((item) => item.id === proposalRequestId);
                  if (!request) return null;
                  return (
                    <div className="proposal-client">
                      <strong>{request.client_name}</strong>
                      <span>{request.client_phone || "WhatsApp não informado"} · {request.client_email || "E-mail não informado"}</span>
                    </div>
                  );
                })()}

                <div className="proposal-items">
                  <div className="proposal-items-title">
                    <strong>Itens da proposta</strong>
                    <button type="button" className="proposal-add" onClick={addProposalItem}>+ Adicionar item</button>
                  </div>
                  {proposalItems.map((item, index) => (
                    <div className="proposal-item" key={index}>
                      <div className="proposal-field">
                        <label>Descrição</label>
                        <input value={item.description} onChange={(event) => updateProposalItem(index, "description", event.target.value)} placeholder="Ex.: Recreação e monitoria" />
                      </div>
                      <div className="proposal-field">
                        <label>Qtd.</label>
                        <input type="number" min="1" step="1" value={item.quantity} onChange={(event) => updateProposalItem(index, "quantity", event.target.value)} />
                      </div>
                      <div className="proposal-field proposal-price">
                        <label>Valor unitário</label>
                        <input inputMode="decimal" value={item.unitPrice} onChange={(event) => updateProposalItem(index, "unitPrice", event.target.value)} placeholder="0,00" />
                      </div>
                      <button type="button" className="proposal-remove" onClick={() => removeProposalItem(index)} aria-label="Remover item">×</button>
                    </div>
                  ))}
                </div>

                <div className="proposal-form-grid">
                  <div className="proposal-field">
                    <label htmlFor="proposal-notes">Observações da proposta</label>
                    <textarea id="proposal-notes" value={proposalNotes} onChange={(event) => setProposalNotes(event.target.value)} placeholder="Inclua condições, prazo, detalhes do serviço ou informações importantes." />
                  </div>
                  <div>
                    <div className="proposal-field">
                      <label htmlFor="proposal-discount">Desconto</label>
                      <input id="proposal-discount" inputMode="decimal" value={proposalDiscount} onChange={(event) => setProposalDiscount(event.target.value)} placeholder="0,00" />
                    </div>
                    <div className="proposal-field" style={{ marginTop: 12 }}>
                      <label htmlFor="proposal-validity">Validade</label>
                      <input id="proposal-validity" type="date" value={proposalValidity} onChange={(event) => setProposalValidity(event.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="proposal-summary">
                  <div className="proposal-summary-box">
                    <div className="proposal-summary-line"><span>Subtotal</span><strong>{money(proposalSubtotal())}</strong></div>
                    <div className="proposal-summary-line"><span>Desconto</span><strong>{money(Number(proposalDiscount.replace(",", ".")) || 0)}</strong></div>
                    <div className="proposal-summary-line total"><span>Total da proposta</span><strong>{money(proposalTotal())}</strong></div>
                  </div>
                </div>

                <div className="proposal-actions">
                  <button type="button" className="quotes-secondary" onClick={resetProposalForm}>Limpar</button>
                  <button type="button" className="proposal-primary" disabled={savingProposal || !proposalRequestId} onClick={createAndSendProposal}>
                    {savingProposal ? "Preparando proposta..." : "Criar proposta e enviar pelo WhatsApp"}
                  </button>
                </div>
                <p className="proposal-hint">O WhatsApp será aberto com a mensagem pronta e o link da proposta.</p>
              </>
            )}
          </section>
        )}

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
              <div className="quote-modal-actions">
                <button type="button" className="quotes-secondary quote-delete-button" onClick={() => deleteQuote(selectedQuote)}>
                  Excluir orçamento
                </button>
              </div>
            </section>
          </div>
        )}
        {message && <div className={"quotes-message " + messageType} role="status">{message}</div>}



      </section>
    </main>
  );
}
